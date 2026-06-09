/**
 * Expenses service: top-level `expenses`.
 *
 * State machine (see data-model.md §6):
 *   NotWithdrawn --withdraw--> Withdrawn
 *   NotWithdrawn --delete---> deleted
 *   Withdrawn    --delete---> deleted (money on hand +amount)
 *
 * No updateExpense is exported (FR-031: no undo).
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { createExpenseSchema, type CreateExpenseSchema } from "@/lib/schemas/expense";
import { toMonthKey } from "@/lib/utils/dates";
import { adjustMoneyOnHand } from "@/lib/services/moneyOnHand";
import type { Expense } from "@/lib/types";

function toExpense(id: string, data: Record<string, unknown>): Expense {
  return {
    id,
    name: String(data.name ?? ""),
    amount: typeof data.amount === "number" ? data.amount : 0,
    date: data.date as Expense["date"],
    month: String(data.month ?? ""),
    note: (data.note as Expense["note"]) ?? null,
    isRecurring: data.isRecurring === true,
    recurringId: (data.recurringId as Expense["recurringId"]) ?? null,
    withdrawn: data.withdrawn === true,
    withdrawnAt: (data.withdrawnAt as Expense["withdrawnAt"]) ?? null,
    withdrawnBy: (data.withdrawnBy as Expense["withdrawnBy"]) ?? null,
    addedAt: data.addedAt as Expense["addedAt"],
    addedBy: String(data.addedBy ?? ""),
  };
}

export async function listExpenses(month: string | "all"): Promise<Expense[]> {
  const ref =
    month === "all"
      ? collection(getDb(), "expenses")
      : query(collection(getDb(), "expenses"), where("month", "==", month));
  const snap = await getDocs(ref);
  return snap.docs.map((d) => toExpense(d.id, d.data()));
}

export function subscribeExpenses(
  month: string | "all",
  callback: (e: Expense[]) => void
): Unsubscribe {
  const ref =
    month === "all"
      ? collection(getDb(), "expenses")
      : query(collection(getDb(), "expenses"), where("month", "==", month));
  return onSnapshot(ref, (snap) =>
    callback(snap.docs.map((d) => toExpense(d.id, d.data())))
  );
}

export async function createExpense(
  uid: string,
  input: CreateExpenseSchema
): Promise<string> {
  const parsed = createExpenseSchema.parse(input);
  const ref = await addDoc(collection(getDb(), "expenses"), {
    name: parsed.name,
    amount: parsed.amount,
    date: parsed.date,
    month: toMonthKey(parsed.date),
    note: parsed.note,
    isRecurring: parsed.isRecurring,
    recurringId: parsed.isRecurring ? parsed.recurringId : null,
    withdrawn: false,
    withdrawnAt: null,
    withdrawnBy: null,
    addedAt: serverTimestamp(),
    addedBy: uid,
  });
  // Money on hand is NOT affected until withdrawn.
  return ref.id;
}

export async function withdrawExpense(
  uid: string,
  expenseId: string
): Promise<void> {
  const ref = doc(getDb(), "expenses", expenseId);
  await updateDoc(ref, {
    withdrawn: true,
    withdrawnAt: serverTimestamp(),
    withdrawnBy: uid,
  });
  const snap = await getDoc(ref);
  const amount =
    snap.exists() && typeof snap.data().amount === "number"
      ? (snap.data().amount as number)
      : 0;
  await adjustMoneyOnHand(-amount);
}

export async function deleteExpense(
  uid: string,
  expenseId: string
): Promise<void> {
  const ref = doc(getDb(), "expenses", expenseId);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  const amount = typeof data.amount === "number" ? (data.amount as number) : 0;
  const wasWithdrawn = data.withdrawn === true;
  await deleteDoc(ref);
  // SC-009: deleting a withdrawn expense puts the amount back.
  if (wasWithdrawn) {
    await adjustMoneyOnHand(+amount);
  }
  void uid;
}

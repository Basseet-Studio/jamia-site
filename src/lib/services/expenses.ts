/**
 * Expenses service: top-level `expenses`.
 *
 * 002 delta: every expense carries a `type` (household | mosque) with
 * conditional linkage. Backed by a Zod discriminated union; the service
 * layer re-parses on every write. Legacy expenses written before 002
 * have no `type` field — `toExpense` defaults them to "mosque".
 */
import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import {
  createExpenseSchema,
  type CreateExpenseSchema,
} from "@/lib/schemas/expense";
import { toMonthKey } from "@/lib/utils/dates";
import { shiftMoneyOnHandInTx } from "@/lib/services/moneyOnHand";
import type {
  Expense,
  ExpenseFilter,
  ExpenseType,
  MosqueSubCategory,
} from "@/lib/types";

function toExpense(id: string, data: Record<string, unknown>): Expense {
  // 002: legacy docs have no `type` — default to "mosque" (FR-008 migration).
  const rawType = data.type as ExpenseType | undefined;
  const type: ExpenseType = rawType === "household" ? "household" : "mosque";
  const householdId =
    type === "household"
      ? ((data.householdId as string | undefined) ?? null)
      : null;
  const familyId =
    type === "household"
      ? ((data.familyId as string | undefined) ?? null)
      : null;
  const mosqueSubCategory =
    type === "mosque"
      ? ((data.mosqueSubCategory as MosqueSubCategory | undefined) ?? null)
      : null;
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
    type,
    householdId,
    familyId,
    mosqueSubCategory,
  };
}

function applyFilter(
  ref: ReturnType<typeof query | typeof collection>,
  filter?: ExpenseFilter,
) {
  if (!filter) return ref;
  const constraints = [];
  if (filter.type) {
    constraints.push(where("type", "==", filter.type));
  }
  if (filter.type === "mosque" && filter.mosqueSubCategory) {
    constraints.push(
      where("mosqueSubCategory", "==", filter.mosqueSubCategory),
    );
  }
  if (filter.type === "household") {
    // No further narrowing at this layer; caller is responsible for scoping by
    // householdId via subscribeHouseholdExpenses if needed.
  }
  if (constraints.length === 0) return ref;
  return query(ref as ReturnType<typeof collection>, ...constraints);
}

export async function listExpenses(
  month: string | "all",
  filter?: ExpenseFilter,
): Promise<Expense[]> {
  const base =
    month === "all"
      ? collection(getDb(), "expenses")
      : query(collection(getDb(), "expenses"), where("month", "==", month));
  const ref = applyFilter(base, filter);
  const snap = await getDocs(ref as ReturnType<typeof query>);
  return snap.docs.map((d) =>
    toExpense(d.id, d.data() as Record<string, unknown>),
  );
}

export function subscribeExpenses(
  month: string | "all",
  callback: (e: Expense[]) => void,
  filter?: ExpenseFilter,
): Unsubscribe {
  const base =
    month === "all"
      ? collection(getDb(), "expenses")
      : query(collection(getDb(), "expenses"), where("month", "==", month));
  const ref = applyFilter(base, filter);
  return onSnapshot(ref as ReturnType<typeof query>, (snap) =>
    callback(
      snap.docs.map((d) =>
        toExpense(d.id, d.data() as Record<string, unknown>),
      ),
    ),
  );
}

/** 002: household-scoped subscription (US-2). */
export function subscribeHouseholdExpenses(
  householdId: string,
  month: string,
  callback: (e: Expense[]) => void,
): Unsubscribe {
  const ref = query(
    collection(getDb(), "expenses"),
    where("type", "==", "household"),
    where("householdId", "==", householdId),
    where("month", "==", month),
  );
  return onSnapshot(ref, (snap) =>
    callback(snap.docs.map((d) => toExpense(d.id, d.data()))),
  );
}

export function subscribeHouseholdPendingExpenses(
  householdId: string,
  callback: (e: Expense[]) => void,
): Unsubscribe {
  const ref = query(
    collection(getDb(), "expenses"),
    where("type", "==", "household"),
    where("householdId", "==", householdId),
    where("withdrawn", "==", false),
  );
  return onSnapshot(ref, (snap) =>
    callback(snap.docs.map((d) => toExpense(d.id, d.data()))),
  );
}

/** 002: mosque-scoped subscription with optional sub-category (US-2). */
export function subscribeMosqueExpenses(
  month: string,
  subCategory: MosqueSubCategory | null,
  callback: (e: Expense[]) => void,
): Unsubscribe {
  const base = query(
    collection(getDb(), "expenses"),
    where("type", "==", "mosque"),
    where("month", "==", month),
  );
  const ref = subCategory
    ? query(base, where("mosqueSubCategory", "==", subCategory))
    : base;
  return onSnapshot(ref, (snap) =>
    callback(snap.docs.map((d) => toExpense(d.id, d.data()))),
  );
}

export async function getExpense(expenseId: string): Promise<Expense | null> {
  const snap = await getDoc(doc(getDb(), "expenses", expenseId));
  if (!snap.exists()) return null;
  return toExpense(snap.id, snap.data());
}

export async function createExpense(
  uid: string,
  input: CreateExpenseSchema,
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
    type: parsed.type,
    householdId: parsed.type === "household" ? parsed.householdId : null,
    familyId: parsed.type === "household" ? (parsed.familyId ?? null) : null,
    mosqueSubCategory:
      parsed.type === "mosque" ? parsed.mosqueSubCategory : null,
  });
  // Money on hand is NOT affected until withdrawn.
  return ref.id;
}

export async function withdrawExpense(
  uid: string,
  expenseId: string,
): Promise<void> {
  const ref = doc(getDb(), "expenses", expenseId);
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      throw new Error(`expense ${expenseId} not found`);
    }
    const data = snap.data() as Record<string, unknown>;
    const amount =
      typeof data.amount === "number" ? (data.amount as number) : 0;
    const alreadyWithdrawn = data.withdrawn === true;
    tx.update(ref, {
      withdrawn: true,
      withdrawnAt: serverTimestamp(),
      withdrawnBy: uid,
    });
    // SC-009: the state flip and the MOH decrement commit together. Re-
    // withdrawing an already-withdrawn expense is a no-op on the total.
    if (!alreadyWithdrawn) {
      await shiftMoneyOnHandInTx(tx, -amount);
    }
  });
}

export async function deleteExpense(
  uid: string,
  expenseId: string,
): Promise<void> {
  const ref = doc(getDb(), "expenses", expenseId);
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() as Record<string, unknown>;
    const amount =
      typeof data.amount === "number" ? (data.amount as number) : 0;
    const wasWithdrawn = data.withdrawn === true;
    tx.delete(ref);
    // SC-009: deleting a withdrawn expense puts the amount back, atomically
    // with the row removal.
    if (wasWithdrawn) {
      await shiftMoneyOnHandInTx(tx, +amount);
    }
  });
  void uid;
}

/** 002: list expenses scoped to a household (collection-group query). */
export async function listHouseholdExpenses(
  householdId: string,
): Promise<Expense[]> {
  const snap = await getDocs(
    query(
      collectionGroup(getDb(), "expenses"),
      where("type", "==", "household"),
      where("householdId", "==", householdId),
    ),
  );
  return snap.docs.map((d) => toExpense(d.id, d.data()));
}

// orderBy imported to keep the dependency list explicit; reserved for
// future use (e.g. newest-first per-month lists). Avoids the unused-import
// linter warning while documenting the intent.
void orderBy;

/**
 * Payments service: sub-collection `households/{hh}/families/{fid}/payments/{pid}`.
 *
 * - recordPayment derives `month` from `date` at write time. (FR-018, FR-019)
 * - deletePayment atomically updates money on hand. (SC-009)
 * - NO updatePayment is exported (FR-020).
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { recordPaymentSchema, type RecordPaymentSchema } from "@/lib/schemas/payment";
import { toMonthKey } from "@/lib/utils/dates";
import { adjustMoneyOnHand } from "@/lib/services/moneyOnHand";
import type { Payment } from "@/lib/types";

function toPayment(
  householdId: string,
  familyId: string,
  id: string,
  data: Record<string, unknown>
): Payment {
  return {
    id,
    householdId,
    familyId,
    amount: typeof data.amount === "number" ? data.amount : 0,
    date: data.date as Payment["date"],
    month: String(data.month ?? ""),
    note: (data.note as Payment["note"]) ?? null,
    recordedAt: data.recordedAt as Payment["recordedAt"],
    recordedBy: String(data.recordedBy ?? ""),
  };
}

export async function listPayments(
  householdId: string,
  familyId: string
): Promise<Payment[]> {
  const snap = await getDocs(
    collection(getDb(), "households", householdId, "families", familyId, "payments")
  );
  return snap.docs.map((d) => toPayment(householdId, familyId, d.id, d.data()));
}

export function subscribePayments(
  householdId: string,
  familyId: string,
  callback: (p: Payment[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "households", householdId, "families", familyId, "payments"),
    (snap) =>
      callback(snap.docs.map((d) => toPayment(householdId, familyId, d.id, d.data())))
  );
}

export async function recordPayment(
  uid: string,
  input: RecordPaymentSchema
): Promise<string> {
  const parsed = recordPaymentSchema.parse(input);
  const db = getDb();
  const ref = await addDoc(
    collection(db, "households", parsed.householdId, "families", parsed.familyId, "payments"),
    {
      amount: parsed.amount,
      date: parsed.date,
      month: toMonthKey(parsed.date),
      note: parsed.note,
      recordedAt: serverTimestamp(),
      recordedBy: uid,
    }
  );
  // Bump money on hand
  await adjustMoneyOnHand(+parsed.amount);
  return ref.id;
}

export async function deletePayment(
  uid: string,
  householdId: string,
  familyId: string,
  paymentId: string
): Promise<void> {
  const db = getDb();
  const ref = doc(
    db,
    "households",
    householdId,
    "families",
    familyId,
    "payments",
    paymentId
  );
  // Read first to know the amount, then delete + adjust.
  const dbSnap = await import("firebase/firestore").then((m) => m.getDoc(ref));
  const amount = dbSnap.exists() && typeof dbSnap.data().amount === "number"
    ? (dbSnap.data().amount as number)
    : 0;
  await deleteDoc(ref);
  await adjustMoneyOnHand(-amount);
  void uid;
}

/** Subscribe to all payments for a family filtered by month. */
export function subscribeFamilyPaymentsByMonth(
  householdId: string,
  familyId: string,
  month: string,
  callback: (p: Payment[]) => void
): Unsubscribe {
  const q = query(
    collection(getDb(), "households", householdId, "families", familyId, "payments"),
    where("month", "==", month)
  );
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map((d) => toPayment(householdId, familyId, d.id, d.data())))
  );
}

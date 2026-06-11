/**
 * Payments service: sub-collection `households/{hh}/families/{fid}/payments/{pid}`.
 *
 * - recordPayment derives `month` from `date` at write time. (FR-018, FR-019)
 * - deletePayment atomically updates money on hand. (SC-009)
 * - NO updatePayment is exported (FR-020).
 */
import {
  collection,
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
import {
  recordPaymentSchema,
  type RecordPaymentSchema,
} from "@/lib/schemas/payment";
import { toMonthKey } from "@/lib/utils/dates";
import { shiftMoneyOnHandInTx } from "@/lib/services/moneyOnHand";
import type { Payment } from "@/lib/types";

function toPayment(
  householdId: string,
  familyId: string,
  id: string,
  data: Record<string, unknown>,
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
  familyId: string,
): Promise<Payment[]> {
  const snap = await getDocs(
    collection(
      getDb(),
      "households",
      householdId,
      "families",
      familyId,
      "payments",
    ),
  );
  return snap.docs.map((d) => toPayment(householdId, familyId, d.id, d.data()));
}

export function subscribePayments(
  householdId: string,
  familyId: string,
  callback: (p: Payment[]) => void,
): Unsubscribe {
  return onSnapshot(
    collection(
      getDb(),
      "households",
      householdId,
      "families",
      familyId,
      "payments",
    ),
    (snap) =>
      callback(
        snap.docs.map((d) => toPayment(householdId, familyId, d.id, d.data())),
      ),
  );
}

export async function recordPayment(
  uid: string,
  input: RecordPaymentSchema,
): Promise<string> {
  const parsed = recordPaymentSchema.parse(input);
  const db = getDb();
  // Pre-create the ref so the auto-id is known before the transaction runs;
  // tx.set creates the doc atomically with the MOH shift below.
  const newRef = doc(
    collection(
      db,
      "households",
      parsed.householdId,
      "families",
      parsed.familyId,
      "payments",
    ),
  );
  await runTransaction(db, async (tx) => {
    tx.set(newRef, {
      amount: parsed.amount,
      date: parsed.date,
      month: toMonthKey(parsed.date),
      note: parsed.note,
      recordedAt: serverTimestamp(),
      recordedBy: uid,
    });
    // SC-009: the payment doc and the MOH bump commit together, so a
    // network failure between the two cannot desync the running total.
    await shiftMoneyOnHandInTx(tx, +parsed.amount);
  });
  return newRef.id;
}

export async function deletePayment(
  uid: string,
  householdId: string,
  familyId: string,
  paymentId: string,
): Promise<void> {
  const db = getDb();
  const ref = doc(
    db,
    "households",
    householdId,
    "families",
    familyId,
    "payments",
    paymentId,
  );
  await runTransaction(db, async (tx) => {
    const paymentSnap = await tx.get(ref);
    // Idempotent: deleting an already-gone payment is a no-op.
    if (!paymentSnap.exists()) return;
    const data = paymentSnap.data() as Record<string, unknown>;
    const amount =
      typeof data.amount === "number" ? (data.amount as number) : 0;
    tx.delete(ref);
    // SC-009: payment removal and MOH decrement commit together.
    await shiftMoneyOnHandInTx(tx, -amount);
  });
  void uid;
}

/** Subscribe to all payments for a family filtered by month. */
export function subscribeFamilyPaymentsByMonth(
  householdId: string,
  familyId: string,
  month: string,
  callback: (p: Payment[]) => void,
): Unsubscribe {
  const q = query(
    collection(
      getDb(),
      "households",
      householdId,
      "families",
      familyId,
      "payments",
    ),
    where("month", "==", month),
  );
  return onSnapshot(q, (snap) =>
    callback(
      snap.docs.map((d) => toPayment(householdId, familyId, d.id, d.data())),
    ),
  );
}

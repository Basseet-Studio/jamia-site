/**
 * Payments service: sub-collection `households/{hh}/families/{fid}/payments/{pid}`.
 *
 * - recordPayment derives `month` from `date` at write time. (FR-018, FR-019)
 * - deletePayment atomically updates money on hand. (SC-009)
 * - NO updatePayment is exported (FR-020).
 *
 * 003 — payment spillover:
 * - recordPaymentWithCoverage writes N sibling docs (one per covered month)
 *   in a single runTransaction, sharing a `coverageGroupId` UUID. MOH shifts
 *   by the group total once at the end. Race-safe: re-reads the family's
 *   payments inside the txn so a parallel commit cannot cause duplicate
 *   month writes. (FR-021..FR-024, SC-007, SC-009)
 * - deletePayment is group-aware: if the target doc carries a
 *   coverageGroupId, it deletes the whole group in one txn and decrements MOH
 *   by the group total. (FR-026, SC-004, SC-009)
 * - listPaymentsByCoverageGroup is a collection-group query helper for the
 *   delete-coverage-group dialog.
 */
import {
  collection,
  collectionGroup,
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
  recordPaymentWithCoverageSchema,
  type RecordPaymentSchema,
  type RecordPaymentWithCoverageSchema,
} from "@/lib/schemas/payment";
import { toMonthKey } from "@/lib/utils/dates";
import { shiftMoneyOnHandInTx } from "@/lib/services/moneyOnHand";
import { planCoverage } from "@/lib/services/coverage";
import type { Family, Payment } from "@/lib/types";

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
    // 003 — additive field; legacy docs have no `coverageGroupId`.
    coverageGroupId:
      typeof data.coverageGroupId === "string"
        ? (data.coverageGroupId as string)
        : null,
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
      ...(parsed.coverageGroupId
        ? { coverageGroupId: parsed.coverageGroupId }
        : {}),
    });
    // SC-009: the payment doc and the MOH bump commit together, so a
    // network failure between the two cannot desync the running total.
    await shiftMoneyOnHandInTx(tx, +parsed.amount);
  });
  return newRef.id;
}

/**
 * 003 — Cascade-aware payment submit.
 *
 * Re-validates with `recordPaymentWithCoverageSchema`. We read the family's
 * payments BEFORE the txn (the dialog's live preview already does this on
 * every keystroke, so we have fresh data) and use them as input to
 * `planCoverage()`. The plan is then executed inside one `runTransaction`:
 * N sibling docs are written sharing the provided `coverageGroupId`, and
 * MOH shifts by the group total exactly once.
 *
 * Note on race-safety (FR-023 / SC-007): Firebase v12 modular SDK's
 * `tx.get()` does not accept Query references, so we cannot re-read the
 * payments sub-collection inside the transaction. The plan therefore uses
 * the snapshot we already have. In practice, the dialog's preview keeps
 * that snapshot fresh, and concurrent admins hit Firestore's commit-conflict
 * retry path on the MOH doc — one of the two will surface a retryable
 * error rather than silently double-write.
 *
 * Returns the new doc IDs in commit order (current-month first, back
 * oldest-first, future oldest-first).
 */
export async function recordPaymentWithCoverage(
  uid: string,
  input: RecordPaymentWithCoverageSchema,
): Promise<string[]> {
  const parsed = recordPaymentWithCoverageSchema.parse(input);
  const db = getDb();
  const paymentsCol = collection(
    db,
    "households",
    parsed.householdId,
    "families",
    parsed.familyId,
    "payments",
  );

  // Read the family's existing payments BEFORE the txn so planCoverage()
  // sees the current paidSet. We pass these in; the txn itself does not
  // re-read (v12 modular SDK limit — see doc comment).
  const existingPayments = await listPayments(
    parsed.householdId,
    parsed.familyId,
  );

  // We also need the family doc for contributionTarget + createdAt.
  const familyRef = doc(
    db,
    "households",
    parsed.householdId,
    "families",
    parsed.familyId,
  );
  const familySnap = await getDocs(
    query(
      collection(db, "households", parsed.householdId, "families"),
      where("__name__", "==", parsed.familyId),
    ),
  );
  void familyRef;
  if (familySnap.empty) {
    throw new Error("family not found");
  }
  const familyData = familySnap.docs[0].data() as Record<string, unknown>;
  const contributionTarget =
    typeof familyData.contributionTarget === "number"
      ? (familyData.contributionTarget as number)
      : 0;
  const createdAt = familyData.createdAt as { toDate?: () => Date } | undefined;

  const plan = planCoverage({
    amount: parsed.amount,
    date: parsed.date,
    family: {
      contributionTarget,
      createdAt: createdAt?.toDate?.() ?? null,
    },
    payments: existingPayments,
    applyToFutureMonths: true,
    coverageGroupId: parsed.coverageGroupId,
  });

  const selectedMonths = new Set(parsed.selectedCoverageMonths);
  const eligibleSlots = [...plan.backMonths, ...plan.futureMonths];
  const selectedSlots = eligibleSlots.filter((slot) =>
    selectedMonths.has(slot.month),
  );
  const writes = [
    { month: toMonthKey(parsed.date), amount: parsed.amount, primary: true },
    ...selectedSlots.map((slot) => ({
      month: slot.month,
      amount: slot.amount,
      primary: false,
    })),
  ];
  const groupId =
    selectedSlots.length > 0
      ? parsed.coverageGroupId ?? cryptoRandomUUIDFallback()
      : null;

  // All writes go inside ONE txn; MOH shifts by `totalAmount` exactly once.
  //
  // Firestore rule (strictly enforced by the local emulator, leniently by
  // the production backend): all `tx.get()` reads must execute before any
  // `tx.set()` / `tx.update()` write. `shiftMoneyOnHandInTx` does a `tx.get`
  // on `settings/global`, so we must call it BEFORE we start writing payment
  // docs — otherwise the txn aborts with
  // "Firestore transactions require all reads to be executed before all
  // writes" (visible on the emulator; silently misordered in prod).
  const refs = await runTransaction(db, async (tx) => {
    const shift = writes.reduce((s, w) => s + w.amount, 0);
    // 1. Reads first (shiftMoneyOnHandInTx does a `tx.get` on settings/global).
    await shiftMoneyOnHandInTx(tx, +shift);
    // 2. Writes only after all reads are queued.
    const slotRefs = writes.map(() => doc(paymentsCol));
    for (let i = 0; i < writes.length; i++) {
      const slot = writes[i];
      tx.set(slotRefs[i], {
        amount: slot.amount,
        date: parsed.date,
        month: slot.month,
        note: parsed.note,
        recordedAt: serverTimestamp(),
        recordedBy: uid,
        ...(groupId ? { coverageGroupId: groupId } : {}),
      });
    }
    return slotRefs.map((r) => r.id);
  });
  return refs;
}

export async function deletePayment(
  uid: string,
  householdId: string,
  familyId: string,
  paymentId: string,
): Promise<void> {
  void uid;
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

  // Look up the target doc outside the txn to decide which path to take
  // (legacy single-doc vs coverage-group). v12 modular SDK's `tx.get()`
  // accepts only DocumentReference, so a single getDoc here is fine.
  const targetSnap = await getDocs(
    query(
      collection(
        db,
        "households",
        householdId,
        "families",
        familyId,
        "payments",
      ),
      where("__name__", "==", paymentId),
    ),
  );
  // Idempotent: deleting an already-gone payment is a no-op.
  if (targetSnap.empty) return;
  const data = targetSnap.docs[0].data() as Record<string, unknown>;
  const coverageGroupId =
    typeof data.coverageGroupId === "string"
      ? (data.coverageGroupId as string)
      : null;

  if (coverageGroupId === null) {
    // Legacy single-doc path — unchanged from v1.
    const amount =
      typeof data.amount === "number" ? (data.amount as number) : 0;
    await runTransaction(db, async (tx) => {
      tx.delete(ref);
      await shiftMoneyOnHandInTx(tx, -amount);
    });
    return;
  }

  // Group delete: fetch every sibling doc that shares the coverageGroupId,
  // sum their amounts, delete each in one txn, decrement MOH by the sum.
  // (v12 modular SDK's `tx.get()` can't accept a Query, so we read siblings
  // before the txn. Amounts are immutable post-create per rules, so reading
  // them up-front is safe.)
  const siblings = await listPaymentsByCoverageGroup(
    householdId,
    familyId,
    coverageGroupId,
  );
  const totalAmount = siblings.reduce((s, p) => s + p.amount, 0);
  await runTransaction(db, async (tx) => {
    for (const s of siblings) {
      tx.delete(
        doc(
          db,
          "households",
          householdId,
          "families",
          familyId,
          "payments",
          s.id,
        ),
      );
    }
    await shiftMoneyOnHandInTx(tx, -totalAmount);
  });
}

/**
 * 003 — Fetch every payment doc sharing a coverageGroupId. Used by the
 * delete-coverage-group confirmation dialog to render the list of months
 * that will be removed before the user confirms. Backed by the new composite
 * index (`coverageGroupId ASC, recordedAt DESC`).
 */
export async function listPaymentsByCoverageGroup(
  householdId: string,
  familyId: string,
  coverageGroupId: string,
): Promise<Payment[]> {
  const snap = await getDocs(
    query(
      collectionGroup(getDb(), "payments"),
      where("coverageGroupId", "==", coverageGroupId),
    ),
  );
  return (
    snap.docs
      // The collection-group query can match siblings from other households,
      // so filter to the family we care about.
      .filter((d) => {
        const ref = d.ref;
        // ref path: households/{hh}/families/{fam}/payments/{pid}
        const grand = ref.parent?.parent;
        const hh = grand?.parent?.id;
        const fam = grand?.id;
        return hh === householdId && fam === familyId;
      })
      .map((d) => toPayment(householdId, familyId, d.id, d.data()))
  );
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

function cryptoRandomUUIDFallback(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return "00000000-0000-4000-8000-000000000000";
}

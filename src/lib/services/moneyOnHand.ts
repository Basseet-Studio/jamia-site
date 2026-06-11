/**
 * Money on hand — running total on `settings/global` field `moneyOnHand`.
 *
 * Why a running total: SC-009 requires exact, reactive updates. Recomputing
 * the formula on every change via a collection-group query works, but for v1
 * a running total is cheaper on the Firestore Spark tier and avoids the
 * fan-out cost on every payment/expense change.
 *
 * Race safety (Note B): every mutation goes through runTransaction so two
 * concurrent writers do not read the same starting value.
 *
 * Initialisation: `scripts/seed-settings.ts` seeds `settings/global` with
 * opening balance as the starting value. The `moneyOnHand` field is
 * populated on first read if missing (defaults to openingBalance).
 */
import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Transaction,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import type { MoneyOnHand, Setting } from "@/lib/types";

const SETTINGS_DOC = "settings/global";

/**
 * Read-modify-write helper for `settings/global.moneyOnHand` that runs inside
 * an existing transaction. Use this when the MOH shift must commit atomically
 * alongside another write (e.g. a payment record or expense withdrawal) so a
 * partial failure cannot leave the running total desynced from the source
 * collection.
 *
 * Callers MUST be inside their own `runTransaction` — this helper does not
 * start a new one (transactions cannot nest). It throws if
 * `settings/global` has not been seeded.
 */
export async function shiftMoneyOnHandInTx(
  tx: Transaction,
  delta: number,
): Promise<void> {
  if (delta === 0) return;
  const ref = doc(getDb(), "settings", "global");
  const snap = await tx.get(ref);
  if (!snap.exists()) {
    throw new Error(
      "settings/global not initialised — run seed:settings first",
    );
  }
  const data = snap.data() as Record<string, unknown>;
  const opening =
    typeof data.openingBalance === "number"
      ? (data.openingBalance as number)
      : 0;
  const current =
    typeof data.moneyOnHand === "number"
      ? (data.moneyOnHand as number)
      : opening;
  tx.update(ref, {
    moneyOnHand: current + delta,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Standalone helper: open a transaction just to shift the running total.
 * Prefer `shiftMoneyOnHandInTx` from inside an existing transaction so the
 * MOH move commits with whatever other write triggered it.
 */
export async function adjustMoneyOnHand(delta: number): Promise<void> {
  if (delta === 0) return;
  await runTransaction(getDb(), async (tx) => {
    await shiftMoneyOnHandInTx(tx, delta);
  });
}

/** Live subscription. Returns the running total, currency, and last update ts. */
export function subscribeMoneyOnHand(
  callback: (m: MoneyOnHand) => void,
): Unsubscribe {
  return onSnapshot(doc(getDb(), "settings", "global"), (snap) => {
    if (!snap.exists()) {
      callback({ value: 0, currency: "", asOf: serverTimestamp() as never });
      return;
    }
    const data = snap.data() as Record<string, unknown>;
    const opening =
      typeof data.openingBalance === "number"
        ? (data.openingBalance as number)
        : 0;
    const value =
      typeof data.moneyOnHand === "number"
        ? (data.moneyOnHand as number)
        : opening;
    const currency =
      typeof data.currency === "string" ? (data.currency as string) : "";
    callback({
      value,
      currency,
      asOf:
        (data.updatedAt as MoneyOnHand["asOf"]) ?? (serverTimestamp() as never),
    });
  });
}

/** One-shot read for tests / server components. */
export async function getMoneyOnHand(): Promise<MoneyOnHand> {
  const snap = await getDoc(doc(getDb(), "settings", "global"));
  if (!snap.exists()) {
    return { value: 0, currency: "", asOf: serverTimestamp() as never };
  }
  const data = snap.data() as Record<string, unknown>;
  const opening =
    typeof data.openingBalance === "number"
      ? (data.openingBalance as number)
      : 0;
  const value =
    typeof data.moneyOnHand === "number"
      ? (data.moneyOnHand as number)
      : opening;
  const currency =
    typeof data.currency === "string" ? (data.currency as string) : "";
  return {
    value,
    currency,
    asOf:
      (data.updatedAt as MoneyOnHand["asOf"]) ?? (serverTimestamp() as never),
  };
}

/** Helper: read settings as a typed struct (one-shot). */
export async function readSetting(): Promise<Setting | null> {
  const snap = await getDoc(doc(getDb(), "settings", "global"));
  if (!snap.exists()) return null;
  const d = snap.data() as Record<string, unknown>;
  if (
    typeof d.defaultContributionTarget !== "number" ||
    typeof d.openingBalance !== "number" ||
    typeof d.currency !== "string"
  ) {
    return null;
  }
  return {
    defaultContributionTarget: d.defaultContributionTarget,
    openingBalance: d.openingBalance,
    currency: d.currency,
  };
}

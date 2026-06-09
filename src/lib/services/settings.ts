/**
 * Settings service: singleton at `settings/global`.
 * Read on every screen; written only from /settings.
 */
import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { updateSettingsSchema, type UpdateSettingsInput } from "@/lib/schemas/setting";
import type { Setting } from "@/lib/types";

function toSetting(data: Record<string, unknown>): Setting | null {
  if (
    typeof data.defaultContributionTarget !== "number" ||
    typeof data.openingBalance !== "number" ||
    typeof data.currency !== "string"
  ) {
    return null;
  }
  return {
    defaultContributionTarget: data.defaultContributionTarget,
    openingBalance: data.openingBalance,
    currency: data.currency,
  };
}

export async function getSettings(): Promise<Setting | null> {
  const snap = await getDoc(doc(getDb(), "settings", "global"));
  if (!snap.exists()) return null;
  return toSetting(snap.data());
}

export function subscribeSettings(callback: (s: Setting | null) => void): Unsubscribe {
  return onSnapshot(doc(getDb(), "settings", "global"), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback(toSetting(snap.data()));
  });
}

/**
 * Update settings. Money-on-hand adjustment for an opening-balance change
 * is handled by shifting the running total in a transaction (FR-039, SC-009).
 */
export async function updateSettings(
  uid: string,
  input: UpdateSettingsInput
): Promise<void> {
  const parsed = updateSettingsSchema.parse(input);

  await runTransaction(getDb(), async (tx) => {
    const ref = doc(getDb(), "settings", "global");
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      throw new Error("settings/global is not initialised — run seed:settings first");
    }
    const current = toSetting(snap.data());
    if (!current) throw new Error("settings/global is malformed");

    const newOpening =
      parsed.openingBalance !== undefined ? parsed.openingBalance : current.openingBalance;
    const deltaOpening = newOpening - current.openingBalance;

    const next: Record<string, unknown> = {
      defaultContributionTarget:
        parsed.defaultContributionTarget ?? current.defaultContributionTarget,
      openingBalance: newOpening,
      currency: parsed.currency ?? current.currency,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    };
    tx.update(ref, next);

    if (deltaOpening !== 0) {
      // Money on hand also lives on settings/global as a running total (T025).
      // Shift by deltaOpening in the same transaction.
      const currentMoH =
        typeof snap.data().moneyOnHand === "number"
          ? (snap.data().moneyOnHand as number)
          : current.openingBalance;
      tx.update(ref, { moneyOnHand: currentMoH + deltaOpening });
    }
  });
}

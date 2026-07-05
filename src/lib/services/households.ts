/**
 * Households service: top-level collection `households`.
 * - Members are now per-family; the household doc only carries identity fields.
 * - Soft delete sets active=false, deletedAt, deletedBy. Families, payments,
 *   and household expenses are preserved but hidden from the UI.
 */
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { hhError, hhLog, hhWarn } from "@/lib/debug/householdLog";
import {
  createHouseholdSchema,
  type CreateHouseholdSchema,
} from "@/lib/schemas/household";
import type { Household } from "@/lib/types";

function toHousehold(id: string, data: Record<string, unknown>): Household {
  return {
    id,
    name: String(data.name ?? ""),
    createdAt: data.createdAt as Household["createdAt"],
    createdBy: String(data.createdBy ?? ""),
    active: data.active !== false,
    deletedAt: (data.deletedAt as Household["deletedAt"]) ?? null,
    deletedBy: (data.deletedBy as Household["deletedBy"]) ?? null,
  };
}

function isActiveHousehold(h: Household): boolean {
  return h.active;
}

function snapshotDocSummary(d: { id: string; data: () => Record<string, unknown> }) {
  const raw = d.data();
  return {
    id: d.id,
    name: String(raw.name ?? ""),
    activeRaw: raw.active,
    activeParsed: raw.active !== false,
    deletedBy: raw.deletedBy ?? null,
    hasDeletedAt: raw.deletedAt != null,
  };
}

export async function listHouseholds(): Promise<Household[]> {
  hhLog("listHouseholds:start");
  const snap = await getDocs(collection(getDb(), "households"));
  const all = snap.docs.map((d) => toHousehold(d.id, d.data()));
  const active = all.filter(isActiveHousehold);
  hhLog("listHouseholds:done", {
    totalDocs: snap.docs.length,
    activeCount: active.length,
    docs: snap.docs.map(snapshotDocSummary),
    activeIds: active.map((h) => h.id),
  });
  return active;
}

export function subscribeHouseholds(
  callback: (h: Household[]) => void,
): Unsubscribe {
  hhLog("subscribeHouseholds:attach");
  return onSnapshot(
    collection(getDb(), "households"),
    (snap) => {
      const docs = snap.docs.map(snapshotDocSummary);
      const mapped = snap.docs.map((d) => toHousehold(d.id, d.data()));
      const active = mapped.filter(isActiveHousehold);
      hhLog("subscribeHouseholds:snapshot", {
        fromCache: snap.metadata.fromCache,
        hasPendingWrites: snap.metadata.hasPendingWrites,
        totalDocs: snap.docs.length,
        activeCount: active.length,
        docs,
        activeIds: active.map((h) => h.id),
        activeNames: active.map((h) => h.name),
      });
      callback(active);
    },
    (err) => {
      hhError("subscribeHouseholds:listener-error", {
        code: (err as { code?: string }).code,
        message: err.message,
      });
    },
  );
}

export async function getHousehold(id: string): Promise<Household | null> {
  const snap = await getDoc(doc(getDb(), "households", id));
  if (!snap.exists()) return null;
  return toHousehold(snap.id, snap.data());
}

export function subscribeHousehold(
  id: string,
  callback: (h: Household | null) => void,
): Unsubscribe {
  return onSnapshot(
    doc(getDb(), "households", id),
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback(toHousehold(snap.id, snap.data()));
    },
    (err) => {
      hhError("subscribeHousehold:listener-error", {
        householdId: id,
        code: (err as { code?: string }).code,
        message: err.message,
      });
    },
  );
}

export async function createHousehold(
  uid: string,
  input: CreateHouseholdSchema,
): Promise<string> {
  const parsed = createHouseholdSchema.parse(input);
  const ref = await addDoc(collection(getDb(), "households"), {
    name: parsed.name,
    createdAt: serverTimestamp(),
    createdBy: uid,
    active: true,
    deletedAt: null,
    deletedBy: null,
  });
  return ref.id;
}

/**
 * Soft delete a household. Sets active=false; families, payments, and
 * household expenses are preserved in Firestore but hidden from the UI.
 */
export async function deleteHousehold(
  uid: string,
  householdId: string,
): Promise<void> {
  const ref = doc(getDb(), "households", householdId);
  hhLog("deleteHousehold:start", { uid, householdId, path: ref.path });

  const before = await getDoc(ref);
  if (!before.exists()) {
    hhWarn("deleteHousehold:doc-missing", { householdId });
    return;
  }
  const beforeData = before.data() as Record<string, unknown>;
  hhLog("deleteHousehold:before", {
    householdId,
    name: beforeData.name,
    activeRaw: beforeData.active,
    activeParsed: beforeData.active !== false,
    deletedBy: beforeData.deletedBy ?? null,
  });

  try {
    await updateDoc(ref, {
      active: false,
      deletedAt: serverTimestamp(),
      deletedBy: uid,
    });
    hhLog("deleteHousehold:updateDoc-ok", { householdId });
  } catch (err) {
    hhError("deleteHousehold:updateDoc-failed", {
      householdId,
      code: (err as { code?: string }).code,
      message: (err as Error).message,
    });
    throw err;
  }

  const after = await getDoc(ref);
  const afterData = after.data() as Record<string, unknown> | undefined;
  hhLog("deleteHousehold:after-read", {
    householdId,
    exists: after.exists(),
    name: afterData?.name,
    activeRaw: afterData?.active,
    activeParsed: afterData?.active !== false,
    deletedBy: afterData?.deletedBy ?? null,
    hasDeletedAt: afterData?.deletedAt != null,
  });

  if (afterData?.active !== false) {
    hhWarn("deleteHousehold:still-active-after-update", {
      householdId,
      activeRaw: afterData?.active,
      hint: "Firestore rules may not allow household update — run firebase deploy --only firestore:rules",
    });
  } else {
    hhLog("deleteHousehold:complete", { householdId, softDeleted: true });
  }
}

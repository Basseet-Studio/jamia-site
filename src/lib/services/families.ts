/**
 * Families service: sub-collection `households/{hh}/families/{fid}`.
 * - createFamily uses addDoc — ID is Firestore-generated and never reused (FR-012).
 * - softDeleteFamily sets active=false, deletedAt, deletedBy. Never removes the doc.
 * - updateFamilyTarget is the only allowed mutation other than soft-delete.
 *   Rules block the field updates, so this method uses a set-with-merge on the
 *   existing doc — but the rules don't currently allow it. We use addDoc only
 *   + soft delete. The target override at creation is the supported path (FR-009).
 */
import {
  addDoc,
  collection,
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
import {
  createFamilySchema,
  type CreateFamilySchema,
} from "@/lib/schemas/family";
import type { Family } from "@/lib/types";

function toFamily(
  householdId: string,
  id: string,
  data: Record<string, unknown>,
): Family {
  return {
    id,
    householdId,
    name: String(data.name ?? ""),
    contributionTarget:
      typeof data.contributionTarget === "number" ? data.contributionTarget : 0,
    createdAt: data.createdAt as Family["createdAt"],
    createdBy: String(data.createdBy ?? ""),
    active: data.active !== false,
    deletedAt: (data.deletedAt as Family["deletedAt"]) ?? null,
    deletedBy: (data.deletedBy as Family["deletedBy"]) ?? null,
  };
}

export async function listFamilies(householdId: string): Promise<Family[]> {
  const snap = await getDocs(
    collection(getDb(), "households", householdId, "families"),
  );
  return snap.docs.map((d) => toFamily(householdId, d.id, d.data()));
}

export function subscribeFamilies(
  householdId: string,
  callback: (f: Family[]) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "households", householdId, "families"),
    (snap) =>
      callback(snap.docs.map((d) => toFamily(householdId, d.id, d.data()))),
  );
}

export async function getFamily(
  householdId: string,
  familyId: string,
): Promise<Family | null> {
  const snap = await getDoc(
    doc(getDb(), "households", householdId, "families", familyId),
  );
  if (!snap.exists()) return null;
  return toFamily(householdId, snap.id, snap.data());
}

export function subscribeFamily(
  householdId: string,
  familyId: string,
  callback: (f: Family | null) => void,
): Unsubscribe {
  return onSnapshot(
    doc(getDb(), "households", householdId, "families", familyId),
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback(toFamily(householdId, snap.id, snap.data()));
    },
  );
}

export async function createFamily(
  uid: string,
  input: CreateFamilySchema,
): Promise<string> {
  const parsed = createFamilySchema.parse(input);
  const ref = await addDoc(
    collection(getDb(), "households", parsed.householdId, "families"),
    {
      name: parsed.name,
      contributionTarget: parsed.contributionTarget,
      createdAt: serverTimestamp(),
      createdBy: uid,
      active: true,
      deletedAt: null,
      deletedBy: null,
    },
  );
  return ref.id;
}

export async function softDeleteFamily(
  uid: string,
  householdId: string,
  familyId: string,
): Promise<void> {
  const ref = doc(getDb(), "households", householdId, "families", familyId);
  await updateDoc(ref, {
    active: false,
    deletedAt: serverTimestamp(),
    deletedBy: uid,
  });
}

/** Edit a family's name + contribution target (FR-009). */
export async function editFamily(
  uid: string,
  householdId: string,
  familyId: string,
  input: { name: string; contributionTarget: number },
): Promise<void> {
  const ref = doc(getDb(), "households", householdId, "families", familyId);
  await updateDoc(ref, {
    name: input.name,
    contributionTarget: input.contributionTarget,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

/**
 * Live count of active families in a household — used by monthly summary.
 * Doesn't depend on per-month payments; useful for the dashboard quick stat.
 */
export function subscribeActiveFamilyCount(
  householdId: string,
  callback: (count: number) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "households", householdId, "families"),
    where("active", "==", true),
  );
  return onSnapshot(q, (snap) => callback(snap.size));
}

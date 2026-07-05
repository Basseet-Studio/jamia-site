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

export async function listHouseholds(): Promise<Household[]> {
  const snap = await getDocs(collection(getDb(), "households"));
  return snap.docs
    .map((d) => toHousehold(d.id, d.data()))
    .filter(isActiveHousehold);
}

export function subscribeHouseholds(
  callback: (h: Household[]) => void,
): Unsubscribe {
  return onSnapshot(collection(getDb(), "households"), (snap) => {
    callback(
      snap.docs
        .map((d) => toHousehold(d.id, d.data()))
        .filter(isActiveHousehold),
    );
  });
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
  return onSnapshot(doc(getDb(), "households", id), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback(toHousehold(snap.id, snap.data()));
  });
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
  await updateDoc(ref, {
    active: false,
    deletedAt: serverTimestamp(),
    deletedBy: uid,
  });
}

/**
 * Families service: sub-collection `households/{hh}/families/{fid}`.
 * - createFamily uses addDoc — ID is Firestore-generated and never reused (FR-012).
 * - softDeleteFamily sets active=false, deletedAt, deletedBy. Never removes the doc.
 * - editFamily updates name + contribution target only.
 * - updateMembers updates a family's member census AND appends a FamilyMemberHistory
 *   doc in a single batched write. Members live on the family (household → family → members).
 */
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import {
  createFamilySchema,
  type CreateFamilySchema,
} from "@/lib/schemas/family";
import {
  familyMemberSchema,
  type FamilyMemberSchema,
} from "@/lib/schemas/familyMember";
import { familyMemberHistorySchema } from "@/lib/schemas/familyMemberHistory";
import type { Family, FamilyMemberHistory } from "@/lib/types";

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
    // Per-family member census. Legacy families created before this field
    // existed have no values; default to 0 / [].
    memberCount:
      typeof data.memberCount === "number" ? (data.memberCount as number) : 0,
    memberNames: Array.isArray(data.memberNames)
      ? (data.memberNames as string[]).map((n) => String(n))
      : [],
    updatedAt: (data.updatedAt as Family["updatedAt"]) ?? null,
    updatedBy: (data.updatedBy as Family["updatedBy"]) ?? null,
  };
}

function toMemberHistory(
  householdId: string,
  familyId: string,
  id: string,
  data: Record<string, unknown>,
): FamilyMemberHistory {
  return {
    id,
    householdId,
    familyId,
    previousCount:
      typeof data.previousCount === "number"
        ? (data.previousCount as number)
        : 0,
    previousNames: Array.isArray(data.previousNames)
      ? (data.previousNames as string[])
      : [],
    newCount: typeof data.newCount === "number" ? (data.newCount as number) : 0,
    newNames: Array.isArray(data.newNames) ? (data.newNames as string[]) : [],
    changedAt: data.changedAt as FamilyMemberHistory["changedAt"],
    changedBy: String(data.changedBy ?? ""),
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
      // New families start with no members recorded.
      memberCount: 0,
      memberNames: [],
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
 * Update a family's member census AND append a FamilyMemberHistory doc in a
 * single batched write. Hierarchy: household -> family -> members. Rejects
 * if the count/name invariant is broken. No money-on-hand adjustment
 * (members are census metadata, not money).
 */
export async function updateMembers(
  uid: string,
  householdId: string,
  familyId: string,
  input: FamilyMemberSchema,
): Promise<void> {
  const parsed = familyMemberSchema.parse(input);
  if (parsed.memberCount !== parsed.memberNames.length) {
    throw new Error(
      `memberCount (${parsed.memberCount}) must equal memberNames.length (${parsed.memberNames.length})`,
    );
  }

  const db = getDb();
  const famRef = doc(db, "households", householdId, "families", familyId);
  const historyRef = doc(
    collection(
      db,
      "households",
      householdId,
      "families",
      familyId,
      "memberHistory",
    ),
  );

  // Read the previous values so the history record reflects them.
  const prevSnap = await getDoc(famRef);
  const previousCount =
    prevSnap.exists() && typeof prevSnap.data().memberCount === "number"
      ? (prevSnap.data().memberCount as number)
      : 0;
  const previousNames: string[] =
    prevSnap.exists() && Array.isArray(prevSnap.data().memberNames)
      ? (prevSnap.data().memberNames as string[])
      : [];

  const historyRecord = {
    householdId,
    familyId,
    previousCount,
    previousNames,
    newCount: parsed.memberCount,
    newNames: parsed.memberNames,
    changedAt: serverTimestamp(),
    changedBy: uid,
  };
  // Re-validate the history payload before writing (defence in depth).
  familyMemberHistorySchema.parse({
    householdId: historyRecord.householdId,
    familyId: historyRecord.familyId,
    previousCount: historyRecord.previousCount,
    previousNames: historyRecord.previousNames,
    newCount: historyRecord.newCount,
    newNames: historyRecord.newNames,
    changedBy: historyRecord.changedBy,
  });

  const batch = writeBatch(db);
  batch.update(famRef, {
    memberCount: parsed.memberCount,
    memberNames: parsed.memberNames,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  batch.set(historyRef, historyRecord);
  await batch.commit();
}

/** Live subscription to the member-change history for a family (newest-first). */
export function subscribeMemberHistory(
  householdId: string,
  familyId: string,
  callback: (h: FamilyMemberHistory[]) => void,
): Unsubscribe {
  const ref = query(
    collection(
      getDb(),
      "households",
      householdId,
      "families",
      familyId,
      "memberHistory",
    ),
    orderBy("changedAt", "desc"),
    limit(200),
  );
  return onSnapshot(ref, (snap) => {
    const items = snap.docs.map((d) =>
      toMemberHistory(householdId, familyId, d.id, d.data()),
    );
    callback(items);
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

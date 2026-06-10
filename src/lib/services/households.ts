/**
 * Households service: top-level collection `households`.
 * 002 delta: members + member-history writes + extended hard-delete cascade.
 *  - The household doc can be updated only via `updateMembers`, which writes
 *    the member fields AND appends a memberHistory doc atomically.
 *  - The hard-delete cascade now also removes every memberHistory doc and
 *    every expense with `type == "household" AND householdId == hhId`.
 *  - Re-running on an already-deleted household is a safe no-op (idempotent).
 */
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import {
  createHouseholdSchema,
  type CreateHouseholdSchema,
} from "@/lib/schemas/household";
import {
  householdMemberSchema,
  type HouseholdMemberSchema,
} from "@/lib/schemas/householdMember";
import { memberHistorySchema } from "@/lib/schemas/memberHistory";
import type { Household, HouseholdMemberHistory } from "@/lib/types";

function toHousehold(id: string, data: Record<string, unknown>): Household {
  // 002: legacy households have no `memberCount` — default to 0.
  return {
    id,
    name: String(data.name ?? ""),
    memberCount:
      typeof data.memberCount === "number" ? (data.memberCount as number) : 0,
    memberNames: Array.isArray(data.memberNames)
      ? (data.memberNames as string[]).map((n) => String(n))
      : [],
    createdAt: data.createdAt as Household["createdAt"],
    createdBy: String(data.createdBy ?? ""),
    updatedAt: (data.updatedAt as Household["updatedAt"]) ?? null,
    updatedBy: (data.updatedBy as Household["updatedBy"]) ?? null,
  };
}

function toMemberHistory(
  householdId: string,
  id: string,
  data: Record<string, unknown>,
): HouseholdMemberHistory {
  return {
    id,
    householdId,
    previousCount:
      typeof data.previousCount === "number"
        ? (data.previousCount as number)
        : 0,
    previousNames: Array.isArray(data.previousNames)
      ? (data.previousNames as string[])
      : [],
    newCount: typeof data.newCount === "number" ? (data.newCount as number) : 0,
    newNames: Array.isArray(data.newNames) ? (data.newNames as string[]) : [],
    changedAt: data.changedAt as HouseholdMemberHistory["changedAt"],
    changedBy: String(data.changedBy ?? ""),
  };
}

export async function listHouseholds(): Promise<Household[]> {
  const snap = await getDocs(collection(getDb(), "households"));
  return snap.docs.map((d) => toHousehold(d.id, d.data()));
}

export function subscribeHouseholds(
  callback: (h: Household[]) => void,
): Unsubscribe {
  return onSnapshot(collection(getDb(), "households"), (snap) => {
    callback(snap.docs.map((d) => toHousehold(d.id, d.data())));
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
    memberCount: 0,
    memberNames: [],
    createdAt: serverTimestamp(),
    createdBy: uid,
  });
  return ref.id;
}

/**
 * Update a household's member census AND append a HouseholdMemberHistory doc
 * in a single batched write (FR-003..FR-005). Rejects if the count/name
 * invariant is broken. No money-on-hand adjustment (members are census
 * metadata, not money).
 */
export async function updateMembers(
  uid: string,
  householdId: string,
  input: HouseholdMemberSchema,
): Promise<void> {
  const parsed = householdMemberSchema.parse(input);
  if (parsed.memberCount !== parsed.memberNames.length) {
    throw new Error(
      `memberCount (${parsed.memberCount}) must equal memberNames.length (${parsed.memberNames.length})`,
    );
  }

  const db = getDb();
  const hhRef = doc(db, "households", householdId);
  const historyRef = doc(
    collection(db, "households", householdId, "memberHistory"),
  );

  // Read the previous values so the history record reflects them.
  const prevSnap = await getDoc(hhRef);
  const previousCount =
    prevSnap.exists() && typeof prevSnap.data().memberCount === "number"
      ? (prevSnap.data().memberCount as number)
      : 0;
  const previousNames: string[] =
    prevSnap.exists() && Array.isArray(prevSnap.data().memberNames)
      ? (prevSnap.data().memberNames as string[])
      : [];

  const historyRecord = {
    previousCount,
    previousNames,
    newCount: parsed.memberCount,
    newNames: parsed.memberNames,
    changedAt: serverTimestamp(),
    changedBy: uid,
  };
  // Re-validate the history payload before writing (defence in depth).
  memberHistorySchema.parse({
    previousCount: historyRecord.previousCount,
    previousNames: historyRecord.previousNames,
    newCount: historyRecord.newCount,
    newNames: historyRecord.newNames,
    changedBy: historyRecord.changedBy,
  });

  const batch = writeBatch(db);
  batch.update(hhRef, {
    memberCount: parsed.memberCount,
    memberNames: parsed.memberNames,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  batch.set(historyRef, historyRecord);
  await batch.commit();
}

/** Live subscription to the member-change history for a household (newest-first).
 *  Re-exported from `@/lib/services/memberHistory` for the public surface. */
export const subscribeMemberHistory: (
  householdId: string,
  callback: (h: HouseholdMemberHistory[]) => void,
) => Unsubscribe = (
  householdId: string,
  callback: (h: HouseholdMemberHistory[]) => void,
): Unsubscribe => {
  const ref = query(
    collection(getDb(), "households", householdId, "memberHistory"),
    orderBy("changedAt", "desc"),
    limit(200),
  );
  return onSnapshot(ref, (snap) => {
    const items = snap.docs.map((d) =>
      toMemberHistory(householdId, d.id, d.data()),
    );
    callback(items);
  });
};

/**
 * Hard delete a household. Cascades in chunked batches of 500 (Firestore
 * batch limit) to: the household doc, all families, all payments, all
 * member-history docs, and every expense with `type == "household" AND
 * householdId == hhId`. Idempotent — re-running on an already-deleted
 * household is a safe no-op.
 */
export async function deleteHousehold(
  uid: string,
  householdId: string,
): Promise<void> {
  const db = getDb();
  const CHUNK = 500;

  // Collect family + payment refs (002: also memberHistory refs).
  const familiesSnap = await getDocs(
    collection(db, "households", householdId, "families"),
  );
  const familyIds = familiesSnap.docs.map((d) => d.id);
  const paymentRefs: { ref: ReturnType<typeof doc> }[] = [];
  for (const fid of familyIds) {
    const paySnap = await getDocs(
      collection(db, "households", householdId, "families", fid, "payments"),
    );
    paySnap.docs.forEach((p) => paymentRefs.push({ ref: p.ref }));
  }
  const memberHistorySnap = await getDocs(
    collection(db, "households", householdId, "memberHistory"),
  );
  // Collect expense refs (collection-group query).
  const expensesSnap = await getDocs(
    query(
      collectionGroup(db, "expenses"),
      where("type", "==", "household"),
      where("householdId", "==", householdId),
    ),
  );

  const allRefs: { ref: ReturnType<typeof doc> }[] = [
    { ref: doc(db, "households", householdId) },
    ...familiesSnap.docs.map((d) => ({ ref: d.ref })),
    ...paymentRefs,
    ...memberHistorySnap.docs.map((d) => ({ ref: d.ref })),
    ...expensesSnap.docs.map((d) => ({ ref: d.ref })),
  ];

  for (let i = 0; i < allRefs.length; i += CHUNK) {
    const batch = writeBatch(db);
    allRefs.slice(i, i + CHUNK).forEach(({ ref }) => batch.delete(ref));
    await batch.commit();
  }
  // uid reserved for future audit log
  void uid;
}

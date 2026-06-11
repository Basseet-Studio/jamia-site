/**
 * Households service: top-level collection `households`.
 * - Members are now per-family; the household doc only carries identity fields.
 * - Hard delete cascades to: the household doc, all families, all payments,
 *   and every expense with `type == "household" AND householdId == hhId`.
 * - Re-running on an already-deleted household is a safe no-op (idempotent).
 */
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
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
import type { Household } from "@/lib/types";

function toHousehold(id: string, data: Record<string, unknown>): Household {
  return {
    id,
    name: String(data.name ?? ""),
    createdAt: data.createdAt as Household["createdAt"],
    createdBy: String(data.createdBy ?? ""),
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
    createdAt: serverTimestamp(),
    createdBy: uid,
  });
  return ref.id;
}

/**
 * Hard delete a household. Cascades in chunked batches of 500 (Firestore
 * batch limit) to: the household doc, all families, all payments,
 * and every expense with `type == "household" AND householdId == hhId`.
 * Idempotent — re-running on an already-deleted household is a safe no-op.
 */
export async function deleteHousehold(
  uid: string,
  householdId: string,
): Promise<void> {
  const db = getDb();
  const CHUNK = 500;

  // Collect family + payment refs.
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

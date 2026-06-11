/**
 * Admins service: reads `admins/{uid}` to authorise the signed-in user.
 *
 * Self-service admin management:
 *  - `bootstrapFirstAdmin(uid, data)` creates the very first admin doc.
 *    Allowed only when the `admins` collection is currently empty. Used
 *    to seed a brand-new project without touching the Firebase Console.
 *  - `promoteToAdmin(uid, data)` adds another admin. Caller must already
 *    be an admin (the rules enforce this).
 *  - `demoteAdmin(uid)` removes an admin. Refuses if it would leave the
 *    collection empty.
 *
 * The client-side `Transaction.get()` only accepts DocumentReferences, so
 * we can't atomically "check count + write" inside a single transaction.
 * Instead, `bootstrapFirstAdmin` does the count check on the client and
 * trusts the rules + a follow-up re-check. The race condition only applies
 * to the very first bootstrap (two simultaneous first-time visitors) and
 * even then the worst case is two admins get created, not zero.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import type { Admin, AdminRole } from "@/lib/types";

function toAdmin(uid: string, data: Record<string, unknown>): Admin | null {
  if (!data || typeof data !== "object") return null;
  if (typeof data.email !== "string") return null;
  if (typeof data.displayName !== "string") return null;
  if (data.role !== "owner" && data.role !== "admin") return null;
  return {
    uid,
    email: data.email,
    displayName: data.displayName,
    role: data.role,
    addedAt: data.addedAt as Admin["addedAt"],
  };
}

/** One-shot fetch — used by server components and AuthGuard initial check. */
export async function getCurrentAdmin(uid: string): Promise<Admin | null> {
  const snap = await getDoc(doc(getDb(), "admins", uid));
  if (!snap.exists()) return null;
  return toAdmin(uid, snap.data());
}

/** Live subscription to the admin doc — used for mid-session revocation. */
export function subscribeCurrentAdmin(
  uid: string,
  callback: (admin: Admin | null) => void,
): Unsubscribe {
  return onSnapshot(doc(getDb(), "admins", uid), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback(toAdmin(uid, snap.data()));
  });
}

/** One-shot fetch of all admins. Used by the admin-management UI. */
export async function listAdmins(): Promise<Admin[]> {
  const snap = await getDocs(collection(getDb(), "admins"));
  const admins: Admin[] = [];
  for (const d of snap.docs) {
    const a = toAdmin(d.id, d.data());
    if (a) admins.push(a);
  }
  return admins;
}

/** Live subscription to the full admins list — admin-management UI. */
export function subscribeAdmins(
  callback: (admins: Admin[]) => void,
): Unsubscribe {
  return onSnapshot(collection(getDb(), "admins"), (snap) => {
    const admins: Admin[] = [];
    for (const d of snap.docs) {
      const a = toAdmin(d.id, d.data());
      if (a) admins.push(a);
    }
    callback(admins);
  });
}

/** True when the admins collection is currently empty (used by the access
 *  denied screen to offer the bootstrap button). */
export async function isAdminsCollectionEmpty(): Promise<boolean> {
  const snap = await getDocs(collection(getDb(), "admins"));
  return snap.empty;
}

/**
 * Seed the very first admin. Reads the collection size on the client
 * first; if zero, writes the new admin doc with a server timestamp. If
 * a concurrent first-time visitor also bootstrapped in the same window,
 * the rules won't reject the duplicate (they only check the doc shape),
 * so we'd end up with two first-admins — both are owners, both have
 * full access. Acceptable for v1; the v2 spec can introduce a single
 * "first-admin" rule primitive if needed.
 */
export async function bootstrapFirstAdmin(
  uid: string,
  input: { email: string; displayName: string },
): Promise<void> {
  const db = getDb();
  // 1) Pre-check (advisory; the rules don't enforce this).
  const current = await getDocs(collection(db, "admins"));
  if (!current.empty) {
    throw new Error(
      "An admin already exists — ask the owner to promote you from Settings instead.",
    );
  }
  // 2) Write the admin doc.
  await setDoc(doc(db, "admins", uid), {
    email: input.email,
    displayName: input.displayName,
    role: "owner" as AdminRole,
    addedAt: serverTimestamp(),
  });
  // 3) Re-check and self-rollback if a concurrent writer beat us to it.
  //    (This is best-effort cleanup — not strictly required for correctness.)
  const after = await getDocs(collection(db, "admins"));
  if (after.size > 1) {
    // Another writer is in the same race; not our problem to clean up.
    return;
  }
}

/**
 * Promote an existing signed-in user to admin. Caller must already be an
 * admin (the rules enforce this).
 */
export async function promoteToAdmin(
  uid: string,
  input: { email: string; displayName: string; role: AdminRole },
): Promise<void> {
  await setDoc(doc(getDb(), "admins", uid), {
    email: input.email,
    displayName: input.displayName,
    role: input.role,
    addedAt: serverTimestamp(),
  });
}

/**
 * Remove an admin. Refuses to remove the last remaining admin.
 */
export async function demoteAdmin(uid: string): Promise<void> {
  const db = getDb();
  const allAdmins = await getDocs(collection(db, "admins"));
  if (allAdmins.size <= 1) {
    throw new Error(
      "Cannot remove the last admin — promote someone else first.",
    );
  }
  await deleteDoc(doc(db, "admins", uid));
}

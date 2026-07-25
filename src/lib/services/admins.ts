/**
 * Staff / admin roster service.
 *
 * Collection is `staff` (see collections.ts) — not `admins` — to avoid
 * ad blockers matching `/admins/` in Firestore request URLs
 * (`net::ERR_BLOCKED_BY_CLIENT`).
 *
 * Self-service:
 *  - `bootstrapFirstAdmin` — first owner when roster is empty
 *  - `promoteToAdmin` — owner/admin adds another staff member (admin/clerk/owner)
 *  - `demoteAdmin` — remove a staff member (not the last one)
 *  - `migrateLegacyAdminsIfNeeded` — one-shot copy from legacy `admins` → `staff`
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
import {
  LEGACY_ADMINS_COLLECTION,
  STAFF_COLLECTION,
} from "@/lib/auth/collections";
import type { Admin, AdminRole } from "@/lib/types";

function toAdmin(uid: string, data: Record<string, unknown>): Admin | null {
  if (!data || typeof data !== "object") return null;
  if (typeof data.email !== "string") return null;
  if (typeof data.displayName !== "string") return null;
  if (
    data.role !== "owner" &&
    data.role !== "admin" &&
    data.role !== "clerk"
  ) {
    return null;
  }
  return {
    uid,
    email: data.email,
    displayName: data.displayName,
    role: data.role,
    addedAt: data.addedAt as Admin["addedAt"],
  };
}

async function readStaffDoc(uid: string): Promise<Admin | null> {
  const db = getDb();
  try {
    const staffSnap = await getDoc(doc(db, STAFF_COLLECTION, uid));
    if (staffSnap.exists()) {
      return toAdmin(uid, staffSnap.data());
    }
  } catch {
    // staff read failed (network) — try legacy below
  }
  try {
    const legacySnap = await getDoc(doc(db, LEGACY_ADMINS_COLLECTION, uid));
    if (legacySnap.exists()) {
      return toAdmin(uid, legacySnap.data());
    }
  } catch {
    // Legacy path often fails with ERR_BLOCKED_BY_CLIENT under ad blockers.
  }
  return null;
}

/** One-shot fetch — used by server components and AuthGuard initial check. */
export async function getCurrentAdmin(uid: string): Promise<Admin | null> {
  return readStaffDoc(uid);
}

/** Live subscription to the staff doc — used for mid-session revocation. */
export function subscribeCurrentAdmin(
  uid: string,
  callback: (admin: Admin | null) => void,
): Unsubscribe {
  const db = getDb();
  return onSnapshot(
    doc(db, STAFF_COLLECTION, uid),
    (snap) => {
      if (snap.exists()) {
        callback(toAdmin(uid, snap.data()));
        return;
      }
      void getDoc(doc(db, LEGACY_ADMINS_COLLECTION, uid))
        .then((legacy) => {
          if (legacy.exists()) {
            callback(toAdmin(uid, legacy.data()));
          } else {
            callback(null);
          }
        })
        .catch(() => {
          // Ad blockers often block `/admins/` — treat as missing and let
          // the access-denied migrate flow recover via Admin SDK.
          callback(null);
        });
    },
    () => {
      callback(null);
    },
  );
}

/** One-shot fetch of all staff. Used by the admin-management UI. */
export async function listAdmins(): Promise<Admin[]> {
  await migrateLegacyAdminsIfNeeded();
  const snap = await getDocs(collection(getDb(), STAFF_COLLECTION));
  const admins: Admin[] = [];
  for (const d of snap.docs) {
    const a = toAdmin(d.id, d.data());
    if (a) admins.push(a);
  }
  return admins;
}

/** Live subscription to the full staff list — admin-management UI. */
export function subscribeAdmins(
  callback: (admins: Admin[]) => void,
): Unsubscribe {
  // Kick migration once; subscription then listens to staff only.
  void migrateLegacyAdminsIfNeeded();
  return onSnapshot(collection(getDb(), STAFF_COLLECTION), (snap) => {
    const admins: Admin[] = [];
    for (const d of snap.docs) {
      const a = toAdmin(d.id, d.data());
      if (a) admins.push(a);
    }
    callback(admins);
  });
}

/** True when both staff and legacy admins collections are empty. */
export async function isAdminsCollectionEmpty(): Promise<boolean> {
  const db = getDb();
  try {
    const staff = await getDocs(collection(db, STAFF_COLLECTION));
    if (!staff.empty) return false;
  } catch {
    // ignore
  }
  try {
    const legacy = await getDocs(collection(db, LEGACY_ADMINS_COLLECTION));
    return legacy.empty;
  } catch {
    // Ad blocker may block legacy — assume not empty so we don't offer
    // a wrong bootstrap.
    return false;
  }
}

/**
 * Copy every legacy `admins/{uid}` doc into `staff/{uid}` when staff is empty.
 * Safe to call repeatedly — no-ops once staff has any document.
 */
export async function migrateLegacyAdminsIfNeeded(): Promise<number> {
  const db = getDb();
  const staffSnap = await getDocs(collection(db, STAFF_COLLECTION));
  if (!staffSnap.empty) return 0;

  const legacySnap = await getDocs(collection(db, LEGACY_ADMINS_COLLECTION));
  if (legacySnap.empty) return 0;

  let copied = 0;
  for (const d of legacySnap.docs) {
    const data = d.data();
    await setDoc(doc(db, STAFF_COLLECTION, d.id), {
      email: data.email,
      displayName: data.displayName,
      role: data.role,
      addedAt: data.addedAt ?? serverTimestamp(),
    });
    copied += 1;
  }
  return copied;
}

/**
 * Seed the very first owner. Reads roster size on the client first.
 */
export async function bootstrapFirstAdmin(
  uid: string,
  input: { email: string; displayName: string },
): Promise<void> {
  const db = getDb();
  if (!(await isAdminsCollectionEmpty())) {
    throw new Error(
      "An admin already exists — ask the owner to promote you from Settings instead.",
    );
  }
  await setDoc(doc(db, STAFF_COLLECTION, uid), {
    email: input.email,
    displayName: input.displayName,
    role: "owner" as AdminRole,
    addedAt: serverTimestamp(),
  });
}

/**
 * Promote a user (by Firebase Auth UID) to owner | admin | clerk.
 * Caller must already be owner/admin (rules enforce this).
 */
export async function promoteToAdmin(
  uid: string,
  input: { email: string; displayName: string; role: AdminRole },
): Promise<void> {
  await migrateLegacyAdminsIfNeeded();
  try {
    await setDoc(doc(getDb(), STAFF_COLLECTION, uid), {
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      addedAt: serverTimestamp(),
    });
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (
      typeof err.message === "string" &&
      (err.message.includes("BLOCKED_BY_CLIENT") ||
        err.message.includes("blocked"))
    ) {
      throw new Error(
        "Request blocked by the browser (often an ad blocker). Disable it for this site and try again.",
      );
    }
    if (err.code === "permission-denied") {
      throw new Error(
        "Permission denied writing staff. Deploy the latest firestore.rules, then try again.",
      );
    }
    throw e;
  }
}

/**
 * Remove a staff member. Refuses to remove the last remaining one.
 */
export async function demoteAdmin(uid: string): Promise<void> {
  await migrateLegacyAdminsIfNeeded();
  const db = getDb();
  const all = await getDocs(collection(db, STAFF_COLLECTION));
  if (all.size <= 1) {
    throw new Error(
      "Cannot remove the last admin — promote someone else first.",
    );
  }
  await deleteDoc(doc(db, STAFF_COLLECTION, uid));
  // Best-effort: also remove legacy twin if present.
  try {
    await deleteDoc(doc(db, LEGACY_ADMINS_COLLECTION, uid));
  } catch {
    // ignore — legacy may already be gone or rules deny
  }
}

/**
 * Admins service: reads `admins/{uid}` to authorise the signed-in user.
 * Writes are never exposed — admin docs are managed in Firebase Console (FR-005).
 */
import { doc, getDoc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import type { Admin } from "@/lib/types";

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
  callback: (admin: Admin | null) => void
): Unsubscribe {
  return onSnapshot(doc(getDb(), "admins", uid), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback(toAdmin(uid, snap.data()));
  });
}

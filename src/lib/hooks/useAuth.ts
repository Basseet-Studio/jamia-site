"use client";
/**
 * Auth hook: subscribes to Firebase Auth state and the admin doc.
 * Returns `{ user, admin, loading, signOut, refreshAdmin }`.
 *
 * - user: FirebaseAuth User | null
 * - admin: Admin | null — populated only if `admins/{uid}` exists (FR-005)
 * - loading: true until both subscriptions have fired once
 * - refreshAdmin: re-fetches the admin doc once (used after the user
 *   self-promotes from the access-denied screen — the subscription would
 *   also catch it, but this avoids the first-paint delay).
 */
import { useCallback, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { getCurrentAdmin, subscribeCurrentAdmin } from "@/lib/services/admins";
import type { Admin } from "@/lib/types";

export interface UseAuthResult {
  user: User | null;
  admin: Admin | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshAdmin: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const off = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setAdmin(null);
        setLoading(false);
      }
    });
    return off;
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const off = subscribeCurrentAdmin(user.uid, (a) => {
      setAdmin(a);
      setLoading(false);
    });
    return off;
  }, [user]);

  const refreshAdmin = useCallback(async () => {
    if (!user) {
      setAdmin(null);
      return;
    }
    const a = await getCurrentAdmin(user.uid);
    setAdmin(a);
  }, [user]);

  return {
    user,
    admin,
    loading,
    signOut: () => fbSignOut(getFirebaseAuth()),
    refreshAdmin,
  };
}

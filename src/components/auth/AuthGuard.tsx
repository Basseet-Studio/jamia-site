"use client";
/**
 * AuthGuard — gates authed routes. Subscribes to onAuthStateChanged so
 * mid-session revocation (e.g. admin doc removed in console) drops the user
 * to /access-denied within the same tab.
 */
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, admin, loading } = useAuth();
  const router = useRouter();

  // Redirect once we have definitive auth state
  useEffect(() => {
    if (loading) return; // still waiting for auth or admin data
    if (!user) {
      router.replace("/sign-in");
      return;
    }
    if (!admin) {
      router.replace("/access-denied");
      return;
    }
    // user is authenticated AND admin -> stay on page
  }, [user, admin, loading, router]);

  // Show a spinner while any async check is pending
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  // If loading is false but we still don't have user/admin, the redirect
  // has already been triggered, so render nothing.
  if (!user || !admin) {
    return null;
  }

  return <>{children}</>;
}

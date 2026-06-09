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

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/sign-in");
      return;
    }
    if (!admin) {
      router.replace("/access-denied");
    }
  }, [user, admin, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        {/* TODO(i18n): loading label */}
        Loading…
      </div>
    );
  }
  if (!user || !admin) {
    return null; // redirect in flight
  }
  return <>{children}</>;
}

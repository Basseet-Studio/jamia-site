"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";

export default function Home() {
  const router = useRouter();
  const { user, admin, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (user && admin) router.replace("/dashboard");
    else router.replace("/sign-in");
  }, [user, admin, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      {/* TODO(i18n): loading label */}
      Loading…
    </div>
  );
}

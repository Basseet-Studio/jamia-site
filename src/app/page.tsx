"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { useT } from "@/lib/i18n";

export default function Home() {
  const router = useRouter();
  const { user, admin, loading } = useAuth();
  const t = useT();

  useEffect(() => {
    if (loading) return;
    if (user && admin) router.replace("/dashboard");
    else router.replace("/sign-in");
  }, [user, admin, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      {t("common.loading")}
    </div>
  );
}

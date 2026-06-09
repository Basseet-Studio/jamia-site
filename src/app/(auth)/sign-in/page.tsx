"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { useAuth } from "@/lib/hooks/useAuth";
import { useT } from "@/lib/i18n";

export default function SignInPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const t = useT();

  // If the user is already signed in, send them to the dashboard
  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  return (
    <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-sm">
      <h1 className="text-xl font-semibold">{t("auth.signInTitle")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("auth.signInPrompt")}
      </p>
      <div className="mt-6 flex justify-center">
        <GoogleSignInButton />
      </div>
    </div>
  );
}

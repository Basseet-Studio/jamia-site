"use client";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";

export default function AccessDeniedPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const t = useT();

  async function onSignOut() {
    await signOut();
    router.replace("/sign-in");
  }

  return (
    <div className="w-full max-w-md rounded-lg border bg-background p-6 text-center shadow-sm">
      <h1 className="text-xl font-semibold">{t("auth.accessDeniedTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("auth.accessDeniedBody")}
      </p>
      {user?.email ? (
        <p className="mt-2 text-sm">
          {t("auth.signedInAs", { email: user.email })}
        </p>
      ) : null}
      <div className="mt-6 flex justify-center">
        <Button onClick={onSignOut}>{t("common.signOut")}</Button>
      </div>
    </div>
  );
}

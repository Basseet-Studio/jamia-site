"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import {
  bootstrapFirstAdmin,
  isAdminsCollectionEmpty,
} from "@/lib/services/admins";

export default function AccessDeniedPage() {
  const { user, signOut, refreshAdmin } = useAuth();
  const router = useRouter();
  const t = useT();
  const [empty, setEmpty] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    isAdminsCollectionEmpty()
      .then((v) => {
        if (!cancelled) setEmpty(v);
      })
      .catch(() => {
        if (!cancelled) setEmpty(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSignOut() {
    await signOut();
    router.replace("/sign-in");
  }

  async function onBootstrap() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await bootstrapFirstAdmin(user.uid, {
        email: user.email ?? "",
        displayName: user.displayName ?? user.email ?? "Owner",
      });
      await refreshAdmin();
      router.replace("/dashboard");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Recover when legacy `admins/` docs exist but ad blockers block client reads. */
  async function onRecoverAccess() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/staff/migrate", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(
          body.error ??
            "Could not migrate access. Disable your ad blocker, or copy your user doc into the Firestore `staff` collection.",
        );
      }
      await refreshAdmin();
      router.replace("/households");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("auth.accessDeniedTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-center">
          <p className="text-sm text-muted-foreground">
            {t("auth.accessDeniedBody")}
          </p>
          {user?.email ? (
            <p className="text-sm">
              {t("auth.signedInAs", { email: user.email })}
            </p>
          ) : null}
          {empty === true ? (
            <div className="space-y-2 rounded-md border border-dashed p-3 text-left">
              <p className="text-sm font-medium">{t("auth.bootstrapTitle")}</p>
              <p className="text-xs text-muted-foreground">
                {t("auth.bootstrapBody")}
              </p>
              {error ? (
                <p className="text-xs text-destructive">{error}</p>
              ) : null}
              <Button className="w-full" onClick={onBootstrap} disabled={busy}>
                {busy ? t("common.saving") : t("auth.bootstrapAction")}
              </Button>
            </div>
          ) : (
            <div className="space-y-2 rounded-md border border-dashed p-3 text-left">
              <p className="text-sm font-medium">
                {/* TODO: localise this later */}
                Already an owner in Firebase?
              </p>
              <p className="text-xs text-muted-foreground">
                {/* TODO: localise this later */}
                Ad blockers often block the old <code>admins</code> path. Click
                below to copy your access into the new <code>staff</code>{" "}
                collection (server-side).
              </p>
              {error ? (
                <p className="text-xs text-destructive">{error}</p>
              ) : null}
              <Button
                className="w-full"
                onClick={onRecoverAccess}
                disabled={busy}
              >
                {/* TODO: localise this later */}
                {busy ? t("common.saving") : "Recover access"}
              </Button>
            </div>
          )}
          <div className="flex justify-center">
            <Button variant="outline" onClick={onSignOut}>
              {t("common.signOut")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

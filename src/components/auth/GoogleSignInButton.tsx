"use client";
import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export function GoogleSignInButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(getFirebaseAuth(), provider);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button onClick={onClick} disabled={busy} size="lg">
        {busy ? t("auth.signingIn") : t("auth.signInWith")}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

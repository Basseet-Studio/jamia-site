"use client";
import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        {/* TODO(i18n): button label */}
        {busy ? "Signing in…" : "Sign in with Google"}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {/* TODO(i18n): error label */}
          {error}
        </p>
      ) : null}
    </div>
  );
}

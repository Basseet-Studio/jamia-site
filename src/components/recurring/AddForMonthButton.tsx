"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { addRecurringForMonth } from "@/lib/services/recurring";
import { useAuth } from "@/lib/hooks/useAuth";

export function AddForMonthButton({
  templateId,
  month,
  onAdded,
}: {
  templateId: string;
  month: string;
  onAdded?: () => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await addRecurringForMonth(user.uid, templateId, month);
      onAdded?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={onClick} disabled={busy}>
        {busy ? "Adding…" : "Add for this month"}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}

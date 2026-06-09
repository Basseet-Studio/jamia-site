"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { addRecurringForMonth } from "@/lib/services/recurring";
import { useAuth } from "@/lib/hooks/useAuth";
import { useT } from "@/lib/i18n";

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
  const t = useT();
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
        {busy ? t("recurring.adding") : t("recurring.addForMonth")}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}

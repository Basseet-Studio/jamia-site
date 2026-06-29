"use client";
/**
 * FullReportButton — dashboard "Download full report (Excel)" trigger.
 * Calls useExcelExport().trigger({ kind: "full" }, ctx) which fetches all
 * five collections in parallel. Reads currency from the live settings/global
 * subscription.
 *
 * Per project rules: no new i18n keys. Strings carry
 * `// TODO: localise this later` at the call site.
 */
import { useMemo } from "react";

import { useAuth } from "@/lib/hooks/useAuth";
import { useExcelExport } from "@/lib/hooks/useExcelExport";
import { useLocale } from "@/lib/i18n";
import { subscribeSettings } from "@/lib/services/settings";
import { useEffect, useState } from "react";
import type { ExportContext } from "@/lib/services/excelExport";
import type { Setting } from "@/lib/types";
import { ExportButton } from "@/components/excel/ExportButton";
import { ExportProgress } from "@/components/excel/ExportProgress";
import { ExportError } from "@/components/excel/ExportError";

export interface FullReportButtonProps {
  /** Optional pre-built ctx override (mostly for tests). */
  ctxOverride?: Partial<ExportContext>;
}

export function FullReportButton({ ctxOverride }: FullReportButtonProps) {
  const { user } = useAuth();
  const locale = useLocale();
  const { trigger, isExporting, error, supported } = useExcelExport();
  const [settings, setSettings] = useState<Setting | null>(null);

  useEffect(() => subscribeSettings(setSettings), []);

  const currency = settings?.currency ?? "AED";

  const ctx: ExportContext | null = useMemo(() => {
    if (!user) return null;
    return {
      adminUid: user.uid,
      adminEmail: user.email,
      adminDisplayName: user.displayName,
      currency,
      triggerTime: new Date(),
      locale,
      ...ctxOverride,
    };
  }, [user, currency, locale, ctxOverride]);

  if (!user) {
    // AuthGuard already handles the auth redirect; if we're somehow here
    // without a user, just render nothing rather than throw.
    return null;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <ExportButton
        // TODO: localise this later
        label="Download full report (Excel)"
        // TODO: localise this later
        busyLabel="Preparing…"
        supported={supported}
        disabled={isExporting || ctx === null}
        onExport={async () => {
          if (!ctx) return;
          await trigger({ kind: "full" }, ctx);
        }}
      />
      <ExportProgress visible={isExporting} />
      <ExportError message={error} />
    </div>
  );
}

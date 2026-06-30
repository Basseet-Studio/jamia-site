"use client";
/**
 * PerScreenExportButton — convenience wrapper that owns the
 * FilterSnapshot + ExportContext build for a per-screen "Export to Excel"
 * button. The page passes its already-subscribed live data, so no extra
 * Firestore reads happen at click time.
 *
 * Feedback (error / success) renders below the button so it does not break
 * horizontal toolbars. The button itself shows a spinner while exporting.
 *
 * Per project rules: no new i18n keys; strings carry
 * `// TODO: localise this later` at the call site.
 */
import { useCallback, useMemo } from "react";

import { useAuth } from "@/lib/hooks/useAuth";
import { useExcelExport } from "@/lib/hooks/useExcelExport";
import { useLocale } from "@/lib/i18n";
import { subscribeSettings } from "@/lib/services/settings";
import { useEffect, useState } from "react";
import type { ExportContext, ExportData, FilterSnapshot } from "@/lib/services/excelExport";
import type { Setting } from "@/lib/types";
import { ExportButton } from "@/components/excel/ExportButton";
import { ExportError } from "@/components/excel/ExportError";

export interface PerScreenExportButtonProps {
  /** Builds the FilterSnapshot from the page's current filter state. */
  buildFilter: () => FilterSnapshot;
  /** Returns the page's currently-subscribed live data at click time. */
  buildData: () => ExportData;
  /** Button label. */
  label: string;
  /** Optional busy-state label override. */
  busyLabel?: string;
  /** Disables the button regardless of export state (e.g. no data). */
  disabled?: boolean;
}

export function PerScreenExportButton({
  buildFilter,
  buildData,
  label,
  busyLabel,
  disabled,
}: PerScreenExportButtonProps) {
  const { user } = useAuth();
  const locale = useLocale();
  const { triggerWithData, isExporting, error, supported, success, clearSuccess } =
    useExcelExport();
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
    };
  }, [user, currency, locale]);

  const handleExport = useCallback(async () => {
    if (!ctx) return;
    const filter = buildFilter();
    const data = buildData();
    await triggerWithData(filter, ctx, data);
  }, [ctx, buildFilter, buildData, triggerWithData]);

  if (!user) return null;

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <ExportButton
        label={label}
        busyLabel={busyLabel ?? label}
        supported={supported}
        disabled={disabled || ctx === null}
        isExporting={isExporting}
        onExport={handleExport}
      />
      <ExportError message={error} />
      {success ? (
        <p
          role="status"
          aria-live="polite"
          className="max-w-xs text-xs text-muted-foreground"
        >
          {/* TODO: localise this later */}
          {`Downloaded ${success.fileName} (${(success.byteSize / 1024).toFixed(1)} KB)`}
          <button
            type="button"
            onClick={clearSuccess}
            className="ml-2 underline"
          >
            {/* TODO: localise this later */}
            Dismiss
          </button>
        </p>
      ) : null}
    </div>
  );
}

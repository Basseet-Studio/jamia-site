"use client";
/**
 * ExportButton — reusable per-screen "Export to Excel" button.
 *
 * Props:
 *   - onExport:        () => void | Promise<void> — wire to useExcelExport().trigger / triggerWithData
 *   - label:           string — button text. Caller passes the inline `// TODO: localise this later` marker.
 *   - busyLabel:       string — text while exporting.
 *   - supported:       boolean — hide button on unsupported browsers.
 *   - disabled:        boolean — extra gate (e.g. when there's no data to export).
 *   - isExporting:     boolean — shows spinner while an export is in flight.
 *
 * Wraps the standard Button with a spinner + disabled state. Per project
 * rules, no new i18n keys are added — strings carry the TODO marker at the
 * call site.
 */
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export interface ExportButtonProps {
  onExport: () => void | Promise<void>;
  label: string;
  busyLabel?: string;
  supported?: boolean;
  disabled?: boolean;
  isExporting?: boolean;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ExportButton({
  onExport,
  label,
  busyLabel,
  supported = true,
  disabled = false,
  isExporting = false,
  variant = "outline",
  size = "sm",
}: ExportButtonProps) {
  if (!supported) {
    // Per research.md §11: hide the button on browsers that can't build .xlsx
    // client-side. The parent page may render its own fallback copy.
    return null;
  }
  const busy = isExporting;
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      onClick={onExport}
      disabled={disabled || busy}
      aria-busy={busy}
    >
      {busy ? (
        <>
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          {busyLabel ?? label}
        </>
      ) : (
        label
      )}
    </Button>
  );
}

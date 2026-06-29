"use client";
/**
 * ExportError — inline <p role="alert"> showing the export's error string.
 * Pure presentational. Per project rules no new i18n keys are added in this
 * feature; the message itself comes from useExcelExport() which surfaces a
 * // TODO: localise this later marker at the call site.
 */
export function ExportError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="text-xs text-destructive"
      aria-live="polite"
    >
      {message}
    </p>
  );
}

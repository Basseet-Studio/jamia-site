"use client";
/**
 * ExportProgress — pure-presentational spinner + aria-busy indicator shown
 * while an export is in flight. Pure: no state, no hooks. Per project rules
 * no new i18n keys are added in this feature.
 */
import { Loader2 } from "lucide-react";

export function ExportProgress({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      role="status"
      aria-busy="true"
      // TODO: localise this later
      className="flex items-center gap-2 text-xs text-muted-foreground"
    >
      <Loader2 className="size-3 animate-spin" aria-hidden="true" />
      {/* TODO: localise this later */}
      <span>Preparing Excel…</span>
    </div>
  );
}

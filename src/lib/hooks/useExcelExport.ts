"use client";
/**
 * useExcelExport — single shared hook consumed by every export surface
 * (FullReportButton, ExportButton). Encapsulates:
 *   - One-time browser capability check (research.md §11).
 *   - Build + download orchestration via excelExportClient.ts.
 *   - isExporting state for the button's spinner / disabled prop.
 *   - error string surfaced inline (FR-009 + SC-006).
 *   - success string (fileName + byteSize) for the SC-006 confirmation.
 *
 * Per project rules: no new i18n keys in this feature. Strings carry
 * `// TODO: localise this later` at the call site.
 */
import { useCallback, useEffect, useState } from "react";

import {
  triggerDownload as clientTriggerDownload,
  triggerDownloadWithData as clientTriggerDownloadWithData,
} from "@/lib/services/excelExportClient";
import type {
  ExportContext,
  ExportData,
  FilterSnapshot,
} from "@/lib/services/excelExport";

export interface UseExcelExportResult {
  /** Trigger an export using pre-fetched live data from the calling screen. */
  triggerWithData: (
    filter: FilterSnapshot,
    ctx: ExportContext,
    data: ExportData,
  ) => Promise<void>;
  /** Trigger a full-report export (one-shot reads of every collection). */
  trigger: (filter: FilterSnapshot, ctx: ExportContext) => Promise<void>;
  isExporting: boolean;
  error: string | null;
  /** Set after a successful download so the UI can show a brief confirmation. */
  success: { fileName: string; byteSize: number } | null;
  /** True if the host browser can generate .xlsx client-side. */
  supported: boolean;
  clearSuccess: () => void;
}

function browserSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof document === "undefined") return false;
  if (typeof Blob === "undefined") return false;
  if (typeof URL === "undefined") return false;
  if (typeof URL.createObjectURL !== "function") return false;
  return true;
}

export function useExcelExport(): UseExcelExportResult {
  const [supported, setSupported] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ fileName: string; byteSize: number } | null>(
    null,
  );

  // One-time browser capability check on mount.
  useEffect(() => {
    setSupported(browserSupported());
  }, []);

  const runWithData = useCallback(
    async (
      filter: FilterSnapshot,
      ctx: ExportContext,
      data: ExportData,
    ) => {
      if (!supported) {
        // eslint-disable-next-line no-console
        console.warn("[useExcelExport] export attempted on unsupported browser");
        return;
      }
      setIsExporting(true);
      setError(null);
      setSuccess(null);
      try {
        const result = await clientTriggerDownloadWithData(filter, ctx, data);
        setSuccess({ fileName: result.fileName, byteSize: result.byteSize });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[useExcelExport] export failed:", e);
        setError(
          e instanceof Error ? e.message : "Excel export failed",
        );
      } finally {
        setIsExporting(false);
      }
    },
    [supported],
  );

  const runFull = useCallback(
    async (filter: FilterSnapshot, ctx: ExportContext) => {
      if (!supported) {
        // eslint-disable-next-line no-console
        console.warn("[useExcelExport] export attempted on unsupported browser");
        return;
      }
      setIsExporting(true);
      setError(null);
      setSuccess(null);
      try {
        const result = await clientTriggerDownload(filter, ctx);
        setSuccess({ fileName: result.fileName, byteSize: result.byteSize });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[useExcelExport] full export failed:", e);
        setError(
          e instanceof Error ? e.message : "Excel export failed",
        );
      } finally {
        setIsExporting(false);
      }
    },
    [supported],
  );

  const clearSuccess = useCallback(() => setSuccess(null), []);

  return {
    trigger: runFull,
    triggerWithData: runWithData,
    isExporting,
    error,
    success,
    supported,
    clearSuccess,
  };
}

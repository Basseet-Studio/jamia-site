"use client";
/**
 * Settings Dump DB card. Full-admin only. Typed REPLACE + checkbox confirm.
 * Partial import failure is a blocking screen, not a toast.
 */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DUMP_OVER_CEILING_MESSAGE,
} from "@/lib/schemas/dumpLimits";
import {
  DumpExportError,
  DumpValidationError,
  PartialImportFailureError,
  exportDump,
  importDump,
} from "@/lib/services/dumpDb";
import { parseJamiaDumpStream } from "@/lib/schemas/jamiaDump";
import { DumpImportPartialFailure } from "@/components/settings/DumpImportPartialFailure";

const CONFIRM_WORD = "REPLACE";

export function DumpDbCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportName, setExportName] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [checked, setChecked] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [partialName, setPartialName] = useState<string | null>(null);

  const confirmed = typed.trim() === CONFIRM_WORD && checked;

  async function onExport() {
    setBusy(true);
    setError(null);
    try {
      const result = await exportDump();
      setExportName(result.fileName);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onPick(file: File | null) {
    setError(null);
    setPendingFile(file);
    setTyped("");
    setChecked(false);
  }

  async function onImport() {
    if (!pendingFile || !confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const buf = new Uint8Array(await pendingFile.arrayBuffer());
      const dump = await parseJamiaDumpStream([buf], { requireStaff: true });
      await importDump(dump);
      setPendingFile(null);
      setTyped("");
      setChecked(false);
    } catch (e) {
      if (e instanceof PartialImportFailureError) {
        setPartialName(e.backupFileName);
        return;
      }
      if (
        e instanceof DumpValidationError ||
        e instanceof DumpExportError
      ) {
        setError(e.message);
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        msg.includes("too large") || msg.includes("100 attachments")
          ? DUMP_OVER_CEILING_MESSAGE
          : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  if (partialName) {
    return <DumpImportPartialFailure backupFileName={partialName} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Dump DB
          {/* TODO: localise this later */}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Export or replace the whole mosque dataset. Import replaces all
          records after you type REPLACE and tick the box.
          {/* TODO: localise this later */}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onExport} disabled={busy}>
            {busy ? "Working…" : "Export dump"}
            {/* TODO: localise this later */}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            Choose dump file
            {/* TODO: localise this later */}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />
        </div>
        {exportName ? (
          <p className="text-sm">
            Downloaded {exportName}
            {/* TODO: localise this later */}
          </p>
        ) : null}
        {pendingFile ? (
          <div className="space-y-3 rounded-md border p-3">
            <p className="text-sm font-medium">{pendingFile.name}</p>
            <div className="space-y-2">
              <Label htmlFor="dump-replace">
                Type REPLACE to confirm
                {/* TODO: localise this later */}
              </Label>
              <Input
                id="dump-replace"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
              />
              I understand this replaces all current data
              {/* TODO: localise this later */}
            </label>
            <Button
              type="button"
              variant="destructive"
              disabled={!confirmed || busy}
              onClick={onImport}
            >
              {busy ? "Importing…" : "Import dump"}
              {/* TODO: localise this later */}
            </Button>
          </div>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

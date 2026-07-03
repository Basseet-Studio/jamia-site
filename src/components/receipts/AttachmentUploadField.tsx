"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { validateAttachmentFile } from "@/lib/services/attachments";

export function AttachmentUploadField({
  id,
  label,
  file,
  onFileChange,
  optional = true,
}: {
  id: string;
  label?: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  optional?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label ??
          (optional
            ? "Scanned receipt (optional)"
            : "Scanned receipt")}
      </Label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const next = e.target.files?.[0] ?? null;
            setError(null);
            if (!next) {
              onFileChange(null);
              return;
            }
            try {
              validateAttachmentFile(next);
              onFileChange(next);
            } catch (err) {
              setError((err as Error).message);
              onFileChange(null);
              e.target.value = "";
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          {file ? "Change file" : "Choose file"}
        </Button>
        {file ? (
          <span className="max-w-[12rem] truncate text-xs text-muted-foreground">
            {file.name}
          </span>
        ) : null}
        {file ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onFileChange(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            Remove
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

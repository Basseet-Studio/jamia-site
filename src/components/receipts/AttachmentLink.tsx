"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getAttachmentDownloadUrl } from "@/lib/services/attachments";

export function AttachmentLink({
  path,
  fileName,
}: {
  path?: string | null;
  fileName?: string | null;
}) {
  const [busy, setBusy] = useState(false);

  if (!path) return null;

  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      className="h-auto px-0 text-xs"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const url = await getAttachmentDownloadUrl(path);
          window.open(url, "_blank", "noopener,noreferrer");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Opening…" : fileName ? `Scan: ${fileName}` : "View scan"}
    </Button>
  );
}

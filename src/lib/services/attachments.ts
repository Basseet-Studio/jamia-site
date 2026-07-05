import { getFirebaseAuth } from "@/lib/firebase/client";
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  type AttachmentInput,
} from "@/lib/schemas/attachment";
import {
  buildReceiptStoragePath,
  type ReceiptEntityType,
} from "@/lib/attachments/receiptPaths";

export type { ReceiptEntityType };

export function validateAttachmentFile(file: File): void {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("Attachment must be 5 MB or smaller");
  }
  if (
    !ALLOWED_ATTACHMENT_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number],
    )
  ) {
    throw new Error("Attachment must be a PDF or image (JPEG, PNG, WebP)");
  }
}

export { buildReceiptStoragePath };

async function authHeaders(): Promise<HeadersInit> {
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    throw new Error("Not signed in");
  }
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

async function parseApiError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function uploadReceiptAttachment(
  entityType: ReceiptEntityType,
  docId: string,
  file: File,
): Promise<AttachmentInput> {
  validateAttachmentFile(file);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("entityType", entityType);
  formData.append("docId", docId);

  const res = await fetch("/api/receipts/upload", {
    method: "POST",
    headers: await authHeaders(),
    body: formData,
  });

  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }

  return (await res.json()) as AttachmentInput;
}

export async function getAttachmentDownloadUrl(path: string): Promise<string> {
  const params = new URLSearchParams({ path });
  const res = await fetch(`/api/receipts/download?${params}`, {
    headers: await authHeaders(),
  });

  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }

  const body = (await res.json()) as { url: string };
  return body.url;
}

export async function deleteReceiptAttachment(path: string): Promise<void> {
  const params = new URLSearchParams({ path });
  const res = await fetch(`/api/receipts/delete?${params}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });

  if (!res.ok && res.status !== 204) {
    throw new Error(await parseApiError(res));
  }
}

export function attachmentFieldsFromInput(
  attachment: AttachmentInput | null | undefined,
): Record<string, string | null> {
  if (!attachment) {
    return {
      attachmentPath: null,
      attachmentFileName: null,
      attachmentMimeType: null,
    };
  }
  return {
    attachmentPath: attachment.path,
    attachmentFileName: attachment.fileName,
    attachmentMimeType: attachment.mimeType,
  };
}

export function parseAttachmentFields(
  data: Record<string, unknown>,
): {
  attachmentPath: string | null;
  attachmentFileName: string | null;
  attachmentMimeType: string | null;
} {
  return {
    attachmentPath:
      typeof data.attachmentPath === "string" ? data.attachmentPath : null,
    attachmentFileName:
      typeof data.attachmentFileName === "string"
        ? data.attachmentFileName
        : null,
    attachmentMimeType:
      typeof data.attachmentMimeType === "string"
        ? data.attachmentMimeType
        : null,
  };
}

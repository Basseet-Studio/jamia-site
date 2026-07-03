import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { getFirebaseStorage } from "@/lib/firebase/client";
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  type AttachmentInput,
} from "@/lib/schemas/attachment";

export type ReceiptEntityType = "payments" | "contributions" | "expenses";

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

export function buildReceiptStoragePath(
  entityType: ReceiptEntityType,
  docId: string,
  fileName: string,
): string {
  const safeName = fileName.replace(/[/\\?%*:|"<>]/g, "-");
  return `receipts/${entityType}/${docId}/${safeName}`;
}

export async function uploadReceiptAttachment(
  entityType: ReceiptEntityType,
  docId: string,
  file: File,
): Promise<AttachmentInput> {
  validateAttachmentFile(file);
  const path = buildReceiptStoragePath(entityType, docId, file.name);
  const storageRef = ref(getFirebaseStorage(), path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return {
    path,
    fileName: file.name,
    mimeType: file.type,
  };
}

export async function getAttachmentDownloadUrl(path: string): Promise<string> {
  return getDownloadURL(ref(getFirebaseStorage(), path));
}

export async function deleteReceiptAttachment(path: string): Promise<void> {
  await deleteObject(ref(getFirebaseStorage(), path));
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

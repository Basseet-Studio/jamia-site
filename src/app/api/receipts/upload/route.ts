import { put } from "@vercel/blob";
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
} from "@/lib/schemas/attachment";
import {
  buildReceiptStoragePath,
  parseReceiptEntityType,
} from "@/lib/server/receiptPaths";
import {
  AuthError,
  jsonError,
  verifyAdminRequest,
} from "@/lib/server/verifyAdmin";

export async function POST(request: Request) {
  try {
    await verifyAdminRequest(request);
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message);
    }
    return jsonError(500, "Authorization failed");
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError(400, "Invalid form data");
  }

  const file = formData.get("file");
  const entityType = parseReceiptEntityType(formData.get("entityType"));
  const docId = formData.get("docId");

  if (!(file instanceof File)) {
    return jsonError(400, "Missing file");
  }
  if (!entityType) {
    return jsonError(400, "Invalid entity type");
  }
  if (typeof docId !== "string" || !docId.trim()) {
    return jsonError(400, "Missing document id");
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return jsonError(400, "Attachment must be 5 MB or smaller");
  }
  if (
    !ALLOWED_ATTACHMENT_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number],
    )
  ) {
    return jsonError(400, "Attachment must be a PDF or image (JPEG, PNG, WebP)");
  }

  const path = buildReceiptStoragePath(entityType, docId.trim(), file.name);

  try {
    await put(path, file, {
      access: "private",
      contentType: file.type,
      addRandomSuffix: false,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Upload failed";
    return jsonError(500, message);
  }

  return Response.json({
    path,
    fileName: file.name,
    mimeType: file.type,
  });
}

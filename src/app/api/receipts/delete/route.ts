import { del } from "@vercel/blob";
import { getReceiptBlobToken } from "@/lib/firebase/admin";
import { isValidReceiptStoragePath } from "@/lib/server/receiptPaths";
import {
  AuthError,
  jsonError,
  verifyAdminRequest,
} from "@/lib/server/verifyAdmin";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    await verifyAdminRequest(request);
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message);
    }
    const message =
      err instanceof Error ? err.message : "Authorization failed";
    return jsonError(500, message);
  }

  const blobToken = getReceiptBlobToken();
  if (!blobToken) {
    return jsonError(
      500,
      "Blob storage not configured (missing BLOB_READ_WRITE_TOKEN)",
    );
  }

  const path = new URL(request.url).searchParams.get("path");
  if (!path || !isValidReceiptStoragePath(path)) {
    return jsonError(400, "Invalid path");
  }

  try {
    await del(path, { token: blobToken });
    return new Response(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return jsonError(500, message);
  }
}

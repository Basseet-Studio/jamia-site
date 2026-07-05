import { del } from "@vercel/blob";
import { isValidReceiptStoragePath } from "@/lib/server/receiptPaths";
import {
  AuthError,
  jsonError,
  verifyAdminRequest,
} from "@/lib/server/verifyAdmin";

export async function DELETE(request: Request) {
  try {
    await verifyAdminRequest(request);
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message);
    }
    return jsonError(500, "Authorization failed");
  }

  const path = new URL(request.url).searchParams.get("path");
  if (!path || !isValidReceiptStoragePath(path)) {
    return jsonError(400, "Invalid path");
  }

  try {
    await del(path);
    return new Response(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return jsonError(500, message);
  }
}

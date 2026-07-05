import { head } from "@vercel/blob";
import { isValidReceiptStoragePath } from "@/lib/server/receiptPaths";
import {
  AuthError,
  jsonError,
  verifyAdminRequest,
} from "@/lib/server/verifyAdmin";

export async function GET(request: Request) {
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
    const metadata = await head(path);
    return Response.json({ url: metadata.downloadUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Download failed";
    if (message.toLowerCase().includes("not found")) {
      return jsonError(404, "Receipt not found");
    }
    return jsonError(500, message);
  }
}

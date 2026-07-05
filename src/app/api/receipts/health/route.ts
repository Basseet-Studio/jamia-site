import { getAdminAuth } from "@/lib/firebase/admin";
import {
  AuthError,
  jsonError,
  verifyAdminRequest,
} from "@/lib/server/verifyAdmin";

export const runtime = "nodejs";

/** Admin-only config probe for the debug page (no secrets returned). */
export async function GET(request: Request) {
  try {
    const { uid } = await verifyAdminRequest(request);
    getAdminAuth();
    return Response.json({
      ok: true,
      uid,
      blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim()),
      firebaseAdminConfigured: Boolean(
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ||
          process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim(),
      ),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message);
    }
    const message = err instanceof Error ? err.message : "Health check failed";
    return jsonError(500, message);
  }
}

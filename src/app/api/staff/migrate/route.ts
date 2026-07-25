import {
  AuthError,
  jsonError,
  verifyFullAdminRequest,
} from "@/lib/server/verifyAdmin";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  LEGACY_ADMINS_COLLECTION,
  STAFF_COLLECTION,
} from "@/lib/auth/collections";

export const runtime = "nodejs";

/**
 * Copy legacy `admins/*` docs into `staff/*` using the Admin SDK so the
 * migration is not blocked by client ad blockers (`ERR_BLOCKED_BY_CLIENT`
 * on `/admins/` paths).
 */
export async function POST(request: Request) {
  try {
    await verifyFullAdminRequest(request);
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonError(err.status, err.message);
    }
    const message =
      err instanceof Error ? err.message : "Authorization failed";
    return jsonError(500, message);
  }

  try {
    const db = getAdminDb();
    const staffSnap = await db.collection(STAFF_COLLECTION).limit(1).get();
    const legacySnap = await db.collection(LEGACY_ADMINS_COLLECTION).get();

    if (legacySnap.empty) {
      return Response.json({
        copied: 0,
        message: "No legacy admins docs to migrate",
      });
    }

    let copied = 0;
    const batch = db.batch();
    for (const docSnap of legacySnap.docs) {
      const data = docSnap.data();
      const target = db.collection(STAFF_COLLECTION).doc(docSnap.id);
      batch.set(
        target,
        {
          email: data.email ?? "",
          displayName: data.displayName ?? data.email ?? docSnap.id,
          role: data.role ?? "admin",
          addedAt: data.addedAt ?? new Date(),
        },
        { merge: true },
      );
      copied += 1;
    }
    await batch.commit();

    return Response.json({
      copied,
      staffAlreadyHadDocs: !staffSnap.empty,
      message: `Migrated ${copied} doc(s) into staff`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Migration failed";
    return jsonError(500, message);
  }
}

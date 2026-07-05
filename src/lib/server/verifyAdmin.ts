import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

export function jsonError(
  status: number,
  message: string,
): Response {
  return Response.json({ error: message }, { status });
}

export async function verifyAdminRequest(
  request: Request,
): Promise<{ uid: string }> {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new AuthError(401, "Missing or invalid authorization");
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    throw new AuthError(401, "Missing or invalid authorization");
  }

  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    throw new AuthError(401, "Invalid or expired token");
  }

  const adminDoc = await getAdminDb().doc(`admins/${uid}`).get();
  if (!adminDoc.exists) {
    throw new AuthError(403, "Admin access required");
  }

  return { uid };
}

export class AuthError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

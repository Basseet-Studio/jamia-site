/**
 * Firebase Admin SDK — server-only. Used to verify ID tokens and read
 * `admins/{uid}` for receipt API routes.
 */
import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let _app: App | null = null;

function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, "\n");
}

function parseServiceAccountJson(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  if (typeof parsed.private_key === "string") {
    parsed.private_key = normalizePrivateKey(parsed.private_key);
  }
  return parsed;
}

function loadServiceAccount(): Record<string, unknown> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (raw && raw.length > 10) {
    try {
      return parseServiceAccountJson(raw);
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON is invalid. Use a single-line minified JSON string in env vars.",
      );
    }
  }

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (credPath) {
    try {
      return parseServiceAccountJson(readFileSync(credPath, "utf8"));
    } catch {
      throw new Error(
        `Failed to read service account from GOOGLE_APPLICATION_CREDENTIALS (${credPath})`,
      );
    }
  }

  return null;
}

function getAdminApp(): App {
  if (_app) return _app;
  const existing = getApps()[0];
  if (existing) {
    _app = existing;
    return _app;
  }

  const serviceAccount = loadServiceAccount();
  const projectId =
    process.env.FIREBASE_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    (typeof serviceAccount?.project_id === "string"
      ? serviceAccount.project_id
      : undefined);

  if (serviceAccount) {
    _app = initializeApp({
      credential: cert(serviceAccount as Parameters<typeof cert>[0]),
      projectId,
    });
  } else if (projectId) {
    _app = initializeApp({ projectId });
  } else {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON (single-line JSON) or GOOGLE_APPLICATION_CREDENTIALS.",
    );
  }
  return _app;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export function getReceiptBlobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || undefined;
}

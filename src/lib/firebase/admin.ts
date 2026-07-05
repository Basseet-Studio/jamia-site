/**
 * Firebase Admin SDK — server-only. Used to verify ID tokens and read
 * `admins/{uid}` for receipt API routes.
 */
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let _app: App | null = null;

function getAdminApp(): App {
  if (_app) return _app;
  const existing = getApps()[0];
  if (existing) {
    _app = existing;
    return _app;
  }

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const serviceAccount = JSON.parse(json) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    _app = initializeApp({
      credential: cert(serviceAccount as Parameters<typeof cert>[0]),
      projectId:
        process.env.FIREBASE_PROJECT_ID ??
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
        serviceAccount.project_id,
    });
  } else {
    _app = initializeApp({
      projectId:
        process.env.FIREBASE_PROJECT_ID ??
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }
  return _app;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

/**
 * Firebase Web SDK init — used in browser and (when needed) in Server Actions
 * with the user's ID token.
 *
 * Receipt attachments are stored in Vercel Blob (see /api/receipts/*), not
 * Firebase Storage. Auth + Firestore remain on Firebase.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  _app = getApps()[0] ?? initializeApp(firebaseConfig as Record<string, string>);
  return _app;
}

export function getFirebaseAuth(): Auth {
  if (_auth) return _auth;
  const app = getFirebaseApp();
  _auth = getAuth(app);

  const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";
  const host = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1";
  const port = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT ?? "9099";
  if (useEmulator && typeof window !== "undefined") {
    try {
      connectAuthEmulator(_auth, `http://${host}:${port}`, { disableWarnings: true });
    } catch {
      // already connected; ignore
    }
  }
  return _auth;
}

export function getDb(): Firestore {
  if (_db) return _db;
  const app = getFirebaseApp();
  _db = getFirestore(app);

  const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";
  const host = process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST ?? "127.0.0.1";
  const port = process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT ?? "8080";
  if (useEmulator && typeof window !== "undefined") {
    try {
      connectFirestoreEmulator(_db, host, Number(port));
    } catch {
      // already connected; ignore
    }
  }
  return _db;
}

export { getApp };

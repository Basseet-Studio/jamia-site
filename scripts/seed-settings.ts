/**
 * Seed script: writes the settings/global singleton with sensible defaults.
 * Run: pnpm seed:settings
 *
 * Connects to the Firestore emulator when FIRESTORE_EMULATOR_HOST is set,
 * otherwise uses the configured project from .env.local.
 */
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

const useEmulator =
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR;

const app =
  getApps()[0] ??
  initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "demo-key",
    authDomain:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "demo.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-jamia",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:0:web:0",
  });

const db = getFirestore(app);
if (useEmulator && process.env.FIRESTORE_EMULATOR_HOST) {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
  connectFirestoreEmulator(db, host, Number(port));
}

async function main() {
  await setDoc(doc(db, "settings", "global"), {
    defaultContributionTarget: 500,
    openingBalance: 0,
    currency: "AED",
    updatedAt: serverTimestamp(),
  });
  // eslint-disable-next-line no-console
  console.log("Seeded settings/global with defaults.");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

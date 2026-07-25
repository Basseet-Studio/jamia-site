/**
 * One-shot audit + optional reset of money-on-hand books.
 *
 * Usage:
 *   pnpm tsx scripts/audit-and-zero-books.ts
 *   pnpm tsx scripts/audit-and-zero-books.ts --apply
 *
 * --apply: deletes ALL payment docs, deletes ALL expense docs, sets
 * openingBalance=0 and moneyOnHand=0. Keeps households + families (members).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");

function loadEnvLocal(): Record<string, string> {
  const path = resolve(process.cwd(), ".env.local");
  const text = readFileSync(path, "utf8");
  const out: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    i += 1;
    if (!line || line.trimStart().startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1);
    if (key === "FIREBASE_SERVICE_ACCOUNT_JSON" && value.trim() === "{") {
      const parts = ["{"];
      while (i < lines.length) {
        const next = lines[i]!;
        i += 1;
        parts.push(next);
        if (next.trim() === "}") break;
      }
      value = parts.join("\n");
    } else if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function getDb() {
  const env = loadEnvLocal();
  const raw = env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw || raw.length < 10) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON missing or truncated in .env.local",
    );
  }
  const sa = JSON.parse(raw) as Record<string, unknown>;
  if (typeof sa.private_key === "string") {
    sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  }
  const projectId =
    env.FIREBASE_PROJECT_ID ||
    env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    (typeof sa.project_id === "string" ? sa.project_id : undefined);
  if (!getApps().length) {
    initializeApp({
      credential: cert(sa as Parameters<typeof cert>[0]),
      projectId,
    });
  }
  return getFirestore();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const db = getDb();
  let lastErr: unknown;

  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const settingsSnap = await db.doc("settings/global").get();
      const settings = settingsSnap.data() ?? {};
      console.log("=== SETTINGS ===");
      console.log({
        openingBalance: settings.openingBalance,
        moneyOnHand: settings.moneyOnHand,
        currency: settings.currency,
      });

      const paySnap = await db.collectionGroup("payments").get();
      let paySum = 0;
      console.log("=== PAYMENTS ===", paySnap.size);
      for (const d of paySnap.docs) {
        const x = d.data();
        const amount = typeof x.amount === "number" ? x.amount : 0;
        paySum += amount;
        console.log(
          `  ${amount} | ${x.month} | note=${JSON.stringify(x.note ?? null)} | ${d.ref.path}`,
        );
      }
      console.log("paySum=", paySum);

      const expSnap = await db.collection("expenses").get();
      let withdrawnSum = 0;
      console.log("=== EXPENSES ===", expSnap.size);
      for (const d of expSnap.docs) {
        const x = d.data();
        const amount = typeof x.amount === "number" ? x.amount : 0;
        if (x.withdrawn === true) withdrawnSum += amount;
        console.log(
          `  ${amount} | withdrawn=${x.withdrawn === true} | ${x.month} | ${x.description ?? x.note ?? ""}`,
        );
      }
      console.log("withdrawnSum=", withdrawnSum);

      const opening =
        typeof settings.openingBalance === "number"
          ? settings.openingBalance
          : 0;
      const storedMoH =
        typeof settings.moneyOnHand === "number"
          ? settings.moneyOnHand
          : opening;
      console.log("=== BALANCE ===", {
        opening,
        storedMoH,
        expected: opening + paySum - withdrawnSum,
        drift: storedMoH - (opening + paySum - withdrawnSum),
      });

      if (!APPLY) {
        console.log("\nDry run. Re-run with --apply to zero books.");
        return;
      }

      const batch = db.batch();
      let ops = 0;
      for (const d of paySnap.docs) {
        batch.delete(d.ref);
        ops += 1;
      }
      for (const d of expSnap.docs) {
        batch.delete(d.ref);
        ops += 1;
      }
      if (ops > 0) await batch.commit();

      await db.doc("settings/global").update({
        openingBalance: 0,
        moneyOnHand: 0,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: "scripts/audit-and-zero-books",
      });

      console.log("RESET_DONE", {
        deletedPayments: paySnap.size,
        deletedExpenses: expSnap.size,
        moneyOnHand: 0,
        openingBalance: 0,
      });
      return;
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`attempt ${attempt} failed: ${msg}`);
      if (attempt < 6) await sleep(20000 * attempt);
    }
  }
  throw lastErr;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

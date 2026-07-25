/**
 * One-shot audit + optional reset of money-on-hand books.
 *
 * Usage:
 *   pnpm tsx scripts/audit-and-zero-books.ts
 *   pnpm tsx scripts/audit-and-zero-books.ts --apply
 *
 * --apply: deletes ALL payment docs, deletes ALL expense docs, sets
 * openingBalance=0 and moneyOnHand=0. Keeps households + families (members).
 *
 * Loads credentials from `.env.local` even when the service-account JSON is
 * stored as a multi-line value (dotenv only keeps the first `{`).
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
    // Multi-line JSON object value for FIREBASE_SERVICE_ACCOUNT_JSON
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

function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, "\n");
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
    sa.private_key = normalizePrivateKey(sa.private_key);
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

async function main() {
  const db = getDb();

  const settingsSnap = await db.doc("settings/global").get();
  const settings = settingsSnap.data() ?? {};
  console.log("=== SETTINGS ===");
  console.log({
    openingBalance: settings.openingBalance,
    moneyOnHand: settings.moneyOnHand,
    currency: settings.currency,
    defaultContributionTarget: settings.defaultContributionTarget,
  });

  const hhSnap = await db.collection("households").get();
  console.log("\n=== HOUSEHOLDS ===", hhSnap.size);

  type PayRow = {
    path: string;
    amount: number;
    month: string;
    note: unknown;
    familyName: string;
    familyActive: boolean;
    hhName: string;
    hhActive: boolean;
  };
  const payments: PayRow[] = [];
  let activeFamilies = 0;
  let inactiveFamilies = 0;

  for (const hh of hhSnap.docs) {
    const hhData = hh.data();
    const fams = await hh.ref.collection("families").get();
    for (const fam of fams.docs) {
      const famData = fam.data();
      const active = famData.active !== false;
      if (active) activeFamilies += 1;
      else inactiveFamilies += 1;
      const pays = await fam.ref.collection("payments").get();
      for (const p of pays.docs) {
        const d = p.data();
        payments.push({
          path: p.ref.path,
          amount: typeof d.amount === "number" ? d.amount : 0,
          month: String(d.month ?? ""),
          note: d.note ?? null,
          familyName: String(famData.name ?? ""),
          familyActive: active,
          hhName: String(hhData.name ?? ""),
          hhActive: hhData.active !== false,
        });
      }
    }
  }

  const paySum = payments.reduce((s, p) => s + p.amount, 0);
  console.log("\n=== FAMILIES ===", { activeFamilies, inactiveFamilies });
  console.log("=== PAYMENTS ===", payments.length, "sum=", paySum);
  for (const p of payments) {
    console.log(
      `  ${p.amount} | ${p.month} | fam=${p.familyName} (active=${p.familyActive}) | hh=${p.hhName} | note=${JSON.stringify(p.note)}`,
    );
  }

  const expSnap = await db.collection("expenses").get();
  const expenses = expSnap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      amount: typeof x.amount === "number" ? x.amount : 0,
      withdrawn: x.withdrawn === true,
      month: String(x.month ?? ""),
      description: String(x.description ?? x.note ?? ""),
      type: String(x.type ?? ""),
    };
  });
  const withdrawnSum = expenses
    .filter((e) => e.withdrawn)
    .reduce((s, e) => s + e.amount, 0);
  const pendingSum = expenses
    .filter((e) => !e.withdrawn)
    .reduce((s, e) => s + e.amount, 0);
  console.log(
    "\n=== EXPENSES ===",
    expenses.length,
    "withdrawn=",
    withdrawnSum,
    "pending=",
    pendingSum,
  );
  for (const e of expenses) {
    console.log(
      `  ${e.amount} | withdrawn=${e.withdrawn} | ${e.month} | ${e.type} | ${e.description}`,
    );
  }

  const opening =
    typeof settings.openingBalance === "number" ? settings.openingBalance : 0;
  const storedMoH =
    typeof settings.moneyOnHand === "number" ? settings.moneyOnHand : opening;
  const expected = opening + paySum - withdrawnSum;
  console.log("\n=== BALANCE CHECK ===");
  console.log({
    opening,
    storedMoH,
    paySum,
    withdrawnSum,
    expected,
    drift: storedMoH - expected,
  });

  if (!APPLY) {
    console.log(
      "\nDry run only. Re-run with --apply to delete all payments + expenses and set MoH/opening to 0 (keeps members/families).",
    );
    return;
  }

  console.log("\n=== APPLYING RESET ===");
  let deletedPayments = 0;
  for (const p of payments) {
    await db.doc(p.path).delete();
    deletedPayments += 1;
  }
  let deletedExpenses = 0;
  for (const e of expenses) {
    await db.collection("expenses").doc(e.id).delete();
    deletedExpenses += 1;
  }

  await db.doc("settings/global").update({
    openingBalance: 0,
    moneyOnHand: 0,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: "scripts/audit-and-zero-books",
  });

  console.log({
    deletedPayments,
    deletedExpenses,
    openingBalance: 0,
    moneyOnHand: 0,
    householdsKept: hhSnap.size,
    familiesKept: activeFamilies + inactiveFamilies,
  });
  console.log("Done. Books zeroed; members preserved.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

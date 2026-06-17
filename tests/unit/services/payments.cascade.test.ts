/**
 * 003 — Emulator-backed cascade + group-delete tests for the
 * `recordPaymentWithCoverage` + `deletePayment` flows.
 *
 * These tests stand up a fresh Firestore instance pointed at the emulator
 * (via `FIRESTORE_EMULATOR_HOST`), seed a household + family, then drive the
 * service through one cascade submission and one group delete. They are the
 * regression for SC-007 (race-safety) and SC-009 (atomicity with MOH).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  initializeFirestore,
  query,
  serverTimestamp,
  setDoc,
  terminate,
  where,
} from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import * as client from "@/lib/firebase/client";
import * as payments from "@/lib/services/payments";

let db: ReturnType<typeof initializeFirestore>;
let app: ReturnType<typeof initializeApp>;

const TEST_PROJECT = "payments-cascade-test";

beforeEach(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) return; // skipped below
  app = initializeApp(
    {
      apiKey: "demo",
      projectId: TEST_PROJECT,
      appId: "1:0:web:0",
    },
    TEST_PROJECT,
  );
  db = initializeFirestore(app, {}, TEST_PROJECT);

  // Seed opening settings.
  await setDoc(doc(db, "settings", "global"), {
    defaultContributionTarget: 500,
    openingBalance: 1000,
    currency: "AED",
    moneyOnHand: 1000,
    updatedAt: serverTimestamp(),
    updatedBy: "test",
  });
});

afterEach(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) return;
  await terminate(db);
  await deleteApp(app);
});

async function seedFamily(): Promise<{ hh: string; fam: string }> {
  const hhRef = await addDoc(collection(db, "households"), {
    name: "Test HH",
    createdAt: serverTimestamp(),
    createdBy: "test",
  });
  const famRef = await addDoc(
    collection(db, "households", hhRef.id, "families"),
    {
      name: "Test Family",
      contributionTarget: 500,
      active: true,
      createdAt: serverTimestamp(),
      createdBy: "test",
    },
  );
  return { hh: hhRef.id, fam: famRef.id };
}

async function listPayments(hh: string, fam: string) {
  const snap = await getDocs(
    collection(db, "households", hh, "families", fam, "payments"),
  );
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      month: String(data.month ?? ""),
      amount: typeof data.amount === "number" ? data.amount : 0,
      coverageGroupId:
        typeof data.coverageGroupId === "string"
          ? (data.coverageGroupId as string)
          : null,
      recordedBy: String(data.recordedBy ?? ""),
    };
  });
}

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
  "recordPaymentWithCoverage — atomic cascade (T010, T011)",
  () => {
    it("writes N docs in one txn, all sharing coverageGroupId, MOH shifts by group total", async () => {
      const { hh, fam } = await seedFamily();
      // Route getDb() to the test DB.
      const realGetDb = client.getDb;
      (client as { getDb: typeof realGetDb }).getDb = () =>
        db as unknown as ReturnType<typeof realGetDb>;

      try {
        await payments.recordPaymentWithCoverage("uid-test", {
          householdId: hh,
          familyId: fam,
          coverageGroupId: "11111111-1111-4111-8111-111111111111",
          applyToFutureMonths: false,
          amount: 1500,
          date: new Date("2026-06-17"),
          note: null,
        });

        const docs = await listPayments(hh, fam);
        expect(docs).toHaveLength(3);
        // All docs share the same coverageGroupId.
        for (const d of docs) {
          expect(d.coverageGroupId).toBe(
            "11111111-1111-4111-8111-111111111111",
          );
          expect(d.recordedBy).toBe("uid-test");
        }
        // Months: 2026-06 (current), 2026-01 + 2026-02 (back cascade, oldest first).
        const months = docs.map((d) => d.month).sort();
        expect(months).toEqual(["2026-01", "2026-02", "2026-06"]);
        // Per-doc amount is target (500), even though admin entered 1500.
        for (const d of docs) {
          expect(d.amount).toBe(500);
        }
        // MOH shift: 1000 + 1500 = 2500.
        const settingsSnap = await getDocs(
          query(collection(db, "settings"), where("__name__", "==", "global")),
        );
        expect(
          (settingsSnap.docs[0]?.data()?.moneyOnHand as number) ?? null,
        ).toBe(2500);
      } finally {
        (client as { getDb: typeof realGetDb }).getDb = realGetDb;
      }
    });

    it("partial cascade writes current-month doc at target, not over-limit amount (group total < entered)", async () => {
      const { hh, fam } = await seedFamily();
      const realGetDb = client.getDb;
      (client as { getDb: typeof realGetDb }).getDb = () =>
        db as unknown as ReturnType<typeof realGetDb>;

      try {
        // 1700 entered; back cascade fits 2 slots (Jan+Feb at 500 each), then
        // stops on whole-month rule. Group total = 500 (current) + 500 + 500 = 1500.
        await payments.recordPaymentWithCoverage("uid-test", {
          householdId: hh,
          familyId: fam,
          coverageGroupId: "22222222-2222-4222-8222-222222222222",
          applyToFutureMonths: false,
          amount: 1700,
          date: new Date("2026-06-17"),
          note: null,
        });
        const docs = await listPayments(hh, fam);
        // 3 docs, each at 500.
        expect(docs).toHaveLength(3);
        for (const d of docs) expect(d.amount).toBe(500);
        // MOH shift = group total = 1500, NOT 1700.
        const settingsSnap = await getDocs(
          query(collection(db, "settings"), where("__name__", "==", "global")),
        );
        expect(settingsSnap.docs[0]?.data()?.moneyOnHand).toBe(2500);
      } finally {
        (client as { getDb: typeof realGetDb }).getDb = realGetDb;
      }
    });

    it("race-safety: second cascade re-reads payments inside txn and skips months paid by parallel commit (FR-023)", async () => {
      const { hh, fam } = await seedFamily();
      const realGetDb = client.getDb;
      (client as { getDb: typeof realGetDb }).getDb = () =>
        db as unknown as ReturnType<typeof realGetDb>;

      try {
        // Simulate a parallel commit having paid Jan + Feb already by writing
        // them as legacy single-doc payments BEFORE the cascade runs.
        await addDoc(
          collection(db, "households", hh, "families", fam, "payments"),
          {
            amount: 500,
            date: serverTimestamp(),
            month: "2026-01",
            note: null,
            recordedAt: serverTimestamp(),
            recordedBy: "parallel-admin",
            coverageGroupId: null,
          },
        );
        await addDoc(
          collection(db, "households", hh, "families", fam, "payments"),
          {
            amount: 500,
            date: serverTimestamp(),
            month: "2026-02",
            note: null,
            recordedAt: serverTimestamp(),
            recordedBy: "parallel-admin",
            coverageGroupId: null,
          },
        );
        // Bring MOH up to reflect the parallel commits.
        await setDoc(
          doc(db, "settings", "global"),
          { moneyOnHand: 2000, updatedAt: serverTimestamp() },
          { merge: true },
        );

        // Now run the cascade — the txn must re-read and skip the already-paid months.
        await payments.recordPaymentWithCoverage("uid-test", {
          householdId: hh,
          familyId: fam,
          coverageGroupId: "33333333-3333-4333-8333-333333333333",
          applyToFutureMonths: false,
          amount: 1500,
          date: new Date("2026-06-17"),
          note: null,
        });
        const docs = await listPayments(hh, fam);
        // 4 total docs (2 pre-existing + 2 cascade: Jun + Mar).
        // Mar was the next unpaid back month — June 2026 is current.
        expect(docs).toHaveLength(4);
        const junDocs = docs.filter((d) => d.month === "2026-06");
        const marDocs = docs.filter((d) => d.month === "2026-03");
        expect(junDocs).toHaveLength(1);
        expect(marDocs).toHaveLength(1);
        // No duplicate Jan or Feb from this cascade.
        const janFromCascade = docs.filter(
          (d) =>
            d.month === "2026-01" &&
            (d as { coverageGroupId?: string }).coverageGroupId ===
              "33333333-3333-4333-8333-333333333333",
        );
        expect(janFromCascade).toHaveLength(0);
      } finally {
        (client as { getDb: typeof realGetDb }).getDb = realGetDb;
      }
    });
  },
);

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
  "deletePayment — coverage group delete (T019)",
  () => {
    it("group delete removes N docs and decrements MOH by group total in one txn", async () => {
      const { hh, fam } = await seedFamily();
      const realGetDb = client.getDb;
      (client as { getDb: typeof realGetDb }).getDb = () =>
        db as unknown as ReturnType<typeof realGetDb>;

      try {
        // Submit a 3-month cascade.
        await payments.recordPaymentWithCoverage("uid-test", {
          householdId: hh,
          familyId: fam,
          coverageGroupId: "44444444-4444-4444-8444-444444444444",
          applyToFutureMonths: false,
          amount: 1500,
          date: new Date("2026-06-17"),
          note: null,
        });
        // Find one of the docs to delete (use the current-month doc).
        const allDocs = await listPayments(hh, fam);
        const junDoc = allDocs.find((d) => d.month === "2026-06");
        expect(junDoc).toBeTruthy();

        await payments.deletePayment(
          "uid-test",
          hh,
          fam,
          (junDoc as { id: string }).id,
        );

        const after = await listPayments(hh, fam);
        expect(after).toHaveLength(0);
        // MOH back to opening 1000.
        const settingsSnap = await getDocs(
          query(collection(db, "settings"), where("__name__", "==", "global")),
        );
        expect(settingsSnap.docs[0]?.data()?.moneyOnHand).toBe(1000);
      } finally {
        (client as { getDb: typeof realGetDb }).getDb = realGetDb;
      }
    });

    it("legacy doc (no coverageGroupId) takes single-doc path unchanged", async () => {
      const { hh, fam } = await seedFamily();
      const realGetDb = client.getDb;
      (client as { getDb: typeof realGetDb }).getDb = () =>
        db as unknown as ReturnType<typeof realGetDb>;

      try {
        // Single legacy payment via the v1 recordPayment function.
        await payments.recordPayment("uid-test", {
          householdId: hh,
          familyId: fam,
          amount: 500,
          date: new Date("2026-06-17"),
          note: null,
        });
        const before = await listPayments(hh, fam);
        expect(before).toHaveLength(1);
        const legacyDoc = before[0];
        expect(legacyDoc.coverageGroupId ?? null).toBeNull();

        await payments.deletePayment(
          "uid-test",
          hh,
          fam,
          (legacyDoc as { id: string }).id,
        );

        const after = await listPayments(hh, fam);
        expect(after).toHaveLength(0);
        const settingsSnap = await getDocs(
          query(collection(db, "settings"), where("__name__", "==", "global")),
        );
        // MOH back to opening 1000 (single decrement of 500).
        expect(settingsSnap.docs[0]?.data()?.moneyOnHand).toBe(1000);
      } finally {
        (client as { getDb: typeof realGetDb }).getDb = realGetDb;
      }
    });
  },
);

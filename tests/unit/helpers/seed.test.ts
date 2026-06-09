/**
 * Test seed helper sanity (T036b).
 *
 * The full data-shape assertion is an emulator test (skipped without
 * FIRESTORE_EMULATOR_HOST). The shape contract — what seedTestData returns —
 * is exercised unconditionally.
 */
import { describe, expect, it } from "vitest";
import { seedTestData, clearTestData } from "../../helpers/seed";

describe("seed helper (T036b) — module surface", () => {
  it("exports seedTestData and clearTestData", () => {
    expect(typeof seedTestData).toBe("function");
    expect(typeof clearTestData).toBe("function");
  });
});

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
  "seed helper (T036b) — emulator-backed",
  () => {
    it("writes the documented collections to a fresh emulator DB", async () => {
      const { initializeApp, deleteApp } = await import("firebase/app");
      const { initializeFirestore, terminate } =
        await import("firebase/firestore");
      const { getDocs, collection } = await import("firebase/firestore");

      const app = initializeApp(
        { apiKey: "demo", projectId: "seed-helper-test", appId: "1:0:web:0" },
        "seed-helper-test",
      );
      const db = initializeFirestore(app, {}, "seed-helper-test");

      try {
        const seed = await seedTestData(db, {
          householdDefs: [{ name: "H1", families: ["F1", "F2"] }],
        });
        expect(seed.households).toHaveLength(1);
        expect(seed.households[0].families).toHaveLength(2);
        expect(seed.payments).toHaveLength(2); // 1 per family
        expect(seed.expenses).toHaveLength(1);
        expect(seed.recurringTemplates).toHaveLength(1);
        expect(seed.settings.openingBalance).toBe(1000);

        // Round-trip read of the seed data
        const hhSnap = await getDocs(collection(db, "households"));
        expect(hhSnap.size).toBe(1);
        const settingsSnap = await getDocs(collection(db, "settings"));
        expect(settingsSnap.size).toBe(1);
      } finally {
        await terminate(db);
        await deleteApp(app);
      }
    });
  },
);

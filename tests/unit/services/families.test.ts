/**
 * Family invariants (T053, T069):
 * - createFamily uses addDoc (auto-generated ID, never reused)
 * - softDeleteFamily sets active=false, deletedAt, deletedBy
 * - soft-delete preserves payments
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  collection,
  doc,
  getDoc,
  initializeFirestore,
  setDoc,
  terminate,
} from "firebase/firestore";
import { initializeApp } from "firebase/app";
import * as svc from "@/lib/services/families";

let app: ReturnType<typeof initializeApp>;
let db: ReturnType<typeof initializeFirestore>;

beforeAll(() => {
  app = initializeApp(
    { apiKey: "demo", projectId: "families-test", appId: "1:0:web:0" },
    "families-test",
  );
  db = initializeFirestore(app, {}, "families-test");
});

afterAll(async () => {
  if (db) await terminate(db);
});

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
  "families service (requires emulator)",
  () => {
    it("softDeleteFamily sets active=false and preserves name", async () => {
      const { addDoc } = await import("firebase/firestore");
      const { createFamily, softDeleteFamily } =
        await import("@/lib/services/families");
      const hhRef = await addDoc(collection(db, "households"), {
        name: "T",
        createdAt: new Date(),
        createdBy: "tester",
      });
      const fid = await createFamily("tester", {
        householdId: hhRef.id,
        name: "Family A",
        contributionTarget: 200,
      });
      await softDeleteFamily("tester", hhRef.id, fid);
      const snap = await getDoc(
        doc(db, "households", hhRef.id, "families", fid),
      );
      const data = snap.data();
      expect(data?.active).toBe(false);
      expect(data?.deletedBy).toBe("tester");
      expect(data?.deletedAt).toBeTruthy();
      expect(data?.name).toBe("Family A");
    });

    it("createFamily uses addDoc: ID is auto-generated, never reused", async () => {
      const { addDoc } = await import("firebase/firestore");
      const { createFamily } = await import("@/lib/services/families");
      const hhRef = await addDoc(collection(db, "households"), {
        name: "T2",
        createdAt: new Date(),
        createdBy: "tester",
      });
      const a = await createFamily("tester", {
        householdId: hhRef.id,
        name: "A",
        contributionTarget: 50,
      });
      const b = await createFamily("tester", {
        householdId: hhRef.id,
        name: "B",
        contributionTarget: 50,
      });
      expect(a).not.toBe(b);
      expect(a.length).toBeGreaterThan(0);
      expect(b.length).toBeGreaterThan(0);
    });
  },
);

// Placeholder test so the file has at least one test even without the emulator.
describe("families — module exports", () => {
  it("exposes createFamily + softDeleteFamily", () => {
    expect(typeof svc.createFamily).toBe("function");
    expect(typeof svc.softDeleteFamily).toBe("function");
    expect(typeof svc.editFamily).toBe("function");
  });
});

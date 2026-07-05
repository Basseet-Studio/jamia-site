/**
 * Households — soft delete smoke + emulator regression.
 *
 * `deleteHousehold(uid, hhId)` soft-deletes the household doc only.
 * Families, payments, and expenses are preserved in Firestore.
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  serverTimestamp,
  setDoc,
  terminate,
  where,
  query,
} from "firebase/firestore";
import { deleteApp, initializeApp } from "firebase/app";
import * as client from "@/lib/firebase/client";
import * as svc from "@/lib/services/households";

const TEST_PROJECT = "households-soft-delete-test";

let db: ReturnType<typeof initializeFirestore>;
let app: ReturnType<typeof initializeApp>;

describe("households — soft delete", () => {
  it("deleteHousehold keeps the v1 signature", () => {
    expect(typeof svc.deleteHousehold).toBe("function");
    expect(svc.deleteHousehold.length).toBe(2);
  });

  it("does NOT expose cascade delete helpers", () => {
    expect(
      (svc as Record<string, unknown>).deleteMemberHistory,
    ).toBeUndefined();
    expect(
      (svc as Record<string, unknown>).deleteHouseholdExpenses,
    ).toBeUndefined();
  });
});

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
  "households service (requires emulator)",
  () => {
    beforeEach(async () => {
      app = initializeApp(
        { apiKey: "demo", projectId: TEST_PROJECT, appId: "1:0:web:0" },
        TEST_PROJECT,
      );
      db = initializeFirestore(app, {}, TEST_PROJECT);
    });

    afterEach(async () => {
      await terminate(db);
      await deleteApp(app);
    });

    it("deleteHousehold sets active=false and preserves families/payments/expenses", async () => {
      const realGetDb = client.getDb;
      (client as { getDb: typeof realGetDb }).getDb = () =>
        db as unknown as ReturnType<typeof realGetDb>;

      try {
        const hhRef = await addDoc(collection(db, "households"), {
          name: "Soft Delete HH",
          createdAt: serverTimestamp(),
          createdBy: "tester",
          active: true,
          deletedAt: null,
          deletedBy: null,
        });
        const famRef = await addDoc(
          collection(db, "households", hhRef.id, "families"),
          {
            name: "Family A",
            contributionTarget: 200,
            createdAt: serverTimestamp(),
            createdBy: "tester",
            active: true,
            deletedAt: null,
            deletedBy: null,
            memberCount: 0,
            memberNames: [],
          },
        );
        await addDoc(
          collection(
            db,
            "households",
            hhRef.id,
            "families",
            famRef.id,
            "payments",
          ),
          {
            amount: 100,
            month: "2026-01",
            date: serverTimestamp(),
            recordedAt: serverTimestamp(),
            recordedBy: "tester",
          },
        );
        await addDoc(collection(db, "expenses"), {
          name: "HH expense",
          amount: 50,
          type: "household",
          householdId: hhRef.id,
          familyId: null,
          mosqueSubCategory: null,
          month: "2026-01",
          date: serverTimestamp(),
          withdrawn: false,
          isRecurring: false,
          addedAt: serverTimestamp(),
          addedBy: "tester",
        });

        await svc.deleteHousehold("tester", hhRef.id);

        const hhSnap = await getDoc(doc(db, "households", hhRef.id));
        const hhData = hhSnap.data();
        expect(hhData?.active).toBe(false);
        expect(hhData?.deletedBy).toBe("tester");
        expect(hhData?.deletedAt).toBeTruthy();
        expect(hhData?.name).toBe("Soft Delete HH");

        const famSnap = await getDoc(
          doc(db, "households", hhRef.id, "families", famRef.id),
        );
        expect(famSnap.exists()).toBe(true);
        expect(famSnap.data()?.name).toBe("Family A");

        const paySnap = await getDocs(
          collection(
            db,
            "households",
            hhRef.id,
            "families",
            famRef.id,
            "payments",
          ),
        );
        expect(paySnap.docs.length).toBe(1);

        const expSnap = await getDocs(
          query(
            collection(db, "expenses"),
            where("type", "==", "household"),
            where("householdId", "==", hhRef.id),
          ),
        );
        expect(expSnap.docs.length).toBe(1);
      } finally {
        (client as { getDb: typeof realGetDb }).getDb = realGetDb;
      }
    });
  },
);

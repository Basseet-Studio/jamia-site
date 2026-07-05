/**
 * Households service: top-level collection `households`.
 * - Members are now per-family; the household doc only carries identity fields.
 * - Hard delete cascades to: the household doc, all families, all payments,
 *   and every expense with `type == "household" AND householdId == hhId`.
 * - Re-running on an already-deleted household is a safe no-op (idempotent).
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  writeBatch,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import {
  createHouseholdSchema,
  type CreateHouseholdSchema,
} from "@/lib/schemas/household";
import type { Household } from "@/lib/types";

function toHousehold(id: string, data: Record<string, unknown>): Household {
  return {
    id,
    name: String(data.name ?? ""),
    createdAt: data.createdAt as Household["createdAt"],
    createdBy: String(data.createdBy ?? ""),
  };
}

export async function listHouseholds(): Promise<Household[]> {
  const snap = await getDocs(collection(getDb(), "households"));
  return snap.docs.map((d) => toHousehold(d.id, d.data()));
}

export function subscribeHouseholds(
  callback: (h: Household[]) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "households"),
    (snap) => {
      callback(snap.docs.map((d) => toHousehold(d.id, d.data())));
    },
    (err) => {
      // #region agent log
      fetch("http://127.0.0.1:7841/ingest/d6064957-b3e4-44c8-9556-962aec9bf7da", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "24531e",
        },
        body: JSON.stringify({
          sessionId: "24531e",
          runId: "post-fix",
          hypothesisId: "H5",
          location: "households.ts:subscribeHouseholds",
          message: "households collection listener error",
          data: { code: (err as { code?: string }).code, message: err.message },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    },
  );
}

export async function getHousehold(id: string): Promise<Household | null> {
  const snap = await getDoc(doc(getDb(), "households", id));
  if (!snap.exists()) return null;
  return toHousehold(snap.id, snap.data());
}

export function subscribeHousehold(
  id: string,
  callback: (h: Household | null) => void,
): Unsubscribe {
  return onSnapshot(
    doc(getDb(), "households", id),
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback(toHousehold(snap.id, snap.data()));
    },
    (err) => {
      // #region agent log
      fetch("http://127.0.0.1:7841/ingest/d6064957-b3e4-44c8-9556-962aec9bf7da", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "24531e",
        },
        body: JSON.stringify({
          sessionId: "24531e",
          runId: "post-fix",
          hypothesisId: "H4",
          location: "households.ts:subscribeHousehold",
          message: "household doc listener error",
          data: {
            householdId: id,
            code: (err as { code?: string }).code,
            message: err.message,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    },
  );
}

export async function createHousehold(
  uid: string,
  input: CreateHouseholdSchema,
): Promise<string> {
  const parsed = createHouseholdSchema.parse(input);
  const ref = await addDoc(collection(getDb(), "households"), {
    name: parsed.name,
    createdAt: serverTimestamp(),
    createdBy: uid,
  });
  return ref.id;
}

/**
 * Hard delete a household. Cascades in chunked batches of 500 (Firestore
 * batch limit) to: the household doc, all families, all payments,
 * and every expense with `type == "household" AND householdId == hhId`.
 * Idempotent — re-running on an already-deleted household is a safe no-op.
 */
export async function deleteHousehold(
  uid: string,
  householdId: string,
): Promise<void> {
  const db = getDb();
  const CHUNK = 500;

  // #region agent log
  const dbg = (
    message: string,
    hypothesisId: string,
    data: Record<string, unknown>,
  ) => {
    fetch("http://127.0.0.1:7841/ingest/d6064957-b3e4-44c8-9556-962aec9bf7da", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "24531e",
      },
      body: JSON.stringify({
        sessionId: "24531e",
        runId: "post-fix",
        hypothesisId,
        location: "households.ts:deleteHousehold",
        message,
        data: { householdId, ...data },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  };
  dbg("deleteHousehold start", "H1", { uid });
  // #endregion

  try {
    // Collect family + payment refs.
    const familiesSnap = await getDocs(
      collection(db, "households", householdId, "families"),
    );
    const familyIds = familiesSnap.docs.map((d) => d.id);
    const paymentRefs: { ref: ReturnType<typeof doc> }[] = [];
    const memberHistoryRefs: { ref: ReturnType<typeof doc> }[] = [];
    for (const fid of familyIds) {
      const paySnap = await getDocs(
        collection(db, "households", householdId, "families", fid, "payments"),
      );
      paySnap.docs.forEach((p) => paymentRefs.push({ ref: p.ref }));
      const histSnap = await getDocs(
        collection(
          db,
          "households",
          householdId,
          "families",
          fid,
          "memberHistory",
        ),
      );
      histSnap.docs.forEach((h) => memberHistoryRefs.push({ ref: h.ref }));
    }
    // #region agent log
    dbg("collected family subtree", "H2", {
      familyCount: familyIds.length,
      paymentCount: paymentRefs.length,
      memberHistoryCount: memberHistoryRefs.length,
    });
    // #endregion

    // Collect expense refs (top-level `expenses` collection).
    let expensesSnap;
    try {
      expensesSnap = await getDocs(
        query(
          collection(db, "expenses"),
          where("type", "==", "household"),
          where("householdId", "==", householdId),
        ),
      );
      // #region agent log
      dbg("expenses query ok", "H1", {
        expenseCount: expensesSnap.docs.length,
        expensePaths: expensesSnap.docs
          .slice(0, 5)
          .map((d) => d.ref.path),
      });
      // #endregion
    } catch (expenseErr) {
      // #region agent log
      dbg("expenses query failed", "H1", {
        code: (expenseErr as { code?: string }).code,
        message: (expenseErr as Error).message,
      });
      // #endregion
      throw expenseErr;
    }

    const allRefs: { ref: ReturnType<typeof doc> }[] = [
      { ref: doc(db, "households", householdId) },
      ...familiesSnap.docs.map((d) => ({ ref: d.ref })),
      ...paymentRefs,
      ...memberHistoryRefs,
      ...expensesSnap.docs.map((d) => ({ ref: d.ref })),
    ];

    // #region agent log
    dbg("starting batch deletes", "H2", {
      totalRefs: allRefs.length,
      chunkCount: Math.ceil(allRefs.length / CHUNK),
    });
    // #endregion

    for (let i = 0; i < allRefs.length; i += CHUNK) {
      const batch = writeBatch(db);
      const chunk = allRefs.slice(i, i + CHUNK);
      chunk.forEach(({ ref }) => batch.delete(ref));
      try {
        await batch.commit();
        // #region agent log
        dbg("batch commit ok", "H2", {
          chunkIndex: i / CHUNK,
          chunkSize: chunk.length,
        });
        // #endregion
      } catch (batchErr) {
        // #region agent log
        dbg("batch commit failed", "H2", {
          chunkIndex: i / CHUNK,
          chunkSize: chunk.length,
          code: (batchErr as { code?: string }).code,
          message: (batchErr as Error).message,
          samplePaths: chunk.slice(0, 5).map(({ ref }) => ref.path),
        });
        // #endregion
        throw batchErr;
      }
    }

    // #region agent log
    dbg("deleteHousehold complete", "H2", { totalRefs: allRefs.length });
    // #endregion
  } catch (err) {
    // #region agent log
    dbg("deleteHousehold failed", "H1", {
      code: (err as { code?: string }).code,
      message: (err as Error).message,
    });
    // #endregion
    throw err;
  }
  // uid reserved for future audit log
  void uid;
}

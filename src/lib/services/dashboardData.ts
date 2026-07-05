/**
 * Dashboard helper: subscribes to all households + their monthly summaries
 * and returns a flat row per household.
 */
import { collection, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { subscribeHouseholdMonthlySummary } from "@/lib/services/derived";
import type { Household, HouseholdMonthlySummary } from "@/lib/types";

export interface HouseholdSummary {
  household: Household;
  summary: HouseholdMonthlySummary | null;
}

export function subscribeHouseholds(
  month: string,
  callback: (rows: HouseholdSummary[]) => void,
): Unsubscribe {
  let summaryUnsubs: Unsubscribe[] = [];
  const offHouseholds = onSnapshot(
    collection(getDb(), "households"),
    (snap) => {
      // #region agent log
      fetch("http://127.0.0.1:7841/ingest/d6064957-b3e4-44c8-9556-962aec9bf7da", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "24531e",
        },
        body: JSON.stringify({
          sessionId: "24531e",
          runId: "pre-fix",
          hypothesisId: "H3",
          location: "dashboardData.ts:subscribeHouseholds",
          message: "dashboard households snapshot",
          data: {
            householdCount: snap.docs.length,
            householdIds: snap.docs.map((d) => d.id),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      // Tear down old summary subscriptions.
      summaryUnsubs.forEach((u) => u());
      summaryUnsubs = [];

      const list: HouseholdSummary[] = snap.docs.map((d) => ({
        household: {
          id: d.id,
          name: String(d.data().name ?? ""),
          createdAt: d.data().createdAt as Household["createdAt"],
          createdBy: String(d.data().createdBy ?? ""),
        },
        summary: null,
      }));
      // Initial empty emit so consumers see the household list.
      callback([...list]);

      list.forEach((row) => {
        summaryUnsubs.push(
          subscribeHouseholdMonthlySummary(row.household.id, month, (s) => {
            row.summary = s;
            callback([...list]);
          }),
        );
      });
    },
  );
  return () => {
    offHouseholds();
    summaryUnsubs.forEach((u) => u());
  };
}

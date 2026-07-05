/**
 * Dashboard helper: subscribes to all households + their monthly summaries
 * and returns a flat row per household.
 */
import { collection, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { hhError, hhLog } from "@/lib/debug/householdLog";
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
      const docs = snap.docs.map((d) => ({
        id: d.id,
        name: String(d.data().name ?? ""),
        activeRaw: d.data().active,
        activeParsed: d.data().active !== false,
      }));
      // Tear down old summary subscriptions.
      summaryUnsubs.forEach((u) => u());
      summaryUnsubs = [];

      const list: HouseholdSummary[] = snap.docs
        .filter((d) => d.data().active !== false)
        .map((d) => ({
          household: {
            id: d.id,
            name: String(d.data().name ?? ""),
            createdAt: d.data().createdAt as Household["createdAt"],
            createdBy: String(d.data().createdBy ?? ""),
            active: d.data().active !== false,
            deletedAt: (d.data().deletedAt as Household["deletedAt"]) ?? null,
            deletedBy: (d.data().deletedBy as Household["deletedBy"]) ?? null,
          },
          summary: null,
        }));
      hhLog("dashboardData:snapshot", {
        month,
        totalDocs: snap.docs.length,
        activeCount: list.length,
        docs,
        activeIds: list.map((r) => r.household.id),
      });
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
    (err) => {
      hhError("dashboardData:listener-error", {
        month,
        code: (err as { code?: string }).code,
        message: err.message,
      });
    },
  );
  return () => {
    offHouseholds();
    summaryUnsubs.forEach((u) => u());
  };
}

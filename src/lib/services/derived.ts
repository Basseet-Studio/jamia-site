/**
 * Derived / live subscriptions: family statuses, household summaries, expense summaries.
 */
import {
  collection,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import type {
  AllTimeExpenseSummary,
  Expense,
  Family,
  FamilyMonthlyStatus,
  FamilyMonthlySummary,
  HouseholdMonthlySummary,
  MonthlyExpenseSummary,
  Payment,
} from "@/lib/types";
import { stepMonthKey, toMonthKey } from "@/lib/utils/dates";

export type {
  AllTimeExpenseSummary,
  FamilyMonthlyStatus,
  FamilyMonthlySummary,
  HouseholdMonthlySummary,
  MonthlyExpenseSummary,
};

function deriveStatus(totalPaid: number, target: number): FamilyMonthlyStatus {
  if (totalPaid === 0) return "Unpaid";
  if (totalPaid < target) return "Partial";
  if (totalPaid === target) return "Met";
  return "Over";
}

function sumPaidForFamilyInMonth(payments: Payment[], month: string): number {
  return payments
    .filter((p) => p.month === month)
    .reduce((s, p) => s + (p.amount ?? 0), 0);
}

export function deriveHouseholdFinancialSummary(
  payments: Payment[],
  expenses: Expense[],
): { totalContributions: number; totalExpenses: number; net: number } {
  const totalContributions = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalExpenses = expenses
    .filter((expense) => !expense.withdrawn)
    .reduce((sum, expense) => sum + expense.amount, 0);
  return {
    totalContributions,
    totalExpenses,
    net: totalContributions - totalExpenses,
  };
}

export function deriveFamilySummary(
  family: Family,
  payments: Payment[],
  asOfDate: Date,
): { totalPaid: number; totalExpected: number } {
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const start = family.createdAt?.toDate
    ? toMonthKey(family.createdAt.toDate())
    : toMonthKey(asOfDate);
  const end = toMonthKey(asOfDate);
  let months = 0;
  let cursor = start > end ? end : start;
  while (cursor <= end) {
    months += 1;
    cursor = stepMonthKey(cursor, 1);
  }
  return {
    totalPaid,
    totalExpected: family.contributionTarget * months,
  };
}

/**
 * Per-family status for a household in a given month.
 * Subscribes to families + payments under each family. Returns one summary per
 * active family (inactive families are excluded from the result).
 */
export function subscribeFamilyMonthlyStatuses(
  householdId: string,
  month: string,
  callback: (summaries: FamilyMonthlySummary[]) => void,
): Unsubscribe {
  const db = getDb();
  let families: Family[] = [];
  const paymentsByFamily = new Map<string, Payment[]>();
  let perFamilyUnsubs: Unsubscribe[] = [];

  const emit = () => {
    const out: FamilyMonthlySummary[] = families
      .filter((f) => f.active)
      .map((f) => {
        const total = sumPaidForFamilyInMonth(
          paymentsByFamily.get(f.id) ?? [],
          month,
        );
        return {
          familyId: f.id,
          month,
          totalPaid: total,
          target: f.contributionTarget,
          status: deriveStatus(total, f.contributionTarget),
        };
      });
    callback(out);
  };

  const rewirePayments = (newFamilies: Family[]) => {
    perFamilyUnsubs.forEach((u) => u());
    perFamilyUnsubs = [];
    newFamilies.forEach((f) => {
      perFamilyUnsubs.push(
        onSnapshot(
          collection(
            db,
            "households",
            householdId,
            "families",
            f.id,
            "payments",
          ),
          (snap) => {
            paymentsByFamily.set(
              f.id,
              snap.docs.map((d) => ({
                id: d.id,
                householdId,
                familyId: f.id,
                amount:
                  typeof d.data().amount === "number"
                    ? (d.data().amount as number)
                    : 0,
                date: d.data().date as Payment["date"],
                month: String(d.data().month ?? ""),
                note: (d.data().note as Payment["note"]) ?? null,
                recordedAt: d.data().recordedAt as Payment["recordedAt"],
                recordedBy: String(d.data().recordedBy ?? ""),
                coverageGroupId:
                  typeof d.data().coverageGroupId === "string"
                    ? (d.data().coverageGroupId as string)
                    : null,
              })),
            );
            emit();
          },
        ),
      );
    });
  };

  const u1 = onSnapshot(
    collection(db, "households", householdId, "families"),
    (snap) => {
      families = snap.docs.map((d) => ({
        id: d.id,
        householdId,
        name: String(d.data().name ?? ""),
        contributionTarget:
          typeof d.data().contributionTarget === "number"
            ? (d.data().contributionTarget as number)
            : 0,
        createdAt: d.data().createdAt as Family["createdAt"],
        createdBy: String(d.data().createdBy ?? ""),
        active: d.data().active !== false,
        deletedAt: (d.data().deletedAt as Family["deletedAt"]) ?? null,
        deletedBy: (d.data().deletedBy as Family["deletedBy"]) ?? null,
        memberCount:
          typeof d.data().memberCount === "number"
            ? (d.data().memberCount as number)
            : 0,
        memberNames: Array.isArray(d.data().memberNames)
          ? (d.data().memberNames as string[])
          : [],
        updatedAt: (d.data().updatedAt as Family["updatedAt"]) ?? null,
        updatedBy: (d.data().updatedBy as Family["updatedBy"]) ?? null,
      }));
      rewirePayments(families);
      emit();
    },
  );

  return () => {
    u1();
    perFamilyUnsubs.forEach((u) => u());
  };
}

/**
 * Monthly summary for one household.
 * Reads family statuses and adds the household total collected (sum of
 * payments.amount where month==M across all families, active AND inactive).
 */
export function subscribeHouseholdMonthlySummary(
  householdId: string,
  month: string,
  callback: (s: HouseholdMonthlySummary) => void,
): Unsubscribe {
  const db = getDb();
  let lastFamilies: Family[] = [];
  let lastStatuses: FamilyMonthlySummary[] = [];
  let lastPayments: Payment[] = [];

  const emit = () => {
    const activeFamilies = lastFamilies.filter((f) => f.active);
    const statusById = new Map(lastStatuses.map((s) => [s.familyId, s]));
    const familiesPaidFull = activeFamilies.filter(
      (f) =>
        statusById.get(f.id)?.status === "Met" ||
        statusById.get(f.id)?.status === "Over",
    ).length;
    const familiesPartial = activeFamilies.filter(
      (f) => statusById.get(f.id)?.status === "Partial",
    ).length;
    const familiesUnpaid = activeFamilies.filter(
      (f) => statusById.get(f.id)?.status === "Unpaid" || !statusById.has(f.id),
    ).length;
    const totalCollected = lastPayments
      .filter((p) => p.month === month)
      .reduce((s, p) => s + (p.amount ?? 0), 0);
    const totalTarget = activeFamilies.reduce(
      (s, f) => s + f.contributionTarget,
      0,
    );
    const collectionRate =
      totalTarget > 0 ? totalCollected / totalTarget : null;
    callback({
      householdId,
      month,
      totalFamilies: activeFamilies.length,
      familiesPaidFull,
      familiesPartial,
      familiesUnpaid,
      totalCollected,
      totalTarget,
      collectionRate,
    });
  };

  const u1 = onSnapshot(
    collection(db, "households", householdId, "families"),
    (snap) => {
      lastFamilies = snap.docs.map((d) => ({
        id: d.id,
        householdId,
        name: String(d.data().name ?? ""),
        contributionTarget:
          typeof d.data().contributionTarget === "number"
            ? (d.data().contributionTarget as number)
            : 0,
        createdAt: d.data().createdAt as Family["createdAt"],
        createdBy: String(d.data().createdBy ?? ""),
        active: d.data().active !== false,
        deletedAt: (d.data().deletedAt as Family["deletedAt"]) ?? null,
        deletedBy: (d.data().deletedBy as Family["deletedBy"]) ?? null,
        memberCount:
          typeof d.data().memberCount === "number"
            ? (d.data().memberCount as number)
            : 0,
        memberNames: Array.isArray(d.data().memberNames)
          ? (d.data().memberNames as string[])
          : [],
        updatedAt: (d.data().updatedAt as Family["updatedAt"]) ?? null,
        updatedBy: (d.data().updatedBy as Family["updatedBy"]) ?? null,
      }));
      emit();
    },
  );

  const u2 = subscribeFamilyMonthlyStatuses(householdId, month, (summaries) => {
    lastStatuses = summaries;
    emit();
  });

  // Collection-group query on payments filtered by month. All payments for the
  // household (across families) show up; filter by family in lastFamilies.
  const u3 = onSnapshot(
    query(collectionGroup(db, "payments"), where("month", "==", month)),
    (snap) => {
      const familyIds = new Set(lastFamilies.map((f) => f.id));
      lastPayments = snap.docs
        .filter((d) => {
          const fid = d.ref.parent.parent?.id;
          return fid ? familyIds.has(fid) : false;
        })
        .map((d) => ({
          id: d.id,
          householdId,
          familyId: d.ref.parent.parent?.id ?? "",
          amount:
            typeof d.data().amount === "number"
              ? (d.data().amount as number)
              : 0,
          date: d.data().date as Payment["date"],
          month: String(d.data().month ?? ""),
          note: (d.data().note as Payment["note"]) ?? null,
          recordedAt: d.data().recordedAt as Payment["recordedAt"],
          recordedBy: String(d.data().recordedBy ?? ""),
          coverageGroupId:
            typeof d.data().coverageGroupId === "string"
              ? (d.data().coverageGroupId as string)
              : null,
        }));
      emit();
    },
  );

  return () => {
    u1();
    u2();
    u3();
  };
}

// Re-export collectionGroup from firestore.
import { collectionGroup } from "firebase/firestore";

/** Live monthly expense summary. */
export function subscribeMonthlyExpenseSummary(
  month: string,
  callback: (s: MonthlyExpenseSummary) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(getDb(), "expenses"), where("month", "==", month)),
    (snap) => {
      const docs = snap.docs.map((d) => d.data());
      const totalAdded = docs.reduce(
        (s, d) => s + (typeof d.amount === "number" ? (d.amount as number) : 0),
        0,
      );
      const totalWithdrawn = docs
        .filter((d) => d.withdrawn === true)
        .reduce(
          (s, d) =>
            s + (typeof d.amount === "number" ? (d.amount as number) : 0),
          0,
        );
      callback({
        month,
        totalAdded,
        totalWithdrawn,
        totalPending: totalAdded - totalWithdrawn,
      });
    },
  );
}

/** Live all-time expense summary. */
export function subscribeAllTimeExpenseSummary(
  callback: (s: AllTimeExpenseSummary) => void,
): Unsubscribe {
  return onSnapshot(collection(getDb(), "expenses"), (snap) => {
    const docs = snap.docs.map((d) => d.data());
    const totalAdded = docs.reduce(
      (s, d) => s + (typeof d.amount === "number" ? (d.amount as number) : 0),
      0,
    );
    const totalWithdrawn = docs
      .filter((d) => d.withdrawn === true)
      .reduce(
        (s, d) => s + (typeof d.amount === "number" ? (d.amount as number) : 0),
        0,
      );
    callback({ totalAdded, totalWithdrawn });
  });
}

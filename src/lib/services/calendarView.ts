/**
 * Calendar view service (US-4) + monthly totals helper (US-3).
 *
 * `subscribeCalendarView` opens three onSnapshot listeners (recurring
 * templates, expenses for the month, shortfall) and re-emits a
 * `CalendarView` where each recurring template row is annotated with the
 * derived status (NotAdded | PendingWithdrawal | Withdrawn) and ad-hoc
 * expenses (recurringId == null) are listed in date-desc order.
 *
 * `getMonthlyTotals` is the one-shot summary used by the recurring-expense
 * withdraw dialog.
 */
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { subscribeMonthlyShortfall } from "@/lib/services/shortfallSubscription";
import { subscribeMonthlyExpenseSummary } from "@/lib/services/derived";
import type {
  CalendarAdHocRow,
  CalendarTemplateRow,
  CalendarView,
  Expense,
  MonthlyExpenseTotals,
  RecurringTemplate,
} from "@/lib/types";

const ACTIVE_TEMPLATE_STATUS = (withdrawn: boolean) =>
  withdrawn ? "Withdrawn" : "PendingWithdrawal";

export function subscribeCalendarView(
  month: string,
  callback: (v: CalendarView) => void,
): Unsubscribe {
  const db = getDb();

  let templates: RecurringTemplate[] = [];
  let monthExpenses: Expense[] = [];
  let shortfall: CalendarView["shortfall"] = null;

  const emit = () => {
    // Index this month's expenses by recurringId.
    const byTpl = new Map<
      string,
      { id: string; withdrawn: boolean }
    >();
    const adHoc: CalendarAdHocRow[] = [];
    monthExpenses.forEach((e) => {
      if (e.recurringId) {
        if (!byTpl.has(e.recurringId)) {
          byTpl.set(e.recurringId, { id: e.id, withdrawn: e.withdrawn });
        }
        return;
      }
      adHoc.push({ expense: e });
    });
    adHoc.sort((a, b) => {
      const ad = a.expense.date?.toDate
        ? a.expense.date.toDate().getTime()
        : 0;
      const bd = b.expense.date?.toDate
        ? b.expense.date.toDate().getTime()
        : 0;
      return bd - ad;
    });

    const templateRows: CalendarTemplateRow[] = templates.map((template) => {
      const hit = byTpl.get(template.id);
      if (!hit) {
        return { template, status: "NotAdded", expenseId: null };
      }
      return {
        template,
        status: ACTIVE_TEMPLATE_STATUS(hit.withdrawn),
        expenseId: hit.id,
      };
    });
    templateRows.sort((a, b) => a.template.name.localeCompare(b.template.name));

    callback({
      month,
      templates: templateRows,
      adHoc,
      shortfall,
    });
  };

  const u1 = onSnapshot(
    query(collection(db, "recurringExpenses"), where("active", "==", true)),
    (snap) => {
      templates = snap.docs.map((d) => {
        const data = d.data();
        const rawSub = data.mosqueSubCategory as
          | RecurringTemplate["mosqueSubCategory"]
          | undefined;
        const mosqueSubCategory: RecurringTemplate["mosqueSubCategory"] =
          rawSub === "maintenance" || rawSub === "salary" || rawSub === "other"
            ? rawSub
            : "other";
        return {
          id: d.id,
          name: String(data.name ?? ""),
          amount:
            typeof data.amount === "number" ? (data.amount as number) : 0,
          description: (data.description as string | null) ?? null,
          active: data.active !== false,
          createdAt: data.createdAt as RecurringTemplate["createdAt"],
          createdBy: String(data.createdBy ?? ""),
          type: "mosque" as const,
          householdId: null,
          familyId: null,
          mosqueSubCategory,
        };
      });
      emit();
    },
  );

  const u2 = onSnapshot(
    query(
      collection(db, "expenses"),
      where("month", "==", month),
      orderBy("date", "desc"),
    ),
    (snap) => {
      monthExpenses = snap.docs.map((d) => ({
        id: d.id,
        name: String(d.data().name ?? ""),
        amount:
          typeof d.data().amount === "number" ? (d.data().amount as number) : 0,
        date: d.data().date as Expense["date"],
        month: String(d.data().month ?? ""),
        note: (d.data().note as Expense["note"]) ?? null,
        isRecurring: d.data().isRecurring === true,
        recurringId: (d.data().recurringId as Expense["recurringId"]) ?? null,
        withdrawn: d.data().withdrawn === true,
        withdrawnAt: (d.data().withdrawnAt as Expense["withdrawnAt"]) ?? null,
        withdrawnBy: (d.data().withdrawnBy as Expense["withdrawnBy"]) ?? null,
        addedAt: d.data().addedAt as Expense["addedAt"],
        addedBy: String(d.data().addedBy ?? ""),
        type:
          (d.data().type as Expense["type"]) === "household"
            ? "household"
            : "mosque",
        householdId:
          (d.data().type as string) === "household"
            ? (d.data().householdId as string | null) ?? null
            : null,
        familyId:
          (d.data().type as string) === "household"
            ? ((d.data().familyId as string | null) ?? null)
            : null,
        mosqueSubCategory:
          (d.data().type as string) === "mosque"
            ? ((d.data().mosqueSubCategory as Expense["mosqueSubCategory"]) ?? null)
            : null,
      }));
      emit();
    },
  );

  const u3 = subscribeMonthlyShortfall(month, (s) => {
    shortfall = s;
    emit();
  });

  return () => {
    u1();
    u2();
    u3();
  };
}

/** One-shot summary used by the recurring-expense WithdrawDialog. */
export async function getMonthlyTotals(
  month: string,
): Promise<MonthlyExpenseTotals> {
  const expenseSummary = await new Promise<{
    totalAdded: number;
    totalWithdrawn: number;
    totalPending: number;
  }>((resolve, reject) => {
    const off = subscribeMonthlyExpenseSummary(month, (s) => {
      off();
      resolve(s);
    });
    // 3s best-effort ceiling (matches FR-031).
    setTimeout(() => {
      off();
      reject(new Error("subscribeMonthlyExpenseSummary timed out"));
    }, 3000);
  });

  const shortfall = await new Promise<MonthlyExpenseTotals["shortfall"]>(
    (resolve, reject) => {
      const off = subscribeMonthlyShortfall(month, (s) => {
        off();
        resolve(s);
      });
      setTimeout(() => {
        off();
        reject(new Error("subscribeMonthlyShortfall timed out"));
      }, 3000);
    },
  );

  return {
    month,
    totalAdded: expenseSummary.totalAdded,
    totalWithdrawn: expenseSummary.totalWithdrawn,
    totalPending: expenseSummary.totalPending,
    shortfall,
  };
}

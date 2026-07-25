/**
 * Pure coverage-planning algorithm.
 *
 * `planCoverage()` builds candidate spillover slots (checkboxes).
 * `resolveCoverageAllocation()` turns current + selected candidates into the
 * final write list, auto-applying any leftover to the next eligible months
 * so every cent hits a monthly target when target > 0.
 *
 * Pure means: no side effects, no I/O, no globals.
 */
import { toMonthKey, stepMonthKey } from "@/lib/utils/dates";
import type { Payment } from "@/lib/types";

export interface MonthSlot {
  /** "YYYY-MM" — the month covered by this slot. */
  month: string;
  /**
   * Amount toward this month's remaining capacity (may be Partial).
   * For candidates: suggested allocation if this slot is included.
   */
  amount: number;
  /** True for checkbox rows; false for current / auto slots. */
  selectable: boolean;
  /** Initial checked state for selectable rows. */
  defaultSelected: boolean;
  /** True when this slot was auto-filled from leftover (not a checkbox). */
  auto?: boolean;
}

export interface CoveragePlan {
  /** UUID v4 — same value across all sibling writes from one submission. */
  coverageGroupId: string;
  /** Slot for the admin's entered `date` month. Null only if target <= 0. */
  currentMonth: MonthSlot | null;
  /** Oldest-first. Empty when no back months are eligible. */
  backMonths: MonthSlot[];
  /** Oldest-first. Empty when checkbox is off OR back cascade had room. */
  futureMonths: MonthSlot[];
  /**
   * Default-selection preview total (current + defaultSelected + auto).
   * Equals `amount` when target > 0.
   */
  totalAmount: number;
  /**
   * Unallocated excess. Always 0 when target > 0 (auto remainder).
   * Equals `amount` when target <= 0.
   */
  overLimitRemainder: number;
  /** Sum already paid toward the current month before this payment. */
  alreadyPaidCurrent: number;
  /** Remaining capacity on the current month before this payment. */
  remainingCapacityCurrent: number;
}

export interface PlanCoverageArgs {
  /** Admin's entered amount (> 0). */
  amount: number;
  /** Admin's entered date — derives the current-month slot. */
  date: Date;
  /** Family config; target=0 disables cascade entirely. */
  family: {
    contributionTarget: number;
    createdAt: Date | null;
  };
  /** Existing payments for the family (any months). */
  payments: Payment[];
  /** Whether to enumerate future-month candidates when back months are clear. */
  applyToFutureMonths: boolean;
  /**
   * Optional injected UUID source — defaults to `crypto.randomUUID()`. Tests
   * pass a deterministic generator; production callers omit it.
   */
  randomUUID?: () => string;
  /**
   * Optional pre-generated UUID — when provided, the algorithm uses this
   * value for `coverageGroupId` instead of generating a fresh one.
   */
  coverageGroupId?: string;
}

export interface ResolveCoverageArgs {
  amount: number;
  date: Date;
  family: {
    contributionTarget: number;
    createdAt: Date | null;
  };
  payments: Payment[];
  /** Months the admin checked (back/future candidates). */
  selectedCoverageMonths: string[];
  /** Cap how far auto-remainder may look ahead (months). */
  maxAutoMonths?: number;
}

export interface CoverageWrite {
  month: string;
  amount: number;
  primary: boolean;
  auto: boolean;
}

/** Sum payment amounts per month key. */
export function sumPaidByMonth(payments: Payment[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of payments) {
    if (!p.month) continue;
    map.set(p.month, (map.get(p.month) ?? 0) + p.amount);
  }
  return map;
}

/** Remaining room toward target for a month (0 if Met/Over). */
export function monthRemainingCapacity(
  month: string,
  target: number,
  paidByMonth: Map<string, number>,
): number {
  if (target <= 0) return 0;
  const paid = paidByMonth.get(month) ?? 0;
  return Math.max(0, target - paid);
}

/** Returns the oldest month key present in `payments`, or null if empty. */
function oldestPaymentMonth(payments: Payment[]): string | null {
  if (payments.length === 0) return null;
  let oldest: string | null = null;
  for (const p of payments) {
    if (!p.month) continue;
    if (oldest === null || p.month < oldest) oldest = p.month;
  }
  return oldest;
}

function maxMonth(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a > b ? a : b;
}

function maxMonthAmong(months: string[]): string | null {
  if (months.length === 0) return null;
  let max = months[0]!;
  for (const m of months) {
    if (m > max) max = m;
  }
  return max;
}

/**
 * Enumerate eligible months and greedily take up to `budget` from each
 * month's remaining capacity. Returns slots in encounter order.
 */
function takeFromMonths(
  months: string[],
  budget: number,
  target: number,
  paidByMonth: Map<string, number>,
  opts: { selectable: boolean; defaultSelected: (index: number) => boolean },
): { slots: MonthSlot[]; used: number } {
  const slots: MonthSlot[] = [];
  let left = budget;
  let index = 0;
  for (const month of months) {
    if (left <= 0) break;
    const capacity = monthRemainingCapacity(month, target, paidByMonth);
    if (capacity <= 0) continue;
    const amount = Math.min(capacity, left);
    slots.push({
      month,
      amount,
      selectable: opts.selectable,
      defaultSelected: opts.defaultSelected(index),
    });
    left -= amount;
    index += 1;
  }
  return { slots, used: budget - left };
}

/** List back-month keys (oldest→newest) with remaining capacity before current. */
function listBackMonthKeys(
  family: { createdAt: Date | null },
  payments: Payment[],
  currentMonthKey: string,
  target: number,
  paidByMonth: Map<string, number>,
): string[] {
  const familyStart = family.createdAt ? toMonthKey(family.createdAt) : null;
  const oldestPayment = oldestPaymentMonth(payments);
  const start = maxMonth(familyStart, oldestPayment);
  if (start === null) return [];
  const keys: string[] = [];
  let m = start;
  // Bound: from start up to (but not including) current, max ~20 years.
  for (let i = 0; i < 240 && m < currentMonthKey; i++) {
    if (monthRemainingCapacity(m, target, paidByMonth) > 0) {
      keys.push(m);
    }
    m = stepMonthKey(m, 1);
  }
  return keys;
}

/** List future month keys with remaining capacity, oldest first. */
function listFutureMonthKeys(
  currentMonthKey: string,
  target: number,
  paidByMonth: Map<string, number>,
  countHint: number,
): string[] {
  const keys: string[] = [];
  let m = stepMonthKey(currentMonthKey, 1);
  for (let i = 0; i < 240 && keys.length < Math.max(countHint, 1); i++) {
    if (monthRemainingCapacity(m, target, paidByMonth) > 0) {
      keys.push(m);
    }
    m = stepMonthKey(m, 1);
  }
  return keys;
}

/** Pure function — builds candidate slots + default allocation preview. */
export function planCoverage(args: PlanCoverageArgs): CoveragePlan {
  const {
    amount,
    date,
    family,
    payments,
    applyToFutureMonths,
    randomUUID,
    coverageGroupId: providedId,
  } = args;
  const uuid = randomUUID ?? cryptoRandomUUID();
  const target = family.contributionTarget;
  const currentMonthKey = toMonthKey(date);
  const paidByMonth = sumPaidByMonth(payments);
  const remainingCapacityCurrent = monthRemainingCapacity(
    currentMonthKey,
    target,
    paidByMonth,
  );
  const alreadyPaidCurrent = paidByMonth.get(currentMonthKey) ?? 0;

  if (target <= 0) {
    return {
      coverageGroupId: providedId ?? uuid(),
      currentMonth: null,
      backMonths: [],
      futureMonths: [],
      totalAmount: 0,
      overLimitRemainder: Math.max(0, amount),
      alreadyPaidCurrent,
      remainingCapacityCurrent: 0,
    };
  }

  const coverageGroupId = providedId ?? uuid();
  const currentAmount = Math.min(Math.max(0, amount), remainingCapacityCurrent);
  const currentMonth: MonthSlot | null =
    currentAmount > 0 || remainingCapacityCurrent > 0
      ? {
          month: currentMonthKey,
          amount: currentAmount,
          selectable: false,
          defaultSelected: true,
        }
      : {
          month: currentMonthKey,
          amount: 0,
          selectable: false,
          defaultSelected: true,
        };

  const excess = Math.max(0, amount - currentAmount);

  const backKeys = listBackMonthKeys(
    family,
    payments,
    currentMonthKey,
    target,
    paidByMonth,
  );
  const { slots: backMonths } = takeFromMonths(
    backKeys,
    excess,
    target,
    paidByMonth,
    { selectable: true, defaultSelected: () => false },
  );

  let futureMonths: MonthSlot[] = [];
  if (applyToFutureMonths && backMonths.length === 0 && excess > 0) {
    // Enough future months to absorb excess (partial last month OK).
    const futureKeys = listFutureMonthKeys(
      currentMonthKey,
      target,
      paidByMonth,
      // Hint: at least one slot per unit of target, plus one for partial.
      Math.ceil(excess / target) + 1,
    );
    const taken = takeFromMonths(futureKeys, excess, target, paidByMonth, {
      selectable: true,
      defaultSelected: (index) => index === 0,
    });
    futureMonths = taken.slots;
  }

  // Default preview: resolve with default-selected months so remainder is
  // auto-applied and totalAmount === amount.
  const defaultSelected = [...backMonths, ...futureMonths]
    .filter((s) => s.defaultSelected)
    .map((s) => s.month);
  const resolved = resolveCoverageAllocation({
    amount,
    date,
    family,
    payments,
    selectedCoverageMonths: defaultSelected,
  });

  return {
    coverageGroupId,
    currentMonth,
    backMonths,
    futureMonths,
    totalAmount: resolved.totalAmount,
    overLimitRemainder: resolved.overLimitRemainder,
    alreadyPaidCurrent,
    remainingCapacityCurrent,
  };
}

/**
 * Resolve current + checked spillover + auto remainder into write slots.
 * When target > 0, allocates the full `amount` (no loose money).
 */
export function resolveCoverageAllocation(
  args: ResolveCoverageArgs,
): {
  writes: CoverageWrite[];
  totalAmount: number;
  overLimitRemainder: number;
  autoMonths: MonthSlot[];
} {
  const {
    amount,
    date,
    family,
    payments,
    selectedCoverageMonths,
    maxAutoMonths = 240,
  } = args;
  const target = family.contributionTarget;
  const currentMonthKey = toMonthKey(date);
  const paidByMonth = sumPaidByMonth(payments);

  if (target <= 0) {
    return {
      writes: [],
      totalAmount: 0,
      overLimitRemainder: Math.max(0, amount),
      autoMonths: [],
    };
  }

  const selectedSet = new Set(selectedCoverageMonths);
  const writes: CoverageWrite[] = [];
  let remaining = Math.max(0, amount);

  const currentCap = monthRemainingCapacity(
    currentMonthKey,
    target,
    paidByMonth,
  );
  const currentAmount = Math.min(remaining, currentCap);
  if (currentAmount > 0) {
    writes.push({
      month: currentMonthKey,
      amount: currentAmount,
      primary: true,
      auto: false,
    });
    remaining -= currentAmount;
  }

  // Apply selected spillover in chronological order among the selected set.
  const selectedOrdered = [...selectedSet].sort();
  for (const month of selectedOrdered) {
    if (remaining <= 0) break;
    if (month === currentMonthKey) continue;
    // Simulate capacity reduced by amounts already queued in this batch.
    const batchPaid = writes
      .filter((w) => w.month === month)
      .reduce((s, w) => s + w.amount, 0);
    const capacity =
      monthRemainingCapacity(month, target, paidByMonth) - batchPaid;
    if (capacity <= 0) continue;
    const take = Math.min(capacity, remaining);
    writes.push({
      month,
      amount: take,
      primary: false,
      auto: false,
    });
    remaining -= take;
  }

  // Auto remainder: chronologically after the latest *selected spillover*
  // month when any were checked; otherwise after the current month.
  // Never leave loose money.
  const autoMonths: MonthSlot[] = [];
  if (remaining > 0) {
    const selectedAnchor = maxMonthAmong(selectedOrdered);
    const anchor =
      selectedAnchor ??
      maxMonthAmong(writes.map((w) => w.month)) ??
      currentMonthKey;
    let m = stepMonthKey(anchor, 1);
    const writtenMonths = new Set(writes.map((w) => w.month));
    for (let i = 0; i < maxAutoMonths && remaining > 0; i++) {
      if (!writtenMonths.has(m)) {
        const capacity = monthRemainingCapacity(m, target, paidByMonth);
        if (capacity > 0) {
          const take = Math.min(capacity, remaining);
          writes.push({
            month: m,
            amount: take,
            primary: false,
            auto: true,
          });
          autoMonths.push({
            month: m,
            amount: take,
            selectable: false,
            defaultSelected: true,
            auto: true,
          });
          writtenMonths.add(m);
          remaining -= take;
        }
      }
      m = stepMonthKey(m, 1);
    }
  }

  // If current had 0 capacity and we still wrote spillover, mark first write primary.
  if (writes.length > 0 && !writes.some((w) => w.primary)) {
    writes[0]!.primary = true;
  }

  const totalAmount = writes.reduce((s, w) => s + w.amount, 0);
  return {
    writes,
    totalAmount,
    overLimitRemainder: Math.max(0, amount - totalAmount),
    autoMonths,
  };
}

/** Wraps `crypto.randomUUID()` so callers can mock it in tests. */
function cryptoRandomUUID(): () => string {
  return () =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : "00000000-0000-4000-8000-000000000000";
}

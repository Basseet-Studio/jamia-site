/**
 * 003 — Pure coverage-planning algorithm.
 *
 * `planCoverage()` is the single source of truth for cascade math. It is used
 * by both the dialog preview (live, on every keystroke) and by the
 * `recordPaymentWithCoverage` service (inside the Firestore txn, where it
 * also re-reads the family's payments to filter out newly-paid months).
 *
 * Pure means: no side effects, no I/O, no globals. Inputs are values; outputs
 * are values. This makes it trivial to unit-test and safe to call inside a
 * transaction body.
 *
 * Algorithm reference: data-model.md §2. The contract is:
 *   1. target = family.contributionTarget
 *   2. If target <= 0: return empty plan, overLimitRemainder = amount.
 *   3. currentMonth slot always exists (when target > 0).
 *   4. backMonths: oldest-first, skip months already in `payments`, stop on
 *      `excess < target` (whole-month rule).
 *   5. futureMonths: only when `applyToFutureMonths`, only when back cascade
 *      added nothing, oldest-first, same whole-month rule.
 *   6. overLimitRemainder = amount - totalAmount (>= 0).
 *   7. coverageGroupId is fresh per call (UUID v4).
 */
import { toMonthKey, stepMonthKey } from "@/lib/utils/dates";
import type { Payment } from "@/lib/types";

export interface MonthSlot {
  /** "YYYY-MM" — the month covered by this slot. */
  month: string;
  /**
   * Current month: `min(enteredAmount, target)`. Spillover slots: always
   * `target` (whole-month rule).
   */
  amount: number;
  /** True for checkbox rows; false for the always-included current month. */
  selectable: boolean;
  /** Initial checked state for selectable rows. */
  defaultSelected: boolean;
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
  /** Sum of all slot amounts — the actual MOH shift. */
  totalAmount: number;
  /** amount - totalAmount. Non-negative; unallocated excess. */
  overLimitRemainder: number;
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
   * value for `coverageGroupId` instead of generating a fresh one. The submit
   * path passes the ID it generated once at plan time so the txn writes
   * N docs sharing the same UUID.
   */
  coverageGroupId?: string;
}

/** Returns the oldest month key present in `payments`, or null if empty. */
function oldestPaymentMonth(payments: Payment[]): string | null {
  if (payments.length === 0) return null;
  // Payments may not be sorted; pick the lexicographically smallest month key.
  let oldest: string | null = null;
  for (const p of payments) {
    if (!p.month) continue;
    if (oldest === null || p.month < oldest) oldest = p.month;
  }
  return oldest;
}

/**
 * Returns the latest of the two month keys, or null if both null. Both inputs
 * are in canonical "YYYY-MM" form so lexicographic comparison is correct.
 */
function maxMonth(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a > b ? a : b;
}

/** Pure function. See module header for contract. */
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

  // Guard: zero target disables spillover entirely (Edge case in spec).
  if (target <= 0) {
    return {
      coverageGroupId: providedId ?? uuid(),
      currentMonth: null,
      backMonths: [],
      futureMonths: [],
      totalAmount: 0,
      overLimitRemainder: Math.max(0, amount),
    };
  }

  const coverageGroupId = providedId ?? uuid();

  // Current-month slot is capped at target; excess is allocated only via
  // opt-in spillover slots (data-model §2). Under-target payments keep the
  // entered amount so Partial months stay accurate.
  const currentMonth: MonthSlot = {
    month: currentMonthKey,
    amount: Math.min(amount, target),
    selectable: false,
    defaultSelected: true,
  };
  const excess = Math.max(0, amount - target);
  const slotCapacity = Math.floor(excess / target);

  // Back cascade: oldest unpaid month first, stop when excess < target.
  const backMonths: MonthSlot[] = [];
  const paidSet = new Set(payments.map((p) => p.month));
  if (slotCapacity > 0) {
    const familyStart = family.createdAt ? toMonthKey(family.createdAt) : null;
    const oldestPayment = oldestPaymentMonth(payments);
    // Start from the LATER of the family creation month and the oldest known
    // payment month. Defensive against a family.createdAt in the future or
    // older than the first payment (FR-005..FR-009).
    const start = maxMonth(familyStart, oldestPayment);
    if (start !== null) {
      let m = start;
      while (m < currentMonthKey && backMonths.length < slotCapacity) {
        if (!paidSet.has(m)) {
          backMonths.push({
            month: m,
            amount: target,
            selectable: true,
            defaultSelected: false,
          });
        }
        m = stepMonthKey(m, 1);
      }
    }
  }

  // Future cascade: only when back cascade had nothing to fill (so we know
  // back is fully paid) AND the admin opted in via the checkbox.
  const futureMonths: MonthSlot[] = [];
  if (applyToFutureMonths && backMonths.length === 0 && slotCapacity > 0) {
    const futurePaidSet = new Set(payments.map((p) => p.month));
    let m = stepMonthKey(currentMonthKey, 1);
    while (futureMonths.length < slotCapacity) {
      if (!futurePaidSet.has(m)) {
        futureMonths.push({
          month: m,
          amount: target,
          selectable: true,
          defaultSelected: futureMonths.length === 0,
        });
      } else {
        // Already paid future month — skip it but keep looking. In practice
        // future payments are rare, but we stay safe.
        // The loop guard `excess >= target` would normally never exit on a
        // dense paid future calendar, so we break defensively after a hard
        // cap of 240 months (~20 years) to bound work.
        if (futureMonths.length >= 240) break;
      }
      m = stepMonthKey(m, 1);
    }
  }

  const totalAmount =
    currentMonth.amount +
    backMonths
      .filter((b) => b.defaultSelected)
      .reduce((s, b) => s + b.amount, 0) +
    futureMonths
      .filter((s) => s.defaultSelected)
      .reduce((s, f) => s + f.amount, 0);
  const selectedExtra = totalAmount - currentMonth.amount;
  const overLimitRemainder = Math.max(0, excess - selectedExtra);

  return {
    coverageGroupId,
    currentMonth,
    backMonths,
    futureMonths,
    totalAmount,
    overLimitRemainder,
  };
}

/** Wraps `crypto.randomUUID()` so callers can mock it in tests. */
function cryptoRandomUUID(): () => string {
  return () =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : // Fallback (very old browsers / SSR) — not used in practice.
        "00000000-0000-4000-8000-000000000000";
}

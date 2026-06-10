import { addMonths, format, parse, startOfMonth, isValid } from "date-fns";

/** "YYYY-MM" — the canonical month key used for queries. */
export const MONTH_KEY_FORMAT = "yyyy-MM";

export function toMonthKey(date: Date): string {
  return format(date, MONTH_KEY_FORMAT);
}

export function fromMonthKey(monthKey: string): Date {
  const parsed = parse(monthKey, MONTH_KEY_FORMAT, new Date());
  return isValid(parsed) ? parsed : new Date();
}

export function currentMonthKey(now: Date = new Date()): string {
  return toMonthKey(startOfMonth(now));
}

/** Step the month key by `n` months (n can be negative). */
export function stepMonthKey(monthKey: string, n: number): string {
  return toMonthKey(addMonths(fromMonthKey(monthKey), n));
}

/** True if `a` is the same calendar month as `b`. */
export function isSameMonth(a: Date, b: Date): boolean {
  return toMonthKey(a) === toMonthKey(b);
}

/** First day of the month (00:00 local). */
export function firstOfMonth(monthKey: string): Date {
  const d = fromMonthKey(monthKey);
  return startOfMonth(d);
}

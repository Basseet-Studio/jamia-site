/**
 * Currency / money display helpers.
 * Currency is display-only — no conversion logic anywhere (FR-046).
 */

/** Format a number with the supplied currency label, e.g. "AED 1,234.50". */
export function formatCurrency(value: number, currency: string): string {
  const fixed = Number.isFinite(value) ? value : 0;
  // TODO(i18n): locale-aware formatting. v1 uses en-US; "AED 1,234.50".
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fixed);
  return `${currency} ${formatted}`;
}

/** Returns sign-aware delta string, e.g. "+AED 50.00" or "-AED 25.00". */
export function formatCurrencyDelta(delta: number, currency: string): string {
  if (delta === 0) return formatCurrency(0, currency);
  const sign = delta > 0 ? "+" : "-";
  return `${sign}${formatCurrency(Math.abs(delta), currency)}`;
}

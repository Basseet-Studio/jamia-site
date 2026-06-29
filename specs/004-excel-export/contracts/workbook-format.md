# Workbook Format Contract

**Branch**: `004-excel-export` | **Date**: 2026-06-29
**Source**: `data-model.md` §9 + `spec.md` FR-005 / FR-006 / FR-008

This is the canonical column spec for every sheet the export pipeline produces. Sheets MUST match this spec exactly; if a column is added or renamed, the `Schema version` cell in the Info sheet is bumped (see `data-model.md` §8).

---

## Common rules

- **Header row**: first row of every sheet, frozen, bold.
- **Number cells**: JS `number`, `format: "#,##0.00"`, right-aligned.
- **Date cells**: JS `Date`, `format: "yyyy-mm-dd"`, ISO 8601 representation.
- **Datetime cells**: JS `Date`, `format: "yyyy-mm-dd hh:mm"`, ISO 8601 representation.
- **String cells**: written as-is. UTF-8 round-trips (Arabic, Malayalam, Tamil).
- **Boolean cells**: written as JS `boolean`. Excel displays as `TRUE` / `FALSE`.
- **Empty / null cells**: rendered as the empty string (not `null`, not `undefined`).
- **No truncation, no escaping, no wrapping** (FR-007).
- **No raw Firestore field names** anywhere in headers (FR-005).
- **Column widths**: per-column; minimum 8 chars, maximum 40 chars. "Amount" columns get 14. "Note" / "Description" columns get 30.

---

## 1. Info sheet (only for `kind: "full"`)

| Header | Type | Format | Width | Notes |
|---|---|---|---|---|
| `Export timestamp` | datetime | `yyyy-mm-dd hh:mm` | 20 | ISO 8601, admin's local zone |
| `Currency` | string | — | 8 | from `settings.global.currency` (e.g. `AED`) |
| `Admin UID` | string | — | 28 | from `useAuth().user.uid` |
| `Admin email` | string | — | 30 | may be empty for some providers |
| `Admin display name` | string | — | 24 | may be empty |
| `Scope` | string | — | 8 | always `"full"` for this sheet |
| `Filter snapshot` | string | — | 30 | JSON of `{ kind: "full" }` for forward compat |
| `Sheet count` | number | `0` | 6 | always 6 here |
| `Schema version` | number | `0` | 6 | starts at `1`; bump on breaking changes |

Row count: exactly 1.

---

## 2. Households sheet

| Header | Type | Format | Width | Source |
|---|---|---|---|---|
| `Name` | string | — | 30 | `Household.name` |
| `Created on` | date | `yyyy-mm-dd` | 14 | `Household.createdAt.toDate()` |
| `Family count` | number | `#,##0` | 12 | COUNT of all families in household (active + soft-deleted) |
| `Active family count` | number | `#,##0` | 12 | COUNT of `Family.active === true` |
| `Soft-deleted family count` | number | `#,##0` | 12 | COUNT of `Family.active === false` |

Sort: `Name` ascending.

---

## 3. Families sheet

| Header | Type | Format | Width | Source |
|---|---|---|---|---|
| `Household name` | string | — | 28 | join from `households` collection by id |
| `Family name` | string | — | 28 | `Family.name` |
| `Contribution target` | number | `#,##0.00` | 14 | `Family.contributionTarget` |
| `Members` | number | `#,##0` | 8 | `Family.memberCount` |
| `Member names` | string | — | 36 | `Family.memberNames.join("; ")` |
| `Active` | boolean | — | 8 | `Family.active` |
| `Soft-deleted` | boolean | — | 8 | `Family.active === false` (mirror for filter convenience) |
| `Created on` | date | `yyyy-mm-dd` | 14 | `Family.createdAt.toDate()` |
| `Updated at` | datetime | `yyyy-mm-dd hh:mm` | 20 | `Family.updatedAt?.toDate()` or empty |

Sort: `Household name` asc, then `Active` desc (active first), then `Family name` asc.

**Per-screen behaviour (kind `families`)**:
- `FilterSnapshot.showSoftDeleted === false` → exclude rows where `Family.active === false`.
- `FilterSnapshot.showSoftDeleted === true` → include all families.
- `FilterSnapshot.month` is recorded in the Info sheet of the full report only; for per-screen the file name encodes it.

---

## 4. Payments sheet

| Header | Type | Format | Width | Source |
|---|---|---|---|---|
| `Date` | date | `yyyy-mm-dd` | 14 | `Payment.date.toDate()` |
| `Month` | string | — | 10 | `Payment.month` (already "YYYY-MM") |
| `Household` | string | — | 28 | join from `households` collection by id |
| `Family` | string | — | 28 | join from `families` collection by id (use current name, even for soft-deleted) |
| `Family active` | boolean | — | 8 | `Family.active` (per spec FR-010, payments of soft-deleted families ARE included; the active flag is a column for the admin's reference) |
| `Amount` | number | `#,##0.00` | 14 | `Payment.amount` |
| `Note` | string | — | 30 | `Payment.note` or empty |
| `Recorded by` | string | — | 24 | `Payment.recordedBy` (raw UID; admin email lookup is future work) |
| `Recorded at` | datetime | `yyyy-mm-dd hh:mm` | 20 | `Payment.recordedAt.toDate()` |
| `Coverage group id` | string | — | 38 | `Payment.coverageGroupId` or empty |

Sort: `Date` desc, then `Family` asc.

**Per-screen behaviour (kind `payments`)**:
- `FilterSnapshot.filter === "all"` → all payments for the family.
- `FilterSnapshot.filter === { month }` → only payments where `Payment.month === month`.

---

## 5. Expenses sheet

| Header | Type | Format | Width | Source |
|---|---|---|---|---|
| `Date` | date | `yyyy-mm-dd` | 14 | `Expense.date.toDate()` |
| `Month` | string | — | 10 | `Expense.month` |
| `Name` | string | — | 28 | `Expense.name` |
| `Amount` | number | `#,##0.00` | 14 | `Expense.amount` |
| `Type` | string | — | 12 | `Expense.type` (`"mosque"` / `"household"`) |
| `Sub-category` | string | — | 14 | `Expense.mosqueSubCategory` (localised: `maintenance` / `salary` / `other`) or empty for household type |
| `Status` | string | — | 12 | `"Withdrawn"` or `"Pending"` |
| `Withdrawn at` | datetime | `yyyy-mm-dd hh:mm` | 20 | `Expense.withdrawnAt?.toDate()` or empty |
| `Withdrawn by` | string | — | 24 | `Expense.withdrawnBy` or empty |
| `Note` | string | — | 30 | `Expense.note` or empty |
| `Added by` | string | — | 24 | `Expense.addedBy` |
| `Added at` | datetime | `yyyy-mm-dd hh:mm` | 20 | `Expense.addedAt.toDate()` |
| `Recurring` | boolean | — | 8 | `Expense.isRecurring` |
| `Recurring template id` | string | — | 24 | `Expense.recurringId` or empty |

Sort: `Date` desc, then `Name` asc.

**Per-screen behaviour (kind `expenses`)**:
- `FilterSnapshot.month === "all"` → every expense.
- `FilterSnapshot.month === "YYYY-MM"` → only `Expense.month === month`.
- `FilterSnapshot.subCategory` non-null → only `Expense.mosqueSubCategory === subCategory`.
- `FilterSnapshot.expenseType === "mosque"` → only `Expense.type === "mosque"` (matches the current `/expenses` page; the page is mosque-only by default today).

---

## 6. Recurring templates sheet

| Header | Type | Format | Width | Source |
|---|---|---|---|---|
| `Name` | string | — | 28 | `RecurringTemplate.name` |
| `Amount` | number | `#,##0.00` | 14 | `RecurringTemplate.amount` |
| `Sub-category` | string | — | 14 | `RecurringTemplate.mosqueSubCategory` (localised) |
| `Description` | string | — | 30 | `RecurringTemplate.description` or empty |
| `Active` | boolean | — | 8 | `RecurringTemplate.active` |
| `Current month status` | string | — | 22 | `"NotAdded"` / `"PendingWithdrawal"` / `"Withdrawn"` for the per-screen `month`; `"—"` for the full report |
| `Created on` | date | `yyyy-mm-dd` | 14 | `RecurringTemplate.createdAt.toDate()` |
| `Created by` | string | — | 24 | `RecurringTemplate.createdBy` |

Sort: `Active` desc, then `Name` asc.

**Per-screen behaviour (kind `recurring`)**:
- `FilterSnapshot.activeOnly === true` → exclude `RecurringTemplate.active === false` rows.
- `FilterSnapshot.month` is used to compute the `Current month status` column.

---

## 7. File-name patterns

`buildFileName(filter, triggerTime)` MUST return one of:

| Filter | Pattern | Example |
|---|---|---|
| `{ kind: "full" }` | `jamia-finance-{YYYY-MM-DD}.xlsx` | `jamia-finance-2026-06-29.xlsx` |
| `{ kind: "households" }` | `jamia-households-{YYYY-MM-DD}.xlsx` | `jamia-households-2026-06-29.xlsx` |
| `{ kind: "families", month: "all" }` | `jamia-families-all-{YYYY-MM-DD}.xlsx` | `jamia-families-all-2026-06-29.xlsx` |
| `{ kind: "families", month: "YYYY-MM" }` | `jamia-families-{YYYY-MM}-{YYYY-MM-DD}.xlsx` | `jamia-families-2026-06-2026-06-29.xlsx` |
| `{ kind: "payments", filter: "all" }` | `jamia-payments-all-{YYYY-MM-DD}.xlsx` | `jamia-payments-all-2026-06-29.xlsx` |
| `{ kind: "payments", filter: { month } }` | `jamia-payments-{month}-{YYYY-MM-DD}.xlsx` | `jamia-payments-2026-06-2026-06-29.xlsx` |
| `{ kind: "expenses", month: "all" }` | `jamia-expenses-all-{YYYY-MM-DD}.xlsx` | `jamia-expenses-all-2026-06-29.xlsx` |
| `{ kind: "expenses", month: "YYYY-MM" }` | `jamia-expenses-{month}-{YYYY-MM-DD}.xlsx` | `jamia-expenses-2026-06-2026-06-29.xlsx` |
| `{ kind: "recurring" }` | `jamia-recurring-{month}-{YYYY-MM-DD}.xlsx` | `jamia-recurring-2026-06-2026-06-29.xlsx` |

**Sanitisation**:
- Replace `\ / : * ? [ ]` with `-` defensively (the patterns above never produce these, but a future filter might).
- Lowercase the result.
- Strip any leading `.` or trailing whitespace.

---

## 8. Right-to-left (Arabic)

- For the `Info` sheet and every data sheet, `rightToLeft` is `true` when the current locale is `ar`, else `false`.
- Cell text is stored as Unicode in the workbook; bidi shaping is handled by Excel / Google Sheets / LibreOffice on open.

---

## 9. Empty sheets (FR-002)

- Every collection listed in the spec MUST appear as a sheet in the full report, even when the collection is empty.
- An empty sheet has: header row, zero data rows, default column widths.
- No "No data" placeholder cell — the header row alone communicates emptiness.

---

## 10. Round-trip validation (SC-004)

A developer must be able to:
1. Open `jamia-finance-2026-06-29.xlsx` in Microsoft Excel, Google Sheets, and LibreOffice Calc with zero warnings or repair prompts.
2. `=SUM(E:E)` (the Amount column on the Payments sheet) returns the same number as the in-app "Total paid" stat.
3. `=SUM(D:D)` on the Families sheet returns the sum of `Family.contributionTarget` over all rows.
4. A cell containing `O'Brien, "the mason"` round-trips with the comma + double-quote intact.
5. A cell containing `محمد` (Arabic), `ഫാസിൽ` (Malayalam), or `பாசில்` (Tamil) round-trips with the script intact.

This validation is run as part of the export's unit + Playwright tests.

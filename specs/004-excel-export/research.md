# Research: Excel Export

**Branch**: `004-excel-export` | **Date**: 2026-06-29

Resolves every `NEEDS CLARIFICATION` from `plan.md` Technical Context and locks the technology + behaviour decisions for the export feature. Every section follows **Decision / Rationale / Alternatives considered**.

---

## 1. xlsx generation library

**Decision**: `write-excel-file` (entry point `write-excel-file/browser`).

**Rationale**:
- MIT, single-command install, no attribution ugliness.
- Browser-first build that runs in a Web Worker, so the main thread stays responsive on big exports (relevant for SC-002's 1,000-row / 10-second budget on slow devices).
- Native multi-sheet API: pass an array of `{ data, sheet, columns }` objects, one per sheet.
- Cells are type-aware: pass JS `number`/`Date`/`string` and they go in as the right xlsx cell types so `=SUM()` works (SC-004).
- UTF-8 / Arabic / Malayalam / Tamil round-trip via the shared strings table (SC-004 last clause). `rightToLeft: true` per sheet for Arabic.
- Column widths, frozen header row, hyperlinks, borders — all native, no plugin dance.
- Actively maintained (latest release in the days before this plan was written). Small bundle (~150 KB gz), built on `fflate`.

**Alternatives considered**:
- `xlsx` (SheetJS Community): still the most-installed option but effectively frozen at 0.18.5 since ~2022, and the maintainer's "going commercial" history is a legal-review red flag. Write-only mini build is ~200 KB, but no Web Worker and no first-class multi-sheet ergonomics for our use case.
- `exceljs`: richer feature set (formulas, conditional formatting, streaming) but unmaintained for 2+ years; ~700 KB browser bundle; pulls Node-style polyfills. We don't need any of its premium features for v1.
- `xlsx-js-style`: wrapper around SheetJS that re-adds styling. Inherits the 0.18.5 freeze and the maintainer drama. Rejected.
- WASM wrappers around `excelize` (Go): 30+ MB. Absurd for a Next.js bundle.

**Trigger pattern (works in Next.js 16 / React 19, all Client Components)**:
```ts
const blob: Blob = await writeExcelFile(sheets).toBlob();
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url; a.download = fileName;
document.body.appendChild(a); a.click(); a.remove();
setTimeout(() => URL.revokeObjectURL(url), 1000);
```

---

## 2. Per-screen "Show soft-deleted families" toggle (NEW UI surface)

**Decision**: Add a "Show soft-deleted" toggle on the household detail page (family list). Export honours the toggle state at click time.

**Rationale**:
- Spec FR-010 + Story 3 AS-2 require a per-screen toggle that the export must mirror. The toggle does not exist in the current UI.
- Adding it as part of this feature keeps the contract clean: the export reflects exactly what the admin sees.
- Default OFF (matches the current behaviour — household detail page already filters families to `active === true` in `src/app/(app)/households/[householdId]/page.tsx:210`).
- Scope: household detail page only. The dashboard's full report always includes soft-deleted families in the Families sheet (so the admin gets a complete picture); per-screen export respects the toggle.

**Alternatives considered**:
- "Always include soft-deleted": violates FR-010's "excluded by default" rule.
- "Never include soft-deleted": violates the per-screen toggle case in Story 3 AS-2.
- "Ask per-export via a dialog": UX-wise heavier than mirroring the on-screen toggle; spec says "matching the on-screen behaviour", which means the toggle, not a dialog.

---

## 3. Filter snapshot contract

**Decision**: Every screen that has a "Download full report" or "Export to Excel" button builds a `FilterSnapshot` at click time and passes it to `triggerExport(snapshot)`. The snapshot is plain serialisable data (no React state, no Firestore refs) so the export service can be unit-tested.

**Rationale**:
- Spec FR-003 / Story 2 AS-1..AS-5 require the export to honour the active filter at the moment the export is triggered. Passing a snapshot object is the most direct way to express this.
- Mirrors the existing service-layer pattern (services take plain input, never React state).
- Allows the future "Schedule an export" feature to reuse the same shape with no refactor.

**Snapshot shape** (in `data-model.md`):
- `kind: "full" | "households" | "families" | "payments" | "expenses" | "recurring"`
- For per-screen kinds: the same filter the screen uses, e.g. `{ kind: "expenses", month: "2026-06", subCategory: "maintenance" | null }`.

---

## 4. Where the export logic lives

**Decision**: New module `src/lib/services/excelExport.ts` (pure) + `src/lib/services/excelExportClient.ts` (browser-only, imports `write-excel-file/browser`). The pure module is unit-testable in node; the client module is the only one that touches the xlsx library and `URL.createObjectURL`.

**Rationale**:
- Follows the existing "service layer for business logic, thin client wrapper for browser-only APIs" pattern (e.g. `moneyOnHand.ts` for pure logic, `useMoneyOnHand.ts` for the hook).
- Pure module owns: column definitions, header resolution, row mapping, file-name construction, sheet ordering, cell-type coercion. Easy to unit test.
- Client module owns: the actual `writeExcelFile()` call and the anchor-click download trigger. Browser-only, lives behind the `"use client"` boundary in the component that calls it.

**Alternatives considered**:
- "Put it all in one file": mixes pure logic with `URL.createObjectURL` and is harder to test.
- "Put it all in the component": scatters the column spec across screens, no chance to share logic for "Export all" from the dashboard.

---

## 5. Data fetching for the dashboard's "Download full report"

**Decision**: When the admin clicks "Download full report" on the dashboard, the export service does fresh one-shot reads of all five collections (using the existing `listHouseholds`, `listExpenses`, `listRecurringTemplates`, and a collection-group query for payments). It does NOT re-use the in-memory dashboard state.

**Rationale**:
- Spec edge case: "Export during live updates: the export uses the snapshot of records loaded at the moment the admin clicks the button. Records added after the click are not required to be in the file; records deleted before the click must be excluded."
- A one-shot `getDocs` per collection at click time gives the cleanest "snapshot at click time" semantics with no listener management. The latency budget is well within SC-002 (10s for 1k rows; 5 collections of 1k rows is ~5s of network reads + encoding).
- Re-using in-memory state would mean: (a) the dashboard doesn't currently subscribe to recurring templates or all expenses, so we'd need new subscriptions anyway; (b) state could be partial if a subscription was still loading; (c) snapshot consistency is hard to reason about.

**Alternatives considered**:
- "Use in-memory state everywhere": would require subscribing to all 5 collections on the dashboard, bloating the dashboard's read quota, and snapshot consistency is harder.
- "Use a single big `getDocs` via collection group": not all entities are in collection groups.

---

## 6. Per-screen export: pay attention to the screen's own filter

**Decision**: Each per-screen export button reads the same filter state the screen uses and passes it in the `FilterSnapshot`. The export service applies the same `where()` constraints the screen's subscription uses.

**Mapping**:
- **Households page** (`/households`): no filter → all households.
- **Household detail → Families** (`/households/[id]`): the new "Show soft-deleted" toggle + the selected month (for the families' paid-this-month column).
- **Family history → Payments** (`/households/[hh]/families/[fid]/history`): `filter === "all" | { month }`.
- **Expenses** (`/expenses`): `month` (or `"all"`) + `subCategory` (nullable) + `type` (the page currently hardcodes `type: "mosque"`, so per-screen export mirrors that).
- **Recurring templates** (the section on `/expenses`): active-only, current month for status column.

**Rationale**: spec FR-003 demands "honour the active filters of that screen (date range, month, household, withdrawn/not withdrawn, etc.) at the moment the export action is triggered." Mirroring the screen's filter is the only way to satisfy this in a way the admin can verify.

---

## 7. Workbook structure

**Decision**:
- One `Info` sheet FIRST, then data sheets in fixed order: `Households`, `Families`, `Payments`, `Expenses`, `Recurring Templates`.
- Per-screen exports get a single sheet named after the entity (no Info sheet — the file name is the context).
- `Info` sheet columns: `Export timestamp (ISO 8601)`, `Currency`, `Admin UID`, `Admin email`, `Admin display name`, `Scope`, `Filter snapshot (JSON)`, `Sheet count`, `Schema version`.
- Numeric cells: JS `number`, formatted `#,##0.00` (FR-006, SC-004).
- Date cells: ISO `YYYY-MM-DD` for date-only fields, ISO `YYYY-MM-DD HH:mm` for timestamps. Stored as `Date` with `format: 'yyyy-mm-dd'` so Excel parses them as dates.
- Header row: frozen (`stickyRowsCount: 1`), bold styling via `write-excel-file` per-column font.
- Column widths: explicit per-column `width` (chars) per the column spec in `contracts/workbook-format.md`.

**Rationale**:
- Spec FR-005: human-readable headers, no raw Firestore field names.
- Spec FR-006: numeric cells as numbers.
- Spec FR-008: metadata sheet first.
- Spec FR-011: open cleanly in Excel / Google Sheets / LibreOffice — frozen header + sensible widths are the largest contributor to that.
- Per-screen exports don't get an Info sheet because the file name carries the context; the spec only requires Info for the "full report" (FR-008 reads "MUST record the export timestamp, the currency code, and the admin's identity that triggered the export" which is naturally met by the dashboard's "full" report).

**Alternatives considered**:
- "Put Info last": less discoverable, and most export tools show the first sheet by default. Info first matches the spec's example ("first sheet, named 'Info'").
- "One big sheet for the full report": violates the spec's "one sheet per entity" requirement.

---

## 8. File-naming convention

**Decision**:
- Full report: `jamia-finance-{YYYY-MM-DD}.xlsx` (spec example: `jamia-finance-2026-06-29.xlsx`).
- Per-screen, no filter: `jamia-{entity}-{YYYY-MM-DD}.xlsx` (e.g. `jamia-households-2026-06-29.xlsx`).
- Per-screen, with filter: `jamia-{entity}-{filter-hint}-{YYYY-MM-DD}.xlsx` (e.g. `jamia-expenses-2026-06-2026-06-29.xlsx`, `jamia-payments-2026-06-2026-06-29.xlsx`).
- For the family's payments history filtered by month, the hint is the month key.
- "All-time" filter: hint is `all`.

**Rationale**:
- Spec FR-004: include the export date + a human-readable filter hint, with examples.
- Two `2026-06` substrings in the filtered case (month + date) sounds redundant but the spec's example uses exactly that pattern (`jamia-expenses-2026-06.xlsx`), and it makes the file self-describing in the browser downloads folder where the admin will recognise the month immediately.
- Distinguishes per-screen exports from the full report by the entity name; the full report never gets an entity name.
- Distinct per click (within the same minute): the `YYYY-MM-DD` date plus the entity means a same-day re-export with a different filter is still distinguishable (different `filter-hint`).

---

## 9. i18n posture for this feature

**Decision**: All new user-facing strings are routed through `useT()` and `t()` from `@/lib/i18n`. Strings added before localisation is complete (e.g. button labels, file-name hints, toast messages, error messages) carry an inline `// TODO: localise this later` comment per project rule. No new keys are added to `src/messages/*.json` in this feature — the new strings will be extracted by a follow-up localisation pass.

**Rationale**:
- Project rule: "never localise or read any arb files or plan localisation; add a `// TODO(localise)` comment on every string localise this later".
- The dashboard and household detail already use `t("…")` for the existing strings, so following the same pattern is consistent.
- The Excel file itself contains data, not localisable UI strings. The only localisable UI surface is the export button + progress indicator.

---

## 10. Progress / error UX

**Decision**: Each export button manages its own `isExporting: boolean` state. While exporting: button shows a spinner, is `disabled`, and a toast appears (success: "Downloaded {fileName}", error: inline `<p>` with a retry hint, no toast spam). A single shared hook `useExcelExport()` returns `{ trigger, isExporting, error }` and is the only consumer of `excelExportClient.ts`.

**Rationale**:
- Spec FR-009: progress indicator + inline error on download failure.
- Spec SC-006: 100% first-try success, no silent failures → if the browser blocks the download, the admin MUST see an actionable message.
- A single hook keeps the spinner / disabled logic out of each button component, and gives us a single place to attach telemetry later.

**Alternatives considered**:
- "One global toast system for all exports": nice in theory but no toast system exists yet in the codebase; introducing one is scope creep.
- "Use `confirm()` for errors": no — the spec wants inline errors.

---

## 11. Browser capability detection

**Decision**: On mount, the export hook runs a one-time capability check (`typeof window !== "undefined" && typeof Blob !== "undefined" && typeof URL !== "undefined" && typeof document !== "undefined"`). If false, the export button is hidden and a placeholder text "Export to Excel is not supported in this browser" is shown instead.

**Rationale**:
- Spec edge case: "if the browser cannot generate `.xlsx` client-side, the export button is hidden or shows an explanatory message rather than failing on click."
- These checks are stable across every modern browser shipped since 2018; the only realistic failure is SSR or a very old browser, both already handled by the `"use client"` boundary.

---

## 12. Summary of NEEDS CLARIFICATION status

| Item | Status | Decision |
|---|---|---|
| xlsx library | RESOLVED | `write-excel-file` (browser entry) |
| Per-screen soft-deleted toggle | RESOLVED | Add toggle to household detail page; export mirrors it |
| Filter snapshot contract | RESOLVED | `FilterSnapshot` object passed to `triggerExport()` |
| Where export logic lives | RESOLVED | `excelExport.ts` (pure) + `excelExportClient.ts` (browser) |
| Dashboard "full report" data source | RESOLVED | One-shot `getDocs` per collection at click time |
| Per-screen filter mapping | RESOLVED | See §6 |
| Workbook structure (sheets, Info, widths) | RESOLVED | See §7 |
| File-naming convention | RESOLVED | See §8 |
| i18n posture | RESOLVED | `t()` for all new UI strings + `// TODO: localise this later` per project rule |
| Progress / error UX | RESOLVED | `useExcelExport()` hook, inline error, no toast |
| Browser capability detection | RESOLVED | Hide button if `Blob`/`URL` missing |

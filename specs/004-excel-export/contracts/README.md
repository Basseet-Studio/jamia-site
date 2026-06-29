# Contracts — Excel Export

The export feature has no REST/GraphQL surface and no new Firestore rules. The "contracts" here are the internal module + workbook format:

| File | Purpose |
|---|---|
| `export-service.ts` | TypeScript interface for `ExcelExportService` — the single contract between UI and export pipeline. Mirrors the v1 service-layer pattern. |
| `workbook-format.md` | Canonical column spec for every sheet, file-name patterns, RTL behaviour, and round-trip validation checklist. The source of truth for "what's in the .xlsx". |

## Why no firestore.rules?

The export feature reads from the five existing collections (households, families, payments, expenses, recurring templates) via the existing `list*` / collection-group queries. The security rules in `firestore.rules` and `specs/001-household-finance-dashboard/contracts/firestore.rules` already authorise any signed-in admin to read these collections, so no rule change is required.

## How to extend

When you add a new entity to the export:

1. Add a row to the `FilterSnapshot` union in `export-service.ts` (mirror the new entity in `data-model.md` §3).
2. Add a new sheet column spec to `workbook-format.md` (or update an existing sheet).
3. Bump `Schema version` in `data-model.md` §8.
4. Add the column to `HOUSEHOLDS_COLUMNS` / `FAMILIES_COLUMNS` / etc. constants in `src/lib/services/excelExport.ts`.
5. Add a test in `tests/unit/services/excelExport.test.ts` asserting the new column renders correctly.

When you add a new UI button that triggers an export:

1. Add the button to the relevant page (or `src/components/excel/ExportButton.tsx` if reusable).
2. Build the `FilterSnapshot` from the page's current filter state.
3. Call `useExcelExport().trigger(snapshot, ctx)`.
4. Surface `isExporting` on the button (`disabled` + spinner) and `error` inline below the button.

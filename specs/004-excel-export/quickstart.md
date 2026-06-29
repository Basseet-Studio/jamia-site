# Quickstart: Excel Export

**Branch**: `004-excel-export` | **Date**: 2026-06-29

Five-minute tour for a developer who needs to trigger an export (manually or via test) or extend the workbook with a new column.

---

## 1. Trigger an export from the UI

### 1.1 Dashboard → "Download full report (Excel)"

1. Sign in, land on `/dashboard`.
2. Top-right of the page, click **Export → Download full report (Excel)**.
3. The button shows a spinner; the admin's browser downloads `jamia-finance-2026-06-29.xlsx` (today's date).
4. Open the file. First sheet is `Info` (export metadata). Then `Households`, `Families`, `Payments`, `Expenses`, `Recurring Templates`.

### 1.2 Per-screen export

- On `/households`, the **Export to Excel** button downloads `jamia-households-{date}.xlsx` (single sheet: Households).
- On `/households/[id]`, the **Export families** button downloads `jamia-families-{month?}-{date}.xlsx` (single sheet: Families). The "Show soft-deleted" toggle controls which families appear.
- On `/households/[hh]/families/[fid]/history`, the **Export to Excel** button downloads `jamia-payments-{month | all}-{date}.xlsx` (single sheet: Payments). The active month filter is encoded in the file name.
- On `/expenses`, the **Export to Excel** button downloads `jamia-expenses-{month | all}-{date}.xlsx` (single sheet: Expenses). The sub-category filter is honoured.
- On `/expenses` → **Recurring expense templates** section, the **Export** button downloads `jamia-recurring-{month}-{date}.xlsx` (single sheet: Recurring Templates).

---

## 2. Trigger an export from a unit test

```ts
import { buildWorkbook, buildFileName } from "@/lib/services/excelExport";

const workbook = buildWorkbook(
  { kind: "full" },
  {
    households: [...],
    families: [...],
    payments: [...],
    expenses: [...],
    recurringTemplates: [...],
  },
  {
    adminUid: "test-uid",
    adminEmail: "admin@example.com",
    adminDisplayName: "Test Admin",
    currency: "AED",
    triggerTime: new Date("2026-06-29T18:42:11Z"),
    locale: "en",
  },
);

expect(workbook.fileName).toBe("jamia-finance-2026-06-29.xlsx");
expect(workbook.sheets[0].name).toBe("Info");
expect(workbook.sheets.map((s) => s.name)).toEqual([
  "Info", "Households", "Families", "Payments", "Expenses", "Recurring Templates",
]);

const paymentsSheet = workbook.sheets.find((s) => s.name === "Payments")!;
expect(paymentsSheet.columns[5].header).toBe("Amount");
expect(paymentsSheet.columns[5].type).toBe("number");
```

---

## 3. Trigger an export from the browser (manual / Playwright)

```ts
import { triggerDownload } from "@/lib/services/excelExportClient";

const result = await triggerDownload(
  { kind: "full" },
  {
    adminUid: user.uid,
    adminEmail: user.email,
    adminDisplayName: user.displayName,
    currency: "AED",
    triggerTime: new Date(),
    locale: "en",
  },
);

// `result.blob` is the .xlsx binary; `result.fileName` is "jamia-finance-{date}.xlsx".
// The function also programmatically clicks an anchor to start the browser download.
```

The `triggerDownload` function does NOT take pre-fetched data — it does its own one-shot reads of the five collections (mirroring the dashboard's "Download full report" path). For per-screen exports, the page passes its already-subscribed data via `triggerDownloadWithData(filter, ctx, data)`.

---

## 4. Add a new column to an existing sheet

1. Update `src/lib/services/excelExport.ts` — add the new column to the relevant `*_COLUMNS` constant. Pick `type: "string" | "number" | "date" | "datetime" | "boolean"` and a `format` if applicable.
2. Update the row-builder in the same file — add the field extraction at the matching index.
3. Update `specs/004-excel-export/contracts/workbook-format.md` — add a row to the sheet's table. The spec is the source of truth.
4. **Bump `Schema version`** in `data-model.md` §8 (set to `2`).
5. Add a unit test in `tests/unit/services/excelExport.test.ts` asserting the new column appears with the right header and type.
6. Re-run the Playwright round-trip check from `workbook-format.md` §10.

---

## 5. Add a new export surface (e.g. "Export by household")

1. Add a new variant to the `FilterSnapshot` union in `contracts/export-service.ts` and `data-model.md` §3.
2. Add a new `ExportKind` to the same file.
3. Add a builder branch in `src/lib/services/excelExport.ts` (`buildXxxSheets`).
4. Add a button in the relevant page (or in `src/components/excel/ExportButton.tsx`).
5. Add a file-name pattern to `contracts/workbook-format.md` §7.
6. Add unit tests + update the Playwright spec.

---

## 6. Run the export test suite

```bash
npm run typecheck
npm test -- excelExport
npm run test:e2e -- excel-export.spec.ts
```

The Playwright spec downloads each export variant, opens the resulting file with the `exceljs` reader (test-only dep), and asserts:
- All sheets present, in the expected order
- Header row matches the column spec
- Numeric columns are typed as `number` (not `string`)
- `=SUM()` on the Amount column equals the in-app total

---

## 7. Common gotchas

- **Empty collections**: the sheet still appears with only the header row. Don't try to "hide" empty sheets — the spec requires them present.
- **Numbers stored as text**: this is the #1 silent failure mode. If you pass `String(1234.56)`, Excel shows a "number stored as text" warning. Always pass `number`, or `type: "number"` explicitly. The column-coercion helper in `excelExport.ts` will console.warn if it coerces a string.
- **Sheet name length**: Excel limits sheet names to 31 chars. The current spec uses short names; if you add a longer one, truncate.
- **File name collisions**: two exports in the same minute to the same path will collide in the browser. The `YYYY-MM-DD` + filter-hint scheme usually distinguishes them, but if you add a new filter, ensure the hint is unique within the day.
- **RTL sheets**: setting `rightToLeft: true` flips the SHEET direction, not individual cells. The cell text is stored as Unicode; Excel / Sheets handle bidi shaping for Arabic automatically. Do not add U+200F marks manually.
- **iOS Safari**: large file generation can block the main thread for >1s. The browser entry point of `write-excel-file` runs in a Web Worker, which mitigates this; if you swap libraries, do NOT lose the worker offload.
- **Localising the UI strings**: per project rule, every new UI string gets an inline `// TODO: localise this later` comment. Do NOT add new keys to `src/messages/*.json` in this feature — a follow-up localisation pass will do it.

---

## 8. Where to look

- `data-model.md` — entities, filter snapshot, file-name derivation
- `contracts/export-service.ts` — service interface
- `contracts/workbook-format.md` — column spec, file names, round-trip checks
- `src/lib/services/excelExport.ts` — pure builder (testable)
- `src/lib/services/excelExportClient.ts` — browser-only wrapper + `useExcelExport` hook
- `tests/unit/services/excelExport.test.ts` — unit tests
- `tests/e2e/excel-export.spec.ts` — Playwright round-trip

# Feature Specification: Excel Export

**Feature Branch**: `004-excel-export`

**Created**: 2026-06-29

**Status**: Draft

**Input**: User description: "i want to add a feature to be able to export information to excel fiels"

## Summary

Add the ability for the single admin to export the dashboard's data as Microsoft Excel (`.xlsx`) workbooks for offline review, sharing, and archival. Exports cover the five core entity types — households, families, payments, expenses, and recurring templates — and are available both as a single "Export all" workbook (one sheet per entity) and as per-screen exports that respect the active filters of the page the admin is on.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Export the entire dataset as a single workbook (Priority: P1)

The admin opens the dashboard (or any data screen) and clicks an "Export" action. A small export menu offers "Download full report (Excel)". Selecting it downloads a single `.xlsx` file that contains one sheet per core entity (Households, Families, Payments, Expenses, Recurring Templates), with one row per record and human-readable column headers. The file name includes the current date so successive downloads don't overwrite each other.

**Why this priority**: This is the core deliverable. It gives the admin a complete, dated snapshot they can email to trustees, archive monthly, or open in Excel without any further setup. Without this, the feature has no purpose.

**Independent Test**: Can be tested independently by populating seed data for each entity, clicking "Download full report", opening the resulting `.xlsx`, and confirming every record appears on its sheet with the correct columns and at least one sample row verified against the on-screen list.

**Acceptance Scenarios**:

1. **Given** the admin is signed in and authorised, **When** they choose "Download full report (Excel)" from any data screen, **Then** a `.xlsx` file is downloaded whose file name contains the current date (YYYY-MM-DD) and the workbook contains five sheets: Households, Families, Payments, Expenses, and Recurring Templates.
2. **Given** any of the five collections is empty, **When** the full report is downloaded, **Then** the corresponding sheet still appears, contains the column header row, and has no data rows (no error, no missing sheet).
3. **Given** the admin clicks the export action, **When** the download begins, **Then** a visual indication (button disabled state, spinner, or toast) is shown until the browser's download dialog appears, so the admin knows the export is in progress.
4. **Given** the export is generated, **When** the workbook is opened in Excel / Google Sheets / LibreOffice, **Then** all sheets open without warnings, column headers are visible on the first row, and column widths are reasonable (no truncated numbers).

---

### User Story 2 — Export a single entity list with its active filters (Priority: P1)

On each list screen (Households, Household detail → Families, Family detail → Payments, Expenses, Recurring Templates), the admin sees an "Export to Excel" button. Clicking it downloads a workbook whose single sheet contains only the records currently visible on that screen, respecting any active filter (date range, month, household, withdrawn/not withdrawn, etc.).

**Why this priority**: This is how the admin will use export day-to-day — they want "this month's expenses", "payments for household X", or "this family's payment history" without having to scroll through an unfiltered dump. It is co-equal with Story 1 in practical value.

**Independent Test**: Can be tested independently on each list screen by applying a known filter (e.g. "current month", "this household"), exporting, and confirming the resulting file contains exactly the rows currently visible on screen (count and at least three spot-checked values match).

**Acceptance Scenarios**:

1. **Given** the admin is on the Expenses screen with the current month selected, **When** they click "Export to Excel", **Then** the downloaded `.xlsx` contains a single "Expenses" sheet whose rows match exactly the expenses currently listed on screen for that month.
2. **Given** the admin is on a household's detail screen, **When** they click "Export families", **Then** the downloaded file contains only families that belong to that household (active and soft-deleted per screen default).
3. **Given** the admin is on a family's payment history with a specific month filter active, **When** they click "Export to Excel", **Then** the downloaded file contains only payments recorded for that family in that month.
4. **Given** no filter is active on a list screen, **When** the admin clicks "Export to Excel", **Then** the exported sheet contains all records visible on that screen (i.e. all-time for expenses and payments unless filtered).
5. **Given** the admin switches the screen's filter and clicks "Export to Excel" again, **When** the new download completes, **Then** the file name reflects the new filter (e.g. includes the month) so the two exports are distinguishable.

---

### User Story 3 — Export respects existing data rules (Priority: P2)

Exports must never expose data the admin would not see on screen, must exclude soft-deleted families by default (with a per-screen toggle that allows including them, matching the on-screen behaviour), and must keep numeric fields as actual numbers (not strings) so Excel can sum them.

**Why this priority**: Without these rules, exports could mislead the admin or break their downstream calculations. P2 rather than P1 because the export will technically work without them, but the data could be wrong.

**Independent Test**: Can be tested by exporting payments that include a soft-deleted family's payment (default behaviour should include it, since the payment is preserved in money-on-hand), exporting a list of families with the soft-deleted toggle off (those rows should be absent), and opening the file to verify numeric columns have right-aligned numeric formatting.

**Acceptance Scenarios**:

1. **Given** a soft-deleted family still has historical payments, **When** the admin exports "All payments", **Then** those payments are included (they still count toward money on hand) and the family name is shown as it was recorded, with a column flagging the family's active status.
2. **Given** the admin toggles "Show soft-deleted" on a family list, **When** they export, **Then** soft-deleted families appear in the export; if the toggle is off, they are excluded.
3. **Given** the exported file is opened in Excel, **When** the admin sums the Amount column, **Then** Excel sums the values correctly (no "SUM 0" because the column was treated as text).
4. **Given** any text field (family name, expense name, payment note) contains a comma, quote, newline, or Arabic / Malayalam / Tamil script, **When** the export is opened, **Then** the text is preserved exactly and is not split across columns or garbled.

---

### Edge Cases

- **Empty collections**: each sheet still appears with its header row but no data rows. No error.
- **Very large datasets** (e.g. thousands of payments): export still completes successfully and produces a valid workbook; the admin sees a progress indicator while it builds.
- **Export during live updates**: the export uses the snapshot of records loaded at the moment the admin clicks the button. Records added after the click are not required to be in the file; records deleted before the click must be excluded.
- **Repeated downloads in the same minute**: file names must be distinct (timestamp suffix) so the browser does not silently overwrite the previous file.
- **Currency formatting**: numeric amounts are written as raw numbers; the workbook records the currency code in a metadata sheet so the admin knows how to interpret them. No hardcoded currency symbol is mixed into numeric cells.
- **Browser blocking download**: if the browser blocks the download (popup blocker, permissions), the admin sees a clear inline error explaining what happened and what to do — never a silent failure.
- **Unsupported browser**: if the browser cannot generate `.xlsx` client-side, the export button is hidden or shows an explanatory message rather than failing on click.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a "Download full report (Excel)" action, accessible from the dashboard and from each main data screen, that downloads a single `.xlsx` workbook with one sheet per entity (Households, Families, Payments, Expenses, Recurring Templates).
- **FR-002**: System MUST provide a per-screen "Export to Excel" action on each list screen (Households, Families, Payments, Expenses, Recurring Templates) that downloads a one-sheet workbook containing only the records currently visible on that screen.
- **FR-003**: Per-screen exports MUST honour the active filters of that screen (date range, month, household, withdrawn/not withdrawn, etc.) at the moment the export action is triggered.
- **FR-004**: Exported file names MUST include the export date and, when a filter is active, a human-readable hint of that filter, so successive downloads are distinguishable (e.g. `jamia-finance-2026-06-29.xlsx`, `jamia-expenses-2026-06.xlsx`).
- **FR-005**: Each sheet MUST have a header row that uses human-readable column names (not raw Firestore field names), and column widths set so a typical value is not truncated.
- **FR-006**: Numeric fields (amounts, counts) MUST be written as numbers, not strings, so Excel can perform sums, averages, and filters on them.
- **FR-007**: Text fields MUST be escaped so commas, quotes, and newlines inside values do not split the row across columns or break the file.
- **FR-008**: A metadata sheet (e.g. first sheet, named "Info") MUST record the export timestamp, the currency code, and the admin's identity that triggered the export.
- **FR-009**: System MUST show a progress indicator (button disabled + spinner / toast) from the moment the admin clicks the export action until the browser download is initiated, and MUST show an inline error message if the download cannot be started.
- **FR-010**: Soft-deleted families MUST be excluded from per-screen family exports by default and MUST be included only when the admin has toggled the on-screen "Show soft-deleted" option; payments of soft-deleted families MUST be included in payment exports because they count toward money on hand.
- **FR-011**: Exported workbooks MUST open cleanly in Microsoft Excel, Google Sheets, and LibreOffice Calc without warnings or repair prompts.
- **FR-012**: Export actions MUST be visible only to signed-in, authorised administrators and MUST follow the same access-control rules as the rest of the dashboard.
- **FR-013**: System MUST localise all user-facing export strings (button labels, menu items, toast / progress messages, error messages, file-name hints) through the existing i18n provider. Strings added before localisation is complete MUST carry an inline `// TODO(localise)` comment at the call site.

### Key Entities *(include if feature involves data)*

- **Export job**: A user-triggered, in-memory operation. Attributes: trigger source (which screen / button), trigger time, filter snapshot, admin identity, target file name. No persistence required.
- **Workbook**: The `.xlsx` file produced by an export job. Attributes: collection of sheets, metadata (export time, currency, admin), file name.
- **Sheet**: One tab inside a workbook, representing one entity type (Households, Families, Payments, Expenses, Recurring Templates) or metadata (Info). Attributes: name, column headers, rows.
- **Export row**: One record inside a sheet. Attributes: ordered list of cell values matching the sheet's column headers; numeric cells are numbers, text cells are strings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An authorised admin can produce a full five-sheet Excel workbook from any data screen in three clicks or fewer (screen → Export → Download full report).
- **SC-002**: A per-screen export containing up to 1,000 rows completes and triggers the browser download within 10 seconds on a typical broadband connection.
- **SC-003**: Opening any exported workbook in Microsoft Excel, Google Sheets, and LibreOffice Calc shows the expected number of sheets, the expected row counts, and the expected numeric totals with zero warnings or repair prompts.
- **SC-004**: Numeric columns in the exported workbook are treated as numbers by Excel (verified by `=SUM(...)` returning a non-zero value matching the on-screen total), and text columns containing commas, quotes, newlines, or Arabic / Malayalam / Tamil script round-trip without corruption.
- **SC-005**: Soft-deleted families are excluded from default family exports and included only when the on-screen toggle is on; payments belonging to soft-deleted families are present in payment exports and their totals match the on-screen "money on hand" figure.
- **SC-006**: 100% of authorised admins who try to export succeed on first attempt (no silent failures); any failure surfaces an actionable inline error message.
- **SC-007**: All export-related user-facing strings flow through the existing i18n provider (en / ar / ml / ta), and every newly added string carries a `// TODO(localise)` marker at the call site until localisation is completed.

## Assumptions

- Exports are generated client-side in the browser (no server roundtrip, no third-party upload). This matches the project's existing pattern of keeping Firebase writes inside the admin's authenticated session.
- The library used to generate `.xlsx` files is a standard, permissively licensed npm dependency (e.g. SheetJS / `exceljs` / similar). Choice of library is a planning concern, not a spec concern.
- "Excel file" in the user request means `.xlsx` (Microsoft Excel Open XML). `.csv` and `.ods` are out of scope for this feature.
- Exports are one-shot snapshots, not live-linked workbooks. The admin is expected to re-export if data changes.
- The single admin role is the only role that can export. No per-household or per-family export permissions exist in v1.
- Concurrent edits during an export do not need to be reconciled; the export captures the snapshot at click time.
- File-name conventions and exact column headers will be refined during the planning step; the requirements above set the contract, not the wording.
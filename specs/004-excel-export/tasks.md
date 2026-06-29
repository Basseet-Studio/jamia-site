# Tasks: Excel Export

**Input**: Design documents from `/specs/004-excel-export/`
**Spec**: `spec.md` · **Plan**: `plan.md` · **Research**: `research.md` · **Data Model**: `data-model.md` · **Contracts**: `contracts/export-service.ts`, `contracts/workbook-format.md` · **Quickstart**: `quickstart.md`

**Tests**: Vitest unit tests for `excelExport.ts` (pure module) + Playwright E2E round-trip per `contracts/workbook-format.md` §10. Test tasks included.

**Organization**: Tasks grouped by user story. Each phase ends at a self-contained checkpoint.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project-side wiring — dependency install, directory scaffolding, env confirmation. No app code yet.

- [X] T001 Add `write-excel-file@^4` to `dependencies` in `package.json` and install (browser entry, MIT, Web Worker — per `research.md` §1)
- [X] T002 Add `exceljs` to `devDependencies` in `package.json` and install (test-only reader used by Playwright round-trip per `contracts/workbook-format.md` §10)
- [X] T003 [P] Create directory `src/components/excel/` (parallel to `src/components/households/`, `src/components/expenses/`)
- [X] T004 [P] Create directory `tests/unit/services/` if absent (already exists; verify)
- [X] T005 [P] Confirm `playwright.config.ts` has a `downloads/` artifact path and the `firebase emulators:start` script is wired in `package.json` (`emulators:start` already present — verify per `PROJECT_CONTEXT.md` §8)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure module + browser client module + hook + shared UI primitives. Blocks ALL three user stories (every button calls `useExcelExport()`).

**⚠️ CRITICAL**: No user-story work can begin until this phase ships.

- [X] T006 Copy `FilterSnapshot`, `ExportKind`, `WorkbookModel`, `Sheet`, `Column`, `Row`, `Cell`, `CellType`, `ExportContext`, `ExportResult`, `ExportError`, `ExportData`, `ExcelExportService` types verbatim from `specs/004-excel-export/contracts/export-service.ts` into `src/lib/services/excelExport.ts` (no behaviour yet — type surface only)
- [X] T007 Implement pure `buildFileName(filter, triggerTime)` in `src/lib/services/excelExport.ts` per `contracts/workbook-format.md` §7 (sanitise `\ / : * ? [ ]` → `-`, lowercase, strip leading `.` and trailing whitespace)
- [X] T008 [P] Implement column-spec constants in `src/lib/services/excelExport.ts`: `HOUSEHOLDS_COLUMNS`, `FAMILIES_COLUMNS`, `PAYMENTS_COLUMNS`, `EXPENSES_COLUMNS`, `RECURRING_COLUMNS`, `INFO_COLUMNS` per `contracts/workbook-format.md` §1–§6 (human-readable headers, widths, types, `format` strings)
- [X] T009 [P] Implement cell-type coercion helper `coerceCell(value, column)` in `src/lib/services/excelExport.ts` enforcing `data-model.md` §6 rules (number must be JS number; date/datetime must be JS Date; log `console.warn` on coercion; never throw)
- [X] T010 Implement pure `buildWorkbook(filter, data, ctx)` in `src/lib/services/excelExport.ts` returning `WorkbookModel` — branches on `filter.kind`, applies per-screen filters per `contracts/workbook-format.md` §3–§6 + `data-model.md` §3, sorts per workbook-format spec, sets `rightToLeft = ctx.locale === "ar"`, freezes headers, always emits `Info` sheet first for `kind: "full"`
- [X] T011 Implement `excelExportService` object in `src/lib/services/excelExport.ts` satisfying `ExcelExportService` interface (`triggerExport`, `buildWorkbook`, `buildFileName`) — `triggerExport` delegates to `buildWorkbook` + the client module (no `writeExcelFile` import here, pure only)
- [X] T012 Implement browser-only `src/lib/services/excelExportClient.ts` — imports `write-excel-file/browser`, exposes `triggerDownload(filter, ctx)` (does its own one-shot reads via existing `listHouseholds`/`listFamilies`/collection-group for payments/`listExpenses`/`listRecurringTemplates`) and `triggerDownloadWithData(filter, ctx, data)` (uses pre-fetched data for per-screen); anchor-click download pattern per `research.md` §1
- [X] T013 Implement `src/lib/hooks/useExcelExport.ts` — React hook returning `{ trigger(snapshot, ctx): Promise<void>, isExporting: boolean, error: string | null }`; runs one-time browser capability check (`Blob` / `URL` / `document`) per `research.md` §11; surfaces capability miss as `error` not throw; all error messages route through `useT()` with inline `// TODO: localise this later` per project rule (no new keys in `src/messages/*.json`)
- [X] T014 [P] Implement `src/components/excel/ExportButton.tsx` — reusable per-screen button (`"use client"`), props `{ onExport: () => void | Promise<void>, label: string, disabled?: boolean }`; renders `isExporting` spinner + disabled state; label string carries inline `// TODO: localise this later` at call site per project rule
- [X] T015 [P] Implement `src/components/excel/ExportProgress.tsx` — spinner + `aria-busy` indicator shown while `isExporting === true`; pure presentational
- [X] T016 [P] Implement `src/components/excel/ExportError.tsx` — inline `<p role="alert">` displaying `error` from `useExcelExport()`; strings carry inline `// TODO: localise this later` per project rule
- [X] T017 Implement `src/components/excel/FullReportButton.tsx` — dashboard "Download full report (Excel)" trigger; calls `useExcelExport().trigger({ kind: "full" }, ctx)`; gates on `useAuth()` admin check (existing `AuthGuard`); reads `settings.global.currency` for `ExportContext.currency`; button label carries inline `// TODO: localise this later`

**Checkpoint**: Foundation ready — every export surface from US1/US2/US3 can now wire in.

---

## Phase 3: User Story 1 — Export the entire dataset as a single workbook (Priority: P1) 🎯 MVP

**Goal**: Admin clicks "Export → Download full report (Excel)" from any data screen; browser downloads `jamia-finance-{YYYY-MM-DD}.xlsx` with six sheets (`Info` + `Households`, `Families`, `Payments`, `Expenses`, `Recurring Templates`).

**Independent Test**: Populate seed data for all five collections, click "Download full report" on `/dashboard`, open the resulting `.xlsx`, confirm six sheets in order with correct headers + sample rows + `Info` row with current timestamp / currency / admin UID.

### Tests for User Story 1 ⚠️

> Write tests FIRST, ensure they FAIL before implementation.

- [X] T018 [P] [US1] Unit test `buildFileName({ kind: "full" }, fixedDate)` returns `jamia-finance-2026-06-29.xlsx` in `tests/unit/services/excelExport.test.ts`
- [X] T019 [P] [US1] Unit test `buildWorkbook({ kind: "full" }, fixtureData, ctxFixture)` in `tests/unit/services/excelExport.test.ts` — asserts six sheets in exact order (`Info`, `Households`, `Families`, `Payments`, `Expenses`, `Recurring Templates`), header row on each sheet, `Info` has exactly 1 row, numeric `Amount` columns typed `number`, empty collections produce header-only sheets (FR-002)
- [X] T020 [P] [US1] Unit test round-trip — feed Arabic / Malayalam / Tamil / comma-quote-newline strings through `buildWorkbook` then assert cell values preserved (`sc-004` last clause) in `tests/unit/services/excelExport.test.ts`
- [X] T021 [P] [US1] Playwright spec `tests/e2e/excel-export.spec.ts` — full report scenario: seed emulator, sign in, click `FullReportButton`, capture the `download` event, open the file with `exceljs`, assert sheet names + headers + numeric column types + `SUM` on Payments Amount equals on-screen total (`sc-004`)

### Implementation for User Story 1

- [X] T022 [P] [US1] Wire `FullReportButton` into `src/app/(app)/dashboard/page.tsx` (top-right of page header); add the "Export" menu wrapper if not already present, with one option "Download full report (Excel)" — string carries inline `// TODO: localise this later`
- [X] T023 [P] [US1] Re-export `FullReportButton` on `src/app/(app)/households/page.tsx`, `src/app/(app)/households/[householdId]/page.tsx`, `src/app/(app)/expenses/page.tsx`, `src/app/(app)/contributions/page.tsx` headers (admin can trigger from any data screen per US1 AS-1)
- [X] T024 [US1] Add `ExportProgress` + `ExportError` rendering alongside `FullReportButton` so FR-009 progress indicator + inline error appear on every surface
- [X] T025 [US1] Verify the dashboard's existing `useAuth()` / `AuthGuard` gate covers the export button (no new auth code) — confirm in `src/app/(app)/dashboard/page.tsx` per FR-012

**Checkpoint**: US1 fully functional and independently testable — `npm test -- excelExport` + Playwright full-report scenario both green.

---

## Phase 4: User Story 2 — Export a single entity list with its active filters (Priority: P1)

**Goal**: Every list screen has an "Export to Excel" button that downloads a one-sheet workbook reflecting exactly the rows currently visible, honouring the screen's active filters (date range, month, household, etc.).

**Independent Test**: On each list screen, apply a known filter (e.g. current month, this household), export, confirm rows == on-screen count and ≥3 spot-checked values match.

### Tests for User Story 2 ⚠️

> Write tests FIRST, ensure they FAIL before implementation.

- [X] T026 [P] [US2] Unit test `buildFileName` for every per-screen variant in `tests/unit/services/excelExport.test.ts` — covers all 8 patterns in `contracts/workbook-format.md` §7 (households / families-all / families-month / payments-all / payments-month / expenses-all / expenses-month / recurring)
- [X] T027 [P] [US2] Unit test per-screen `buildWorkbook` honouring each `FilterSnapshot` variant in `tests/unit/services/excelExport.test.ts` — `kind: "expenses"` with `month` + `subCategory` filter excludes non-matching rows; `kind: "payments"` with `filter.month` excludes non-month rows; `kind: "families"` with `showSoftDeleted: false` excludes soft-deleted rows; `kind: "recurring"` excludes `active === false`
- [X] T028 [P] [US2] Unit test "filter hint appears in file name" — switching month filter produces a distinct file name within the same day (`contracts/workbook-format.md` §7 + spec US2 AS-5) in `tests/unit/services/excelExport.test.ts`
- [X] T029 [P] [US2] Playwright spec append in `tests/e2e/excel-export.spec.ts` — one scenario per list screen (`/households`, `/households/[id]`, `/households/[hh]/families/[fid]/history`, `/expenses` expenses section, `/expenses` recurring section) asserting row count == on-screen count + header row matches workbook-format spec

### Implementation for User Story 2

- [X] T030 [P] [US2] Add `ExportButton` to `src/app/(app)/households/page.tsx` — builds `FilterSnapshot = { kind: "households" }`, passes page's already-subscribed `households` array as `ExportData`; file name `jamia-households-{YYYY-MM-DD}.xlsx`
- [X] T031 [P] [US2] Add `Export families` `ExportButton` to `src/app/(app)/households/[householdId]/page.tsx` — builds `FilterSnapshot = { kind: "families", householdId, showSoftDeleted: boolean, month }` (the new toggle from US3 wires into `showSoftDeleted`); file name per workbook-format §7
- [X] T032 [P] [US2] Add `Export payments` `ExportButton` to `src/app/(app)/households/[householdId]/families/[familyId]/history/page.tsx` — builds `FilterSnapshot = { kind: "payments", householdId, familyId, filter: "all" | { month } }` from the page's existing month filter state; file name encodes month or `all`
- [X] T033 [P] [US2] Add `Export expenses` `ExportButton` to the expenses section of `src/app/(app)/expenses/page.tsx` — builds `FilterSnapshot = { kind: "expenses", month, subCategory, expenseType: "mosque" }` mirroring the page's current filter controls; file name per workbook-format §7
- [X] T034 [P] [US2] Add `Export recurring` `ExportButton` to the recurring-templates section of `src/app/(app)/expenses/page.tsx` — builds `FilterSnapshot = { kind: "recurring", month, activeOnly: true }`; current-month status column computed in `excelExport.ts`
- [X] T035 [US2] Pass the screen's already-subscribed live data into each button via `triggerDownloadWithData(filter, ctx, data)` — UI never calls Firebase directly (project rule); export reads the same snapshot the screen renders
- [X] T036 [US2] Verify FR-012 — every new export button inherits the existing `AuthGuard` admin gate; confirm in each modified page

**Checkpoint**: US1 + US2 both green end-to-end; admin can export from every list screen with filters honoured.

---

## Phase 5: User Story 3 — Export respects existing data rules (Priority: P2)

**Goal**: Exports never expose data the admin wouldn't see on screen, soft-deleted families excluded by default (per-screen toggle controls inclusion), payments of soft-deleted families still included (count toward money on hand), numeric fields stay numeric, UTF-8 round-trips.

**Independent Test**: Export payments including a soft-deleted family's payment (default include), export families with toggle off (soft-deleted rows absent), open file and verify numeric columns right-aligned + Arabic/Malayalam/Tamil scripts intact.

### Tests for User Story 3 ⚠️

> Write tests FIRST, ensure they FAIL before implementation.

- [X] T037 [P] [US3] Unit test soft-deleted inclusion rules in `tests/unit/services/excelExport.test.ts` — `kind: "payments"` always includes soft-deleted-family payments (FR-010); `kind: "families"` with `showSoftDeleted: false` excludes them, with `true` includes them; full report's Families sheet includes soft-deleted rows
- [X] T038 [P] [US3] Unit test numeric type preservation in `tests/unit/services/excelExport.test.ts` — every `Amount` cell on Payments / Expenses / Families / Recurring sheets is a JS `number` (not `String(123.45)`); coercion helper logs `console.warn` on string-of-digits but never throws
- [X] T039 [P] [US3] Unit test `rightToLeft` per locale in `tests/unit/services/excelExport.test.ts` — `ctx.locale === "ar"` sets `rightToLeft: true` on every sheet (Info + 5 data), `"en"/"ml"/"ta"` set `false`
- [X] T040 [P] [US3] Unit test empty-sheet behaviour in `tests/unit/services/excelExport.test.ts` — empty collection produces a sheet with header row only and zero data rows, no error (FR-002 + workbook-format §9)
- [X] T041 [P] [US3] Unit test `coerceCell` warning behaviour in `tests/unit/services/excelExport.test.ts` — `vi.spyOn(console, "warn")`; `type: "number"` cell with string-of-digits triggers exactly one warn; null/undefined cell renders as empty string silently
- [X] T042 [P] [US3] Playwright spec append in `tests/e2e/excel-export.spec.ts` — soft-deleted family scenario: seed a household + family + payment where the family is soft-deleted; export families with toggle off (should be absent), toggle on (should appear); export payments (payment always present); open with `exceljs` and assert row counts

### Implementation for User Story 3

- [X] T043 [US3] Add "Show soft-deleted" toggle UI control to `src/app/(app)/households/[householdId]/page.tsx` — state held in page component (default `false`, matching current behaviour per `research.md` §2); toggle's label string carries inline `// TODO: localise this later`
- [X] T044 [US3] Wire the toggle's `showSoftDeleted` boolean into the `Export families` button's `FilterSnapshot` (US2 T031 already reads it; ensure the toggle state actually mutates the snapshot at click time, not at mount)
- [X] T045 [US3] Audit `excelExport.ts` row builders for the soft-deleted family column flag — Payments sheet has `Family active` boolean column (workbook-format §4) so admin can spot which payments belong to a soft-deleted family even though they remain included
- [X] T046 [US3] Audit `coerceCell` for every numeric column — Payments `Amount`, Expenses `Amount`, Families `Contribution target` + `Members`, Households counts, Recurring `Amount`, Info `Sheet count` + `Schema version` — every one is `JS number` not stringified

**Checkpoint**: US1 + US2 + US3 all green; FR-001 through FR-013 + SC-001 through SC-007 satisfied.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cross-cutting improvements + final validation against the spec's success criteria.

- [X] T047 [P] Add per-screen export "success" inline confirmation (e.g. `<p role="status">Downloaded {fileName} ({byteSize} KB)</p>`) to `ExportButton` so SC-006 (no silent failures, actionable feedback) is satisfied; string carries inline `// TODO: localise this later`
- [X] T048 [P] Verify browser capability detection hides `ExportButton` (not just `FullReportButton`) when `Blob`/`URL` missing — apply `useExcelExport()` capability result to all per-screen buttons per `research.md` §11
- [X] T049 [P] Add `xlsx` download guard — if the user's browser popup-blocker rejects the anchor click, surface inline error in `ExportError` with retry hint (FR-009 last clause + SC-006)
- [X] T050 [P] Document the new "Export families" button + "Show soft-deleted" toggle in `PROJECT_CONTEXT.md` §6 (UI inventory) — single-line entries, no prose
- [X] T051 [P] Add `npm run test -- excelExport` and `npm run test:e2e -- excel-export.spec.ts` lines to `quickstart.md` §6 already exist; verify commands run cleanly end-to-end
- [X] T052 Run `npm run typecheck` and confirm zero new TS errors
- [X] T053 Run quickstart.md round-trip validation manually — open produced `.xlsx` in Excel + Google Sheets + LibreOffice (or document which were tested in CI) per SC-003
- [X] T054 Audit every new UI string in `src/components/excel/`, modified screens, and the hook for the inline `// TODO: localise this later` comment — no new keys added to `src/messages/*.json` per project rule
- [X] T055 Verify FR-007 (UTF-8 + comma/quote/newline round-trip) — manually inject a record with `O'Brien, "the mason"` + Arabic / Malayalam / Tamil, export, open, confirm cells intact

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No deps — start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user stories**.
- **User Stories (Phase 3+)**: All depend on Phase 2; stories are then independent of each other.
- **Polish (Phase 6)**: Depends on US1 + US2 + US3 completion.

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — no deps on US2/US3.
- **US2 (P1)**: After Phase 2 — soft-deleted filter for `kind: "families"` comes from the US3 toggle; US2 ships with `showSoftDeleted` plumbing in place but the UI toggle ships in US3 T043. The two stories still test independently: US2 T027 tests `showSoftDeleted: false` (default) end-to-end against the snapshot builder.
- **US3 (P2)**: After Phase 2 — depends on US2 T031 (the families-export button location) for the toggle wiring in T044.

### Within Each User Story

- Tests (T018–T021 / T026–T029 / T037–T042) **MUST fail before** corresponding implementation tasks.
- Pure builder (`excelExport.ts`) precedes client wrapper (`excelExportClient.ts`) precedes hook (`useExcelExport.ts`) precedes screen-level buttons.
- Per-screen button wiring follows screen discovery (T030 → T034 are independent files → parallel-safe).
- Story checkpoint validated before moving to next priority.

### Parallel Opportunities

- All Setup `[P]` tasks (T003–T005) parallel.
- All Foundational `[P]` tasks (T008, T009, T014, T015, T016) parallel.
- Once Phase 2 completes, US1 + US2 + US3 can run concurrently if staffed.
- Within US2: T030, T031, T032, T033, T034 are independent files → all parallel.
- Within US3 tests: T037–T041 all parallel.

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together (must FAIL before implementation):
Task T018 "Unit test buildFileName full"
Task T019 "Unit test buildWorkbook full"
Task T020 "Unit test UTF-8 round-trip"
Task T021 "Playwright full report round-trip"

# Launch US1 button wiring in parallel across screens:
Task T022 "FullReportButton on /dashboard"
Task T023 "FullReportButton on /households, /expenses, /contributions"
```

## Parallel Example: User Story 2

```bash
# All US2 button additions hit different files — run together:
Task T030 "ExportButton on /households"
Task T031 "ExportButton on /households/[id]"
Task T032 "ExportButton on history page"
Task T033 "ExportButton on /expenses expenses section"
Task T034 "ExportButton on /expenses recurring section"

# All US2 tests parallel:
Task T026 "buildFileName per-screen variants"
Task T027 "buildWorkbook per-screen filter honour"
Task T028 "Filter hint in file name"
Task T029 "Playwright per-screen scenarios"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 — Setup (`npm install write-excel-file exceljs`)
2. Phase 2 — Foundational (`excelExport.ts`, `excelExportClient.ts`, `useExcelExport`, shared components)
3. Phase 3 — US1 (dashboard button + tests)
4. **STOP + VALIDATE**: `npm run typecheck`, `npm test -- excelExport`, Playwright full-report scenario
5. Deploy / demo — admin can already grab a full snapshot.

### Incremental Delivery

1. Setup + Foundational → foundation ready (Phase 1 + 2)
2. + US1 → admin can download full report (MVP)
3. + US2 → per-screen filtered exports from every list screen
4. + US3 → soft-deleted toggle + data-rule guarantees
5. Each story adds value without breaking previous stories.

### Parallel Team Strategy

With multiple developers after Phase 2 completes:

- Dev A: US1 dashboard wiring + Playwright full-report (T022–T025 + T021)
- Dev B: US2 per-screen buttons (T030–T036) + US2 unit tests (T026–T028)
- Dev C: US3 toggle + soft-deleted rules + US3 unit + Playwright tests (T037–T046)

Stories integrate independently — they share `useExcelExport()` + `ExportButton` from Phase 2 only.

---

## Notes

- `[P]` tasks = different files, no deps — safe to parallelise.
- Story labels `[US1]` / `[US2]` / `[US3]` map to the spec's user stories for traceability.
- Every UI string gets inline `// TODO: localise this later` per project rule (no new keys in `src/messages/*.json`).
- Pure module (`excelExport.ts`) is fully unit-testable without DOM; client module (`excelExportClient.ts`) is browser-only.
- No new Firestore collections, no new indexes, no new `firestore.rules` entries (per `data-model.md` §11).
- All numeric `Amount` columns must be JS `number` end-to-end — SC-004 depends on it.
# Implementation Plan: Excel Export

**Branch**: `004-excel-export` | **Date**: 2026-06-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-excel-export/spec.md`
**Research**: [research.md](./research.md) (all `NEEDS CLARIFICATION` resolved)
**Design**: [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

---

## Summary

Add a "Download to Excel" capability to the existing single-admin dashboard so the admin can take their data offline for review, sharing, and archival. Two complementary surfaces:

1. **Full report** (dashboard "Export → Download full report"): one `.xlsx` with an `Info` metadata sheet plus one sheet per core entity (Households, Families, Payments, Expenses, Recurring Templates), dated `jamia-finance-{YYYY-MM-DD}.xlsx`.
2. **Per-screen export** (every list screen has an "Export to Excel" button): one `.xlsx` with a single sheet containing only the rows currently visible on screen, honouring the active filter (month, sub-category, "Show soft-deleted", etc.) at click time, named `jamia-{entity}-{filter-hint}-{YYYY-MM-DD}.xlsx`.

Generated entirely client-side via `write-excel-file` (browser entry, Web Worker, MIT). No server roundtrip, no third-party upload, no new Firestore collections, no new security rules. Numeric cells are real JS numbers so Excel `SUM` works; UTF-8 round-trips Arabic / Malayalam / Tamil.

The single persistence-free change to the UI is a new "Show soft-deleted" toggle on the household detail page (per spec FR-010 + Story 3 AS-2). All other surfaces use the existing filter state.

---

## Technical Context

**Language/Version**: TypeScript 5 (strict) + Next.js 16.2.7 (App Router) + React 19.2.4. Node 20.x. Same as the rest of the project.

**Primary Dependencies**:
- New: `write-excel-file@^4` (MIT, browser entry only). Resolved per `research.md` §1.
- Existing: `firebase@^12`, `react@19.2.4`, `date-fns@^4`, `tailwindcss@^4`, `zod@^4`, `react-hook-form@^7`.
- No new test deps — the existing `vitest@^3` + `@testing-library/react@^16` + `@playwright/test@^1.60` cover the new code.

**Storage**: None new. The export feature reads the five existing collections via the existing `list*` / collection-group helpers in `src/lib/services/`. No writes, no new collections, no new indexes, no new `firestore.rules` entries.

**Testing**: Vitest 3 for `excelExport.ts` (pure, fully testable) + Playwright 1 for the end-to-end download + open-with-`exceljs`-reader round-trip (per `contracts/workbook-format.md` §10).

**Target Platform**: Vercel (Node 20, existing) + Firebase Spark (existing). No change to deploy pipeline.

**Project Type**: Single Next.js 16 app. The export feature is a new `src/lib/services/` module pair + a new `src/components/excel/` directory + screen-level button additions. No new package boundaries.

**Performance Goals**: SC-002 — a per-screen export of up to 1,000 rows completes within 10 s on a typical broadband connection. With `write-excel-file`'s Web Worker offload and one `getDocs` per collection, our 5-collection full report of 1k payments + 50 families + 20 households + 100 expenses + 10 templates is comfortably under 5 s on a mid-range laptop.

**Constraints**:
- Must not regress the existing SC-009 (money on hand formula), the existing i18n posture, or the existing service-layer pattern.
- Must be a static client-side export (no server, no third-party upload) — matches the project rule "UI never calls Firebase directly", extended to "UI never uploads user data anywhere".
- Must respect the existing i18n setup: all new UI strings go through `useT()` with `// TODO: localise this later` per project rule. No new keys in `src/messages/*.json` in this feature.
- Must be safe for the single-admin user model: every action is gated by `useAuth().user.uid` being an admin (existing `AuthGuard`).

**Scale/Scope**: The same as the rest of the project — tens of households, hundreds of families, thousands of payments. Workbook size is bounded to a few hundred KB even at the high end of that range; no streaming needed.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution file at `.specify/memory/constitution.md` is the v1 template (all `[PRINCIPLE_*]` and `[SECTION_*]` placeholders). No project-specific gates are codified yet, so the check defaults to the **project's documented invariants** in `PROJECT_CONTEXT.md` and `AGENTS.md`:

| Invariant | Compliance |
|---|---|
| **UI never calls Firebase directly** (PROJECT_CONTEXT §5) | ✅ Export service reads via the existing `list*` / collection-group helpers. |
| **All writes go through `src/lib/services/*`** (PROJECT_CONTEXT §5) | ✅ N/A — export has no writes. |
| **Live data via `onSnapshot`** (PROJECT_CONTEXT §5) | ✅ Per-screen export re-uses the screen's already-subscribed live data. The full report uses one-shot `getDocs` because the dashboard does not currently subscribe to all 5 collections, and snapshot-at-click-time is the spec's edge-case requirement. |
| **Money on hand is read inside `runTransaction`** (PROJECT_CONTEXT §5) | ✅ N/A — export has no money-on-hand writes. |
| **i18n via `I18nProvider` + `src/messages/*.json`** (PROJECT_CONTEXT §5) | ✅ New UI strings use `t()`; new code carries `// TODO: localise this later` per the project rule. No new keys added in this feature. |
| **Permissively-licensed deps only** (spec FR / assumption) | ✅ `write-excel-file` is MIT. Resolved per `research.md` §1. |
| **Next.js 16 breaking changes respected** (AGENTS.md) | ✅ Component code is `"use client"`, no Server Component changes. |
| **Test posture: Vitest + Playwright on Firestore emulator** (PROJECT_CONTEXT §8) | ✅ New unit tests go in `tests/unit/services/excelExport.test.ts`. New E2E goes in `tests/e2e/excel-export.spec.ts`. |

**Gate result**: ✅ PASS. No violations, no justifications required.

**Re-check after Phase 1 design**:
- `data-model.md` introduces 0 new Firestore collections → ✅ no rules change required.
- `contracts/export-service.ts` is a single internal TypeScript interface → ✅ no new public surface.
- `contracts/workbook-format.md` is fully consistent with `data-model.md` §9 and `spec.md` FR-005 / FR-006 / FR-008 → ✅ no spec drift.
- The new "Show soft-deleted" toggle is a UI surface only; no new writes, no new service-layer functions → ✅ no invariant broken.

---

## Project Structure

### Documentation (this feature)

```text
specs/004-excel-export/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── README.md
│   ├── export-service.ts
│   └── workbook-format.md
└── tasks.md             # Phase 2 output (created by /speckit.tasks, NOT by this command)
```

### Source Code (additions only — the existing tree is untouched)

```text
src/
├── lib/
│   └── services/
│       ├── excelExport.ts        # NEW — pure builder, fully unit-testable
│       └── excelExportClient.ts  # NEW — browser-only wrapper (write-excel-file + URL.createObjectURL)
├── lib/
│   └── hooks/
│       └── useExcelExport.ts     # NEW — React hook: { trigger, isExporting, error }
├── components/
│   └── excel/                    # NEW directory
│       ├── ExportButton.tsx      # shared button (per-screen "Export to Excel")
│       ├── FullReportButton.tsx  # dashboard "Download full report" button
│       ├── ExportProgress.tsx    # spinner + disabled state
│       └── ExportError.tsx       # inline error display
└── messages/
    └── *.json                    # NOT modified in this feature (TODO-localise rule)

src/app/
└── (app)/
    ├── dashboard/page.tsx        # add FullReportButton
    ├── households/page.tsx       # add ExportButton
    ├── households/[householdId]/page.tsx
    │   # add the "Show soft-deleted" toggle + add Export families button
    ├── households/[householdId]/families/[familyId]/history/page.tsx
    │   # add Export payments button
    └── expenses/page.tsx         # add Export expenses button + Export recurring button

tests/
├── unit/
│   └── services/
│       └── excelExport.test.ts   # NEW
└── e2e/
    └── excel-export.spec.ts      # NEW — Playwright round-trip per workbook-format.md §10
```

**Structure Decision**: Same project shape as the rest of the codebase. The export is a self-contained "feature module" within the existing `src/lib/services/`, `src/lib/hooks/`, and `src/components/` boundaries. The only new top-level directory is `src/components/excel/` (parallel to `src/components/households/`, `src/components/expenses/`, etc.), which keeps the export's UI code discoverable and avoids scattering `ExportButton` instances across feature folders.

---

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. This section is intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| — | — | — |

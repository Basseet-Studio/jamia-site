# Implementation Plan: Payment Contribution Spillover

**Branch**: `003-payment-spillover` | **Date**: 2026-06-17 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from `/specs/003-payment-spillover/spec.md`

## Summary

Add an over-limit indicator and auto-cascade of excess payment amount to unpaid back months (oldest-first) plus an opt-in checkbox to fill future months. Each admin submission can produce N linked payment docs (one per covered month) sharing a `coverageGroupId` UUID, committed atomically with a single money-on-hand shift. All writes happen in one Firestore `runTransaction` to preserve v1's SC-009 atomicity guarantee.

Primary requirement (from spec): one admin entry → many covered months, with live preview and atomic commit.

Technical approach (from research): pure `planCoverage()` module drives both the dialog preview and the submit transaction; existing payment schema is extended additively with one nullable field; one new composite index enables group-lookup queries; UUID v4 generated client-side via `crypto.randomUUID()`.

## Technical Context

**Language/Version**: TypeScript 5.x, strict mode (existing project standard)
**Primary Dependencies**: Next.js 16.2.7, React 19.2.4, Firebase 12.14.0 (client SDK), Zod 4.4.3, react-hook-form 7.78.0, date-fns 4.4.0 (all already in `package.json` — no new runtime deps)
**Storage**: Firestore (existing) — additive field on `payments` sub-collection docs; no schema migration needed
**Testing**: Vitest 3.2.6 (unit + emulator-backed), @testing-library/react (UI), Playwright 1.60.0 (e2e, optional for this feature)
**Target Platform**: Web admin dashboard (Chrome/Firefox/Safari evergreen — matches v1 baseline). `crypto.randomUUID()` is available in all targeted browsers since 2022.
**Project Type**: Web (Next.js app router) — single frontend project, Firestore as the backend-as-a-service
**Performance Goals**: SC-005 requires over-limit indicator to update within 100ms of keystroke (controlled input, no debounce). Cascade plan computation is O(unpaid months) — sub-millisecond for the stated scale (~24 months worst case).
**Constraints**:
- v1 SC-009 atomicity MUST be preserved — every payment write commits with its MOH shift in one Firestore transaction.
- Composite-index budget under 200 (Spark limit). Plan adds 1 → total 8.
- One payment doc per covered month — never persist "leftover" partial back-month coverage (whole-month rule per spec assumption).
**Scale/Scope**: Single feature; touches 1 service module (new), 1 service module (modified), 1 component (modified), 1 type file (modified), 1 schema file (modified), 1 rules file (delta), 1 indexes file (delta). No new top-level directories.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Note**: The project constitution file (`.specify/memory/constitution.md`) is a template placeholder — not yet filled out for this codebase. This plan proceeds using the de-facto principles observable in v1 and 002 specs:

| De-facto principle (inferred from v1/002 patterns) | Compliance |
|---|---|
| **Service-layer re-validates all writes via Zod** | ✅ `recordPaymentWithCoverage` re-runs `recordPaymentSchema` + new `recordPaymentWithCoverageSchema` before any Firestore write. |
| **Atomic transactions for state mutations involving multiple docs** | ✅ Single `runTransaction` wraps N payment writes + 1 MOH shift + 1 in-txn re-read (race-safety). Matches SC-009. |
| **Additive schema changes only; legacy docs continue to work** | ✅ `coverageGroupId` is nullable; legacy `recordPayment` export preserved; legacy `deletePayment` path preserved (FR-028). |
| **Localised UI text via `useT()` hook + ARB files** | ✅ All new strings routed through `useT()` with `// TODO: localise` markers per project rule (skill directive). |
| **Pure derived values live in `services/`, not as stored state** | ✅ `CoveragePlan` is a pure function output; `CoverageGroup` is a query. Mirrors `MonthlyBudgetShortfall` pattern in 002. |
| **Firestore rule changes ship as additive patches** | ✅ `contracts/firestore.rules` documents the delta only; field is optional in the rule (`!('coverageGroupId' in request.resource.data) || ...`). |
| **No new runtime dependencies unless justified** | ✅ Uses browser-native `crypto.randomUUID()`; no new package. |

No constitution violations.

## Project Structure

### Documentation (this feature)

```text
specs/003-payment-spillover/
├── plan.md              # This file
├── research.md          # Phase 0 — 13 design decisions
├── data-model.md        # Phase 1 — entity / index / schema delta
├── quickstart.md        # Phase 1 — 9-scenario smoke test
├── contracts/
│   └── firestore.rules  # Phase 1 — security rule delta
├── checklists/
│   └── requirements.md  # Spec quality checklist (filled during /speckit.specify)
├── spec.md              # Feature specification (filled during /speckit.specify)
└── tasks.md             # Phase 2 — generated by /speckit.tasks (not yet)
```

### Source Code (repository root)

```text
src/
├── components/payments/
│   ├── RecordPaymentDialog.tsx      # MODIFIED — adds over-limit indicator, preview block, future-months checkbox
│   ├── DeletePaymentDialog.tsx      # MODIFIED — detects coverageGroupId, group-prompt path
│   ├── PaymentHistoryTable.tsx      # unchanged for v1 (out of scope per research #13)
│   └── StatusBadge.tsx              # unchanged
├── lib/
│   ├── schemas/
│   │   └── payment.ts               # MODIFIED — add recordPaymentWithCoverageSchema, extend recordPaymentSchema
│   ├── services/
│   │   ├── coverage.ts              # NEW — planCoverage() pure module + types
│   │   ├── payments.ts              # MODIFIED — add recordPaymentWithCoverage, listPaymentsByCoverageGroup, group-aware deletePayment
│   │   └── moneyOnHand.ts           # unchanged (reuse shiftMoneyOnHandInTx)
│   ├── types/
│   │   └── index.ts                 # MODIFIED — extend Payment interface with coverageGroupId: string | null
│   ├── utils/
│   │   └── dates.ts                 # unchanged (reuse toMonthKey, stepMonthKey)
│   └── i18n/                        # unchanged in this PR (// TODO: localise markers added at call sites)
├── app/                             # unchanged (no new routes — feature is in existing pages)
└── ...
firestore.rules                      # MODIFIED — see contracts/firestore.rules for the delta
firestore.indexes.json               # MODIFIED — add 1 composite index
tests/
├── unit/
│   ├── services/
│   │   ├── coverage.test.ts         # NEW — pure-function tests for planCoverage()
│   │   ├── payments.cascade.test.ts # NEW — emulator-backed cascade + group-delete tests
│   │   ├── payments.test.ts         # unchanged (regression)
│   │   └── payments.atomicity.test.ts # unchanged (regression)
│   └── ui/
│   └── RecordPaymentDialog.test.tsx # NEW — UI tests for indicator + preview + checkbox
└── ...
```

**Structure Decision**: Web application (Option 2 from the template, narrowed to the frontend side because the backend is Firestore). Single Next.js project — no separate backend service. New code lives in existing directories; only one new top-level file (`src/lib/services/coverage.ts`). All other changes are additive edits to existing files.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. The new code introduces one pure module and additive edits — well within the existing architectural style.

| Concern | Mitigation |
|---|---|
| In-transaction re-read of payments sub-collection adds a `tx.get()` per submit | One extra `tx.get()` on a small collection (one family's payments). Sub-millisecond. Required for SC-007 race-safety. |
| One new composite index | Spark budget 8/200 — non-issue. |
| `coverage.ts` module appears "purely algorithmic" but is used by both UI and service | Intentional — single source of truth for cascade math. Test coverage is highest-priority (mirror v1's two-level pattern). |
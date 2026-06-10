# Implementation Plan: Household Members, Expense Types, Calendar View, and Budget Shortfall Warnings

**Branch**: `002-members-expenses-calendar` | **Date**: 2026-06-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-members-expenses-calendar/spec.md`
**Extends**: `specs/001-household-finance-dashboard/plan.md` (read-only reference)

---

## Summary

Extends the v1 household-finance dashboard with four additive features. (1) Households gain a `memberCount` + `memberNames` pair with full append-only change history stored as a sibling sub-collection to `families`. (2) Every expense gets a required `type` field (`household` | `mosque`) with linkage rules enforced via a Zod `discriminatedUnion` and re-asserted in Firestore security rules; recurring templates get the same `type` field, defaulting to `mosque`. (3) A new `/calendar` page lists, per selected month, all active recurring templates (with `Not added` / `Pending withdrawal` / `Withdrawn` status) plus the month's ad-hoc expenses, with a navigator to step months. (4) A pure `BudgetShortfallService` computes the gap between available funds and the active recurring total, with severity `ok` / `watch` / `risk`; a live subscription drives a banner on the Calendar view and an inline warning inside the recurring-expense withdraw confirmation.

Built on the v1 stack (Next.js 15 App Router, Firebase Firestore, shadcn/ui, React Hook Form + Zod, Vitest + Playwright, `onSnapshot` everywhere, no client cache lib). No new packages beyond what v1 already uses; all logic stays in the service layer. Household hard-delete cascade is extended to also remove member-history docs and household-scoped expenses, in the same chunked-batch pattern v1 uses for families + payments.

## Technical Context

**Language/Version**: TypeScript 5.x, Next.js 15 (App Router), React 19, Node.js 20 — inherited unchanged from v1.

**Primary Dependencies**: Inherited from v1 (`next@15`, `react@19`, `firebase@11`, `tailwindcss@4`, `react-hook-form@7`, `zod@3`, `date-fns@3`, `lucide-react`, `vitest@2`, `playwright@1`, shadcn/ui). No new packages required for 002; the only candidate (`sonner` for the calendar toast) is verified in the implementation phase — if absent, it gets added. See `research.md` §12.

**Storage**: Firebase Firestore (Spark free tier). Same collections as v1, with the following additions/changes:
- `households/{hhId}` — gains `memberCount`, `memberNames`, `updatedAt`, `updatedBy`
- `households/{hhId}/memberHistory/{histId}` — new append-only sub-collection
- `expenses/{expId}` — gains `type` (`household` | `mosque`), `householdId`/`familyId` (conditional), `mosqueSubCategory` (conditional)
- `recurringExpenses/{tplId}` — gains the same `type` + linkage fields
- No new top-level collections

Three new composite indexes (declared in `firestore.indexes.json`, see `data-model.md` §8). Total: 7 composite indexes, well under the Spark 200 limit.

**Testing**: Vitest 2 + `@testing-library/react@16` + Playwright 1 — inherited from v1. The `BudgetShortfallService` pure function is unit-tested with the six required cases from FR-032 (data-model.md §5). Firestore Emulator Suite for data tests; the existing E2E suite from v1 must continue to pass (SC-007).

**Target Platform**: Browser (modern desktop/laptop; no mobile-first v1). Vercel (Node 20) + Firebase Spark — inherited.

**Project Type**: Web application — single Next.js 15 app, no separate backend service. All business logic in `src/lib/services/` callable from Server Actions, Route Handlers, or client components. New page `src/app/(app)/calendar/page.tsx`.

**Performance Goals** (inherits v1 + adds):
- SC-001: household member save → history row visible in < 2s (live `onSnapshot`)
- SC-002: expense type classification → correct badge + list placement in < 30s with no refresh
- SC-003: recurring-withdraw dialog → expanded confirmation in < 1s
- SC-004: `/calendar` page load < 2s, re-render on month step < 1s
- SC-005: shortfall banner updates within 1s of any underlying change
- All achieved via `onSnapshot` listeners and client-side derivation; no new server round-trips

**Constraints**: Inherited from v1 (Spark quotas, Vercel free tier, single time zone display-only, English-only UI for v1 with `// TODO(i18n)` tags). The 002 delta adds:
- v1 rule on household `update: if false` is relaxed to a narrow allowlist (member fields only). Any other field update attempt is still rejected.
- Household hard-delete cascade grows from 2 sub-collections to 4, plus a collection-group query on `expenses`. Total per-batch cost stays under 500 ops.
- No new top-level package; only possibly `sonner` if not already in v1.

**Scale/Scope**: 5 user stories, 32 functional requirements, 8 success criteria. Volume target unchanged from v1 (tens of households, hundreds of families, thousands of payments/expenses over years). Member history adds tens of docs per household per lifetime (one per edit). Calendar view pulls one month at a time, indexed.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The repo's `.specify/memory/constitution.md` is the unfilled template — no real principles to enforce. Treated as "no gates" rather than fabricated rules. The strict rules below are pulled from the v1 plan's tracked rules (which themselves come from the v1 spec's "Key Rules Summary" appendix) plus the 002 delta, so reviewers can verify conformance for both phases:

**v1 rules (carried over, see 001/plan.md for full list):**
- No edit on payment rows (FR-020)
- No undo on withdrawal (FR-031)
- No automatic recurring expense creation (FR-034)
- No recurring template auto-add per month
- No adding the same recurring template twice in one month
- Soft delete preserves payments and reserves family ID (FR-012, FR-013)
- Money on hand formula is exact (FR-039, SC-009)
- Money on hand may be negative
- Currency is display-only (FR-046)
- Admin list is managed outside the app (FR-005)
- English-only UI for v1 — `// TODO(i18n)` on every user-facing literal
- No edit action on payment rows (no `updatePayment`)

**002 additions (locked from spec):**
- **No type change on existing expense** (FR-008, FR-009, FR-010) — to change an expense's type, delete + recreate. Enforced by the rules' withdraw-only `update` rule and the service layer.
- **No auto-cleanup of orphaned templates on household delete** (Edge case L117 + research §7) — admin must manually archive.
- **No `updateMemberHistory` or `deleteMemberHistory` service methods** (FR-005) — append-only, enforced in both service layer and rules.
- **No money-on-hand adjustment for member edits** — `updateMembers` does NOT touch `settings.global.moneyOnHand`. (Members are census metadata, not money.)
- **`memberCount === memberNames.length` invariant** (FR-003) — service layer rejects mismatches; the form computes `memberCount` from `memberNames.length` before submit.
- **Shortfall banner is hidden when no active recurring templates** (FR-030) — UI checks `recurringTotal === 0` and skips rendering.
- **Best-effort fallback for shortfall on network error** (FR-031) — dialog shows "Could not compute budget impact" if `getMonthlyTotals` rejects within the 3s budget.
- **Household hard-delete is idempotent** (research §11) — re-running on an already-deleted household is a safe no-op.
- **All new strings carry `// TODO(i18n)`** (per project rule).

**Re-evaluation after Phase 1 design**: no violations. The 002 service interface in `contracts/service-interface.ts`:
- Has no `updateExpenseType` (only the v1 withdraw update exists)
- Has no `updateMemberHistory` / `deleteMemberHistory`
- Has no `adjustMoneyOnHand` call inside `updateMembers`
- The pure `computeShortfall` function is exported separately and unit-tested; the subscription `subscribeMonthlyShortfall` is a thin wrapper that hydrates inputs
- The Firestore rules delta in `contracts/firestore.rules` blocks all `update`/`delete` on `memberHistory`, and the household `update` rule is a narrow allowlist
- All gates pass.

## Project Structure

### Documentation (this feature)

```text
specs/002-members-expenses-calendar/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── README.md
│   ├── firestore.rules  # the 002 delta
│   └── service-interface.ts  # additive over v1
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

The 002 branch extends v1's structure. New files only; no v1 file is moved or renamed.

```text
jamia-site/
├── src/
│   ├── app/
│   │   ├── (app)/
│   │   │   ├── calendar/                       # NEW — page.tsx
│   │   │   ├── households/
│   │   │   │   └── [householdId]/
│   │   │   │       ├── page.tsx                # MODIFIED — members section
│   │   │   │       └── history/                # NEW — member change history
│   │   │   │           └── page.tsx
│   │   │   ├── expenses/page.tsx               # MODIFIED — type filter
│   │   │   └── recurring/page.tsx              # MODIFIED — type field
│   ├── components/
│   │   ├── households/                         # NEW + MODIFIED
│   │   │   ├── MembersSection.tsx              # NEW
│   │   │   ├── MemberHistoryTable.tsx          # NEW
│   │   │   └── HouseholdDetail.tsx             # MODIFIED
│   │   ├── expenses/
│   │   │   ├── AddExpenseDialog.tsx            # MODIFIED — type selector
│   │   │   ├── WithdrawDialog.tsx              # MODIFIED — recurring mode
│   │   │   └── ExpenseTable.tsx                # MODIFIED — type badge + filter
│   │   ├── recurring/
│   │   │   ├── AddTemplateDialog.tsx           # MODIFIED — type selector
│   │   │   └── RecurringTemplateList.tsx       # MODIFIED — type badge
│   │   ├── calendar/                           # NEW
│   │   │   ├── CalendarView.tsx
│   │   │   ├── MonthNavigator.tsx
│   │   │   ├── RecurringExpensesGroup.tsx
│   │   │   ├── AdHocExpensesGroup.tsx
│   │   │   ├── ShortfallBanner.tsx
│   │   │   └── CalendarEmptyState.tsx
│   │   ├── nav/
│   │   │   └── AppShell.tsx                    # MODIFIED — add Calendar link
│   │   └── summary/
│   │       └── MoneyOnHandCard.tsx             # unchanged
│   ├── lib/
│   │   ├── services/
│   │   │   ├── households.ts                   # MODIFIED — updateMembers + extended cascade
│   │   │   ├── memberHistory.ts                # NEW
│   │   │   ├── expenses.ts                     # MODIFIED — type-aware create
│   │   │   ├── recurring.ts                    # MODIFIED — type field
│   │   │   ├── shortfall.ts                    # NEW — pure computeShortfall
│   │   │   ├── shortfallSubscription.ts        # NEW — subscribeMonthlyShortfall
│   │   │   ├── calendarView.ts                 # NEW — subscribeCalendarView + getMonthlyTotals
│   │   │   ├── moneyOnHand.ts                  # unchanged
│   │   │   └── derived.ts                      # unchanged
│   │   ├── schemas/
│   │   │   ├── household.ts                    # MODIFIED — memberCount/memberNames
│   │   │   ├── householdMember.ts              # NEW
│   │   │   ├── memberHistory.ts                # NEW
│   │   │   ├── expense.ts                      # MODIFIED — discriminatedUnion
│   │   │   └── recurringTemplate.ts            # MODIFIED — discriminatedUnion
│   │   ├── types/index.ts                      # MODIFIED — extend Household, Expense, RecurringTemplate
│   │   ├── hooks/
│   │   │   └── useCalendarMonth.ts             # NEW — month-stepper state
│   │   └── i18n/
│   │       └── useT.ts                         # MODIFIED — add calendar.* keys
│   ├── messages/                               # unchanged
│   ├── components/                             # unchanged beyond listed
│   ├── styles/                                 # unchanged
│   ├── lib/utils/dates.ts                      # unchanged
│   └── lib/utils/currency.ts                   # unchanged
├── tests/
│   ├── unit/
│   │   ├── services/
│   │   │   ├── shortfall.test.ts               # NEW — FR-032 six cases
│   │   │   ├── households.updateMembers.test.ts # NEW
│   │   │   └── expenses.createType.test.ts     # NEW
│   │   └── schemas/
│   │       └── expense.discriminatedUnion.test.ts # NEW
│   └── e2e/
│       ├── calendar.spec.ts                    # NEW
│       ├── household-members.spec.ts           # NEW
│       └── expense-type.spec.ts                # NEW
├── firestore.indexes.json                      # MODIFIED — add 3 composite indexes
└── firestore.rules                             # MODIFIED — apply 002 delta
```

**Structure Decision**: Single Next.js app, additive on v1. No new package. v1 contracts are read-only references; 002 lives in its own `contracts/` and `data-model.md`. The rules file is the only canonical place where v1 and 002 are merged (deploy step concatenates them). The shortfall service is split into a pure-function module (`shortfall.ts`) and a subscription wrapper (`shortfallSubscription.ts`) so the formula can be unit-tested with no Firestore.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitution violations. No additional complexity introduced beyond the spec's explicit requirements. The only "added" complexity is the discriminated-union on expense type, which is required by FR-008/FR-009/FR-010 to encode the type XOR linkage invariant in a single place.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | — | — |

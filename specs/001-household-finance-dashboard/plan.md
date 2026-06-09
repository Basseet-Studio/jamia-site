# Implementation Plan: Veeramangalam Juma Masjid Household Finance Dashboard

**Branch**: `001-household-finance-dashboard` | **Date**: 2026-06-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-household-finance-dashboard/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Single-admin web dashboard for the Veeramangalam Juma Masjid. Tracks monthly family contributions, expenses, and an all-time "money on hand" balance. Built as a single Next.js 15 (App Router) app on Vercel, backed by Firebase Firestore with Google Sign-In via Firebase Auth, styled with shadcn/ui on Tailwind. v1 has no family portal, no messaging, no edit-on-payment, no undo-withdrawal, no automatic recurring generation, no in-app admin management.

## Technical Context

**Language/Version**: TypeScript 5.x, Next.js 15 (App Router), React 19, Node.js 20.

**Primary Dependencies**:
- `next@15` (App Router, Server Components, Server Actions, Route Handlers)
- `react@19`, `react-dom@19`
- `firebase@11` (Web SDK — Auth + Firestore)
- `firebase-admin@12` (server SDK for Server Actions that need privileged reads)
- `tailwindcss@4` + `@tailwindcss/postcss`
- shadcn/ui primitives (Radix UI + `class-variance-authority` + `tailwind-merge`)
- `react-hook-form@7` + `zod@3` (form validation; Zod schemas double as service-layer guards)
- `date-fns@3` (date math + `format(date, "yyyy-MM")` for the month key)
- `lucide-react` (icons)
- `@tanstack/react-query@5` (client cache + mutation invalidation)
- `vitest@2` + `@testing-library/react@16` (unit + service)
- `@playwright/test@1` (E2E on critical flows)

**Storage**: Firebase Firestore (Spark free tier). Collections: `admins`, `settings/global` (singleton), `households/{householdId}/families/{familyId}/payments` (collection group for money-on-hand), `expenses`, `recurringExpenses`. Composite indexes declared in `firestore.indexes.json` and listed in `data-model.md` §11.

**Testing**: Vitest (unit + service layer, Firestore emulator for data tests), Playwright (E2E on sign-in, record payment, withdraw expense, soft-delete family, all-time expense toggle). Coverage target: 80% statements on `src/lib/services/`. Firestore Emulator Suite for test data isolation.

**Target Platform**: Browser (modern desktop/laptop; no mobile-first v1). Hosting: Vercel (free tier) + Firebase Spark (free tier). Next.js runtime: Node 20.

**Project Type**: Web application — single Next.js app, no separate backend service. All business logic in `src/lib/services/` callable from Server Actions, Route Handlers, or client components.

**Performance Goals**:
- SC-001: sign-in → dashboard in < 30s on broadband
- SC-002: record payment → all derived totals update in < 3s
- SC-003: withdraw expense → money on hand updates in < 3s
- Live surfaces (dashboard, money on hand, household summary) use Firestore `onSnapshot` listeners so updates feel instant
- Sub-200ms p95 for any single Firestore query (Spark-tier cold starts excluded)

**Constraints**:
- Firebase Spark: 50K reads/day, 20K writes/day, 20K deletes/day, 1 GiB storage
- Vercel free: 100 GB bandwidth/month, 100 GB-h serverless execution/month
- Single time zone (display-only; no conversion logic)
- English UI only for v1; every user-facing string tagged with `// TODO(i18n)` for later extraction
- No family-facing portal, no messaging, no in-app admin management (per spec "Not in v1")

**Scale/Scope**: 13 user stories, 51 functional requirements, 12 success criteria. Data volume target (per spec assumptions): tens of households, hundreds of families, thousands of payments/expenses over years. Performance beyond that out of scope for v1.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The repo's `.specify/memory/constitution.md` is the unfilled template — no real principles to enforce. Treated as "no gates" rather than fabricated rules. The strict rules below are pulled from the spec's "Key Rules Summary" appendix and the explicit non-goals in the assumption section, and are tracked here so reviewers can verify v1 conformance:

- **No edit on payment rows** (FR-020, US-9) — UI must not render an Edit action on payment rows
- **No undo on withdrawal** (FR-031, US-5) — UI must not render an Undo action on withdrawn expenses
- **No automatic recurring expense creation** (US-7, assumption) — templates are inert; admin must explicitly add for the month
- **No recurring template auto-add per month** (FR-034, US-7) — even if a template was added in previous month, it is NOT auto-added next month
- **No adding the same recurring template twice in one month** (Edge case) — second attempt is rejected
- **Soft delete preserves payments and reserves family ID** (FR-011, FR-012, FR-013) — invariant enforced in the service layer and security rules
- **Hard delete on household cascades to families and payments** (FR-014, FR-015) — atomic batched write with retyped-name confirmation
- **Money on hand formula is exact** (FR-039, SC-009) — `opening + Σ payments(all) − Σ withdrawnExpenses(all)`
- **Money on hand may be negative** (Edge case) — display as negative, no special handling
- **Currency is display-only** (FR-046) — no conversion logic anywhere
- **Admin list is managed outside the app** (FR-005, "Not in v1") — `admins/{uid}` documents are written in Firebase Console
- **Optional recent-activity feed is out of scope for v1** (Edge case) — dashboard renders correctly without it
- **English-only UI for v1** — all strings inlined; add `// TODO(i18n)` on every user-facing literal
- **No edit action on payment rows** (FR-020) — service layer exposes no `updatePayment` method

**Re-evaluation after Phase 1 design**: no violations. The service interface in `contracts/service-interface.ts` has no `updatePayment`, no `undoWithdrawal`, no `autoAddRecurring`. The Firestore rules in `contracts/firestore.rules` block family `delete()` and only allow the `active: true → false` transition on families, and only allow the `withdrawn: false → true` transition on expenses. All gates pass.

## Project Structure

### Documentation (this feature)

```text
specs/001-household-finance-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── README.md
│   ├── firestore.rules
│   └── service-interface.ts
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
jamia-site/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── sign-in/page.tsx
│   │   │   └── access-denied/page.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx                 # AppShell + AuthGuard
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── households/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [householdId]/page.tsx
│   │   │   │       └── families/[familyId]/history/page.tsx
│   │   │   ├── expenses/page.tsx
│   │   │   ├── recurring/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── api/                           # Route handlers (webhooks, etc.)
│   │   ├── layout.tsx                     # Root layout, providers
│   │   └── page.tsx                       # → /sign-in or /dashboard
│   ├── components/
│   │   ├── ui/                            # shadcn/ui primitives
│   │   ├── nav/                           # AppShell, MonthNavigator
│   │   ├── summary/                       # MoneyOnHandCard, MonthSummaryBar
│   │   ├── households/                    # HouseholdTable, FamilyRow, AddHouseholdDialog
│   │   ├── payments/                      # RecordPaymentDialog, PaymentHistoryTable
│   │   ├── expenses/                      # ExpenseTable, AddExpenseDialog, WithdrawDialog
│   │   ├── recurring/                     # RecurringTemplateList, AddForMonthButton
│   │   └── auth/                          # GoogleSignInButton, AuthGuard
│   ├── lib/
│   │   ├── firebase/
│   │   │   ├── client.ts                  # client SDK init (browser)
│   │   │   ├── admin.ts                   # server SDK init (Node runtime only)
│   │   │   └── rules/                     # firestore.rules (mirrored to repo root)
│   │   ├── services/
│   │   │   ├── admins.ts
│   │   │   ├── settings.ts
│   │   │   ├── households.ts
│   │   │   ├── families.ts
│   │   │   ├── payments.ts
│   │   │   ├── expenses.ts
│   │   │   ├── recurring.ts
│   │   │   ├── moneyOnHand.ts             # formula + live query hook
│   │   │   └── monthKey.ts                # date → "YYYY-MM"
│   │   ├── hooks/
│   │   │   ├── useFirestoreCollection.ts
│   │   │   ├── useMoneyOnHand.ts
│   │   │   └── useAuth.ts
│   │   ├── schemas/                       # Zod schemas per entity (single source of truth)
│   │   ├── types/                         # TypeScript types per entity
│   │   └── utils/
│   │       ├── currency.ts                # format with currency label
│   │       └── dates.ts                   # month-stepping helpers
│   └── styles/
│       └── globals.css                    # Tailwind entry
├── tests/
│   ├── unit/
│   │   ├── services/                      # Vitest specs for lib/services
│   │   └── utils/
│   └── e2e/
│       ├── sign-in.spec.ts
│       ├── record-payment.spec.ts
│       ├── withdraw-expense.spec.ts
│       ├── soft-delete-family.spec.ts
│       └── all-time-expense-toggle.spec.ts
├── scripts/
│   └── seed-settings.ts                   # writes settings/global with defaults
├── public/
├── .env.local.example
├── firestore.indexes.json                 # composite index declarations
├── firestore.rules                        # mirror of contracts/firestore.rules
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── package.json
├── vitest.config.ts
├── playwright.config.ts
└── README.md
```

**Structure Decision**: Single Next.js app (Option 2 web app, "frontend" + "backend" collapsed). Next.js 15 Server Actions and Route Handlers call the service layer directly — no separate API server. Firebase is the data backend; security rules in `firestore.rules` are the access contract.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitution violations. No additional complexity introduced beyond the spec's explicit requirements.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | — | — |

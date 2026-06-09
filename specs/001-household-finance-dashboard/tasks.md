# Tasks: Veeramangalam Juma Masjid Household Finance Dashboard

**Input**: Design docs at `specs/001-household-finance-dashboard/`
**Prereqs**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓
**Tests**: Required (Vitest unit + Playwright E2E per `plan.md` and `research.md` §1)

**Structure**: 1 setup phase, 1 foundational phase, 13 user-story phases, 1 polish phase.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project skeleton, deps, tooling.

- [ ] T001 Init Next.js 15 + TS 5 + React 19 + Node 20 at repo root per `plan.md` §Project Structure
- [ ] T002 [P] Add deps to `package.json`: next, react, react-dom, firebase, tailwindcss, @tailwindcss/postcss, react-hook-form, zod, @hookform/resolvers, date-fns, lucide-react, shadcn deps (radix, class-variance-authority, tailwind-merge, clsx)
- [ ] T003 [P] Dev deps in `package.json`: vitest, @vitest/ui, @testing-library/react, @testing-library/jest-dom, jsdom, @playwright/test, firebase-tools
- [ ] T004 [P] `tsconfig.json` (strict, paths `@/*` → `src/*`), `next.config.ts`, `postcss.config.mjs`, `tailwind.config.ts`
- [ ] T005 [P] `src/styles/globals.css` Tailwind entry
- [ ] T006 [P] Init shadcn/ui in `src/components/ui/`: add `button`, `card`, `dialog`, `input`, `label`, `select`, `table`, `tabs`, `badge`, `dropdown-menu`, `alert-dialog`, `form`, `toast`
- [ ] T007 [P] `.env.local.example` with NEXT_PUBLIC_FIREBASE_* keys
- [ ] T008 [P] `.gitignore` (node_modules, .next, .env.local, playwright-report, test-results)
- [ ] T009 [P] `vitest.config.ts` (jsdom env, path alias, setup file), `playwright.config.ts` (chromium, webServer for emulator), `tests/setup.ts`
- [ ] T010 [P] Mirror `contracts/firestore.rules` → `firestore.rules` and create `firestore.indexes.json` per `data-model.md` §11
- [ ] T011 [P] `scripts/seed-settings.ts` (writes `settings/global` defaults)
- [ ] T012 [P] `package.json` scripts: dev, build, start, typecheck, test, test:e2e, emulators:start, seed:settings, lint
- [ ] T013 [P] Root `README.md` linking to `quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: All user stories depend on this. Schemas, types, services, base UI, auth gate.

**⚠️ CRITICAL**: No user story work starts until this phase done.

- [ ] T014 [P] `src/lib/firebase/client.ts` — Web SDK init, `getAuth`, `getFirestore` exports
- [ ] T015 [P] `src/lib/schemas/` Zod schemas: `admin.ts`, `setting.ts`, `household.ts`, `family.ts`, `payment.ts`, `expense.ts`, `recurringTemplate.ts` (single source of truth, used by forms + service guards)
- [ ] T016 [P] `src/lib/types/` TS entity types mirroring `contracts/service-interface.ts`
- [ ] T017 [P] `src/lib/utils/currency.ts` (format with currency label), `src/lib/utils/dates.ts` (month step), `src/lib/services/monthKey.ts` (`format(date, "yyyy-MM")`)
- [ ] T018 `src/lib/services/admins.ts` — `getCurrentAdmin()` (reads `admins/{uid}`)
- [ ] T019 [P] `src/lib/services/settings.ts` — `subscribeSettings`, `updateSettings`
- [ ] T020 [P] `src/lib/services/households.ts` — list/subscribe/get/create/`deleteHousehold` (cascade batched)
- [ ] T021 [P] `src/lib/services/families.ts` — list/subscribe/get/create (`addDoc` only → ID reserved), `softDeleteFamily`, `updateFamilyTarget`
- [ ] T022 [P] `src/lib/services/payments.ts` — list/subscribe/`recordPayment` (derives `month`), `deletePayment` (NO `updatePayment` exported)
- [ ] T023 [P] `src/lib/services/expenses.ts` — list/subscribe/`createExpense`/`withdrawExpense`/`deleteExpense` (state transitions enforced)
- [ ] T024 [P] `src/lib/services/recurring.ts` — list/subscribe/`createRecurringTemplate`/`updateRecurringTemplate`/`archiveRecurringTemplate`/`addRecurringForMonth` (rejects duplicate in same month), `listRecurringTemplatesWithStatus`
- [ ] T025 [P] `src/lib/services/moneyOnHand.ts` — `subscribeMoneyOnHand` (3 `onSnapshot`: settings/global, payments collection-group, expenses where `withdrawn==true`); formula `opening + Σ payments − Σ withdrawnExpenses`
- [ ] T026 `src/lib/services/index.ts` — assemble `HouseholdFinanceService` instance, export `services`
- [ ] T027 [P] `src/lib/hooks/useAuth.ts` (returns `{ user, admin, loading, signOut }`)
- [ ] T028 [P] `src/lib/hooks/useFirestoreCollection.ts` (wraps `onSnapshot` → state)
- [ ] T029 [P] `src/lib/hooks/useMoneyOnHand.ts` (wraps `services.subscribeMoneyOnHand`)
- [ ] T030 `src/app/layout.tsx` — root layout, Firebase provider, Tailwind globals
- [ ] T031 [P] `src/components/auth/AuthGuard.tsx` — server component; redirects to `/sign-in` or `/access-denied` based on `admins/{uid}` existence
- [ ] T032 [P] `src/components/nav/AppShell.tsx` — global nav (Dashboard, Households, Expenses, Recurring, Settings) + admin identity + sign-out
- [ ] T033 [P] `src/components/nav/MonthNavigator.tsx` — back/forward arrows, disabled past current if needed, defaults to current month
- [ ] T034 [P] `src/app/(auth)/layout.tsx`, `src/app/(app)/layout.tsx` (wraps in AuthGuard + AppShell)
- [ ] T035 [P] `src/app/page.tsx` — server redirect: authed → `/dashboard`, else → `/sign-in`
- [ ] T036 Vitest config + Playwright config; `tests/setup.ts` connects to Firestore emulator; helper `tests/helpers/seed.ts` to seed test data

**Checkpoint**: `pnpm typecheck` clean, `pnpm test` runs empty suite, `pnpm dev` serves blank shell with auth gate functional.

---

## Phase 3: User Story 1 — Sign in and gain dashboard access (Priority: P1) 🎯 MVP

**Goal**: Google sign-in, admin allow-list check, sign-out.
**Independent Test**: Sign in with approved Google identity → `/dashboard`. Sign in with unapproved → `/access-denied`, no data returned.

- [ ] T037 [P] [US1] `src/app/(auth)/sign-in/page.tsx` with `GoogleSignInButton`
- [ ] T038 [P] [US1] `src/components/auth/GoogleSignInButton.tsx` (Firebase `signInWithPopup`)
- [ ] T039 [P] [US1] `src/app/(auth)/access-denied/page.tsx` showing email + sign-out
- [ ] T040 [US1] Wire `AuthGuard` redirect logic in `src/components/auth/AuthGuard.tsx` + `src/app/(app)/layout.tsx`; test mid-session revocation (sign-in → access-denied after admin doc removed)
- [ ] T041 [P] [US1] E2E test `tests/e2e/sign-in.spec.ts` — approved + unapproved paths

**Checkpoint**: US1 alone delivers a deployable, access-controlled shell.

---

## Phase 4: User Story 2 — Dashboard summary (Priority: P1)

**Goal**: Money on hand card, month summary, household overview table.
**Independent Test**: Seed data → dashboard cards + household table match formulas; empty month renders zeros without errors.

- [ ] T042 [P] [US2] `src/components/summary/MoneyOnHandCard.tsx` (uses `useMoneyOnHand`)
- [ ] T043 [P] [US2] `src/components/summary/MonthSummaryBar.tsx` (collections, expenses, families paid)
- [ ] T044 [P] [US2] `src/components/households/HouseholdTable.tsx` (rows link to detail)
- [ ] T045 [US2] `src/app/(app)/dashboard/page.tsx` — assembles cards + table from `services` subscriptions
- [ ] T046 [P] [US2] Unit test `tests/unit/services/moneyOnHand.test.ts` — formula + invariants per SC-009

**Checkpoint**: Dashboard shows live money on hand + household summary.

---

## Phase 5: User Story 3 — Create households and families (Priority: P1)

**Goal**: Add household, add family with default target (override allowed).
**Independent Test**: Create household + 2 families w/ different targets → both appear, targets correct, ID uniqueness.

- [ ] T047 [P] [US3] `src/app/(app)/households/page.tsx` (list + `AddHouseholdDialog`)
- [ ] T048 [P] [US3] `src/components/households/AddHouseholdDialog.tsx` (RHF + Zod, `services.households.createHousehold`)
- [ ] T049 [P] [US3] `src/app/(app)/households/[householdId]/page.tsx` (family list + `AddFamilyDialog`)
- [ ] T050 [P] [US3] `src/components/households/AddFamilyDialog.tsx` (defaults target from `settings.global`, allows override)
- [ ] T051 [P] [US3] `src/components/households/FamilyRow.tsx` (name, target, status placeholder, soft-delete button)
- [ ] T052 [US3] Wire `createFamily` flow in `src/app/(app)/households/[householdId]/page.tsx`; ensure existing families unchanged when global default changes (FR-010)
- [ ] T053 [P] [US3] Unit test `tests/unit/services/families.test.ts` — ID auto-gen, `addDoc` only (no chosen IDs)

**Checkpoint**: Households + families CRUD work; targets default from settings.

---

## Phase 6: User Story 4 — Record a payment (Priority: P1)

**Goal**: Record payment with amount/date/note; derive `month`; status badge.
**Independent Test**: 2 payments same month + 1 in different month → totals + status correct (Unpaid/Partial/Met/Over).

- [ ] T054 [P] [US4] `src/components/payments/RecordPaymentDialog.tsx` (RHF + Zod, date defaults to today)
- [ ] T055 [P] [US4] Wire `services.payments.recordPayment` in `src/app/(app)/households/[householdId]/page.tsx` from household detail
- [ ] T056 [P] [US4] `src/components/payments/StatusBadge.tsx` (Unpaid/Partial/Met/Over, all four visually distinct)
- [ ] T057 [US4] Derive family status from `subscribeFamilyMonthlyStatuses` in `src/app/(app)/households/[householdId]/page.tsx`
- [ ] T058 [P] [US4] E2E test `tests/e2e/record-payment.spec.ts` — record → status + household summary + money on hand update < 3s (SC-002)

**Checkpoint**: Recording payment updates status, household summary, money on hand live.

---

## Phase 7: User Story 5 — Add, withdraw, delete expenses (Priority: P1)

**Goal**: Add expense (not withdrawn) → withdraw → delete; money on hand reacts correctly.
**Independent Test**: Add → MoH unchanged; withdraw → MoH −amount; delete withdrawn → MoH +amount. No undo shown.

- [ ] T059 [P] [US5] `src/app/(app)/expenses/page.tsx` (list + summary bar)
- [ ] T060 [P] [US5] `src/components/expenses/AddExpenseDialog.tsx` (RHF + Zod)
- [ ] T061 [P] [US5] `src/components/expenses/ExpenseTable.tsx` (rows visually distinct when withdrawn)
- [ ] T062 [P] [US5] `src/components/expenses/WithdrawDialog.tsx` (confirms withdrawal)
- [ ] T063 [US5] Wire `createExpense` / `withdrawExpense` / `deleteExpense` in `src/app/(app)/expenses/page.tsx` (no undo button rendered per FR-031)
- [ ] T064 [P] [US5] Unit test `tests/unit/services/expenses.test.ts` — state transitions, no `updateExpense` method exported
- [ ] T065 [P] [US5] E2E test `tests/e2e/withdraw-expense.spec.ts` — add → withdraw → money on hand −amount < 3s (SC-003)

**Checkpoint**: Expense lifecycle works; money on hand tracks all transitions.

---

## Phase 8: User Story 6 — Soft delete family (Priority: P1)

**Goal**: Soft delete preserves family + payments; reserves ID; exclude from active counts.
**Independent Test**: Soft-delete family with current-month payment → row hidden, active count −1, total collected unchanged, MoH unchanged.

- [ ] T066 [P] [US6] `src/components/households/SoftDeleteFamilyDialog.tsx` (explicit copy: "removed from active list, payment history preserved")
- [ ] T067 [US6] Wire `services.families.softDeleteFamily` from `src/components/households/FamilyRow.tsx`
- [ ] T068 [US6] Update household summary in `src/app/(app)/households/[householdId]/page.tsx` to exclude inactive from active counts/targets (FR-013)
- [ ] T069 [P] [US6] Unit test `tests/unit/services/families.test.ts` — soft-delete invariants (active → false, deletedAt/deletedBy set, no payments touched)
- [ ] T070 [P] [US6] E2E test `tests/e2e/soft-delete-family.spec.ts` — MoH unchanged, household total unchanged, family hidden (SC-005)

**Checkpoint**: Soft delete preserves data, hides from active, ID reserved forever.

---

## Phase 9: User Story 7 — Recurring expense templates (Priority: P2)

**Goal**: CRUD template, add for month (idempotent), per-month status, edit/archive.
**Independent Test**: Create template → add for current month → withdraw → status: NotAdded → Pending → Withdrawn. Re-add same month → no duplicate.

- [ ] T071 [P] [US7] `src/app/(app)/recurring/page.tsx` (active templates + archived section)
- [ ] T072 [P] [US7] `src/components/recurring/RecurringTemplateList.tsx`
- [ ] T073 [P] [US7] `src/components/recurring/AddTemplateDialog.tsx`
- [ ] T074 [P] [US7] `src/components/recurring/AddForMonthButton.tsx` (hidden when already added for current month)
- [ ] T075 [US7] Wire `createRecurringTemplate`, `updateRecurringTemplate`, `archiveRecurringTemplate`, `addRecurringForMonth` in `src/app/(app)/recurring/page.tsx`
- [ ] T076 [P] [US7] Unit test `tests/unit/services/recurring.test.ts` — idempotent add, archive preserves expenses, edit does not mutate expenses

**Checkpoint**: Templates manage + add-for-month works, no auto-creation.

---

## Phase 10: User Story 8 — Family payment history (Priority: P2)

**Goal**: List all payments for a family, filter by month or all time, summary vs target.
**Independent Test**: Family with payments across 2 months → filter by month shows subset + correct total; all-time shows all + lifetime total vs target.

- [ ] T077 [P] [US8] `src/app/(app)/households/[householdId]/families/[familyId]/history/page.tsx`
- [ ] T078 [P] [US8] `src/components/payments/PaymentHistoryTable.tsx` (date, amount, note, recorded-by, recorded-at, delete action)
- [ ] T079 [P] [US8] Month filter (specific month / all time) in `src/app/(app)/households/[householdId]/families/[familyId]/history/page.tsx`
- [ ] T080 [P] [US8] Summary line in `src/app/(app)/households/[householdId]/families/[familyId]/history/page.tsx`: total paid (period) vs family contribution target

**Checkpoint**: History view filters + summarises correctly.

---

## Phase 11: User Story 9 — Delete a payment (Priority: P2)

**Goal**: Permanent delete from history; all derived totals + MoH recompute.
**Independent Test**: Delete a payment → row gone, family status recomputed, household summary recomputed, MoH −amount.

- [ ] T081 [P] [US9] `src/components/payments/DeletePaymentDialog.tsx` (names payment + amount in copy)
- [ ] T082 [US9] Wire `services.payments.deletePayment` from `src/components/payments/PaymentHistoryTable.tsx`
- [ ] T083 [P] [US9] Unit test `tests/unit/services/payments.test.ts` — delete updates MoH, no `updatePayment` exported, `month` derived at write

**Checkpoint**: Payment deletion cascades to all derived surfaces.

---

## Phase 12: User Story 10 — Delete a household (Priority: P3)

**Goal**: Hard delete household + all families + all payments; retyped-name confirm.
**Independent Test**: Create household with families + payments → delete (retyped name) → all gone, MoH −sum of deleted payments.

- [ ] T084 [P] [US10] `src/components/households/DeleteHouseholdDialog.tsx` (requires retyping household name, FR-015)
- [ ] T085 [US10] Wire `services.households.deleteHousehold` from `src/components/households/HouseholdTable.tsx` (batched cascade: household doc + all family docs + all payment sub-collection docs)
- [ ] T086 [P] [US10] Unit test `tests/unit/services/households.test.ts` — cascade deletes everything atomically

**Checkpoint**: Household hard delete works atomically.

---

## Phase 13: User Story 11 — Edit global settings (Priority: P3)

**Goal**: Edit default target, opening balance (with warning), currency; show admin identity; sign-out.
**Independent Test**: Change default → new families use new value, existing unchanged. Change opening balance → MoH shifts by delta. Change currency → label updates everywhere. Sign-out works.

- [ ] T087 [P] [US11] `src/app/(app)/settings/page.tsx` (form + read-only admin info)
- [ ] T088 [P] [US11] `src/components/settings/OpeningBalanceWarning.tsx` (confirms MoH impact before save, FR-045)
- [ ] T089 [US11] Wire `services.settings.updateSettings` + sign-out in `src/app/(app)/settings/page.tsx`
- [ ] T090 [P] [US11] Unit test `tests/unit/services/settings.test.ts` — singleton path `settings/global`, MoH delta on opening-balance change

**Checkpoint**: Settings editable, warnings enforced, sign-out works.

---

## Phase 14: User Story 12 — Month navigation + global nav (Priority: P3)

**Goal**: Global nav on every authed screen; month navigator on month-aware screens.
**Independent Test**: Step back/forward on household detail → statuses + totals reflect month. Global nav reaches all top-level screens without losing session.

- [ ] T091 [P] [US12] Finalise `src/components/nav/AppShell.tsx` (links: Dashboard, Households, Expenses, Recurring, Settings + admin identity + sign-out, FR-047)
- [ ] T092 [P] [US12] Finalise `src/components/nav/MonthNavigator.tsx` (back/forward, disable forward past current if spec'd, default current month, FR-048)
- [ ] T093 [US12] Wire `MonthNavigator` into `src/app/(app)/households/[householdId]/page.tsx`, `src/app/(app)/households/[householdId]/families/[familyId]/history/page.tsx`, `src/app/(app)/expenses/page.tsx` (monthly scope)

**Checkpoint**: Global nav + month stepping work everywhere.

---

## Phase 15: User Story 13 — All-time expenses toggle (Priority: P2)

**Goal**: Toggle monthly ↔ all-time on expenses page; remember month; empty state.
**Independent Test**: Expenses in 3 months → toggle all-time shows every row + lifetime totals; toggle back returns to last month; no expenses → explicit empty state.

- [ ] T094 [P] [US13] `AllTimeToggle` in `src/app/(app)/expenses/page.tsx` (hides/disables `MonthNavigator` when active, FR-043a)
- [ ] T095 [US13] Remember previously selected month; restore on deactivation in `src/app/(app)/expenses/page.tsx`
- [ ] T096 [P] [US13] Empty state "No expenses recorded yet" in `src/app/(app)/expenses/page.tsx` when all-time + zero expenses (FR-043b)
- [ ] T097 [P] [US13] E2E test `tests/e2e/all-time-expense-toggle.spec.ts` — toggle, totals, restore, empty state

**Checkpoint**: All-time view works, empty state correct, month memory works.

---

## Phase 16: Polish & Cross-Cutting Concerns

**Purpose**: Cross-cutting quality, docs, deploy.

- [ ] T098 [P] Empty states on all data surfaces (households, families, payments, expenses, recurring, history) in `src/app/(app)/**/page.tsx` per SC-007
- [ ] T099 [P] Add `// TODO(i18n)` comment on every user-facing string literal in `src/` (English-only v1)
- [ ] T100 [P] Audit: no `updatePayment`, no `undoWithdrawal`, no `autoAddRecurring` exposed in `src/lib/services/` (matches plan constitution check)
- [ ] T101 [P] Audit `firestore.rules` against `contracts/firestore.rules` (drift check); deploy via `firebase deploy --only firestore:rules,firestore:indexes` from `package.json`
- [ ] T102 [P] Verify SC-002/SC-003 latency in CI Playwright run (< 3s) in `tests/e2e/*.spec.ts`
- [ ] T103 [P] Run `quickstart.md` end-to-end on fresh clone; fix any gaps
- [ ] T104 [P] Vercel env vars documented in `README.md` (same as `.env.local`)
- [ ] T105 [P] Coverage report on `src/lib/services/` (target 80% per `plan.md`)
- [ ] T106 [P] `pnpm typecheck && pnpm test && pnpm build` green on CI (scripts in `package.json`)

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)** → no deps
- **Foundational (Phase 2)** → blocks all user stories
- **User Stories (Phase 3-15)** → depend on Foundational; sequential by priority recommended for solo dev
- **Polish (Phase 16)** → depends on all user stories

### User Story Dependencies
- **US1 (P1)**: blocks US2-US15 (no auth → no screens)
- **US2 (P1)**: depends on US1
- **US3 (P1)**: depends on US1
- **US4 (P1)**: depends on US3 (needs family)
- **US5 (P1)**: depends on US1; independent of US3/US4
- **US6 (P1)**: depends on US3 (needs family to delete)
- **US7 (P2)**: depends on US1
- **US8 (P2)**: depends on US4 (needs payments)
- **US9 (P2)**: depends on US8 (delete lives in history)
- **US10 (P3)**: depends on US3
- **US11 (P3)**: depends on US1
- **US12 (P3)**: depends on US2/US3 (needs surfaces to wrap)
- **US13 (P2)**: depends on US5 (needs expenses page)

### Within Each User Story
- Tests (if any) first → fail → implement
- Zod schemas before forms (already in Phase 2)
- Service methods before UI calls
- Dialog/table components before page wiring
- Unit tests for service invariants before E2E flows

### Parallel Opportunities
- Phase 1: all `[P]` tasks parallel
- Phase 2: all `[P]` schemas/types/utils/services parallel; root layout depends on AuthGuard
- Within a user story: dialog + table + page can be parallel (different files)
- Across user stories post-US1: solo dev sequential; team can split US4/US5/US7 in parallel

---

## Parallel Example: User Story 5 (illustrative)

```bash
# Launch in parallel (different files, no deps between them):
Task: "AddExpenseDialog in src/components/expenses/AddExpenseDialog.tsx"
Task: "ExpenseTable in src/components/expenses/ExpenseTable.tsx"
Task: "WithdrawDialog in src/components/expenses/WithdrawDialog.tsx"
Task: "Unit test expenses service in tests/unit/services/expenses.test.ts"
# Then sequentially:
Task: "Wire createExpense/withdrawExpense/deleteExpense in expenses page"
Task: "E2E test tests/e2e/withdraw-expense.spec.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 + US4 + US5 + US6)

1. Phase 1: Setup
2. Phase 2: Foundational
3. Phase 3-8: US1-US6 (all P1)
4. **STOP and VALIDATE**: sign in, view dashboard, create household + family, record payment, add/withdraw expense, soft-delete family — all working end-to-end
5. Deploy to Vercel + Firebase

### Incremental Delivery
1. Setup + Foundational
2. US1 (auth shell) → deploy
3. US2 (dashboard) → deploy
4. US3 + US4 + US5 + US6 (core flows) → deploy
5. US7/US8/US9/US13 (P2) → deploy
6. US10/US11/US12 (P3) → deploy
7. Polish

### Solo Strategy
One dev. Do Phase 1+2 in one sitting. US1-US6 sequentially. P2/P3 polish sprint. Tests in parallel with implementation (write test → implement → green → next).

---

## Notes
- `[P]` = different files, no deps
- `[Story]` label = traceability to spec.md
- Each story independently testable (see story `Independent Test` line)
- Verify tests fail before implementing
- 5 E2E flows required (US1, US4, US5, US6, US13) — exact filenames per `plan.md` §Project Structure
- All English strings inlined with `// TODO(i18n)` per project rule

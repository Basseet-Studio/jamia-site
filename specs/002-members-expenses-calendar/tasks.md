# Tasks: Household Members, Expense Types, Calendar View, and Budget Shortfall

**Input**: Design documents from `/specs/002-members-expenses-calendar/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/
**Tests**: Test tasks are included — the spec is explicit about unit + e2e coverage (SC-006, SC-007, FR-032).

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and delivered independently. Foundational + cross-cutting tasks live in dedicated phases.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- **TODO(i18n)**: Every new user-facing literal gets a `// TODO(i18n)` comment per the project rule

## Path Conventions

- Single Next.js 15 app at repo root
- Source: `src/` · Services: `src/lib/services/` · Schemas: `src/lib/schemas/` · Components: `src/components/` · Pages: `src/app/`
- Tests: `tests/unit/` (Vitest) · `tests/e2e/` (Playwright)
- Rules: `firestore.rules` · Indexes: `firestore.indexes.json`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project-wide scaffolding for the 002 delta.

- [x] T001 Verify `sonner` (or shadcn Radix toast) is present in `package.json` for the calendar toast; install if missing per `research.md` §12
- [x] T002 [P] Confirm `node`, `pnpm`, `firebase-tools` available locally; print versions
- [x] T003 [P] Create new component folders `src/components/calendar/` and `src/components/calendar/shortfall/` (empty, ready for later phases)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core type definitions, schemas, indexes, and rules that ALL user stories depend on. **No user story work can begin until this phase is complete.**

- [x] T004 [P] Extend `Household`, `Expense`, `RecurringTemplate` types + add new types (`ExpenseType`, `MosqueSubCategory`, `HouseholdMemberHistory`, `MonthlyBudgetShortfall`, `CalendarTemplateRow`, `CalendarAdHocRow`, `CalendarView`, `MonthlyExpenseTotals`, `ShortfallSeverity`, `CalendarTemplateStatus`) in `src/lib/types/index.ts`
- [x] T005 [P] Create `householdMemberSchema` (memberCount int >= 0, memberNames string[1..80], trim) in `src/lib/schemas/householdMember.ts`
- [x] T006 [P] Create `memberHistorySchema` (previousCount/Names, newCount/Names, changedAt, changedBy) in `src/lib/schemas/memberHistory.ts`
- [x] T007 Replace `createExpenseSchema` with `z.discriminatedUnion("type", [...])` (household / mosque branches) in `src/lib/schemas/expense.ts`
- [x] T008 Replace `createRecurringTemplateSchema` + `updateRecurringTemplateSchema` with `z.discriminatedUnion("type", [...])` (default type "mosque") in `src/lib/schemas/recurringTemplate.ts`
- [x] T009 [P] Add 3 new composite indexes to `firestore.indexes.json`: `expenses(type, mosqueSubCategory, month)`, `expenses(householdId, type, month)`, `recurringExpenses(type, active)`
- [x] T010 Apply 002 rules delta to `firestore.rules`: relax household `update` to allowlist (memberCount/memberNames/updatedAt/updatedBy only), add `households/{hhId}/memberHistory/{histId}` match (append-only), extend expense `create` + `update` guards for new fields, relax `recurringExpenses` update to permit new fields
- [x] T011 [P] Add `calendar.*` i18n keys + `householdMembers.*` keys to `src/messages/en.json` (only `en.json`; other locales fall back per v1 rule). Strings: calendar.title, calendar.empty, calendar.recurringHeading, calendar.adHocHeading, calendar.status.*, calendar.action.addForMonth, calendar.shortfall.*, calendar.monthPrev/Next, householdMembers.*, expenseType.household/mosque, mosqueSubCategory.*, householdDetail.expenses, expenses.typeFilter.*, expenses.subCategoryFilter, recurring.withdrawConfirmTitle/Body, calendar.toast.shortfallWorsened
- [x] T012 [P] Mirror the new English keys into `src/messages/ar.json`, `src/messages/ta.json`, `src/messages/ml.json` (English placeholders until v1 i18n pass)
- [x] T013 [P] Create `useCalendarMonth(initialMonth?)` hook (useState + stepMonthKey helpers) in `src/lib/hooks/useCalendarMonth.ts`
- [x] T014 Update `firestore.rules` deploy docs in `specs/002-members-expenses-calendar/quickstart.md` if the file path diverges from the patch pipeline described in `contracts/firestore.rules`

**Checkpoint**: Foundation ready — types, schemas, indexes, rules, and i18n keys in place. User story work can begin.

---

## Phase 3: User Story 2 — Classify expenses as household-linked or mosque-linked (Priority: P1) 🎯 MVP

**Goal**: Every expense (and recurring template) carries a `type` field with conditional linkage rules enforced at schema, service, and rules layers.

**Independent Test**: Add three expenses — a `household` expense linked to a household, a `household` expense linked to a specific family, and a `mosque` expense with sub-category `salary`. Confirm the expenses list shows correct badges, the household detail view lists only the household-scoped expenses, and the mosque expense is excluded from every household detail.

### Tests for User Story 2

- [ ] T015 [P] [US2] Unit test for the expense `discriminatedUnion` schema in `tests/unit/schemas/expense.discriminatedUnion.test.ts` — covers household branch, mosque branch, XOR violation (both fields set), and missing-type rejection
- [ ] T016 [P] [US2] Unit test for expense create type wiring in `tests/unit/services/expenses.createType.test.ts` — module exports `createExpense`; calls write the new fields to Firestore
- [ ] T017 [P] [US2] E2E test for expense type flow in `tests/e2e/expense-type.spec.ts` — admin adds household + mosque expenses, badges render, household filter works, household detail scopes correctly

### Implementation for User Story 2

- [ ] T018 [P] [US2] Extend `toExpense` in `src/lib/services/expenses.ts` to read `type`, `householdId`, `familyId`, `mosqueSubCategory`; default `type` to `"mosque"` on legacy docs (nullable migration)
- [ ] T019 [US2] Extend `createExpense` in `src/lib/services/expenses.ts` to write the new fields (depends on T007, T018)
- [ ] T020 [US2] Add `subscribeHouseholdExpenses(householdId, month, cb)` in `src/lib/services/expenses.ts` (query `type=="household"`, `householdId`, `month`)
- [ ] T021 [P] [US2] Add `subscribeMosqueExpenses(month, subCategory, cb)` in `src/lib/services/expenses.ts` (query `type=="mosque"`, optional `mosqueSubCategory`, `month`)
- [ ] T022 [US2] Extend `listExpenses` signature in `src/lib/services/expenses.ts` to `listExpenses(month, filter?: ExpenseFilter)`; v1 callers passing no filter still work
- [ ] T023 [P] [US2] Extend `createRecurringTemplate` and `updateRecurringTemplate` in `src/lib/services/recurring.ts` to accept/persist the type + linkage fields; default `type` to `"mosque"` on create
- [ ] T024 [US2] Extend `addRecurringForMonth` in `src/lib/services/recurring.ts` to copy `type`, `householdId`, `familyId`, `mosqueSubCategory` from the template onto the new expense
- [ ] T025 [US2] Re-export `ExpenseType`, `MosqueSubCategory`, `ExpenseFilter` from `src/lib/services/index.ts`
- [ ] T026 [P] [US2] Add type-selector + dynamic linkage pickers to `AddExpenseDialog` in `src/components/expenses/AddExpenseDialog.tsx`; show household/family dropdown for `type=="household"`, mosque sub-category dropdown for `type=="mosque"`; gate submit on a valid type
- [ ] T027 [P] [US2] Add type badge column + type filter (All/Household/Mosque) + mosque sub-category filter to `ExpenseTable` in `src/components/expenses/ExpenseTable.tsx`
- [ ] T028 [US2] Add type filter state to `src/app/(app)/expenses/page.tsx`; pass filter to `subscribeExpenses` / `listExpenses` (depends on T022, T027)
- [ ] T029 [P] [US2] Add type-selector to `AddTemplateDialog` in `src/components/recurring/AddTemplateDialog.tsx`; mirror the dynamic linkage pickers from T026
- [ ] T030 [P] [US2] Add type badge to each row in `RecurringTemplateList` in `src/components/recurring/RecurringTemplateList.tsx`
- [ ] T031 [US2] Add a "Household expenses" section to `src/app/(app)/households/[householdId]/page.tsx`; subscribe via `subscribeHouseholdExpenses` from T020; render the expense rows (read-only in v1 per FR-013)

**Checkpoint**: US2 fully functional — every expense + recurring template carries a `type`, badges render, filters work, household detail scope is correct.

---

## Phase 4: User Story 3 — Confirm withdrawal explicitly for recurring expenses (Priority: P1)

**Goal**: Recurring-expense withdrawal shows an expanded dialog with totals + current shortfall figure; ad-hoc expenses keep the v1 lighter flow.

**Independent Test**: Add a recurring template, add it for the current month, click Withdraw — confirm the dialog shows the template name, amount, new month totals, and current shortfall figure. Cancel keeps the expense pending. Withdraw a non-recurring expense to verify the lighter flow is preserved.

**Depends on**: US5 (shortfall service) for the inline warning figure. The dialog UI ships first with a loading state; the shortfall line populates as soon as `getMonthlyTotals` resolves.

### Tests for User Story 3

- [ ] T032 [P] [US3] E2E test for recurring-withdraw confirmation in `tests/e2e/withdraw-recurring.spec.ts` — opens the expanded dialog, verifies all required fields render, cancel keeps expense pending, confirm flips to withdrawn

### Implementation for User Story 3

- [ ] T033 [P] [US3] Add `getMonthlyTotals(month)` service in `src/lib/services/calendarView.ts` (re-exported from `src/lib/services/index.ts`) returning `{ month, totalAdded, totalWithdrawn, totalPending, shortfall }` — uses `subscribeMonthlyExpenseSummary` snapshot + `subscribeMonthlyShortfall` (added in US5)
- [ ] T034 [US3] Extend `WithdrawDialog` props in `src/components/expenses/WithdrawDialog.tsx` to accept `isRecurring: boolean`; render expanded view (name, amount, new month totals, shortfall figure) when true, else keep the v1 lighter view (depends on T033)
- [ ] T035 [US3] Update `ExpenseTable` in `src/components/expenses/ExpenseTable.tsx` to pass `isRecurring={e.isRecurring}` to `WithdrawDialog` (depends on T034)
- [ ] T036 [US3] Add best-effort fallback (3s timeout) for `getMonthlyTotals` in `WithdrawDialog`; show "Could not compute budget impact" if the call rejects or times out per FR-031

**Checkpoint**: US3 fully functional — recurring withdraws require explicit confirmation with full impact summary; ad-hoc flow preserved.

---

## Phase 5: User Story 5 — Budget shortfall warning service (Priority: P2)

**Goal**: A pure `computeShortfall` function + a live `subscribeMonthlyShortfall` reactive subscription that drives the calendar banner and the inline withdraw warning.

**Independent Test**: `pnpm test src/lib/services/shortfall.test` — all six required FR-032 cases pass on first run (SC-006). Live test: change a payment / expense and observe the subscription re-emits within 1s (SC-005).

### Tests for User Story 5

- [ ] T037 [P] [US5] Unit tests for `computeShortfall` in `tests/unit/services/shortfall.test.ts` — six FR-032 cases: zero recurring, exact match (`available == recurringTotal`), 5% gap, 10% gap (boundary inclusive), 50% gap, negative `available`
- [ ] T038 [P] [US5] Module-export smoke test in `tests/unit/services/shortfall.test.ts` — confirms `computeShortfall` and `subscribeMonthlyShortfall` are exported; no `updateShortfall` or `deleteShortfall` methods exist (shortfall is derived, never stored)

### Implementation for User Story 5

- [ ] T039 [P] [US5] Create `src/lib/services/shortfall.ts` exporting the pure `computeShortfall({ month, moneyOnHandAtStartOfMonth, paymentsThisMonth, withdrawnExpensesThisMonth, recurringTotal, asOf })` function with formula from `data-model.md` §5 and severity thresholds `ok` / `watch` / `risk`
- [ ] T040 [US5] Create `src/lib/services/shortfallSubscription.ts` exporting `subscribeMonthlyShortfall(month, cb)`; opens 4 `onSnapshot` listeners (settings/global, expenses where date<firstOfMonth + month, payments where date<firstOfMonth + month, recurringExpenses) and re-emits via `computeShortfall` (depends on T039)
- [ ] T041 [US5] Re-export shortfall functions from `src/lib/services/index.ts`
- [ ] T042 [US5] Add a Vitest assertion in `tests/unit/services/shortfall.test.ts` that `computeShortfall` returns `severity="ok"` and `shortfall=0` for `recurringTotal=0` (banner hidden condition, FR-030)

**Checkpoint**: US5 fully functional — pure function unit-tested against FR-032; live subscription re-emits within 1s of any underlying change.

---

## Phase 6: User Story 1 — Track household members with full change history (Priority: P2)

**Goal**: Households gain `memberCount` + `memberNames`; every edit appends an immutable history record.

**Independent Test**: Create a household, set 4 members, edit to 3, edit to 5, open the history view, confirm three records in chronological order with previous/new values and the admin identity that made each change.

**Independent of other stories** — can ship alongside any of US2/US3/US4/US5.

### Tests for User Story 1

- [ ] T043 [P] [US1] Unit test for the `updateMembers` invariant in `tests/unit/services/households.updateMembers.test.ts` — `memberCount !== memberNames.length` is rejected; valid pairs succeed; module exports `updateMembers` and `subscribeMemberHistory`
- [ ] T044 [P] [US1] E2E test for member-edit + history in `tests/e2e/household-members.spec.ts` — three edits, history view shows three rows, fields populated correctly

### Implementation for User Story 1

- [ ] T045 [P] [US1] Extend `toHousehold` in `src/lib/services/households.ts` to read `memberCount` (default 0) and `memberNames` (default []) for legacy migration per `data-model.md` §1
- [ ] T046 [US1] Add `updateMembers(uid, householdId, input)` in `src/lib/services/households.ts` — single batched write that updates the household doc (memberCount/memberNames/updatedAt/updatedBy) AND appends a `memberHistory` doc; rejects on `memberCount !== memberNames.length` (depends on T045)
- [ ] T047 [P] [US1] Create `src/lib/services/memberHistory.ts` exporting `subscribeMemberHistory(householdId, cb)` (orderBy changedAt desc) (depends on T006)
- [ ] T048 [US1] Re-export `updateMembers` and `subscribeMemberHistory` from `src/lib/services/index.ts`
- [ ] T049 [P] [US1] Create `MembersSection` form in `src/components/households/MembersSection.tsx` — list editor with add/remove/rename, computes `memberCount` from `memberNames.length` before submit; calls `updateMembers` (depends on T046)
- [ ] T050 [P] [US1] Create `MemberHistoryTable` in `src/components/households/MemberHistoryTable.tsx` — newest-first rows showing timestamp, admin, previous count/names, new count/names
- [ ] T051 [US1] Add `MembersSection` to the household detail page in `src/app/(app)/households/[householdId]/page.tsx`; add a "View history" link to the new history sub-page
- [ ] T052 [US1] Create read-only history page `src/app/(app)/households/[householdId]/history/page.tsx` that subscribes via `subscribeMemberHistory` and renders `MemberHistoryTable`

**Checkpoint**: US1 fully functional — members are editable from the household detail; every edit appends an immutable history record visible on the history sub-page.

---

## Phase 7: User Story 4 — Monthly calendar view (Priority: P2)

**Goal**: A `/calendar` page showing the selected month's recurring templates (with per-month status + add action) and ad-hoc expenses, plus the budget shortfall banner.

**Independent Test**: With at least one active template and one ad-hoc expense, open `/calendar`, confirm both groups render for the current month, step backwards (templates show `Not added`), step forwards, add the template for the selected month, confirm it appears as `Pending withdrawal` with a link.

**Depends on**: US2 (type field drives the calendar row rendering) + US5 (banner consumes the shortfall subscription).

### Tests for User Story 4

- [ ] T053 [P] [US4] Unit test for `subscribeCalendarView` shape in `tests/unit/services/calendarView.test.ts` — module exports the subscription + `getMonthlyTotals`; per-month status derivation handles the three states
- [ ] T054 [P] [US4] E2E test for the calendar view in `tests/e2e/calendar.spec.ts` — open page, verify two groups render, step months, click "Add for this month" on a `NotAdded` row, verify status flips and link renders

### Implementation for User Story 4

- [ ] T055 [US4] Add `subscribeCalendarView(month, cb)` in `src/lib/services/calendarView.ts` (depends on T040, T024) — opens 3 listeners (recurringExpenses, expenses for month, shortfall) and re-emits a `CalendarView` with `templates` annotated by status (`NotAdded` / `PendingWithdrawal` / `Withdrawn`) and `adHoc` filtered to `recurringId == null`
- [ ] T056 [P] [US4] Create `CalendarView` container in `src/components/calendar/CalendarView.tsx` — header, MonthNavigator, ShortfallBanner, RecurringExpensesGroup, AdHocExpensesGroup, empty state
- [ ] T057 [P] [US4] Create `RecurringExpensesGroup` in `src/components/calendar/RecurringExpensesGroup.tsx` — one row per template with status badge + "Add for this month" action (uses `addRecurringForMonth`) or link to the underlying expense
- [ ] T058 [P] [US4] Create `AdHocExpensesGroup` in `src/components/calendar/AdHocExpensesGroup.tsx` — list of ad-hoc expenses for the month (recurringId == null) sorted by date desc; click navigates to the expense detail / edit
- [ ] T059 [P] [US4] Create `ShortfallBanner` in `src/components/calendar/ShortfallBanner.tsx` — consumes `MonthlyBudgetShortfall`; renders green "On track" for `ok`, amber with shortfall number for `watch`, red with shortfall number + suggestion for `risk`; hidden entirely when `recurringTotal === 0`
- [ ] T060 [P] [US4] Create `CalendarEmptyState` in `src/components/calendar/CalendarEmptyState.tsx` — the explicit empty card "No expenses scheduled or recorded for this month" (FR-026)
- [ ] T061 [US4] Create `src/app/(app)/calendar/page.tsx` — uses `useCalendarMonth`, subscribes to `subscribeCalendarView`, renders `CalendarView` (depends on T055–T060)
- [ ] T062 [US4] Add a "Calendar" link to the global nav in `src/components/nav/AppShell.tsx`; add `nav.calendar` key
- [ ] T063 [US4] Wire a one-time `useToast` warning on `/calendar` when the live `MonthlyBudgetShortfall` worsens to a new `severity` (FR-031) — track last severity in component state, fire toast on transitions to `watch` or `risk`

**Checkpoint**: US4 fully functional — calendar page renders both groups + banner; month stepping works; add-for-this-month flips the status live.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Hard-delete cascade extension, e2e regression, and a v1 sanity pass.

- [ ] T064 Extend `deleteHousehold` in `src/lib/services/households.ts` — collect memberHistory refs + collection-group query on `expenses where type=="household" AND householdId==hhId`; include them in the chunked-batch delete list (idempotent)
- [ ] T065 [P] Unit test for the extended cascade in `tests/unit/services/households.delete.test.ts` — confirm `deleteHousehold` exports unchanged signature; module shape matches the v1 contract
- [ ] T066 [P] Run the full v1 e2e suite (`tests/e2e/*.spec.ts`) against the Firestore emulator; fix any regressions introduced by the 002 delta (SC-007)
- [ ] T067 [P] Run `pnpm test` — all unit + integration tests pass; the six FR-032 shortfall cases pass on first run (SC-006)
- [ ] T068 [P] Audit every new user-facing literal in this branch — confirm each is loaded via `useT()` (or `messages/en.json`) and carries a `// TODO(i18n)` marker
- [ ] T069 [P] Add a `// TODO(i18n)` note above the `formatMonthLabel` helper in `src/components/nav/MonthNavigator.tsx` if not already present (v1 carried it forward — verify)
- [ ] T070 [P] Update `scripts/seed-settings.ts` to ensure `settings/global` includes the fields the shortfall formula needs (verify only — no code change expected)
- [ ] T071 [P] Walk through `specs/002-members-expenses-calendar/quickstart.md` step-by-step on the Firestore emulator; confirm every smoke-test action works

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — **BLOCKS all user stories**
- **User Stories (Phases 3–7)**: All depend on Foundational (Phase 2) completion
  - Phases can proceed in parallel (if staffed) after Phase 2
  - Or sequentially in the order below (priority + technical dependency)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### Story Execution Order (sequential, single team)

1. **Phase 3 — US2 (P1)** ← MVP, type system changes
2. **Phase 5 — US5 (P2)** ← pure service + subscription, no UI yet
3. **Phase 4 — US3 (P1)** ← needs US5 for shortfall in dialog
4. **Phase 6 — US1 (P2)** ← independent; can run in parallel with any phase
5. **Phase 7 — US4 (P2)** ← needs US2 (type on rows) + US5 (banner)
6. **Phase 8 — Polish** ← cascade, regression, audit

### User Story Dependencies

- **US2 (P1)**: No dependencies on other stories — pure type-system delta
- **US5 (P2)**: No dependencies on other stories — pure function + 4 listeners
- **US3 (P1)**: Depends on **US5** (shortfall figure in the dialog) and **US2** (isRecurring flag already present, but new `type` field is orthogonal)
- **US1 (P2)**: No dependencies on other stories — fully independent
- **US4 (P2)**: Depends on **US2** (row type badge) + **US5** (banner + toast)

### Within Each User Story

- Tests MUST be written first and MUST fail before implementation
- Schemas/models before services
- Services before UI
- UI components in parallel where they touch different files
- Service barrel (`index.ts`) re-export after each story's services land

### Parallel Opportunities

- **Phase 2 [P] tasks** (T004, T005, T006, T009, T011, T012, T013) can all run in parallel — different files
- **Within US2**: T018 + T020 + T021 + T023 + T026 + T027 + T029 + T030 can run in parallel after T007/T008
- **Within US5**: T037 + T038 + T039 + T040 are split into test + impl, but test and impl can co-evolve
- **Within US1**: T045 + T047 + T049 + T050 can run in parallel after foundational types
- **Within US4**: T056 + T057 + T058 + T059 + T060 are all independent components
- **Different user stories can be worked on in parallel by different team members** after Phase 2 completes (e.g. one dev on US1, another on US5)

---

## Parallel Examples

### Example 1 — Foundational phase (all [P] together)

```bash
# Launch in parallel:
Task: "T004 Extend types in src/lib/types/index.ts"
Task: "T005 Create householdMemberSchema in src/lib/schemas/householdMember.ts"
Task: "T006 Create memberHistorySchema in src/lib/schemas/memberHistory.ts"
Task: "T009 Add 3 new composite indexes to firestore.indexes.json"
Task: "T011 Add calendar.* i18n keys to src/messages/en.json"
Task: "T013 Create useCalendarMonth hook in src/lib/hooks/useCalendarMonth.ts"
```

### Example 2 — US2 components in parallel

```bash
# After T007/T008 schemas land:
Task: "T018 Extend toExpense in src/lib/services/expenses.ts"
Task: "T020 Add subscribeHouseholdExpenses in src/lib/services/expenses.ts"
Task: "T021 Add subscribeMosqueExpenses in src/lib/services/expenses.ts"
Task: "T023 Extend createRecurringTemplate in src/lib/services/recurring.ts"
Task: "T026 Add type-selector to AddExpenseDialog in src/components/expenses/AddExpenseDialog.tsx"
Task: "T027 Add type badge + filter to ExpenseTable in src/components/expenses/ExpenseTable.tsx"
Task: "T029 Add type-selector to AddTemplateDialog in src/components/recurring/AddTemplateDialog.tsx"
Task: "T030 Add type badge to RecurringTemplateList in src/components/recurring/RecurringTemplateList.tsx"
```

### Example 3 — US4 components in parallel

```bash
# After T055 service lands:
Task: "T056 Create CalendarView in src/components/calendar/CalendarView.tsx"
Task: "T057 Create RecurringExpensesGroup in src/components/calendar/RecurringExpensesGroup.tsx"
Task: "T058 Create AdHocExpensesGroup in src/components/calendar/AdHocExpensesGroup.tsx"
Task: "T059 Create ShortfallBanner in src/components/calendar/ShortfallBanner.tsx"
Task: "T060 Create CalendarEmptyState in src/components/calendar/CalendarEmptyState.tsx"
```

---

## Implementation Strategy

### MVP First (US2 only)

1. Complete **Phase 1: Setup** (T001–T003)
2. Complete **Phase 2: Foundational** (T004–T014) — CRITICAL
3. Complete **Phase 3: US2** (T015–T031) — type system + UI badges + filters
4. **STOP and VALIDATE**: type classification works in isolation; v1 e2e still passes
5. Deploy/demo if ready — even just US2 is a meaningful hardening

### Incremental Delivery

1. **Phase 1 + Phase 2** → Foundation ready
2. **+ US2** → Type classification live (MVP!)
3. **+ US5** → Pure shortfall service, unit-tested
4. **+ US3** → Recurring withdraws require expanded confirmation
5. **+ US1** → Members + history (admin-facing data, no money impact)
6. **+ US4** → Calendar view ties everything together
7. **+ Phase 8** → Cascade extension, regression pass, audit

### Parallel Team Strategy

With multiple developers:

1. **Team together**: Phase 1 + Phase 2 (foundational types, schemas, rules, i18n)
2. **After foundation**:
   - **Dev A**: US2 (P1, largest surface — types + 2 forms + 2 tables + new listeners)
   - **Dev B**: US5 (P2, pure function + subscription — fastest path to green tests)
   - **Dev C**: US1 (P2, fully independent — members + history)
3. **Sync point** before US3 and US4 (both depend on prior work)
4. **Dev A**: US3 (after Dev B lands US5)
5. **Dev A or D**: US4 (after US2 + US5 land)
6. **Team together**: Phase 8 polish

---

## Summary

- **Total task count**: 71
- **Phase 1 (Setup)**: 3 tasks
- **Phase 2 (Foundational)**: 11 tasks (7 [P])
- **Phase 3 (US2 — P1)**: 17 tasks
- **Phase 4 (US3 — P1)**: 5 tasks
- **Phase 5 (US5 — P2)**: 6 tasks
- **Phase 6 (US1 — P2)**: 10 tasks
- **Phase 7 (US4 — P2)**: 11 tasks
- **Phase 8 (Polish)**: 8 tasks (7 [P])
- **Test tasks**: 10 (Vitest + Playwright)
- **Parallel opportunities**: 7 distinct batches identified

**Suggested MVP scope**: Phases 1 + 2 + 3 (Setup, Foundation, US2). This ships the core type classification, which is the foundation for the rest of the 002 delta and the biggest behavioural change to existing screens.

**Independent test per story**:
- US1: three edits → three history rows with correct previous/new values
- US2: three expenses (household/household-family/mosque) → correct badges + correct scope
- US3: recurring withdraw → expanded dialog with totals + shortfall; ad-hoc unchanged
- US4: `/calendar` → both groups + banner, month stepping, add-for-this-month flips status
- US5: 6 FR-032 cases pass on first run; live subscription re-emits within 1s

**Format validation**: All 71 tasks follow the checklist format (`- [ ] [ID] [P?] [Story?] Description with file path`). Foundational + Polish phases have no `[Story]` label. Every user story phase uses `[US1]`–`[US5]`. File paths are present in every task description.

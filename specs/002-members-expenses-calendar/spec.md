# Feature Specification: Household Members, Expense Types, Calendar View, and Budget Shortfall Warnings

**Feature Branch**: `002-members-expenses-calendar`
**Created**: 2026-06-10
**Status**: Draft
**Input**: User description — add (a) household member count + member names with full change history, (b) expense types that classify each expense as household-linked or mosque-linked, (c) a monthly calendar view that surfaces recurring expenses per month, and (d) a service that warns the admin when logged expenses for the month cannot cover the total expected recurring expenses.

## Summary

This feature extends the existing household finance dashboard in four ways. First, every household gains a member count and a JSON-encoded list of member names, with a full append-only history of member changes stored in a separate collection (sibling to, not under, the families collection). Second, every expense is classified by type — `household` (linked to a specific household or family) or `mosque` (mosque-wide costs such as maintenance and salaries). Third, the dashboard gains a monthly calendar view that lists, for the selected month, every active recurring expense template and its per-month status (Not added / Pending withdrawal / Withdrawn) alongside the ad-hoc expenses logged in that month. Fourth, a budget shortfall service computes, per month, the gap between available funds and the total of expected recurring expenses, and warns the admin at the moment an expense is logged and on the calendar view whenever that gap is negative.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Track household members with full change history (Priority: P2)

The admin can record, for each household, the number of people in the household and a list of their names. Both fields are editable. Names are stored as a JSON array on the household document. Every change to those two fields creates a new entry in a separate history collection so the admin can see who changed what and when, and revert to any prior state if needed.

**Why this priority**: Useful census-style metadata for the masjid, but does not affect money on hand, payments, or expenses. Secondary to the financial core.

**Independent Test**: Create a household, set 4 members with names, edit to 3 members with different names, edit again to 5 members, then open the history view and confirm three history records exist in chronological order with the correct previous and new values and the admin identity that made each change.

**Acceptance Scenarios**:

1. **Given** a household exists, **When** the admin opens the household detail screen, **Then** the household shows a "Members" section with a member count and a list of member names (or an empty state prompting entry).
2. **Given** the admin is editing household members, **When** they save a new member count and a list of names, **Then** the household document stores the new count and the names as a JSON array, and a history record is created capturing the previous and new values, the timestamp, and the admin identity.
3. **Given** a household already has members, **When** the admin changes the count or any name, **Then** a new history record is created and the previous history records are not modified.
4. **Given** a household has member change history, **When** the admin opens the history view, **Then** the records are listed newest first, each row shows the change timestamp, the admin who made the change, the previous count and names, and the new count and names.
5. **Given** the admin clears all member names and sets the count to zero, **When** the change is saved, **Then** the household is recorded with zero members and a history entry captures the transition to an empty list.
6. **Given** a household is hard-deleted, **When** the deletion completes, **Then** all member history records for that household are removed as part of the same cascade (or, if retention is required, marked tombstoned — to be confirmed in plan).

---

### User Story 2 — Classify expenses as household-linked or mosque-linked (Priority: P1)

When adding or editing an expense, the admin chooses an expense type. Expenses of type `household` are linked to a specific household (or optionally a specific family inside that household) via the household/family ID. Expenses of type `mosque` are mosque-wide costs such as building maintenance, utility bills for the mosque building, and salaries paid to people who serve at the mosque; they are not linked to a household. The type and any linkage IDs are stored on the expense and are required fields.

**Why this priority**: Re-shapes the core expense entity. Without it, the calendar view and the shortfall warning cannot distinguish mosque-only commitments from household-linked ones, and the existing expense screen would be ambiguous. Required for the other stories.

**Independent Test**: Add three expenses — a household electricity bill linked to a specific household, a household payment linked to a specific family, and a mosque salary with no household link — then confirm the expenses list, the calendar view, and the household detail view each show the correct type and linkage, and the mosque salary does not appear as a household expense anywhere.

**Acceptance Scenarios**:

1. **Given** the admin is adding an expense, **When** the form is shown, **Then** the admin must choose a type of `household` or `mosque` before the form is submittable.
2. **Given** the admin chose type `household`, **When** the form is submitted, **Then** the saved expense has `type: "household"` and a non-null `householdId` (and optionally a `familyId` if a specific family was picked), and the household/family selection is required.
3. **Given** the admin chose type `mosque`, **When** the form is submitted, **Then** the saved expense has `type: "mosque"`, no `householdId` and no `familyId` is set, and the admin can additionally tag the mosque expense with a sub-category such as `maintenance` or `salary`.
4. **Given** an expense exists with `type: "household"`, **When** the household detail screen renders, **Then** that expense appears in the household's expense list scoped to that household.
5. **Given** an expense exists with `type: "mosque"`, **When** the expenses list is opened, **Then** the mosque expense appears with a clear "Mosque" badge and does not appear in any household detail view.
6. **Given** an expense exists with `type: "mosque"` and sub-category `salary`, **When** the admin filters expenses by mosque sub-category, **Then** the salary expense is included in the result.
7. **Given** a household is hard-deleted, **When** the deletion cascade runs, **Then** all `type: "household"` expenses linked to that household are deleted in the same batch; mosque expenses and the cascade on other households are unaffected.

---

### User Story 3 — Confirm withdrawal explicitly for recurring expenses (Priority: P1)

When the admin withdraws a recurring expense (one created from a recurring template, or one the system recognises as repeating), the system shows a confirmation step that summarises the impact on the month's budget: the amount, the new total withdrawn for the month, the new total pending for the month, and any current budget shortfall figure. Withdrawal only proceeds when the admin confirms. This is a hardening of the existing withdraw flow scoped to recurring expenses; ad-hoc expenses keep the lighter one-click confirmation already shipped in v1.

**Why this priority**: The user explicitly asked for "admin has to confirm their withdrawal" for recurring expenses. A missed or premature withdrawal of a recurring obligation has the largest financial impact of any single admin action, so the extra confirmation is justified.

**Independent Test**: Add a recurring template for AED 200, add it for the current month (creating a non-withdrawn expense), click Withdraw, observe the confirmation dialog showing the template name, amount, and impact summary, confirm, and verify the expense is now withdrawn and money on hand has dropped. Repeat and click Cancel to confirm the expense stays un-withdrawn.

**Acceptance Scenarios**:

1. **Given** a recurring expense is in the "not withdrawn" state, **When** the admin clicks Withdraw, **Then** a confirmation dialog is shown that includes the expense name, the expense amount, the new total withdrawn for the month, the new total pending for the month, and (if applicable) the current budget shortfall warning text.
2. **Given** the confirmation dialog is open, **When** the admin confirms, **Then** the expense is marked withdrawn, `withdrawnAt` and `withdrawnBy` are recorded, and money on hand is reduced by the amount.
3. **Given** the confirmation dialog is open, **When** the admin cancels, **Then** the expense remains in the "not withdrawn" state and money on hand is unchanged.
4. **Given** an ad-hoc (non-recurring) expense is in the "not withdrawn" state, **When** the admin clicks Withdraw, **Then** the existing lighter confirmation flow is shown (no budget summary), preserving current behaviour for non-recurring expenses.
5. **Given** a recurring expense has already been withdrawn, **When** the admin views it, **Then** the Withdraw action is no longer offered (state is terminal for withdrawal in v1).

---

### User Story 4 — Monthly calendar view showing recurring and ad-hoc expenses (Priority: P2)

The admin can open a Calendar screen and navigate by month. For the selected month, the calendar view shows two clearly separated groups: (a) every active recurring expense template, each annotated with its per-month status (`Not added` / `Pending withdrawal` / `Withdrawn`) and, for `Pending withdrawal` and `Withdrawn`, a link to the underlying expense; and (b) every ad-hoc expense logged in that month, sorted by date. The view also shows the month total (sum of all withdrawn expenses) and a "shortfall" banner when the month's available funds cannot cover the sum of the active recurring expenses (see US-5). The current month is the default; the admin can step one month forwards or backwards. A separate all-time toggle is not offered in this view — it is a per-month view by design.

**Why this priority**: Saves the admin time each month and exposes the recurring vs ad-hoc split, but the underlying expenses and templates are already accessible through other screens. A useful follow-up to the core flows.

**Independent Test**: With at least one active recurring template and at least one ad-hoc expense, open the Calendar screen, confirm both groups render for the current month, step to the previous month (which has no ad-hoc expenses and no template additions), confirm the templates show `Not added`, return to the current month, add the template for this month, then refresh and confirm the template now shows `Pending withdrawal` with a link to the new expense.

**Acceptance Scenarios**:

1. **Given** the admin opens the Calendar screen, **When** it loads, **Then** the current month is selected and two groups render: "Recurring expenses this month" (one row per active template) and "Ad-hoc expenses this month" (one row per ad-hoc expense whose `month` equals the selected month).
2. **Given** a recurring template has not been added for the selected month, **When** the calendar view renders, **Then** its row shows `Not added` and an "Add for this month" action that creates the expense using the template's name and amount and the selected month.
3. **Given** a recurring template has been added for the selected month but the resulting expense is not yet withdrawn, **When** the calendar view renders, **Then** its row shows `Pending withdrawal` and a link to the expense.
4. **Given** a recurring template has been added for the selected month and the resulting expense is withdrawn, **When** the calendar view renders, **Then** its row shows `Withdrawn` and a link to the expense.
5. **Given** the admin navigates to a different month, **When** the calendar view re-renders, **Then** the recurring status and ad-hoc expense list are recomputed for the new month without reloading the screen.
6. **Given** a month has no active recurring templates and no ad-hoc expenses, **When** the calendar view renders, **Then** it shows an explicit empty state ("No expenses scheduled or recorded for this month") and the month navigator remains functional.
7. **Given** the admin clicks an ad-hoc expense row, **When** the click is processed, **Then** the admin is taken to the expense detail / edit screen for that expense (read-only for fields other than note in v1, per existing expense rules).

---

### User Story 5 — Budget shortfall warning service (Priority: P2)

A dedicated service computes, for any given month, the budget shortfall: the amount by which the sum of active recurring expense templates for that month exceeds the funds available to the masjid for that month. Available funds for a month are defined as `money on hand at the start of the month + sum of all payments recorded in that month − sum of all expenses withdrawn in that month`. The service exposes a single function `computeMonthlyShortfall(month)` that returns `{ available, recurringTotal, shortfall, severity }` where `shortfall = max(0, recurringTotal − available)` and `severity` is `ok` when shortfall is zero, `watch` when shortfall is between 0 and 10% of recurring total, and `risk` otherwise. The shortfall is recomputed live (via the same reactive listeners that drive money on hand). The calendar view (US-4) shows a banner when severity is `watch` or `risk`. When the admin logs a new expense (or withdraws a recurring one), the system recomputes shortfall and, if severity worsens, surfaces an inline warning on the confirmation step (US-3) and a toast on the calendar view.

**Why this priority**: A real value-add but a polish on top of the core flows. The service itself is small and testable in isolation.

**Independent Test**: Seed the system so money on hand at the start of the month is 2000, the active recurring total for the month is 1800, and there are no payments or withdrawn expenses in the month. Confirm `available = 2000`, `recurringTotal = 1800`, `shortfall = 0`, `severity = ok`. Log a non-recurring expense of 500 and confirm `available = 1500`, `shortfall = 300`, `severity = risk` (since 300 / 1800 = 16.7% > 10%). Open the calendar view and confirm the banner says, in the user's words, "you have 1500, expected expenses this month are 1800, you are 300 short".

**Acceptance Scenarios**:

1. **Given** a month with no active recurring templates, **When** the service computes the shortfall, **Then** `recurringTotal = 0`, `shortfall = 0`, `severity = ok`, and no banner is shown anywhere.
2. **Given** `available >= recurringTotal`, **When** the service computes the shortfall, **Then** `shortfall = 0`, `severity = ok`, and the calendar view shows a positive ("On track") badge.
3. **Given** `available < recurringTotal` and the gap is at most 10% of `recurringTotal`, **When** the service computes the shortfall, **Then** `severity = watch` and the calendar view shows an amber banner with the exact shortfall number.
4. **Given** `available < recurringTotal` and the gap is more than 10% of `recurringTotal`, **When** the service computes the shortfall, **Then** `severity = risk` and the calendar view shows a red banner with the exact shortfall number and a one-line suggestion to review recurring commitments.
5. **Given** the admin logs a new expense and that expense pushes the available funds below the recurring total, **When** the expense is saved, **Then** the inline warning on the withdraw confirmation (for recurring) and a toast on the calendar view show the new shortfall figure within 3 seconds of the write.
6. **Given** the admin withdraws a recurring expense, **When** the withdrawal is confirmed, **Then** the shortfall figure is recomputed using the post-withdrawal `available` and any banner on the calendar view updates within 3 seconds.
7. **Given** a month in the past has a negative shortfall, **When** the admin views that month on the calendar, **Then** the banner is shown for historical context but the admin is not blocked from navigating or editing.
8. **Given** the service is unit-tested, **When** the test suite runs, **Then** the shortfall math is verified for at least: zero recurring, exact-match (`available == recurring`), 5% gap, 10% gap, 50% gap, and negative `available`.

---

### Edge Cases

- **Editing a household's name to match another household's name**: Uniqueness rule (case-insensitive) still applies; the form rejects the duplicate. Member edits are independent of name uniqueness.
- **Member history when the admin is the only one who ever edits**: Even a single edit must produce a history record; the system never silently overwrites.
- **Expense with `type: "household"` linked to a family whose household is then hard-deleted**: The cascade deletes both the family-scoped expense rows and the household-scoped expense rows for that household. The expense's `householdId` is treated as the cascade root; an expense with `type: "household"` is always tied to exactly one household, regardless of whether a `familyId` is also set.
- **Recurring template used by an existing expense, then archived**: The template becomes inactive but the historical expense keeps its `recurringId`. The calendar view hides archived templates from the active list but the historical expense still appears in the ad-hoc expenses group if the month matches.
- **Same template added for two different months and the admin views a month with no template addition yet**: Calendar view shows the template as `Not added` with an "Add for this month" action; clicking creates a new expense for the selected month, not the current month.
- **Shortfall computation in a month with no payments ever recorded**: `available = money on hand at the start of the month` (which may be negative if the masjid is in deficit). The service handles negative `available` without throwing.
- **Shortfall with mixed household and mosque recurring templates**: All active recurring templates — both household-linked and mosque — are summed into `recurringTotal`. Mosque sub-categories do not change the math.
- **Concurrent edits to the same household's members**: Last-write-wins on the household document; the history collection records both writes with their respective admin identities and timestamps. No locks in v1.
- **Calendar navigation beyond the seeded history**: Stepping to months with no recorded activity renders an empty state, not a broken screen.
- **Withdrawal confirmation when the service is unreachable (network error)**: The withdrawal still proceeds if the underlying write succeeds; the shortfall warning is best-effort and degrades to a generic "Could not compute budget impact" message.

## Requirements *(mandatory)*

### Functional Requirements

#### Household Members

- **FR-001**: System MUST store on each household document a `memberCount` (non-negative integer) and a `memberNames` field containing a JSON array of strings (each 1-80 chars, trimmed).
- **FR-002**: System MUST allow an authorised admin to edit `memberCount` and `memberNames` from the household detail screen. The form MUST allow adding, removing, renaming, and reordering names.
- **FR-003**: `memberCount` MUST be derivable from `memberNames.length` on read; the system MUST treat the two as consistent (warn or reject on save if they diverge, per validation rule in plan).
- **FR-004**: Every successful change to `memberCount` or `memberNames` MUST create a new document in a member-history collection whose path is a sibling of the families collection (i.e. at `households/{householdId}/memberHistory/{historyId}` — see Assumptions), capturing: the previous `memberCount` and `memberNames`, the new `memberCount` and `memberNames`, the server timestamp, and the admin UID that made the change.
- **FR-005**: The history collection is append-only. The system MUST NOT modify or delete a history record through the admin UI.
- **FR-006**: System MUST allow an authorised admin to open a read-only "Member change history" view for a household, showing records newest first with the change timestamp, admin, previous values, and new values.
- **FR-007**: When a household is hard-deleted, the system MUST cascade the deletion to the household document, all member-history documents, all families, and all family-scoped payments and expenses, in a single batched write.

#### Expense Types

- **FR-008**: Every expense MUST have a `type` field with one of the values `"household"` or `"mosque"`. The system MUST reject the save if `type` is missing or invalid.
- **FR-009**: For an expense with `type: "household"`, the system MUST require a `householdId`. The admin MAY additionally select a `familyId` within that household; if `familyId` is set, it MUST belong to the same household.
- **FR-010**: For an expense with `type: "mosque"`, the system MUST NOT set `householdId` or `familyId` and MUST require a `mosqueSubCategory` with one of the values `"maintenance" | "salary" | "other"`.
- **FR-011**: The expense form MUST render a type selector as the first input and MUST dynamically show or hide the household/family picker or the mosque sub-category picker based on the chosen type.
- **FR-012**: The expenses list MUST display a clear visual badge for the expense type ("Household" or "Mosque") on every row.
- **FR-013**: The household detail screen MUST list only expenses whose `type === "household"` AND `householdId === this household`. Mosque expenses MUST NOT appear in any household detail view.
- **FR-014**: The expenses list MUST offer a filter by `type` (All / Household / Mosque) and, when `type === "mosque"`, a sub-filter by `mosqueSubCategory`.
- **FR-015**: When a household is hard-deleted, the system MUST cascade the deletion to all `type: "household"` expenses whose `householdId` matches the deleted household, in the same batched write. Mosque expenses MUST NOT be affected by household deletion.
- **FR-016**: Recurring expense templates MUST also carry a `type` field (defaulting to `"mosque"` for new templates in v1) and, for `type: "household"`, a `householdId` and optional `familyId`. The calendar view MUST only surface household-scoped recurring templates within their household's detail view; the global calendar MUST list all active templates regardless of type.

#### Withdrawal Confirmation for Recurring Expenses

- **FR-017**: When the admin clicks Withdraw on an expense where `isRecurring === true` (or, in plan-determined terms, on any expense produced by a recurring template), the system MUST show an expanded confirmation dialog that includes: the expense name, the expense amount, the new total withdrawn for the month, the new total pending for the month, and the current monthly shortfall figure (per the budget shortfall service).
- **FR-018**: Withdrawal MUST proceed only when the admin explicitly confirms the dialog. Cancel MUST leave the expense in `withdrawn: false`.
- **FR-019**: The existing lighter confirmation flow for ad-hoc (non-recurring) expenses MUST be preserved.

#### Monthly Calendar View

- **FR-020**: System MUST provide a Calendar screen that shows, for a selected month, two groups: (a) all active recurring expense templates annotated with their per-month status, and (b) all ad-hoc expenses whose `month` matches the selected month.
- **FR-021**: The Calendar screen MUST default to the current month and MUST allow the admin to step one month forwards or backwards via a month navigator.
- **FR-022**: For each recurring template in the selected month, the system MUST display exactly one of three statuses: `Not added`, `Pending withdrawal`, or `Withdrawn`, derived from whether an `expenses` document exists for that template and selected month and whether that expense has been withdrawn.
- **FR-023**: For templates with status `Pending withdrawal` or `Withdrawn`, the system MUST show a link to the underlying expense.
- **FR-024**: For templates with status `Not added`, the system MUST show an "Add for this month" action that creates an expense using the template's name, amount, type, and linkage (household/family or mosque sub-category), with `date` defaulted to the first of the selected month and `withdrawn: false`.
- **FR-025**: The Calendar screen MUST recompute the recurring status, the ad-hoc expense list, and the budget shortfall banner in real time when the underlying data changes.
- **FR-026**: The Calendar screen MUST show an explicit empty state ("No expenses scheduled or recorded for this month") when there are no active recurring templates and no ad-hoc expenses for the selected month.

#### Budget Shortfall Service

- **FR-027**: System MUST provide a service `BudgetShortfallService` (or equivalent) that, given a month `YYYY-MM`, returns `{ available, recurringTotal, shortfall, severity, asOf }` where:
  - `available = moneyOnHandAtStartOfMonth(month) + sum(payments.amount where month === M) − sum(expenses.amount where month === M AND withdrawn === true)`
  - `recurringTotal = sum(recurringExpenses.amount where active === true)`
  - `shortfall = max(0, recurringTotal − available)`
  - `severity` is `"ok"` if `shortfall === 0`, `"watch"` if `0 < shortfall ≤ 0.10 × recurringTotal`, `"risk"` if `shortfall > 0.10 × recurringTotal`.
- **FR-028**: `moneyOnHandAtStartOfMonth(month)` is defined as `openingBalance + sum(payments.amount where date < firstOfMonth) − sum(expenses.amount where date < firstOfMonth AND withdrawn === true)`.
- **FR-029**: The service MUST recompute the shortfall reactively (via the same Firestore listeners that drive money on hand) and MUST return an updated value within 3 seconds of any underlying change.
- **FR-030**: The Calendar screen MUST show a banner whose colour and text depend on `severity`: green/"On track" for `ok`, amber with the shortfall number for `watch`, red with the shortfall number and a short suggestion to review recurring commitments for `risk`. The banner MUST be hidden entirely when there are no active recurring templates for the month.
- **FR-031**: When the admin logs a new expense (ad-hoc or recurring) or withdraws a recurring expense, the system MUST recompute the shortfall. If severity worsens, the system MUST surface an inline warning on the relevant confirmation step (per US-3) and a toast on the Calendar screen. A best-effort, non-blocking fallback ("Could not compute budget impact") MUST be used if the service cannot respond in time.
- **FR-032**: The service MUST be unit-tested with at least the following cases: no recurring templates, exact-match (`available === recurringTotal`), 5% gap, 10% gap, 50% gap, and negative `available`.

### Key Entities *(include if feature involves data)*

- **HouseholdMemberHistory**: a record of one change to a household's `memberCount` or `memberNames`. Fields: `previousCount`, `previousNames` (JSON), `newCount`, `newNames` (JSON), `changedAt` (Timestamp), `changedBy` (admin UID). Sibling collection to families; not a sub-document of Family.
- **ExpenseType**: the classification of an expense — `household` (linked to a household, optionally a family) or `mosque` (linked to a mosque sub-category: maintenance, salary, other). Stored as `type` on every expense and on every recurring expense template. The existing `Expense` and `RecurringExpenseTemplate` entities gain new required fields.
- **MonthlyBudgetShortfall** (derived, not stored): the result of `BudgetShortfallService.computeMonthlyShortfall(month)`. Fields: `available`, `recurringTotal`, `shortfall`, `severity`, `asOf`. Computed live; never persisted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An authorised admin can add or edit household members and see a new history record appear in the member-history view within 2 seconds of the save.
- **SC-002**: An authorised admin can classify an expense as `household` or `mosque` from the expense form in under 30 seconds, and the saved expense renders the correct type badge and appears in the correct lists (household detail or mosque filter) without a manual refresh.
- **SC-003**: When the admin clicks Withdraw on a recurring expense, the confirmation dialog appears within 1 second and shows the expense name, amount, new month totals, and current shortfall figure.
- **SC-004**: The Calendar screen loads for the current month in under 2 seconds on broadband and re-renders the selected month in under 1 second when the admin steps forwards or backwards.
- **SC-005**: When `available < recurringTotal`, the Calendar screen shows the shortfall banner with the exact shortfall number and the correct severity colour within 1 second of the data change.
- **SC-006**: 95% of unit tests for `BudgetShortfallService` pass on the first run, covering all six required test cases in FR-032.
- **SC-007**: No regression in any of the existing v1 user stories (sign-in, dashboard, households, families, payments, expenses, recurring templates) after the changes ship; the existing E2E suite still passes.
- **SC-008**: Household hard-delete cascades in a single batched write and removes all related expenses, families, payments, and member-history records within 3 seconds of the admin confirming the deletion.

## Assumptions

- **Member-history path**: Recorded as `households/{householdId}/memberHistory/{historyId}` — i.e. a sub-collection of the household but a sibling of the `families` sub-collection. The user's wording "separate table from families table" is interpreted as "not inside the families sub-collection"; the plan phase may revisit whether a top-level collection is preferred.
- **Recurring template default type**: New recurring templates default to `type: "mosque"` since the original use case (electricity, salaries) is mosque-wide. The plan may add a UI control to switch a template to `type: "household"` with a household/family picker.
- **Shortfall formula direction**: The shortfall compares `available` to `recurringTotal`. The user's example (2000 had, 500 spent, 1800 recurring, 300 short) maps to `available = 1500`, `recurringTotal = 1800`, `shortfall = 300`, severity `risk` (300/1800 = 16.7%). The plan may refine the formula (e.g. add a safety buffer) but the comparison direction is locked.
- **"Cold added" recurring expenses**: The user repeated that recurring expenses are added cold (manually, not auto-created). This is already enforced in v1 (FR-034 in 001). The plan reuses that behaviour and only adds the explicit confirmation step on withdraw (US-3).
- **No family-facing portal**: Consistent with v1. Members and member history are admin-only data.
- **No bulk import of members in v1**: Each household is edited one at a time. A future version may add CSV import.
- **Household hard-delete behaviour on member history**: The plan must decide between cascade-delete (preferred for consistency with the rest of the system) and tombstone-retention. Default assumption: cascade-delete, matching the existing rule for families and payments.
- **Time zone**: Single time zone, display-only, consistent with v1.
- **English UI only** in v1; every user-facing string tagged with `// TODO(i18n)` for later extraction (per the existing 001 plan).

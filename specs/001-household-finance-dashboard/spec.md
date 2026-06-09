# Feature Specification: Veeramangalam Juma Masjid Household Finance Dashboard

**Feature Branch**: `001-household-finance-dashboard`
**Created**: 2026-06-09
**Status**: Draft
**Input**: Full product specification for a single-admin household finance dashboard that tracks monthly family contributions, expenses, and a single all-time "money on hand" figure for the Veeramangalam Juma Masjid.

## Summary

A single-admin web dashboard that helps the Veeramangalam Juma Masjid track monthly contributions collected from families, expenses paid out, and a running "money on hand" balance. The administrator can sign in with a Google account, organise families into households, record payments, log and withdraw expenses, manage recurring expense templates, and review monthly and all-time summaries. The first version serves only the admin; there is no family-facing portal and no in-app messaging.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Sign in and gain dashboard access (Priority: P1)

The admin opens the application and is presented with a sign-in screen. They sign in with a Google account. The system checks whether the signed-in identity has been pre-approved as an administrator. If approved, the admin lands on the dashboard. If not, the system shows an "access denied" page that identifies the email used and offers a sign-out action. No financial data is ever shown to a non-approved user.

**Why this priority**: Every other story depends on a signed-in, authorised admin. Without access control, the system cannot be deployed safely.

**Independent Test**: Can be tested by signing in with an approved Google identity (lands on dashboard) and an unapproved Google identity (lands on access denied) and confirming that no household, family, payment, or expense data is ever returned in the unapproved case.

**Acceptance Scenarios**:

1. **Given** a user is not signed in, **When** they open the app, **Then** the sign-in screen is displayed with a "Sign in with Google" action.
2. **Given** a user is not signed in, **When** they successfully complete Google sign-in and their identity is on the approved administrators list, **Then** they are taken to the dashboard.
3. **Given** a user is not signed in, **When** they successfully complete Google sign-in and their identity is not on the approved administrators list, **Then** they are taken to an access-denied screen that shows the email they used and offers a "Sign out" action, and no data is loaded.
4. **Given** a user is already signed in and authorised, **When** they reopen the app, **Then** they are taken directly to the dashboard without seeing the sign-in screen.
5. **Given** a user is on the access-denied screen, **When** they click "Sign out", **Then** they are returned to the sign-in screen.

---

### User Story 2 — View dashboard summary of money on hand and current month (Priority: P1)

Once on the dashboard, the admin sees a high-level financial snapshot. This includes the all-time "money on hand" figure, this month's collections versus target, this month's expenses added versus withdrawn, the count of households, and a quick tally of how many families have fully paid this month. The dashboard also shows a per-household table that summarises each household's families, fully paid / partial / unpaid counts, total collected, and total target for the current month. Clicking a household row navigates to that household's detail view.

**Why this priority**: The dashboard is the primary entry point after sign-in and delivers the single most important number (money on hand) and the monthly status across all households.

**Independent Test**: Can be tested by creating seed data (one household with a mix of paid and unpaid families, expenses that are added and withdrawn) and confirming that the dashboard cards, household table, and totals match the documented formulas.

**Acceptance Scenarios**:

1. **Given** there is at least one household, **When** the admin opens the dashboard, **Then** the household overview table shows one row per household with: household name, family count, fully paid count, partial count, unpaid count, total collected this month, and total target this month.
2. **Given** the admin clicks a household row in the overview table, **When** the click is processed, **Then** they are taken to that household's detail screen.
3. **Given** the system contains seed data, **When** the admin opens the dashboard, **Then** the "money on hand" card displays `opening balance + sum of all payments ever recorded (active and inactive families) − sum of all withdrawn expenses (all time)`.
4. **Given** the current month has no payments or expenses, **When** the admin opens the dashboard, **Then** the relevant cards show zero and the household overview table still renders without errors.

---

### User Story 3 — Create households and families (Priority: P1)

The admin can create a new household, give it a name, and add families to that household. When a family is created, it inherits a default monthly contribution target from global settings, which the admin can override on a per-family basis. A family is uniquely identified inside its household; once a family is removed, its identifier is never reused.

**Why this priority**: The household/family hierarchy is the data backbone of every other flow (payments, summaries, targets).

**Independent Test**: Can be tested by creating a household, adding two families with different contribution targets, and confirming both families appear under the household with the correct targets.

**Acceptance Scenarios**:

1. **Given** the admin is on the households list, **When** they submit a new household name, **Then** a new household is created and appears in the list.
2. **Given** the admin is on a household's detail screen, **When** they add a new family without specifying a target, **Then** the family is created with the current global default contribution target and is shown in the family's table.
3. **Given** the admin adds a new family, **When** the family is created, **Then** it is marked active by default and has a unique identifier within the household.
4. **Given** a global default contribution target exists, **When** the admin changes the global default, **Then** no existing family's target is changed; only families created afterwards inherit the new default.

---

### User Story 4 — Record a payment for a family (Priority: P1)

From a household's detail screen, the admin can record a payment for any active family. They enter the amount (required), the date (defaults to today, editable), and an optional note. The system derives a month key ("YYYY-MM") from the date and stores it alongside the payment. Multiple payments may be recorded for the same family in the same month; all are preserved and totalled. The family's monthly status, household summary, and dashboard all update immediately.

**Why this priority**: Recording payments is the core income-tracking flow. Without it, the system has no purpose.

**Independent Test**: Can be tested by recording two payments for the same family in the same month, then a third in a different month, and confirming that family totals, status badges, household summary, and dashboard figures all update correctly.

**Acceptance Scenarios**:

1. **Given** the admin is on a household detail screen, **When** they record a payment for a family with an amount, today's date, and a note, **Then** the payment row appears in the family's payment history with the correct amount, date, month, and note.
2. **Given** the admin records a second payment for the same family in the same month, **When** it is saved, **Then** both payments are stored as separate rows and the family's "paid this month" total equals the sum of the two amounts.
3. **Given** the admin records a payment with a date in a past or future month, **When** it is saved, **Then** the month key on the payment is derived from that date (not from today), and the payment is counted in that month's totals.
4. **Given** a family's total paid this month is zero, **When** the household detail screen renders, **Then** that family's status badge shows "Unpaid".
5. **Given** a family's total paid this month is greater than zero and less than its target, **When** the household detail screen renders, **Then** the status badge shows "Partial".
6. **Given** a family's total paid this month equals its target, **When** the household detail screen renders, **Then** the status badge shows "Met".
7. **Given** a family's total paid this month exceeds its target, **When** the household detail screen renders, **Then** the status badge shows "Over".

---

### User Story 5 — Add, withdraw, and delete expenses (Priority: P1)

The admin can log an expense with a name, amount, date, and optional note. The expense starts in a "not withdrawn" state and does not yet count against money on hand. The admin can later mark the expense as withdrawn, which captures the date and the admin's identity and then deducts the amount from money on hand. Withdrawn expenses are visually distinct. The admin can also delete any expense; deleting a withdrawn expense increases money on hand by its amount. Withdrawal is one-way in v1.

**Why this priority**: Expenses and withdrawals are the only way money leaves the system, so they are the second half of the core ledger.

**Independent Test**: Can be tested by adding an expense, observing that money on hand is unchanged, withdrawing it, observing that money on hand is reduced, then deleting it and observing that money on hand is restored.

**Acceptance Scenarios**:

1. **Given** the admin is on the expenses screen, **When** they submit a new expense with a name, amount, and date, **Then** the expense appears in the list in "not withdrawn" state and money on hand is unchanged.
2. **Given** an expense is in "not withdrawn" state, **When** the admin confirms withdrawal, **Then** the expense moves to "withdrawn" state, records the withdrawal date and admin, and money on hand is reduced by the expense amount.
3. **Given** an expense is in "withdrawn" state, **When** the admin views the expenses list, **Then** the expense is visually distinct from non-withdrawn expenses.
4. **Given** the admin deletes a non-withdrawn expense, **When** the deletion is confirmed, **Then** the expense row is removed and money on hand is unchanged.
5. **Given** the admin deletes a withdrawn expense, **When** the deletion is confirmed, **Then** the expense row is removed and money on hand increases by the expense amount.
6. **Given** the admin attempts to "undo" a withdrawal, **When** the action is unavailable, **Then** no undo action is presented (v1 has no withdrawal undo).

---

### User Story 6 — Soft delete a family while preserving payment history (Priority: P1)

The admin can mark a family as removed from the active list. This is a "soft delete": the family document and every payment recorded under it are preserved. The family is excluded from active counts, targets, and status calculations going forward, but the payments it received continue to count toward money on hand and toward that month's total collected. The family's identifier is permanently reserved and is never reassigned to a new family.

**Why this priority**: The soft-delete rule is a foundational data-integrity invariant that the rest of the spec depends on. A family that leaves the active list must not have its money "disappear" from the books.

**Independent Test**: Can be tested by soft-deleting a family that has paid in the current month and confirming that the family's status row is hidden, the household's active family count drops by one, the household's total collected for the month is unchanged, and money on hand is unchanged.

**Acceptance Scenarios**:

1. **Given** the admin soft-deletes a family from the household detail screen, **When** the confirmation is accepted, **Then** the family no longer appears in the household's active family table.
2. **Given** a family has been soft-deleted, **When** the household's monthly summary is recomputed, **Then** that family is excluded from the active count, from the active total target, and from paid/partial/unpaid counts.
3. **Given** a family has been soft-deleted, **When** the household's total collected this month and money on hand are recomputed, **Then** all payments previously recorded under that family are still included.
4. **Given** the admin attempts to add a new family using the identifier of a soft-deleted family, **When** the add operation is performed, **Then** the operation is rejected (or no conflict occurs because identifiers are immutable); a soft-deleted family's identifier is never reused.
5. **Given** the admin clicks delete on a family, **When** the confirmation dialog is shown, **Then** the dialog explicitly states that the family will be removed from the active list and that payment history will be fully preserved.

---

### User Story 7 — Manage recurring expense templates and add them to a month (Priority: P2)

The admin can define recurring expense templates (e.g. "Water Bill", AED 150) that act as reusable inputs. Adding a template does not itself create an expense. For the current month, the admin can add a template as an actual expense; once added for a month, the template shows whether the resulting expense is pending withdrawal or already withdrawn, with a quick link to that expense. The admin can edit a template's name, amount, or description, and can archive a template so it no longer appears in the active list.

**Why this priority**: Recurring templates save time on monthly bookkeeping but are not strictly required to operate the system.

**Independent Test**: Can be tested by creating a template, adding it for the current month, withdrawing the resulting expense, and confirming the template's per-month status progresses "Not added" → "Pending withdrawal" → "Withdrawn" without creating duplicate expenses for that month.

**Acceptance Scenarios**:

1. **Given** the admin is on the recurring expenses screen, **When** they add a new template with a name, amount, and description, **Then** the template appears in the active list.
2. **Given** a template has not yet been added for the current month, **When** the admin opens the recurring expenses screen, **Then** the template row shows an "Add for this month" action.
3. **Given** a template has been added for the current month and the resulting expense is not yet withdrawn, **When** the admin opens the recurring expenses screen, **Then** the template row shows a "Pending withdrawal" state with a link to the expense.
4. **Given** a template has been added for the current month and the resulting expense has been withdrawn, **When** the admin opens the recurring expenses screen, **Then** the template row shows a "Done" indicator.
5. **Given** a template has already been added for the current month, **When** the admin attempts to add it again for the same month, **Then** no duplicate expense is created and the existing expense is preserved.
6. **Given** the admin archives a template, **When** the action is confirmed, **Then** the template no longer appears in the active list and previously generated expenses from that template are not affected.

---

### User Story 8 — View family payment history (Priority: P2)

The admin can open a family payment history view that shows every payment recorded for that family, with date, amount, note, who recorded it, and when. The view can be filtered to a specific month or set to "all time". A summary line at the top shows the total paid for the selected period versus the family's contribution target. The admin can also delete a payment row from this view, which permanently removes that payment and updates all related totals (family status, household summary, dashboard, money on hand).

**Why this priority**: Payment history is needed to audit and correct mistakes, but the basic record-a-payment flow is the priority.

**Independent Test**: Can be tested by opening a family with payments across two months, filtering by month, confirming the summary and rows, deleting one payment, and confirming the totals adjust.

**Acceptance Scenarios**:

1. **Given** the admin opens a family's payment history, **When** the view renders, **Then** it shows all payment rows sorted by date, each with date, amount, note, recorded-by, recorded-at, and a delete action.
2. **Given** the admin changes the month filter, **When** the view updates, **Then** only payments whose month key matches the filter are listed and the summary line reflects the new total.
3. **Given** the admin sets the filter to "all time", **When** the view updates, **Then** every payment ever recorded for the family is listed and the summary compares the lifetime total against the current target.
4. **Given** the admin deletes a payment, **When** the deletion is confirmed, **Then** the row is removed, the family status for the affected month is recomputed, the household summary is recomputed, and money on hand decreases by that payment's amount.

---

### User Story 9 — Delete a payment (Priority: P2)

From the family payment history (or another surface that exposes a payment row), the admin can delete a payment. Deletion is permanent. The admin must confirm the action. After deletion, all derived totals and "money on hand" reflect the removal.

**Why this priority**: Mistakes in payments will happen; a way to remove a mis-recorded payment is required for trustworthy books.

**Independent Test**: Can be tested by recording a payment, deleting it, and confirming the family totals, household summary, dashboard, and money on hand all decrease by that amount.

**Acceptance Scenarios**:

1. **Given** a payment row exists, **When** the admin clicks delete, **Then** a confirmation dialog is shown that names the payment and the amount.
2. **Given** the confirmation is accepted, **When** the deletion completes, **Then** the payment row no longer exists, money on hand decreases by the payment amount, and the family status for that month is recomputed.
3. **Given** the confirmation is dismissed, **When** the action is cancelled, **Then** the payment row is preserved and no totals change.

---

### User Story 10 — Delete a household (Priority: P3)

The admin can delete an entire household. Unlike family deletion, household deletion is a hard delete: all families under the household and every payment row in those families are permanently removed. The action requires a strong confirmation step (e.g. typing the household name) so it cannot be performed accidentally.

**Why this priority**: Household deletion is destructive and is needed only when a household was created in error or is no longer relevant.

**Independent Test**: Can be tested by creating a household with families and payments, then deleting the household, and confirming the household, all of its families, and all of its payments are gone (and that money on hand has decreased by the deleted payments).

**Acceptance Scenarios**:

1. **Given** the admin clicks delete on a household, **When** the confirmation is requested, **Then** the system requires the admin to type the household name to enable the destructive action.
2. **Given** the admin successfully confirms, **When** the deletion completes, **Then** the household, all of its families, and all payments under those families are removed, and money on hand is reduced by the sum of the deleted payments.
3. **Given** the admin cancels the confirmation, **When** the dialog is dismissed, **Then** no data is removed.

---

### User Story 11 — Edit global settings (Priority: P3)

The admin can view and edit a small set of global settings: a default contribution target (used when a new family is created), an opening balance (a one-time seed value used in the money-on-hand calculation), and a currency label (used for display only, with no conversion). The settings page also shows the current admin's display name and email (read-only) and offers a sign-out action. Editing the opening balance carries a clear warning that the change will affect the money-on-hand figure.

**Why this priority**: Settings are configuration, not core workflow. They can be edited at any time and the system continues to function with sensible defaults.

**Independent Test**: Can be tested by changing the default contribution target and confirming newly created families use the new value while existing families are unchanged; by changing the opening balance and confirming money on hand shifts by the delta; and by changing the currency label and confirming the new label appears in displays.

**Acceptance Scenarios**:

1. **Given** the admin opens settings, **When** the page renders, **Then** the current default contribution target, opening balance, and currency label are shown as editable fields, and the admin's name and email are shown as read-only.
2. **Given** the admin changes the default contribution target and saves, **When** the change is applied, **Then** the new value is used for families created after the change and no existing family is modified.
3. **Given** the admin changes the opening balance and saves, **When** the change is applied, **Then** money on hand is adjusted by the delta between the old and new opening balance, and the save action explicitly warned the admin about that effect.
4. **Given** the admin changes the currency label, **When** the change is applied, **Then** monetary displays throughout the app show the new label (still without any conversion).
5. **Given** the admin clicks "Sign out" from settings, **When** the action is confirmed, **Then** the admin is signed out and returned to the sign-in screen.

---

### User Story 12 — Navigate between months and across screens (Priority: P3)

The app surfaces that summarise a month (household detail, family payment history, expenses) provide a month navigator so the admin can step backwards or forwards one month at a time. The current month is the default on first visit. A global navigation shell is present on every authenticated screen with links to the dashboard, households, expenses, recurring expenses, and settings, plus the signed-in admin's identity and a sign-out action.

**Why this priority**: Navigation is a usability concern; the system is functional without month-stepping but is much harder to use.

**Independent Test**: Can be tested by stepping the household detail screen back one month and forward one month and confirming the family statuses and totals reflect that month; and by using the global nav to move between every top-level screen.

**Acceptance Scenarios**:

1. **Given** the admin is on a month-aware screen set to the current month, **When** they click the back arrow, **Then** the screen updates to show the previous month's data.
2. **Given** the admin is on a month-aware screen, **When** they click the forward arrow, **Then** the screen moves forward one month and is disabled at the current month if forward stepping beyond it is not allowed.
3. **Given** the admin is on any authenticated screen, **When** they use the global navigation, **Then** they can reach the dashboard, households list, expenses, recurring expenses, and settings without losing their session.

---

### Edge Cases

- **Unauthorized sign-in**: A Google user not on the approved administrators list sees only the access-denied screen. No household, family, payment, expense, template, or setting data is returned or rendered.
- **Soft-deleted family with historical payments**: The family disappears from active lists, but every payment row is retained and still contributes to total collected and money on hand. The family's identifier is never reused.
- **Reused payment dates in the same month**: Multiple payment rows for the same family in the same month are allowed and must each be stored and totalled.
- **Payment date outside the current month**: The month key on the payment is derived from the payment's date, not from the time the admin recorded it. A payment recorded today for last month counts toward last month.
- **Money on hand becomes negative**: The system must show the value as a negative number with no special handling required, and must continue to operate.
- **Deleting a withdrawn expense**: Money on hand increases by the expense amount. There is no need to also restore a "withdrawn" flag.
- **Editing payments**: There is no edit action in v1. The only way to fix a wrong payment is to delete the row and re-add it. The UI must not offer an edit option on payment rows.
- **Editing a withdrawal**: There is no undo for withdrawal in v1. The UI must not offer an undo on a withdrawn expense.
- **Automatic recurring expense creation**: Templates never create expenses on their own. The admin must explicitly add a template for the current month.
- **Adding the same template twice in one month**: The second attempt must not create a duplicate expense. The template's per-month status transitions "Not added" → "Pending withdrawal" or "Withdrawn" exactly once per month.
- **Currency conversion**: The currency field is a display label only. The system never converts between currencies; the label is shown next to monetary values and stored as text.
- **Empty states**: When no households, families, payments, expenses, or templates exist, each surface must render an explicit empty state and a primary call-to-action (e.g. "Add household", "Add family") rather than appearing broken.
- **Inactive families in summaries**: Inactive families are excluded from active counts and target totals but their payments are still included in "total collected" and "money on hand" calculations.
- **Sign-in status changes mid-session**: If the signed-in identity is removed from the approved administrators list while the admin is using the app, subsequent data fetches must be rejected and the admin must be returned to the access-denied screen.
- **Household deletion cascading**: Deleting a household removes every family under it and every payment row under those families. The confirmation must clearly state this and require the household name to be retyped.

## Requirements *(mandatory)*

### Functional Requirements

#### Authentication & Access Control

- **FR-001**: System MUST allow users to sign in using a Google account.
- **FR-002**: System MUST consider a signed-in user authorised if and only if their identity is on the approved administrators list.
- **FR-003**: System MUST route unauthorised signed-in users to an access-denied screen that shows the email they used and a sign-out action, and MUST NOT return any household, family, payment, expense, template, or settings data to that user.
- **FR-004**: System MUST skip the sign-in screen and proceed directly to the dashboard for a user who is already signed in and authorised.
- **FR-005**: System MUST support an "owner" role with a single primary owner and an "admin" role for any additional approved users; in v1 both roles have identical in-app permissions.
- **FR-006**: System MUST allow the user to sign out from any authenticated screen via a clearly visible control, and MUST return them to the sign-in screen after sign-out.

#### Households & Families

- **FR-007**: System MUST allow an authorised admin to create a household with a required name.
- **FR-008**: System MUST allow an authorised admin to add a family to a household with a required name and a per-family contribution target.
- **FR-009**: When a family is created, its contribution target MUST be initialised to the current global default contribution target, and the admin MUST be able to override this value at creation time and at any later time.
- **FR-010**: Changing the global default contribution target MUST NOT modify the contribution target of any existing family.
- **FR-011**: System MUST allow an authorised admin to soft-delete a family. Soft delete MUST mark the family as inactive, record the deletion timestamp and the deleting admin's identity, and MUST NOT remove the family document or any of its payment rows.
- **FR-012**: The identifier of a soft-deleted family MUST be permanently reserved and MUST NEVER be reused for a new family.
- **FR-013**: Soft-deleted (inactive) families MUST be excluded from active family counts, from the household's active total target, and from paid/partial/unpaid counts. Their payment rows MUST still be included in total collected and in money on hand.
- **FR-014**: System MUST allow an authorised admin to delete a household. Household deletion is a hard delete that permanently removes the household, all of its families, and every payment row in those families.
- **FR-015**: Household deletion MUST require the admin to confirm by retyping the household name before the action is executed.

#### Payments

- **FR-016**: System MUST allow an authorised admin to record a payment against a family with a required amount, a date (defaulting to today, editable), and an optional note.
- **FR-017**: Each payment MUST store a month key in "YYYY-MM" format derived from the payment's date.
- **FR-018**: System MUST allow an authorised admin to record more than one payment for the same family in the same month. Each payment MUST be stored as a separate row and MUST be totalled for display and reporting.
- **FR-019**: System MUST allow an authorised admin to delete a payment. Deletion is permanent, MUST require confirmation, and MUST update all derived totals (family status, household summary, dashboard, money on hand).
- **FR-020**: System MUST NOT provide an edit action for payment rows in v1. The only way to correct a payment is to delete and re-add it.

#### Family Monthly Status

- **FR-021**: For each family in a given month, the system MUST compute the family's total paid as the sum of that family's payment amounts whose month key equals the month in question.
- **FR-022**: The system MUST classify each family's status in a given month as one of "Unpaid" (total paid = 0), "Partial" (0 < total paid < target), "Met" (total paid = target), or "Over" (total paid > target). All four statuses MUST be representable in the user interface and visually distinct.
- **FR-023**: Status classification MUST consider only active families. Inactive families MUST NOT receive a status.

#### Household Monthly Summary

- **FR-024**: For a given household and month, the system MUST compute the household's total target as the sum of contribution targets over active families only.
- **FR-025**: For a given household and month, the system MUST compute the household's total collected as the sum of payment amounts in that month across both active and inactive families.
- **FR-026**: For a given household and month, the system MUST compute counts of fully paid (status = "Met" or "Over"), partial, and unpaid families over active families only.
- **FR-027**: The household's collection rate MUST be `totalCollected / totalTarget` expressed as a percentage.

#### Expenses

- **FR-028**: System MUST allow an authorised admin to add a non-recurring expense with a required name, required amount, date (defaulting to today, editable), and optional note.
- **FR-029**: A newly added expense MUST start in a "not withdrawn" state and MUST NOT affect money on hand until withdrawn.
- **FR-030**: System MUST allow an authorised admin to withdraw an expense. Withdrawal MUST record the withdrawal timestamp and the withdrawing admin's identity, MUST require confirmation, and MUST cause the expense to count against money on hand.
- **FR-031**: System MUST NOT provide an undo action for a withdrawal in v1.
- **FR-032**: System MUST allow an authorised admin to delete any expense. Deletion of a non-withdrawn expense MUST NOT change money on hand; deletion of a withdrawn expense MUST increase money on hand by the expense amount. Deletion is permanent and MUST require confirmation.

#### Recurring Expense Templates

- **FR-033**: System MUST allow an authorised admin to create a recurring expense template with a required name, required amount, and optional description.
- **FR-034**: A recurring expense template MUST NOT itself create expense rows. Templates are inert until the admin explicitly acts on them.
- **FR-035**: For the current month, system MUST show, per active template, a status of "Not added", "Pending withdrawal", or "Withdrawn" derived from whether an expense row already exists in the current month for that template, and whether that expense has been withdrawn.
- **FR-036**: System MUST allow an authorised admin to "Add for this month" on a template. The action MUST create a new expense row using the template's name and amount and the current month, MUST set the expense's "is recurring" marker and reference the template, and MUST initialise the expense as "not withdrawn". The action MUST be available only when no expense for that template exists in the current month.
- **FR-037**: System MUST allow an authorised admin to edit a template's name, amount, and description. Editing a template MUST NOT modify any expense rows already created from that template.
- **FR-038**: System MUST allow an authorised admin to archive a template. Archived templates MUST NOT appear in the active template list, and previously generated expenses from that template MUST be preserved.

#### Money on Hand

- **FR-039**: Money on hand MUST be computed as `opening balance (from settings) + sum of all payments ever recorded across all families (active and inactive) − sum of all withdrawn expenses (all time)`.
- **FR-040**: Money on hand MUST be displayed in the currency label stored in settings and MUST be visible on the dashboard.
- **FR-041**: Money on hand MUST update reactively whenever a payment is added or deleted or whenever an expense is added, withdrawn, or deleted.

#### Monthly & All-Time Expense Summaries

- **FR-042**: For a given month, the system MUST display a summary of: total expenses added (sum of expense amounts in that month), total expenses withdrawn (sum of withdrawn expense amounts in that month), and total expenses pending (added minus withdrawn).
- **FR-043**: The expenses surface MUST also be able to display an all-time summary of total expenses added and total expenses withdrawn.

#### Settings

- **FR-044**: System MUST allow an authorised admin to view and edit the default contribution target, the opening balance, and the currency label, and MUST persist these values in global settings.
- **FR-045**: System MUST display a confirmation warning when the opening balance is changed, stating that money on hand will be affected.
- **FR-046**: The currency label MUST be a free-text display label only; the system MUST NOT perform any currency conversion.

#### Navigation & Surfacing

- **FR-047**: System MUST provide a global navigation shell on every authenticated screen that links to the dashboard, households, expenses, recurring expenses, and settings, and that shows the current admin's display name and a sign-out action.
- **FR-048**: The household detail, family payment history, and expenses surfaces MUST provide a month navigator that allows the admin to step backwards and forwards one month at a time, defaulting to the current month on first visit.

#### Auditing & Provenance

- **FR-049**: Every payment row MUST record the admin who recorded it and the timestamp it was recorded. The admin who recorded a payment MUST be visible in the family payment history view.
- **FR-050**: Every expense row MUST record the admin who added it and the timestamp it was added. Withdrawn expense rows MUST also record the admin who withdrew them and the timestamp of the withdrawal.
- **FR-051**: Every household and family creation MUST record the admin who created it and the timestamp it was created.

### Key Entities

- **Admin**: A person authorised to access the dashboard. Identified by their Google account. Has a display name, an email for reference, a role (owner or admin), and a record of when they were added.
- **Setting**: Global configuration for the app. Holds the default contribution target used when creating new families, the opening balance that seeds money on hand, and a currency label for display.
- **Household**: A named grouping that contains families. Has a name, a creation timestamp, and a record of the admin who created it.
- **Family**: A contributor unit that belongs to a household. Has a name, a per-family monthly contribution target, an active flag (true by default), and (when soft-deleted) a deletion timestamp and the deleting admin. Has a unique identifier within its household that is permanently reserved once issued.
- **Payment**: A single contribution row recorded against a family. Has an amount, a date the admin assigned to it, a derived month key in "YYYY-MM" format, an optional note, a recorded-at timestamp, and the admin who recorded it.
- **Expense**: A single outflow event. Has a name, amount, date, derived month key, optional note, a "withdrawn" flag with a withdrawal timestamp and the withdrawing admin, and references its adding admin and a creation timestamp. May be linked to a recurring template.
- **Recurring Expense Template**: A reusable input that helps the admin add a similar expense every month. Has a name, amount, optional description, an active flag, a creation timestamp, and the admin who created it. The template never produces expense rows on its own; the admin must explicitly add it for a given month.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An authorised admin can sign in and reach the dashboard in under 30 seconds on a typical broadband connection.
- **SC-002**: An authorised admin can record a payment for a family and see the family's status, the household's monthly total, and the dashboard's "money on hand" update within 3 seconds of saving the payment.
- **SC-003**: An authorised admin can add an expense, withdraw it, and see the dashboard's "money on hand" decrease by that expense's amount within 3 seconds of confirming the withdrawal.
- **SC-004**: An authorised admin can add a recurring template and add it for the current month in under 60 seconds.
- **SC-005**: An authorised admin can soft-delete a family and confirm that, on the same screen, the family's status row disappears while the household's total collected for the month and the dashboard's "money on hand" are unchanged.
- **SC-006**: A signed-in user who is not on the approved administrators list is shown the access-denied screen on first interaction and is unable to retrieve any household, family, payment, expense, template, or settings data, verifiable by inspecting network traffic for the session.
- **SC-007**: 100% of household, family, payment, and expense views that have no data display an explicit empty state with a primary call-to-action rather than a blank or broken screen.
- **SC-008**: After stepping the household detail screen backwards or forwards one month, the family statuses, total collected, and total target all reflect the selected month's data, and the dashboard's month-aware cards agree with the household detail screen's numbers.
- **SC-009**: 100% of money-on-hand changes are traceable: deleting a payment reduces money on hand by exactly that payment's amount; withdrawing an expense reduces money on hand by exactly that expense's amount; deleting a withdrawn expense increases money on hand by exactly that expense's amount; changing the opening balance shifts money on hand by the delta between the new and old value.
- **SC-010**: 100% of soft-deleted families remain in storage with all of their payment rows intact, verifiable by the soft-deleted family still appearing in any "all time" payment list scoped to its payments and by its payments still contributing to "total collected" and "money on hand".
- **SC-011**: 100% of attempts to add a new family using a previously soft-deleted family's identifier are rejected (or the system otherwise guarantees the identifier is never reused).
- **SC-012**: An authorised admin can perform every common workflow (sign in, view dashboard, record a payment, add and withdraw an expense, add a recurring template for the month, view a family's history, soft-delete a family, edit settings, sign out) entirely through the user interface with no need to access the database directly.

## Assumptions

- A single primary owner administers the system and adds other administrators manually outside the app (e.g. in the database console) for v1.
- All users access the application from modern desktop or laptop web browsers; native mobile and tablet-optimised layouts are not in v1.
- The system is used by a single organisation (Veeramangalam Juma Masjid); multi-tenant behaviour is not in v1.
- The currency used by the organisation is stable and does not require conversion. The currency label exists so the display can match the organisation's accounting convention.
- Network connectivity is generally available when the admin uses the app. Offline read/write is not in v1.
- The Google account used for sign-in is treated as a verified identity. The system does not perform additional identity proofing.
- All times in the system are stored and displayed using a single time zone. The admin is assumed to operate in that time zone.
- The opening balance is set once at initial setup and is rarely changed. The warning on change exists precisely because the change has an outsized effect on money on hand.
- The owner accepts that v1 has no edit-on-payment, no undo-withdrawal, no automatic recurring expense generation, and no family-facing portal. These are explicit non-goals for v1, not oversights.
- Recurring expense templates are added to a month by explicit human action; the system is not expected to auto-create them on a schedule.
- Data volume is modest (tens of households, hundreds of families, thousands of payments and expenses over years). Performance under much larger volumes is not a v1 concern.
- The administrator trusts the access control list. The system does not implement a separate per-household or per-family permission model in v1.

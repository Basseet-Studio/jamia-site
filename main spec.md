# Veeramangalam Juma Masjid

# Household Finance Dashboard — Full Product Specification

**Stack:** Next.js (App Router) · Firebase Firestore · Firebase Auth (Google Sign-In) · shadcn/ui · Tailwind CSS  
**Hosting:** Vercel (free tier) + Firebase (Spark free tier)  
**Version:** v1 — Single admin view, no family-facing portal, no messaging  

---

## Table of Contents

1. [Data Layer](#1-data-layer)
2. [Business Logic](#2-business-logic)
3. [Screens](#3-screens)
4. [Components & Widgets](#4-components--widgets)

---

## 1. Data Layer

This section defines what is stored, where, and what shape it takes. No logic lives here — only structure.

---

### 1.1 Collection: `admins`

Stores all users who are allowed to access the dashboard. Populated manually in the Firebase Console by the owner. Google Sign-In creates the auth account; the owner then adds the UID here to grant access.

```
admins/
  {googleUID}/
    email         string       e.g. "ahmed@gmail.com"  — for human reference only
    displayName   string       e.g. "Ahmed Al Mansouri"
    role          string       "owner" | "admin"
    addedAt       timestamp
```

- `owner` is the primary admin. There is exactly one.
- `admin` is any other person the owner grants access to.
- A user who signs in with Google but has no document here is considered unauthorized.

---

### 1.2 Collection: `settings`

A single document holding global app-wide settings.

```
settings/
  global/
    defaultContributionTarget   number     e.g. 500
    openingBalance              number     e.g. 0
    currency                   string     e.g. "AED"
```

- `defaultContributionTarget` is the starting target amount assigned to every new family. It can be overridden per family.
- `openingBalance` is a one-time seed value representing money that existed before the app started tracking.
- `currency` is a display-only label, no conversion logic.

---

### 1.3 Collection: `households`

Top-level grouping. A household is a named group that contains one or more families.

```
households/
  {householdId}/
    name          string       e.g. "Al Mansouri"
    createdAt     timestamp
    createdBy     string       UID of the admin who created it
```

---

### 1.4 Sub-collection: `households/{householdId}/families`

Each family belongs to exactly one household.

```
families/
  {familyId}/
    name                    string     e.g. "Ahmed's Unit"
    contributionTarget      number     e.g. 500  — copied from default at creation, editable
    createdAt               timestamp
    createdBy               string     UID
    active                  boolean    true by default — set to false on soft delete
    deletedAt               timestamp  null until soft-deleted
    deletedBy               string     UID, null until soft-deleted
```

- `contributionTarget` is the expected monthly amount for this specific family.
- Changing this value does not retroactively affect past payment records.
- Family documents are **never hard deleted**. Setting `active: false` is the only removal operation.
- The family's ID is permanently reserved once created and can never be reused.
- The payments sub-collection is **never touched** on soft delete — all payment history is preserved.

---

### 1.5 Sub-collection: `households/{householdId}/families/{familyId}/payments`

Each document is one payment row. Multiple payments can exist for the same family in the same month.

```
payments/
  {paymentId}/
    amount          number       e.g. 300
    date            timestamp    the date the admin records it (can be set manually)
    month           string       derived at write time, format "YYYY-MM" e.g. "2025-06"
    note            string       optional free-text note
    recordedAt      timestamp    server timestamp of when the row was created
    recordedBy      string       UID of admin who recorded it
```

- `month` is stored as a string field at write time so queries can filter by month without date math.
- There is no edit on payments — only delete and re-add.

---

### 1.6 Collection: `expenses`

Each document is one expense event — either manually added or generated from a recurring template.

```
expenses/
  {expenseId}/
    name              string       e.g. "Electricity Bill"
    amount            number       e.g. 450
    date              timestamp    the date the admin assigns to the expense
    month             string       "YYYY-MM" — derived at write time
    note              string       optional
    isRecurring       boolean      true if generated from a recurring template
    recurringId       string       ID of the source recurring template, or null
    withdrawn         boolean      false by default — true only when admin clicks Withdraw
    withdrawnAt       timestamp    null until withdrawn
    withdrawnBy       string       UID, null until withdrawn
    addedAt           timestamp    server timestamp
    addedBy           string       UID
```

- Non-recurring expenses can be added freely. They start with `withdrawn: false`.
- When admin clicks "Withdraw", only `withdrawn`, `withdrawnAt`, and `withdrawnBy` are updated.
- An expense that is not withdrawn does not count against money on hand.

---

### 1.7 Collection: `recurringExpenses`

Templates for expenses that repeat monthly. These do not automatically create expense rows. The admin must trigger that manually.

```
recurringExpenses/
  {recurringId}/
    name          string     e.g. "Water Bill"
    amount        number     e.g. 150
    description   string     optional note about this recurring item
    active        boolean    true = show in recurring list, false = archived
    createdAt     timestamp
    createdBy     string     UID
```

- These are templates only. They never touch the `expenses` collection on their own.
- When the admin clicks "Add for This Month" on a recurring template, a new document is written to `expenses` with `isRecurring: true` and the `recurringId` set.

---

## 2. Business Logic

This section defines all calculations, rules, and processes. No UI described here.

---

### 2.1 Access Control

**Rule:** A user is authorized if and only if their Google UID exists as a document in the `admins` collection.

**On sign-in:**
1. Firebase Auth completes Google Sign-In and returns a UID.
2. App queries `admins/{uid}`.
3. If the document exists → user is authorized, proceed to dashboard.
4. If the document does not exist → user is shown the Access Denied screen. No data is accessible.

**Role distinction (v1):** Owner and admin have identical permissions in the UI. The `role` field is stored for future use only.

---

### 2.2 Default Contribution Target

- When a new family is created, their `contributionTarget` is copied from `settings/global.defaultContributionTarget`.
- The admin can edit it per family at any time.
- Changing the global default does not update existing families — only newly created ones.
- Changing the per-family target does not affect historical payment records.

---

### 2.3 Payment Totals Per Family Per Month

For any family in any given month:

```
totalPaid     = sum of all payment.amount where payment.month = "YYYY-MM"
target        = family.contributionTarget
difference    = totalPaid - target

status:
  if totalPaid === 0           → "Unpaid"
  if totalPaid < target        → "Partial"
  if totalPaid === target      → "Met"
  if totalPaid > target        → "Over"
```

- All four statuses must be representable in the UI.
- "Partial" and "Unpaid" are both "not fully paid" but shown distinctly.

---

### 2.4 Household Monthly Summary

For a given household and month:

```
totalFamilies         = count of all families where active = true
familiesPaidFull      = count (active only) where status is "Met" or "Over"
familiesPartial       = count (active only) where status is "Partial"
familiesUnpaid        = count (active only) where status is "Unpaid"
totalCollected        = sum of all family totalPaid for the month (active AND inactive)
totalTarget           = sum of contributionTarget for active families only
collectionRate        = totalCollected / totalTarget (as a percentage)
```

- Inactive (soft-deleted) families are excluded from counts and targets, because they are no longer expected to contribute.
- Their past payments are still included in `totalCollected` because that money was real and is accounted for.

---

### 2.5 Money on Hand

This is the single most important calculated number in the app.

```
moneyOnHand =
  settings.openingBalance
  + sum of ALL payments ever recorded (all time, all families — active and inactive)
  - sum of all expenses where withdrawn = true (all time)
```

- Only withdrawn expenses reduce money on hand.
- Expenses that have been added but not withdrawn do not affect this number.
- Payments from soft-deleted (inactive) families are included — that money was received and must be accounted for.
- This is an all-time calculation, not monthly.

---

### 2.6 Monthly Expense Summary

For a given month:

```
totalExpensesAdded      = sum of all expenses.amount where month = "YYYY-MM"
totalExpensesWithdrawn  = sum of all expenses.amount where month = "YYYY-MM" AND withdrawn = true
totalExpensesPending    = totalExpensesAdded - totalExpensesWithdrawn
```

---

### 2.7 All-Time Expense Summary

```
allTimeExpenses         = sum of all expenses.amount (regardless of withdrawn status)
allTimeWithdrawn        = sum of all expenses.amount where withdrawn = true
```

---

### 2.8 Recurring Expense Flow

1. Admin opens the Recurring Expenses page.
2. Admin sees all active recurring templates.
3. For the current month, the app checks whether each template has already been added (by querying `expenses` where `recurringId` matches and `month` matches the current month).
4. If not yet added for this month → show "Add for This Month" button.
5. If already added but not withdrawn → show "Pending Withdrawal" state with a link to the expense.
6. If already added and withdrawn → show "Done" state.
7. When admin clicks "Add for This Month":
   - A new expense document is written using the template's name, amount, and current month.
   - `isRecurring: true`, `recurringId` set, `withdrawn: false`.
8. Withdrawal happens separately on the Expenses page, not on this screen.

---

### 2.9 Adding a Payment

1. Admin selects a family.
2. Admin clicks "Record Payment."
3. Admin enters: amount (required), date (defaults to today, editable), note (optional).
4. On save, `month` is derived from the date field as "YYYY-MM" and stored alongside the other fields.
5. The payment appears immediately in the family's payment history.
6. All monthly totals for that family recalculate.

---

### 2.10 Deleting a Payment

- Any admin can delete any payment row.
- Deletion is permanent. No undo in v1.
- A confirmation prompt is shown before deletion.

---

### 2.11 Adding and Deleting Families

**Adding:**
- Any admin can add a family to any household.
- The new family inherits `contributionTarget` from the global default at the time of creation.
- The family is created with `active: true`.

**Deleting (soft delete):**
- "Deleting" a family sets `active: false`, `deletedAt`, and `deletedBy` on the family document. No other data changes.
- The family document itself is never removed from Firestore.
- The family's ID is permanently reserved — no new family can ever use it.
- All payment records under the family are completely untouched. Every payment row remains and continues to count toward money on hand and all totals.
- The confirmation prompt explains that the family will be removed from the active list and that their full payment history is preserved.
- In v1, there is no UI to view or restore inactive families. Their contribution to totals is silent but correct.

---

### 2.12 Adding and Deleting Households

- Any admin can create a new household.
- Any admin can delete a household.
- **Deleting a household deletes all its families and all payment records.** Permanent.
- A strong confirmation prompt is shown (type the household name to confirm, or similar).

---

### 2.13 Withdrawing an Expense

1. Admin clicks "Withdraw" on any non-withdrawn expense.
2. A confirmation prompt shows the expense name and amount.
3. On confirm, `withdrawn: true`, `withdrawnAt`, and `withdrawnBy` are written.
4. The expense now counts against money on hand.
5. Withdrawal cannot be undone in v1.

---

### 2.14 Deleting an Expense

- Any admin can delete any expense.
- If the expense was withdrawn, money on hand will increase after deletion.
- A confirmation prompt is shown.
- Deletion is permanent.

---

## 3. Screens

Each screen is described by its purpose, what data it shows, and what actions are available. No visual styling described here.

---

### 3.1 Sign-In Screen

**Purpose:** Entry point for all users. Only way into the app.

**Content:**
- App name / logo
- One button: "Sign in with Google"

**Behavior:**
- On successful Google auth, app checks admin status (see 2.1).
- If authorized → redirect to Dashboard.
- If not authorized → redirect to Access Denied screen.
- If already signed in → redirect directly to Dashboard, skip this screen.

---

### 3.2 Access Denied Screen

**Purpose:** Shown when a signed-in user is not in the admins list.

**Content:**
- Message explaining access is restricted.
- The email address they signed in with (so they can tell the owner).
- A "Sign out" button.

**Behavior:**
- No data is fetched or displayed.
- Signing out returns to Sign-In screen.

---

### 3.3 Dashboard (Home)

**Purpose:** High-level overview of the current month's financial state.

**Content — Summary Cards:**
- Money on Hand (all-time calculated value)
- This Month's Collections: total paid vs total target, as a number and percentage
- This Month's Expenses: total added vs total withdrawn
- Number of households
- Quick stat: how many families have fully paid this month vs total families

**Content — Household Overview Table:**
- One row per household
- Columns: Household Name, Families Count, Fully Paid, Partial, Unpaid, Total Collected This Month, Target This Month
- Clicking a row navigates to that Household Detail screen

**Content — Recent Activity Feed (optional in v1):**
- Last 5–10 payments recorded or expenses added, with timestamp and admin who did it

**Navigation:**
- Link to Households list
- Link to Expenses page
- Link to Recurring Expenses
- Link to Settings

---

### 3.4 Households List Screen

**Purpose:** See all households, navigate to any one.

**Content:**
- List or table of all households
- Each row: Household Name, number of families, total collected this month, date created
- "Add Household" button at the top

**Actions:**
- Click a household → Household Detail screen
- Click "Add Household" → opens Add Household dialog
- Delete icon on each row → confirmation prompt → delete household

---

### 3.5 Household Detail Screen

**Purpose:** See all families inside a household and manage contributions for the current month.

**Header:**
- Household name
- Month selector (defaults to current month, can navigate back/forward)
- Household monthly summary: total collected, total target, collection rate

**Family Table:**
- One row per family
- Columns: Family Name, Target (AED), Paid This Month (AED), Status badge, Actions
- Status badge: Unpaid / Partial / Met / Over (color-coded)
- Actions column: "Record Payment" button, "View History" link, delete family button

**Actions:**
- "Add Family" button → Add Family dialog
- "Record Payment" on a family row → Record Payment dialog
- "View History" on a family row → Family Payment History drawer or sub-screen
- Delete family → confirmation → delete

---

### 3.6 Family Payment History Screen / Drawer

**Purpose:** See all individual payment rows for one family, optionally filtered by month.

**Content:**
- Family name + household name as breadcrumb
- Month filter (default: current month, option to show all time)
- Table of payment rows: Date, Amount, Note, Recorded By, Recorded At, Delete button
- Summary at top: total paid for selected period vs target

**Actions:**
- Delete a payment row → confirmation → delete
- "Record Payment" button → Record Payment dialog (pre-filled with this family)

---

### 3.7 Expenses Screen

**Purpose:** View, add, and manage all expenses. Primary place to withdraw expenses.

**Header:**
- Month filter (defaults to current month)
- Toggle to show all-time view

**Summary Bar (for selected month or all time):**
- Total Expenses Added
- Total Withdrawn
- Total Pending (added but not withdrawn)

**Expense Table:**
- Columns: Name, Amount, Date, Recurring (yes/no), Status (Pending / Withdrawn), Withdrawn At, Actions
- Actions: "Withdraw" button (if not yet withdrawn), "Delete" button
- Withdrawn rows visually distinct (dimmed or with a checkmark)

**Actions:**
- "Add Expense" button → Add Expense dialog
- "Withdraw" → confirmation → mark withdrawn
- "Delete" → confirmation → delete

---

### 3.8 Recurring Expenses Screen

**Purpose:** Manage expense templates and add them to the current month.

**Content:**
- List of all active recurring expense templates
- Each row: Name, Amount, Description, Status for current month (Not Added / Pending Withdrawal / Withdrawn), Action button
- "Add Template" button at top

**Action button per row (context-sensitive):**
- "Add for This Month" → if not yet added this month
- "Go to Expense" → if added but not yet withdrawn (links to the expense on Expenses screen)
- "Done" (disabled/label) → if added and withdrawn this month

**Actions:**
- "Add Template" → Add Recurring Template dialog
- Edit template → Edit dialog (name, amount, description)
- Archive/delete template → removes from active list

---

### 3.9 Settings Screen

**Purpose:** Configure global defaults.

**Content:**
- Default Contribution Target — editable number field with save button
- Opening Balance — editable number field with save button (shows warning that this affects money on hand)
- Currency label — editable text field
- Current admin's name and email (read-only, from Google account)
- Sign out button

**Not in v1:**
- Admin management UI (done manually in Firebase Console)
- Family bulk-edit

---

## 4. Components & Widgets
## shadcn preset code --preset b2wfMGacfQ

This section lists every reusable UI component the app needs, what props it takes, and what it does. Built with shadcn/ui primitives unless noted.

---

### 4.1 Navigation

**`AppShell`**
- Wraps every authenticated screen
- Contains: sidebar or top nav, page title area, main content slot
- Sidebar links: Dashboard, Households, Expenses, Recurring, Settings
- Shows current signed-in user name and avatar (from Google)
- Sign out button in sidebar footer

**`MonthNavigator`**
- Displays current selected month (e.g. "June 2025")
- Left/right arrow buttons to go back and forward one month
- Used on: Household Detail, Expenses, Family History

---

### 4.2 Summary Cards

**`StatCard`**
Props: `label`, `value`, `subvalue` (optional), `variant` (neutral / positive / warning / danger)
- Used on Dashboard and Household Detail header
- Shows one metric clearly
- Examples: "Money on Hand — AED 12,400", "Collection Rate — 78%"

**`HouseholdSummaryRow`**
Props: `household`, `monthlyStats`
- One row in the Dashboard household overview table
- Clickable to navigate to Household Detail

---

### 4.3 Family Components

**`FamilyTable`**
Props: `families[]`, `month`, `onRecordPayment`, `onViewHistory`, `onSoftDeleteFamily`
- Receives only active families (`active: true`) — filtering happens before this component
- Full table of families for a household
- "Delete" action sets `active: false` via soft delete — does not remove the row from Firestore
- Handles empty state: "No families yet. Add one to get started."

**`FamilyStatusBadge`**
Props: `status` ("Unpaid" | "Partial" | "Met" | "Over")
- Color-coded pill badge
- Unpaid → red, Partial → amber, Met → green, Over → blue

**`FamilyPaymentHistoryTable`**
Props: `payments[]`, `target`, `month` (optional filter)
- Lists payment rows
- Shows total at the bottom
- Each row has a delete button

---

### 4.4 Dialogs (Modal Forms)

All dialogs use shadcn `Dialog` with `DialogContent`, `DialogHeader`, `DialogFooter`.

**`AddHouseholdDialog`**
Fields: Household Name (required)
Actions: Cancel, Create

**`AddFamilyDialog`**
Props: `householdId`, `defaultTarget`
Fields: Family Name (required), Contribution Target (pre-filled with default, editable)
Actions: Cancel, Add Family

**`EditFamilyDialog`**
Props: `family`
Fields: Family Name, Contribution Target
Actions: Cancel, Save Changes

**`RecordPaymentDialog`**
Props: `family`, `householdId`
Fields:
- Amount (number, required)
- Date (date picker, defaults to today)
- Note (text, optional)
Actions: Cancel, Record Payment

**`AddExpenseDialog`**
Fields:
- Name (required)
- Amount (number, required)
- Date (date picker, defaults to today)
- Note (optional)
Actions: Cancel, Add Expense

**`AddRecurringTemplateDialog`**
Fields:
- Name (required)
- Amount (number, required)
- Description (optional)
Actions: Cancel, Save Template

**`EditRecurringTemplateDialog`**
Props: `template`
Fields: same as Add
Actions: Cancel, Save Changes

**`ConfirmDeleteDialog`**
Props: `title`, `description`, `onConfirm`, `destructive` (boolean)
- Generic reusable confirmation dialog
- Used for: soft-delete family, delete household, delete payment, delete expense, withdraw expense
- When used for family soft delete: description explicitly states "This family will be removed from the active list. Their payment history will be fully preserved."
- Destructive variant shows red confirm button

---

### 4.5 Expense Components

**`ExpenseTable`**
Props: `expenses[]`, `onWithdraw`, `onDelete`
- Renders all expense rows
- Withdrawn rows visually dimmed
- Each row: Name, Amount, Date, Recurring badge, Status, Actions

**`ExpenseSummaryBar`**
Props: `totalAdded`, `totalWithdrawn`, `totalPending`
- Three inline stats shown above the expense table

**`RecurringTemplateCard`**
Props: `template`, `currentMonthStatus`, `onAddForMonth`, `onEdit`, `onDelete`
- Card for one recurring expense template
- Shows current month status and the correct action button

---

### 4.6 Utility Components

**`EmptyState`**
Props: `title`, `description`, `actionLabel` (optional), `onAction` (optional)
- Used in any table or list with no data
- Shows a centered message with optional call-to-action button

**`LoadingSpinner`**
- Full-page or inline loading indicator
- Used while Firestore data is being fetched

**`ErrorBanner`**
Props: `message`
- Inline error display for failed reads or writes
- Uses shadcn `Alert` with destructive variant

**`CurrencyDisplay`**
Props: `amount`, `showSign` (optional)
- Formats a number as currency with the app's configured currency label
- e.g. "AED 1,250.00"
- Optional `showSign` for +/- prefix (used in difference calculations)

**`PageHeader`**
Props: `title`, `subtitle` (optional), `actions` (slot for buttons)
- Consistent top-of-page header used on every screen
- Right slot for primary action buttons (e.g. "Add Household")

---

### 4.7 Auth Components

**`GoogleSignInButton`**
- Triggers Firebase Google Sign-In popup
- Shows loading state during auth

**`AuthGuard`**
- Wrapper component used at the layout level
- Checks auth state and admin status on every render
- Redirects to Sign-In or Access Denied as needed
- Shows a loading state while the check is in progress

---

## Appendix: Key Rules Summary

| Rule | Detail |
|---|---|
| Multiple payments per family per month | ✅ Allowed — totaled for display |
| Edit a payment | ❌ Not in v1 — delete and re-add |
| Automatic recurring expense creation | ❌ Not in v1 — manual trigger only |
| Undo a withdrawal | ❌ Not in v1 |
| Family-facing portal | ❌ Not in v1 |
| Admin management UI | ❌ Not in v1 — done in Firebase Console |
| Changing default target affects existing families | ❌ No — new families only |
| Deleting a family removes its Firestore document | ❌ No — soft delete only (`active: false`) |
| Deleting a family removes its payments | ❌ No — payments are fully preserved and still count |
| Family ID can be reused after deletion | ❌ No — ID is permanently reserved |
| Inactive family payments count toward money on hand | ✅ Yes — money received is always accounted for |
| Inactive families count toward targets or status | ❌ No — excluded from active counts and totals |
| Deleting a household deletes everything under it | ✅ Yes — permanent hard delete |
| Currency conversion | ❌ No — display label only |

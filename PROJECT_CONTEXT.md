# Project Context — Veeramangalam Juma Masjid Household Finance Dashboard

A snapshot of the entire repo: what it is, what it runs on, how it's laid out, and the rules it follows.

---

## 1. What it is

A **single-admin web dashboard** for tracking monthly family contributions, expenses, and an all-time "money on hand" balance for the **Veeramangalam Juma Masjid**.

- Auth-gated: Google sign-in + an `admins` allow-list
- Hierarchy: **Household → Family → Member** (members are per-family, not per-household)
- Money on hand is a running total stored on `settings/global`, updated atomically
- Three tracked feature specs (`specs/001…003`); the dashboard is the latest iteration

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16.2.7** (App Router) |
| UI runtime | **React 19.2.4** + **TypeScript 5** (strict) |
| Styling | **Tailwind 4** + **shadcn/ui** (Radix-nova preset, `neutral` base) |
| Icons | `lucide-react` |
| Backend / DB | **Firebase 12** — Auth + Firestore |
| Forms | `react-hook-form` 7 + `@hookform/resolvers` + **Zod 4** (service-layer guards) |
| Dates | `date-fns` 4 (month key `YYYY-MM`) |
| i18n | Custom React context over `src/messages/{en,ar,ml,ta}.json` |
| Unit tests | **Vitest 3** + Testing Library |
| E2E | **Playwright 1** (Firestore/Auth emulators) |
| Deploy | Vercel (auto on push) + `firebase deploy --only firestore:rules,firestore:indexes` |

**Notable:** `next lint` script exists; the project warns in `AGENTS.md` that this is "NOT the Next.js you know" and points at `node_modules/next/dist/docs/` for breaking changes.

---

## 3. Folder structure

```
jamia-site/
├── AGENTS.md                       # Agent rules (Next.js warning + Spec-Kit hook)
├── CLAUDE.md                       # Just "@AGENTS.md"
├── README.md                       # Project README
├── PROJECT_CONTEXT.md              # ← this file
├── notes.md                        # Working notes (Note A/B/C — race + cascade + phase ordering)
├── main spec.md                    # Full product spec (v1)
│
├── components.json                 # shadcn config (radix-nova, neutral)
├── next.config.ts                  # (empty config object)
├── next-env.d.ts
├── tsconfig.json                   # strict; paths "@/*" → "./src/*"
├── postcss.config.mjs              # Tailwind 4 postcss
├── playwright.config.ts
├── vitest.config.ts
│
├── package.json                    # scripts: dev/build/start/typecheck/test/test:e2e/emulators:start/seed:settings/lint
├── package-lock.json
├── pnpm-lock.yaml + pnpm-workspace.yaml   # leftover workspace files (npm is in use)
│
├── firebase.json                   # emulator ports: auth 9099, firestore 8080, ui 4000
├── .firebaserc
├── firestore.rules                 # security rules (mirrored from specs/.../contracts/firestore.rules)
├── firestore.indexes.json
├── firestore-debug.log
│
├── .env.local / .env.local.example / a.env copy.local   # Firebase web SDK keys
├── .gitignore
├── .vscode/
│
├── .github/
│   ├── copilot-instructions.md
│   ├── agents/
│   ├── commands/
│   └── prompts/
│
├── .specify/                       # Spec-Kit config + templates + workflows
│   ├── extensions.yml
│   ├── init-options.json
│   ├── integration.json
│   ├── extensions/
│   ├── integrations/
│   ├── memory/
│   ├── scripts/
│   ├── templates/
│   └── workflows/
│
├── public/                         # stock next.svg, vercel.svg, etc.
│
├── scripts/
│   └── seed-settings.ts            # writes settings/global defaults
│
├── specs/                          # Three feature specs
│   ├── 001-household-finance-dashboard/   # v1 — current dashboard
│   │   ├── spec.md
│   │   ├── plan.md
│   │   ├── tasks.md
│   │   ├── data-model.md
│   │   ├── research.md
│   │   ├── quickstart.md
│   │   ├── checklists/
│   │   └── contracts/
│   ├── 002-members-expenses-calendar/     # v2 — members + calendar
│   └── 003-payment-spillover/             # v3 — payment spillover (coverageGroupId)
│
├── src/
│   ├── app/                        # Next App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   ├── (app)/                  # Authed shell (layout.tsx)
│   │   │   ├── dashboard/
│   │   │   ├── households/
│   │   │   ├── expenses/
│   │   │   ├── recurring/
│   │   │   ├── calendar/
│   │   │   ├── settings/
│   │   │   └── debug/
│   │   └── (auth)/                 # Public shell (layout.tsx)
│   │       ├── sign-in/
│   │       └── access-denied/
│   │
│   ├── components/                 # Feature-grouped UI
│   │   ├── auth/
│   │   ├── nav/
│   │   ├── summary/
│   │   ├── households/
│   │   ├── payments/
│   │   ├── expenses/
│   │   ├── recurring/
│   │   ├── calendar/
│   │   ├── settings/
│   │   └── ui/                     # shadcn primitives
│   │
│   ├── lib/
│   │   ├── firebase/client.ts      # Firebase web SDK init
│   │   ├── hooks/                  # useAuth, useFirestoreCollection, useMoneyOnHand, useCalendarMonth
│   │   ├── i18n/                   # I18nProvider, config, index
│   │   ├── schemas/                # Zod schemas (admin, household, family, familyMember, …)
│   │   ├── services/               # ALL Firebase writes go through here (see §5)
│   │   ├── types/                  # Shared TS types
│   │   ├── utils/                  # currency.ts, dates.ts
│   │   └── utils.ts                # cn() helper for Tailwind
│   │
│   └── messages/
│       ├── README.md
│       ├── en.json
│       ├── ar.json
│       ├── ml.json
│       └── ta.json
│
├── tests/
│   ├── setup.ts
│   ├── helpers/seed.ts             # Firestore seed used by E2E
│   ├── unit/                       # 20 files — services, schemas, ui, utils
│   └── e2e/                        # 9 specs — sign-in, record-payment, family-members,
│                                    #   soft-delete-family, withdraw-expense, withdraw-recurring,
│                                    #   expense-type, all-time-expense-toggle, calendar
│
├── test-fail.md                    # Last test/typecheck log
└── .next/                          # build output (gitignored)
```

---

## 4. Data model (Firestore)

```
admins/{uid}                  email, displayName, role: 'owner' | 'admin'
settings/global               defaultContributionTarget, openingBalance, currency, moneyOnHand
households/{householdId}      name, createdAt, createdBy
 └─ families/{familyId}       name, contributionTarget, memberCount, memberNames,
                              active, deletedAt, deletedBy, createdAt, createdBy, updatedAt, updatedBy
     ├─ payments/{paymentId}  amount, month, recordedAt, recordedBy, [coverageGroupId]
     └─ memberHistory/{id}    append-only: previousCount/Names → newCount/Names
expenses/{expenseId}          name, amount, date, month, note,
                              type: 'household' | 'mosque', householdId, familyId?, mosqueSubCategory?,
                              isRecurring, recurringId?, withdrawn, withdrawnAt, withdrawnBy,
                              addedAt, addedBy
recurringExpenses/{templateId} name, amount, type, householdId?, mosqueSubCategory?, active,
                              createdAt, createdBy
```

**Rules of the road (enforced by `firestore.rules` + service layer):**

- `households/{id}` carries **identity only** — no member fields. `update: false`.
- `families/{id}` `update` only allows three transitions, expressed as `affectedKeys().hasOnly([…])`:
  1. soft-delete (active false, deletedAt, deletedBy)
  2. name/target edit
  3. member edit (memberCount + memberNames, names.size() == count)
- `payments` and `memberHistory` are **append-only** for create/update; payments can be hard-deleted, member history cannot.
- `expenses` create enforces a **type/linkage XOR** — `household` ⇔ `householdId is string & mosqueSubCategory == null`; `mosque` ⇔ `householdId == null & familyId == null & mosqueSubCategory ∈ {maintenance, salary, other}`.
- `expenses` update is restricted to **withdraw** (sets `withdrawn=true` + timestamps) — every other field must be byte-equal to `resource.data`.
- `admins.create` is intentionally permissive on shape; the **service layer in `admins.ts` enforces "only the first user can self-promote"** via a transaction that reads collection size first.

---

## 5. Architecture rules

These are the project's hard-won invariants:

- **UI never calls Firebase directly.** All writes route through `src/lib/services/*`, which keep business invariants (soft-delete, family ID reservation, money-on-hand formula, month-key derivation) in one testable place.
- **Live data:** every screen subscribes via `onSnapshot` (no TanStack Query).
- **Money on hand** is updated inside a `runTransaction` to avoid races (Note B in `notes.md`).
- **Household cascade delete** uses chunked batches of 500 (Note A) — Firestore batches cap at 500 ops.
- **Soft delete for families**, hard delete allowed for households, expenses, and payments. Member history is immutable.
- **First admin bootstrap:** `admins.ts` is the only gate — "the first signed-in user can self-promote; after that, only admins can manage admins."
- **i18n** via custom `I18nProvider` + JSON catalogs in `src/messages/` (en/ar/ml/ta). Legacy `// TODO(i18n)` tags still exist on some strings per README.

### Service layer (`src/lib/services/`)

```
admins.ts              # bootstrap, list, role changes
households.ts          # create, soft-delete, cascade
families.ts            # create, edit name/target, edit members (writes memberHistory)
payments.ts            # add, delete, spillover coverage
expenses.ts            # add, withdraw (type/linkage-aware)
recurring.ts           # templates
settings.ts            # read/write settings/global
moneyOnHand.ts         # transactional running total
dashboardData.ts       # household + monthly summary rollups
derived.ts             # pure derived calculations
calendarView.ts        # calendar month aggregation
coverage.ts            # coverage-group (spillover) helpers
shortfall.ts           # monthly shortfall computation
shortfallSubscription.ts  # live shortfall subscription
memberHistory.ts       # member-history writes
index.ts               # barrel export
```

### Hooks (`src/lib/hooks/`)

`useAuth`, `useFirestoreCollection`, `useMoneyOnHand`, `useCalendarMonth` — the only React-aware data primitives.

---

## 6. Specs in flight

| # | Title | Status cue |
|---|---|---|
| 001 | Household Finance Dashboard | Core domain — implemented (admin/role rules, soft-delete, money-on-hand, transactions) |
| 002 | Members, Expenses, Calendar | Members, expense type/linkage, calendar — partially implemented (`familyMember*` schemas, `expenses.ts` XOR, `calendarView.ts`) |
| 003 | Payment Spillover | `coverageGroupId` (UUID) on payments, `coverage.ts` service — referenced in `firestore.rules` line 158 |
| 004 | Excel Export | Implemented. Pure builder at `src/lib/services/excelExport.ts`, browser client at `excelExportClient.ts`, hook `useExcelExport`, shared `ExportButton` / `FullReportButton` / `PerScreenExportButton` in `src/components/excel/`. Per-screen "Export to Excel" + "Export families" / "Export payments" / "Export expenses" / "Export recurring" buttons across the data screens. New "Show soft-deleted" toggle on the household detail page mirrors FR-010. No new Firestore collections / rules / indexes. UI strings carry inline `// TODO: localise this later` per project rule. |

---

## 7. Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local Next dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run test:watch` | Vitest watch |
| `npm run test:coverage` | Vitest + v8 coverage |
| `npm run test:e2e` | Playwright (needs `npm run emulators:start`) |
| `npm run emulators:start` | Firebase Auth (9099) + Firestore (8080) + UI (4000) |
| `npm run seed:settings` | Writes `settings/global` defaults via `scripts/seed-settings.ts` |
| `npm run lint` | `next lint` |

> Legacy `pnpm-lock.yaml` + `pnpm-workspace.yaml` are checked in, but `package-lock.json` and npm are the active toolchain.

---

## 8. Test posture (per `test-fail.md`)

- **Vitest unit:** ✅ **20 files / 79 passed / 4 skipped** — covers services (admins/families/payments/expenses/recurring/settings/moneyOnHand/shortfall/calendarView), schemas (incl. `expense.discriminatedUnion`), utils, helpers, ui (toast, form), and the quickstart smoke test.
- **Playwright E2E:** 9 specs wired up — `sign-in`, `record-payment`, `family-members`, `soft-delete-family`, `withdraw-expense`, `withdraw-recurring`, `expense-type`, `all-time-expense-toggle`, `calendar`.
- **`tsc --noEmit`:** ❌ currently failing on 3 files — known issues to clean up next session:
  - `src/components/households/MembersSection.tsx:42` — `string` not assignable to `never`
  - `src/lib/services/dashboardData.ts:27` — `HouseholdSummary` shape mismatch (missing `memberCount/memberNames/updatedAt/updatedBy` on `household` field)
  - `src/lib/services/expenses.ts:108,122` — `unknown` not assignable to `Record<string, unknown>`
  - `tests/unit/services/shortfall.test.ts` — `asOf: FieldValue` vs `Timestamp` (serverTimestamp leak in test input)

---

## 9. Open work / TODO markers

- `// TODO(i18n)` strings (per README) — not all copy is yet in `src/messages/`.
- Specs 002 and 003 are partially in flight (calendar, spillover coverage, expense type/linkage).
- Typecheck regressions listed above.
- Stray `pnpm-workspace.yaml` / `pnpm-lock.yaml` can likely be removed if the project is npm-only.

---

## 10. Where to start (cheat sheet)

- **New dev reading the code:** `README.md` → `main spec.md` → `src/lib/services/index.ts` → `src/lib/services/moneyOnHand.ts` (most subtle file).
- **Adding a collection / new write:** add Zod schema in `src/lib/schemas/`, service in `src/lib/services/`, then mirror the rule in `firestore.rules` + `specs/.../contracts/firestore.rules`.
- **Adding a screen:** drop a route in `src/app/(app)/<area>/page.tsx`, use the existing `useFirestoreCollection` + service functions, no direct `getFirestore()` calls.
- **Changing money-on-hand math:** re-read Note B in `notes.md` first; everything must stay inside `runTransaction`.

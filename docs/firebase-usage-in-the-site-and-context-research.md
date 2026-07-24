# Firebase Usage in the Site — Context & Research

**Project:** Veeramangalam Juma Masjid Household Finance Dashboard (`jamia-site`)  
**Firebase project ID:** `jamia-674ec` (`.firebaserc`)  
**Document date:** 2026-07-13  
**Scope:** Current implementation only. This report documents how Firebase is used today; it does not evaluate alternatives or propose changes.

---

## 1. Site context

### 1.1 What the application is

`jamia-site` is a **single-admin web dashboard** for the Veeramangalam Juma Masjid. It tracks:

- Monthly family contributions (payments per household/family)
- Expenses (household-linked and mosque-wide)
- Recurring expense templates
- Ad-hoc contributions
- A running **money on hand** balance
- Calendar and budget-shortfall views

There is **no family-facing portal**. Only approved administrators can access financial data after Google sign-in.

### 1.2 Domain hierarchy

```
Household
  └── Family
        ├── Members (stored on family doc: memberCount, memberNames)
        ├── Payments (sub-collection)
        └── Member history (sub-collection, append-only)
```

Top-level collections also hold expenses, recurring templates, contributions, global settings, and the admin allow-list.

### 1.3 Feature specs (product scope)

The codebase is organized around numbered specs under `specs/`:

| Spec | Focus |
|------|-------|
| `001-household-finance-dashboard` | Core dashboard, households, families, payments, expenses, money on hand |
| `002-members-expenses-calendar` | Per-family members, expense types (household/mosque), calendar view, shortfall |
| `003-payment-spillover` | Multi-month payment coverage via `coverageGroupId` |
| `004-excel-export` | Excel export (reads Firestore-backed data via services; no separate Firebase product) |

Firestore rules and indexes are versioned in spec contract folders and mirrored at the repo root for deployment.

---

## 2. Framework and technical stack

| Layer | Technology |
|-------|------------|
| Framework | **Next.js 16.2.7** (App Router) |
| UI | **React 19.2.4**, **TypeScript 5** (strict) |
| Styling | Tailwind 4, shadcn/ui (Radix) |
| Forms / validation | react-hook-form 7, Zod 4 |
| Dates | date-fns 4 (`YYYY-MM` month keys) |
| Backend data | **Firebase 12** — Auth + Firestore (client SDK) |
| Server auth verification | **firebase-admin 14** — ID token verification + admin doc lookup |
| File attachments (receipts) | **Vercel Blob** — not Firebase Storage |
| Unit tests | Vitest 3 |
| E2E tests | Playwright 1 (against Firebase emulators) |
| Hosting | Vercel (auto-deploy on push) |
| Firebase deploy | `firebase deploy --only firestore:rules,firestore:indexes` |

### 2.1 Architectural rule

**UI components do not call Firebase directly.** All reads and writes go through `src/lib/services/*`, which enforce business invariants (soft-delete, month-key derivation, money-on-hand atomicity, coverage groups, etc.). This is stated in `README.md` and `PROJECT_CONTEXT.md`.

**Live data pattern:** Screens subscribe via Firestore `onSnapshot` listeners. There is no TanStack Query or similar caching layer.

---

## 3. Firebase products in use

| Firebase product | Used? | Role |
|------------------|-------|------|
| **Authentication** | Yes | Google sign-in (`signInWithPopup`) |
| **Cloud Firestore** | Yes | Primary database for all app data |
| **Firebase Admin SDK** | Yes | Server-side ID token verification; admin doc check on API routes |
| **Firebase CLI / config** | Yes | Rules, indexes, local emulators |
| **Firebase Storage** | **No (in application code)** | Rules file exists (`storage.rules`) but the app stores receipt files in Vercel Blob. Client init includes `storageBucket` in config but `getStorage` is never called. |
| **Cloud Functions** | No | — |
| **Firebase Hosting** | No | App is hosted on Vercel |
| **FCM / Analytics / Remote Config** | No | — |

---

## 4. Configuration

### 4.1 Repo files

| File | Purpose |
|------|---------|
| `.firebaserc` | Default project: `jamia-674ec` |
| `firebase.json` | Firestore rules/indexes paths; emulator ports (auth 9099, firestore 8080, storage 9199, UI 4000) |
| `firestore.rules` | Production security rules (mirrored from `specs/*/contracts/firestore.rules`) |
| `firestore.indexes.json` | Composite indexes for queries |
| `storage.rules` | Storage rules for `receipts/` paths (legacy/unused by current app code) |

### 4.2 Environment variables

**Client (browser) — `NEXT_PUBLIC_*`:**

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Web SDK config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Web SDK config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Web SDK config |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Web SDK config (present in init; Storage SDK not used) |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Web SDK config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Web SDK config |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATOR` | When `"true"`, connects Auth + Firestore to local emulators in the browser |
| `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST` | Auth emulator host (default `127.0.0.1`) |
| `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT` | Auth emulator port (default `9099`) |
| `NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST` | Firestore emulator host (default `127.0.0.1`) |
| `NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_PORT` | Firestore emulator port (default `8080`) |

**Server (Node.js / API routes):**

| Variable | Purpose |
|----------|---------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Single-line JSON service account for Admin SDK |
| `GOOGLE_APPLICATION_CREDENTIALS` | Alternative: path to service account file (local dev) |
| `FIREBASE_PROJECT_ID` | Optional Admin SDK project override |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token (receipt storage; exported from `admin.ts` helper, not a Firebase product) |

**Tests / scripts:**

| Variable | Purpose |
|----------|---------|
| `FIRESTORE_EMULATOR_HOST` | Set by `tests/setup.ts` to `127.0.0.1:8080` for Vitest emulator-backed tests |

Template: `.env.local.example`

### 4.3 SDK initialization

**Client — `src/lib/firebase/client.ts`**

- Singleton `initializeApp` with env-based config
- Exports `getFirebaseAuth()` and `getDb()` (Firestore)
- When `NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true"` and `typeof window !== "undefined"`, connects Auth and Firestore emulators
- Comment in file: receipt attachments use Vercel Blob, not Firebase Storage

**Admin — `src/lib/firebase/admin.ts`**

- Server-only; loads credentials from `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`
- Exports `getAdminAuth()`, `getAdminDb()`, and `getReceiptBlobToken()` (Vercel Blob env, colocated for receipt API routes)

---

## 5. Authentication

### 5.1 Sign-in flow

1. User opens `/sign-in`
2. `GoogleSignInButton` calls `signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider())`
3. `useAuth` hook listens to `onAuthStateChanged`
4. When a user is signed in, a second subscription reads `admins/{uid}` via `subscribeCurrentAdmin`
5. `AuthGuard` (in `src/app/(app)/layout.tsx`) redirects:
   - No user → `/sign-in`
   - User but no admin doc → `/access-denied`
   - User + admin doc → app shell

### 5.2 Authorization model

Authorization is **allow-list based**:

- A user is an admin iff document `admins/{request.auth.uid}` exists in Firestore
- Firestore rules use helper `isAdmin()` that checks this document
- Roles stored: `owner` | `admin` (same permissions in v1)

### 5.3 Admin management (Firestore writes)

`src/lib/services/admins.ts`:

| Function | Firestore operation |
|----------|---------------------|
| `getCurrentAdmin` | `getDoc(admins/{uid})` |
| `subscribeCurrentAdmin` | `onSnapshot(admins/{uid})` |
| `listAdmins` / `subscribeAdmins` | Read `admins` collection |
| `bootstrapFirstAdmin` | `setDoc(admins/{uid})` when collection empty (access-denied page) |
| `promoteToAdmin` | `setDoc(admins/{uid})` |
| `demoteAdmin` | `deleteDoc(admins/{uid})` |

### 5.4 Server-side auth (API routes)

`src/lib/server/verifyAdmin.ts`:

1. Reads `Authorization: Bearer <Firebase ID token>` header
2. `getAdminAuth().verifyIdToken(token)` → UID
3. `getAdminDb().doc('admins/{uid}').get()` → must exist
4. Used by `/api/receipts/upload`, `/api/receipts/download`, `/api/receipts/delete`, `/api/receipts/health`

Client-side `attachments.ts` obtains the ID token via `getFirebaseAuth().currentUser.getIdToken()` when calling those API routes.

---

## 6. Firestore data model

### 6.1 Collections and paths

| Collection / path | Document ID | Written by | Notes |
|-------------------|-------------|------------|-------|
| `admins/{uid}` | Google UID | `admins.ts` | Allow-list |
| `settings/global` | Fixed `global` | `settings.ts`, `moneyOnHand.ts`, `seed-settings.ts` | Singleton; includes `moneyOnHand` running total |
| `households/{householdId}` | Auto (`addDoc`) | `households.ts` | Soft-delete via `active: false` |
| `households/{hh}/families/{familyId}` | Auto (`addDoc`) | `families.ts` | Soft-delete; member census on doc |
| `households/{hh}/families/{fid}/payments/{paymentId}` | Auto or pre-allocated in txn | `payments.ts` | Append-only; optional `coverageGroupId` |
| `households/{hh}/families/{fid}/memberHistory/{id}` | Auto (batch) | `families.ts` | Append-only audit trail |
| `expenses/{expenseId}` | Auto | `expenses.ts`, `recurring.ts` | Withdraw / attach receipt updates |
| `recurringExpenses/{templateId}` | Auto | `recurring.ts` | Mosque templates |
| `contributions/{contributionId}` | Pre-allocated `doc()` | `contributions.ts` | Ad-hoc donations |

### 6.2 Attachment metadata (Firestore fields, files elsewhere)

Payments, expenses (after withdrawal), and contributions may store:

- `attachmentPath` — e.g. `receipts/payments/{docId}/{fileName}` (Vercel Blob path, not `gs://`)
- `attachmentFileName`
- `attachmentMimeType`

Binary files are uploaded to **Vercel Blob** via Next.js API routes. Firestore only stores path metadata.

### 6.3 Money on hand

Stored on `settings/global.moneyOnHand` as a **running total**, updated inside `runTransaction` alongside payment/expense/settings mutations (`moneyOnHand.ts`). Subscribed live via `subscribeMoneyOnHand` → `onSnapshot(settings/global)`.

### 6.4 Firestore operations used

Across services, the codebase uses:

- `getDoc`, `getDocs`
- `onSnapshot` (primary read pattern)
- `addDoc`, `setDoc`, `updateDoc`, `deleteDoc`
- `runTransaction` (payments, expenses withdraw/delete, settings, money on hand)
- `writeBatch` (family member updates + history)
- `collection`, `doc`, `query`, `where`, `orderBy`, `limit`
- `collectionGroup` (payments — spillover group lookup, money/shortfall-related queries)
- `serverTimestamp`

---

## 7. Security rules

Source of truth: `firestore.rules` (deployed); copies in `specs/*/contracts/firestore.rules`.

### 7.1 Access pattern

- **`isSignedIn()`** — `request.auth != null`
- **`isAdmin()`** — signed in AND `admins/{uid}` exists
- Almost all financial data: **read/write only if `isAdmin()`**
- Exception: any signed-in user may **read** their own `admins/{uid}` doc and **create** their own admin doc (bootstrap shape validation)

### 7.2 Write constraints (high level)

| Collection | Create | Update | Delete |
|------------|--------|--------|--------|
| `admins` | Self-create with shape check | Admin only | Admin only |
| `settings/global` | — | Admin; required fields | — |
| `households` | Admin; soft-delete fields | Soft-delete only | Admin |
| `families` | Admin; target/member invariants | Soft-delete, name/target edit, or member edit (separate `affectedKeys` sets) | Admin |
| `payments` | Admin; amount, month regex, optional `coverageGroupId` UUID | **Denied** | Admin |
| `memberHistory` | Admin; append-only shape | **Denied** | Admin (cascade) |
| `contributions` | Admin | **Denied** | Admin |
| `expenses` | Admin; type/linkage XOR; no attachment on create | Withdraw-only OR attach-receipt-after-withdraw | Admin |
| `recurringExpenses` | Admin; type/linkage | Admin; immutable `createdAt`/`createdBy` | Admin |

`storage.rules` defines admin-only read/write for `receipts/{entityType}/{docId}/{fileName}` with MIME and 5 MB limits — **not invoked by current application code** (Vercel Blob handles files).

---

## 8. Firestore indexes

Declared in `firestore.indexes.json`:

| Collection group | Fields | Typical use |
|------------------|--------|-------------|
| `expenses` | `month` ASC, `date` DESC | Monthly expense lists |
| `expenses` | `month` ASC, `withdrawn` ASC, `date` DESC | Monthly summary + filters |
| `expenses` | `recurringId` ASC, `month` ASC | Recurring template status |
| `expenses` | `type` ASC, `mosqueSubCategory` ASC, `month` ASC | Mosque expense filters |
| `expenses` | `householdId` ASC, `type` ASC, `month` ASC | Household expense queries |
| `payments` | `month` ASC, `recordedAt` DESC | Payment history by month |
| `payments` | `coverageGroupId` ASC, `recordedAt` DESC | Spillover group delete |
| `families` | `active` ASC, `name` ASC | Active family listing |
| `recurringExpenses` | `type` ASC, `active` ASC | Active mosque templates |

---

## 9. Service layer → Firebase mapping

All paths under `src/lib/services/`.

| Module | Firestore collections | Key Firebase patterns |
|--------|----------------------|------------------------|
| `admins.ts` | `admins` | `getDoc`, `onSnapshot`, `setDoc`, `deleteDoc` |
| `settings.ts` | `settings/global` | `onSnapshot`, `runTransaction` |
| `moneyOnHand.ts` | `settings/global` | `runTransaction`, `shiftMoneyOnHandInTx`, `onSnapshot` |
| `households.ts` | `households` | `addDoc`, `onSnapshot`, soft `updateDoc` |
| `families.ts` | `families`, `memberHistory` | `addDoc`, `writeBatch`, `onSnapshot`, `query`+`where`+`orderBy` |
| `payments.ts` | `payments` (nested + `collectionGroup`) | `runTransaction`, `onSnapshot`, spillover multi-doc writes |
| `expenses.ts` | `expenses` | `runTransaction`, `onSnapshot`, `query` filters |
| `recurring.ts` | `recurringExpenses`, `expenses` | `addDoc`, `onSnapshot`, `where` |
| `contributions.ts` | `contributions` | `setDoc`, `deleteDoc` |
| `derived.ts` | Multiple via subscriptions | Composes `onSnapshot` across families/payments/expenses |
| `dashboardData.ts` | `households` + derived summaries | `onSnapshot` on households, fans out summary subs |
| `shortfallSubscription.ts` | `settings`, `expenses`, `recurringExpenses`, collection groups | Multiple `onSnapshot` listeners |
| `calendarView.ts` | `recurringExpenses`, `expenses` | `onSnapshot`, composes shortfall + expense summary |
| `attachments.ts` | — (uses Firebase Auth token only) | `getIdToken()` for API routes; metadata written by other services |

Barrel export: `src/lib/services/index.ts`

---

## 10. Hooks and UI integration

| Hook / component | Firebase usage |
|------------------|----------------|
| `useAuth` | `onAuthStateChanged`, admin doc subscription via `admins.ts` |
| `useFirestoreCollection` | Generic `onSnapshot` on any collection path |
| `useContributions` | Direct `onSnapshot` on `contributions` ordered by `date` |
| `useHouseholdFinancialSummary` | Subscribes via `families.ts`, `payments.ts`, and direct `onSnapshot` on `expenses` |
| `GoogleSignInButton` | `signInWithPopup` |
| `AuthGuard` | Consumes `useAuth`; no direct Firebase calls |
| `access-denied/page.tsx` | `bootstrapFirstAdmin`, `isAdminsCollectionEmpty` |
| `debug/page.tsx` | Direct Firestore reads/writes for probing (`getDocs`, `getDoc`, `setDoc`, `updateDoc`) — admin-gated |

Screens under `src/app/(app)/` (dashboard, households, expenses, recurring, calendar, contributions, settings) consume data through service subscriptions or the hooks above.

---

## 11. API routes (Firebase Admin involvement)

| Route | Firebase Admin usage | Storage |
|-------|---------------------|---------|
| `POST /api/receipts/upload` | `verifyAdminRequest` → `verifyIdToken` + admin doc | Vercel Blob `put` |
| `GET /api/receipts/download` | Same verification | Vercel Blob `head` |
| `DELETE /api/receipts/delete` | Same verification | Vercel Blob `del` |
| `GET /api/receipts/health` | `verifyAdminRequest` + `getAdminAuth()` probe | Reports config flags only |

`getReceiptBlobToken()` lives in `src/lib/firebase/admin.ts` for convenience but reads `BLOB_READ_WRITE_TOKEN`, not a Firebase API.

---

## 12. Scripts and tooling

| Script | Command | Firebase usage |
|--------|---------|----------------|
| Local emulators | `npm run emulators:start` | `firebase emulators:start --only auth,firestore` |
| Seed settings | `npm run seed:settings` | `scripts/seed-settings.ts` — Web SDK `setDoc(settings/global)`; respects `FIRESTORE_EMULATOR_HOST` |
| Deploy rules/indexes | `firebase deploy --only firestore:rules,firestore:indexes` | Firebase CLI (documented in README) |

`firebase-tools` is a devDependency (`^15.19.1`).

---

## 13. Testing

### 13.1 Vitest

- `tests/setup.ts` sets `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` by default
- Emulator-backed tests use `describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)` and monkey-patch `getDb()` to point at a test Firestore instance
- Examples: `payments.atomicity.test.ts`, `payments.cascade.test.ts`, `expenses.atomicity.test.ts`, `households.delete.test.ts`, `families.test.ts`, `moneyOnHand.test.ts`, `seed.test.ts`
- `tests/helpers/seed.ts` seeds all collections via Firestore Web SDK against emulator

### 13.2 Playwright E2E

- Documented to require `npm run emulators:start`
- Specs under `tests/e2e/` exercise flows against emulator-backed environment

### 13.3 Types

`firebase/firestore` `Timestamp` type is imported in `src/lib/types/index.ts` and used across domain types.

---

## 14. Deployment topology

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Next.js client components)                        │
│  firebase/app · firebase/auth · firebase/firestore          │
│  Google Sign-In · onSnapshot listeners · service writes     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Firebase (project: jamia-674ec)                            │
│  · Authentication (Google provider)                           │
│  · Cloud Firestore (all app data + security rules)          │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────┐
│  Vercel (Next.js server)                                    │
│  · App Router pages + API routes                            │
│  · firebase-admin: verifyIdToken + admins/{uid} lookup      │
│  · @vercel/blob: receipt file storage                       │
└─────────────────────────────────────────────────────────────┘
```

- **App hosting:** Vercel
- **Firestore rules/indexes:** Deployed separately via Firebase CLI
- **Local dev:** Next.js dev server + optional Firebase emulators

---

## 15. File reference index

### Core Firebase modules

| Path | Role |
|------|------|
| `src/lib/firebase/client.ts` | Web SDK init (Auth + Firestore) |
| `src/lib/firebase/admin.ts` | Admin SDK init (Auth + Firestore) |
| `src/lib/server/verifyAdmin.ts` | Bearer token verification |
| `firebase.json` | CLI config + emulators |
| `.firebaserc` | Project ID |
| `firestore.rules` | Security rules |
| `firestore.indexes.json` | Composite indexes |
| `storage.rules` | Storage rules (not used by app code) |
| `.env.local.example` | Env var template |

### All source files importing Firebase (application code)

| Path |
|------|
| `src/lib/firebase/client.ts` |
| `src/lib/firebase/admin.ts` |
| `src/lib/server/verifyAdmin.ts` |
| `src/lib/hooks/useAuth.ts` |
| `src/lib/hooks/useFirestoreCollection.ts` |
| `src/lib/hooks/useContributions.ts` |
| `src/lib/hooks/useHouseholdFinancialSummary.ts` |
| `src/lib/services/admins.ts` |
| `src/lib/services/settings.ts` |
| `src/lib/services/moneyOnHand.ts` |
| `src/lib/services/households.ts` |
| `src/lib/services/families.ts` |
| `src/lib/services/payments.ts` |
| `src/lib/services/expenses.ts` |
| `src/lib/services/recurring.ts` |
| `src/lib/services/contributions.ts` |
| `src/lib/services/derived.ts` |
| `src/lib/services/dashboardData.ts` |
| `src/lib/services/shortfallSubscription.ts` |
| `src/lib/services/calendarView.ts` |
| `src/lib/services/attachments.ts` |
| `src/components/auth/GoogleSignInButton.tsx` |
| `src/app/(app)/debug/page.tsx` |
| `src/app/api/receipts/health/route.ts` |
| `src/app/api/receipts/upload/route.ts` |
| `src/app/api/receipts/download/route.ts` |
| `src/app/api/receipts/delete/route.ts` |
| `scripts/seed-settings.ts` |

### Test / seed files using Firebase

| Path |
|------|
| `tests/setup.ts` |
| `tests/helpers/seed.ts` |
| `tests/unit/services/payments.atomicity.test.ts` |
| `tests/unit/services/payments.cascade.test.ts` |
| `tests/unit/services/expenses.atomicity.test.ts` |
| `tests/unit/services/households.delete.test.ts` |
| `tests/unit/services/families.test.ts` |
| `tests/unit/services/moneyOnHand.test.ts` |
| `tests/unit/helpers/seed.test.ts` |

---

## 16. Summary

Firebase is the **authentication and database backbone** of `jamia-site`:

1. **Firebase Auth** — Google sign-in for administrators
2. **Cloud Firestore** — All persistent application state, real-time via `onSnapshot`, writes centralized in `src/lib/services/*`, protected by `firestore.rules` and composite indexes
3. **Firebase Admin SDK** — Server-side verification of ID tokens and admin allow-list checks on receipt API routes
4. **Firebase CLI + emulators** — Local development, testing, and deployment of rules/indexes

Receipt **file bytes** are **not** stored in Firebase; they use Vercel Blob with Firebase Auth tokens for authorization. `storage.rules` and `storageBucket` config remain in the repo but are outside the active application storage path.

The application is a Next.js 16 admin dashboard for mosque household finance, with a strict service-layer boundary over Firestore and live subscriptions as the primary data-fetching model.

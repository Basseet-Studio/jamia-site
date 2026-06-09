# Quickstart: Veeramangalam Juma Masjid Household Finance Dashboard

**Branch**: `001-household-finance-dashboard` | **Date**: 2026-06-09

Five-minute setup for a new contributor. From a fresh clone to a running dev environment.

---

## Prerequisites

- Node.js 20.x (`nvm use 20`)
- pnpm 9 (`npm i -g pnpm`)
- Firebase CLI 13+ (`npm i -g firebase-tools`)
- A Firebase project (Spark free tier is enough for v1)
- A Google account that will be the first admin

## 1. Clone and install

```bash
git clone <repo-url> jamia-site
cd jamia-site
pnpm install
```

## 2. Create the Firebase project

1. Go to https://console.firebase.google.com → Add project → name it `jamia-finance` (or whatever).
2. Enable **Authentication → Sign-in method → Google**.
3. Enable **Firestore Database** → start in production mode → pick the region nearest to the admin (e.g. `asia-south1`).
4. Note the project ID — you will use it as `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.

## 3. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```bash
NEXT_PUBLIC_FIREBASE_PROJECT_ID=jamia-finance
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=jamia-finance.firebaseapp.com
NEXT_PUBLIC_FIREBASE_APP_ID=1:xxxxxxxxxx:web:xxxxxxxxxx
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
```

Get those values from Firebase Console → Project settings → Your apps → Web app.

## 4. Bootstrap the first admin (owner)

This is the ONLY manual step. The spec's "Not in v1" rule says admin management is not in the app — you write the doc directly in Firestore.

1. Sign in to the running app once with the owner's Google account. The access-denied screen will show.
2. Open Firebase Console → Firestore → start a collection `admins` → document id = the owner's Google UID (find it in Firebase Console → Authentication → Users).
3. Add fields:

   ```
   email         "owner@example.com"
   displayName   "Owner Name"
   role          "owner"
   addedAt       <now>
   ```

4. Reload the app. The owner is now authorised and lands on the dashboard.

To add another admin, repeat steps 2-3 with their UID and `role: "admin"`.

## 5. Seed the settings singleton

```bash
pnpm seed:settings
```

This writes a `settings/global` document with sensible defaults:

```
defaultContributionTarget   500
openingBalance              0
currency                    "AED"
```

Edit it later from `/settings` in the app.

## 6. Run dev

```bash
pnpm dev
```

Open http://localhost:3000. Sign in with the owner Google account. You should land on the dashboard.

## 7. Run tests

```bash
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest run
pnpm test:e2e         # playwright test
```

E2E tests need the Firestore emulator:

```bash
pnpm emulators:start  # in another terminal
pnpm test:e2e
```

## 8. Deploy

### Deploy rules + indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### Deploy the app to Vercel

1. Push the branch to GitHub.
2. Import the repo in Vercel.
3. Add the same environment variables from `.env.local` in Vercel → Settings → Environment Variables.
4. Deploy. Vercel auto-detects Next.js 15.

## 9. Smoke test after deploy

Sign in with the owner account, create a household, add a family, record a payment, add an expense, withdraw it. Confirm:
- Money on hand updates in < 3s (SC-002, SC-003)
- Dashboard cards reflect the new totals
- The household detail screen shows the family's status badge

## Common gotchas

- **Access denied for the owner**: confirm the `admins/{uid}` doc exists with the EXACT Google UID (not the email).
- **"Missing or insufficient permissions" on write**: re-check `firestore.rules` is deployed (`firebase deploy --only firestore:rules`).
- **Money on hand not updating**: hard refresh — the `onSnapshot` listeners are per-tab.
- **Time zone surprises**: all times in the app are the browser's local zone. If the admin is abroad, they will see the wrong "today" for payments. Out of scope for v1; see `data-model.md` §8.

## Where to look

- `data-model.md` — every entity, field, validation, derived value
- `contracts/firestore.rules` — the access contract
- `contracts/service-interface.ts` — the service interface the UI must use
- `specs/001-household-finance-dashboard/spec.md` — the product spec
- `main spec.md` — the original product spec (data layer, business logic, screens, components)

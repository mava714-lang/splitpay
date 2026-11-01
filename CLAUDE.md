# CLAUDE.md — SplitPay Codebase Guide

## Project Overview

SplitPay is a mobile-first web app for splitting restaurant bills among groups. Users upload a receipt photo (or enter items manually), add participants, and share a room code via WhatsApp. Each person joins on their own device and selects which items they consumed. The app calculates totals per person including proportional tip.

**Target audience:** Spanish-speaking users in Chile.
**Deployment platform:** Vercel (serverless functions + static SPA).
**Backend:** Firebase Realtime Database (no dedicated server).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 18 (JSX, no TypeScript) |
| Build | Vite 5 |
| State | React `useState` / `useEffect` (no Redux/Zustand) |
| Database | Firebase Realtime Database v10 |
| OCR API | Anthropic Claude Sonnet (vision) via Vercel serverless |
| Deployment | Vercel (SPA + serverless function) |
| Fonts | Bricolage Grotesque (headings), Nunito (body) via Google Fonts |

---

## Repository Structure

```
splitpay/
├── api/
│   └── ocr.js            # Vercel serverless function — calls Anthropic API
├── src/
│   ├── auth.js           # Optional Google sign-in (Firebase Auth): watchAuth, loginWithGoogle, logout
│   ├── main.jsx          # React entry point
│   ├── App.jsx           # Entire app (single file, ~1020 lines)
│   ├── firebase.js       # Firebase init and config
│   └── db.js             # Firebase helpers (rooms, claims, paid, contacts, owner, user history)
├── tests/
│   └── database.rules.test.mjs  # Security-rules tests (Firebase emulator)
├── public/
│   └── manifest.json     # PWA manifest
├── index.html            # HTML shell, Google Fonts, dark bg (#06080c)
├── vite.config.js        # Vite config (React plugin, dist output)
├── database.rules.json   # Firebase Realtime Database security rules (source of truth)
├── firebase.json         # Firebase CLI config (rules deploy + emulator)
├── vercel.json           # SPA rewrite rules, /api/ocr route, 30s timeout
├── package.json          # Scripts and dependencies
└── README.md             # Setup + deployment instructions (Spanish)
```

---

## Architecture: Single-File App

The entire frontend lives in `src/App.jsx`. It renders one of 8 views based on a `view` state string. There are no separate route files, page components, or component directories.

### Views (in order of user flow)

| `view` value | Description |
|---|---|
| `"home"` | Entry screen — upload photo, manual entry, or join room |
| `"processing"` | OCR in progress — shows animated progress ring |
| `"setup"` | Review/edit extracted items, set tip %, add participants |
| `"roomCreated"` | Displays room code, copy buttons, WhatsApp message |
| `"form"` | Participant selects items and quantities |
| `"formDone"` | Confirmation + prompt for next person |
| `"dashboard"` | Real-time breakdown per person, full receipt, export summary |
| `"history"` | List of rooms the signed-in user created/joined (`users/{uid}/rooms`) |
| `"profile"` | Signed-in user's profile / logout |
| `"privacy"` | Privacy policy (also reachable at `/privacidad`; bypasses onboarding) |
Two "screens" are **not** `view` values and short-circuit rendering before it:
- `showOnboarding` — 4-slide tutorial (persisted via `localStorage` key `sp_onboarded`).
- `!urlChecked` — "Cargando..." while the `/sala/CODE` URL is being resolved.

Render order of the `if` blocks: onboarding → loading → `home` → `processing` → `setup` → `roomCreated` → `form` → `formDone` → `dashboard`. (`joinEntry` in a code comment is unused.)

Navigation happens via `setView("...")` calls — no React Router. The one exception is deep links: a `useEffect` reads `window.location.pathname`; `/sala/CODE` loads the room and jumps straight to `form`. `vercel.json` rewrites make this work, and the WhatsApp invite message contains this URL (`getRoomURL`).

### Claim lifecycle (form / dashboard)

- `form` lists **all** people in the dropdown; confirmed ones are marked `✓ (editar)`. Choosing one preloads `myQtys` from their claim (`loadClaim`), and `isEditing` becomes true.
- While editing, `remainQty` adds back the person's own previous quantity so they can keep/lower it.
- `submitForm` overwrites `claims/{personId}` (Firebase `set`). `removeMyClaim` deletes it (`deleteClaim` in `db.js`), returning the person to pending.
- `myQtys` keys: item id → qty for individual items; `"sh_" + itemId` → `1` for shared items (stripped of the prefix when saved).
- `editClaim(pid)` is the entry point from the dashboard ("Editar selección de X") and `formDone` ("Corregir mi reclamo", uses `lastSubmittedPerson`). `isEditing` is derived (`selPerson` already has a claim); there is no separate editing flag.
- `justUpdated` switches the `formDone` copy to "¡Actualizado!" after an edit.
- The dashboard has a "Boleta completa" section: every item with claimed/total, who took it, and shared-item splits.
- **Optional Google login** (`auth.js`, `authChip`, `matchPersonId`): a signed-in user is auto-matched to a person by name when that person has no claim yet; rooms are saved to `users/{uid}/rooms` for the history view. Login is never required to use a room.
- **Room editing after creation**: `loadRoomForEditing` / `saveRoomEdits` (`updateRoom`) reuse the `setup` state to change items, people and tip of an existing room.
- **Payments**: organizer may add transfer data (`payment`) in setup / edit room, only with an explicit consent checkbox. Diners see `payCard` ("Transfiere $X a …", copy buttons) on `formDone` and mark "Ya transferí" (`rooms/{code}/paid/{pid}`, subscribed in real time). Anyone can toggle paid from the dashboard.
- **Phones (personal data)**: optional, collected on `formDone` via `phoneCard` with an explicit consent checkbox; stored in `contacts/{code}/{pid}` (never under `rooms/`). The device that saved it can delete it (`sp_contact_{code}_{pid}` in localStorage).
- **Ownership**: `rooms/{code}/ownerUid` is set at creation if the organizer is signed in, or later on the creator device (`sp_owner_{code}` in localStorage) after Google login. Only the owner can read `contacts/{code}`; the dashboard then shows "Recordar" `wa.me` links (`reminderText`).
- No identity/auth for claims: anyone with the link can edit anyone's claim (accepted trade-off). Concurrent edits are last-write-wins.

### Inline UI Component System

Small UI building blocks are defined inline in `App.jsx` as arrow functions:

- `Shell` — main container with max-width 480px
- `Hdr` — sticky header with back button
- `Card` — rounded card container
- `Btn` / `GBtn` — primary / ghost buttons
- `Inp` / `Sel` — text input / select element
- `Tag` — badge/chip
- `Fab` — floating action button
- `Ring` — SVG circular progress indicator
- `Stepper` — quantity +/- control
- `Lbl` — section label

The theme object `T` holds all colors and font families. Use it instead of hardcoded values.

---

## Firebase Data Model

All data lives under `rooms/{code}`:

```js
{
  code: "ASADO-X1F2",
  restaurant: "El Buen Comer",
  branch: "Providencia",
  tipPercent: 10,
  createdAt: 1704067200000,
  items: [
    { id: "abc123", name: "Coca Cola Zero", qty: 2, unitPrice: 2900, shared: false }
  ],
  people: [
    { id: "xyz789", name: "Juan", avatar: "🦊" }
  ],
  claims: {
    "xyz789": {
      items:  { "abc123": 1 },   // item id → qty consumed
      shared: { "def456": 1 },   // shared item id → 1 if participating
      confirmedAt: 1704067200000
    }
  }
}
```

Additional fields/paths:

```js
rooms/{code}: {
  ownerUid: "googleUid",            // optional; set once (rules forbid changing/removing it)
  payment: { name, rut, bank, accountType, accountNumber, email, consentAt, consentVersion }, // optional, public to room
  paid: { "personId": { at: 1704067200000 } }
}
contacts/{code}/{personId}: { phone: "+569XXXXXXXX", consentAt, consentVersion }  // owner-only read
users/{uid}/rooms/{code}: { code, restaurant, branch, total, createdAt, accessedAt } // self-only
```

Database helpers live in `src/db.js`. Firebase is initialized in `src/firebase.js` with the project config hardcoded (public Firebase config keys are safe to commit).

---

## OCR Serverless Function

**File:** `api/ocr.js`
**Route:** `POST /api/ocr`
**Auth:** Requires `ANTHROPIC_API_KEY` environment variable (set in Vercel dashboard).

Flow:
1. Receives `{ image: "<base64>", mediaType: "image/jpeg|image/png" }`.
2. Sends to Claude Sonnet (model id set in `api/ocr.js`, currently `claude-sonnet-4-6`) vision with a prompt to extract Chilean restaurant receipt data.
3. Returns `{ restaurant, branch, items: [{ name, qty, unitPrice }] }`.

The frontend compresses images to max 1200px before sending. JSON is extracted with a fallback regex if Claude wraps the response in markdown.

---

## Development Workflow

### Setup

```bash
npm install
npm run dev       # starts Vite dev server at http://localhost:5173
```

### Production Build

```bash
npm run build     # outputs to dist/
npm run preview   # preview the production build locally
```

### Deployment

The app deploys automatically to Vercel on push to `main`. No manual deploy step needed after initial Vercel project setup.

Environment variables required in Vercel:
- `ANTHROPIC_API_KEY` — Anthropic API key for OCR function

### Local OCR Testing

The `/api/ocr` serverless function does **not** run locally with `npm run dev`. To test OCR locally, use the [Vercel CLI](https://vercel.com/docs/cli):

```bash
npx vercel dev
```

---

## Key Conventions

### Styling

- All styles are inline (no CSS files, no CSS modules, no Tailwind).
- Use the `T` theme object for colors and fonts — never hardcode hex values.
- The design is dark-first with `#06080c` background.
- Accent color: `#22c55e` (green). Secondary accents: orange `#f97316`, yellow `#eab308`, red `#ef4444`.
- Max content width: `480px` (mobile-first).

### State Management

- All state is in `App.jsx` via `useState`. No context, no global store.
- Only `rooms/{code}/claims` is subscribed in real time (`subscribeToClaims`, imported as `fbSub`, in a `useEffect` on `[roomCode]`). Items, people and tip are read once (`getRoom`) or via `refreshRoom` (🔄).
- `items`, `ppl`, `tp`, `claims` are derived as `roomData?.x || localState`.

### IDs

- Room codes: `"WORD-XXXX"` (random word from a fixed list + 4 random chars), e.g. `ASADO-A1B2`.
- Item/person IDs: `uid()` = 6 uppercase alphanumeric chars.

### Language

- All UI text is in **Spanish**. Keep it that way.
- Chilean Spanish conventions apply (e.g., "boleta" for receipt).

### Calculations

- Tip is distributed proportionally to each person's subtotal.
- Shared items are split equally among all claimants for that item.
- `remaining qty = item.qty - sum(all claims for that item)`.

### Personal Data & Privacy (Ley 21.719, Chile)

- **Never store personal data (phones, emails, RUTs of diners…) under `rooms/`** — everything there is readable by anyone with the room code. Use a separate path with restrictive rules, like `contacts/`.
- Every new personal-data field needs: an explicit, unchecked-by-default consent checkbox linking to the privacy policy, `consentAt` + `consentVersion` stored with the data, a way to delete it, and an update to the privacy view.
- When the privacy text changes, bump `PRIVACY_VERSION` in `App.jsx`. Contact for data requests: `PRIVACY_CONTACT`.
- Never write `undefined` into Firebase (`set` rejects it): delete the key instead.

### Security Rules

- `database.rules.json` is the source of truth. It is **published automatically** by `.github/workflows/firebase-rules.yml` on push to `main` (tests in the emulator → prints current rules as backup → publishes via `scripts/firebase-rules.mjs`). Requires the GitHub secret `FIREBASE_SERVICE_ACCOUNT` (service account JSON with the "Firebase Realtime Database Admin" role). The workflow can also be run manually with `mode: show` to inspect the published rules.
- Run `tests/database.rules.test.mjs` (instructions in the file) after any rules change.

### Testing

No unit-test framework yet (prefer **Vitest** + React Testing Library when adding one). Security rules have emulator tests in `tests/`.

---

## Important Files to Read Before Editing

| Task | Read first |
|------|-----------|
| Any UI change | `src/App.jsx` (full file) |
| Database operations | `src/db.js`, `src/firebase.js` |
| OCR logic | `api/ocr.js` |
| Routing / deployment | `vercel.json`, `vite.config.js` |

---

## Common Pitfalls

- **Do not add a router.** Navigation uses `setView()` by design.
- **Do not extract components into separate files** unless the user explicitly requests a refactor. The single-file approach is intentional.
- **Firebase config keys are intentional** in `src/firebase.js` — Firebase public config is not a secret.
- **The OCR function is Chilean-receipt-specific.** The Claude prompt targets boletas/facturas; adjust the prompt if expanding to other regions.
- **`vercel.json` rewrites** ensure all non-API paths serve `index.html`. Don't break this when adding new API routes.
- **Security depends on Firebase Realtime Database rules** (`database.rules.json`). The client config is public by design; room codes are the only access control for `rooms/`.
- **OCR progress bar is fake** (fixed jumps in `processOCR`), not real progress.
- **`tipPercent` is stored as a number (e.g., `10` for 10%)**, not a decimal.

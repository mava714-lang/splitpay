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
│   ├── main.jsx          # React entry point
│   ├── App.jsx           # Entire app (single file, ~1020 lines)
│   ├── firebase.js       # Firebase init and config
│   └── db.js             # Firebase database helpers
├── public/
│   └── manifest.json     # PWA manifest
├── index.html            # HTML shell, Google Fonts, dark bg (#06080c)
├── vite.config.js        # Vite config (React plugin, dist output)
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
| `"dashboard"` | Real-time breakdown per person, export summary |
| *(onboarding overlay)* | 4-slide tutorial shown on first visit |

Navigation happens via `setView("...")` calls — no React Router.

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

Database helpers live in `src/db.js`. Firebase is initialized in `src/firebase.js` with the project config hardcoded (public Firebase config keys are safe to commit).

---

## OCR Serverless Function

**File:** `api/ocr.js`
**Route:** `POST /api/ocr`
**Auth:** Requires `ANTHROPIC_API_KEY` environment variable (set in Vercel dashboard).

Flow:
1. Receives `{ image: "<base64>", mediaType: "image/jpeg|image/png" }`.
2. Sends to Claude Sonnet 4 vision with a prompt to extract Chilean restaurant receipt data.
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
- Real-time Firebase subscriptions are set up with `onValue` and cleaned up on unmount.
- `subscribeToToClaims()` is the main real-time listener for the dashboard.

### IDs

- Room codes: `"WORD-XXXXXXXX"` (random word prefix + 8 random chars).
- Item/person IDs: `Math.random().toString(36).slice(2, 9)`.

### Language

- All UI text is in **Spanish**. Keep it that way.
- Chilean Spanish conventions apply (e.g., "boleta" for receipt).

### Calculations

- Tip is distributed proportionally to each person's subtotal.
- Shared items are split equally among all claimants for that item.
- `remaining qty = item.qty - sum(all claims for that item)`.

### No Testing Framework

There are currently no automated tests. When adding tests, prefer **Vitest** (Vite-native) with React Testing Library.

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
- **`tipPercent` is stored as a number (e.g., `10` for 10%)**, not a decimal.

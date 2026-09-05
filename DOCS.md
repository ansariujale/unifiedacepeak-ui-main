# Running Locally

## Prerequisites

- Node.js `>= 22.16.0`
- npm `>= 11.4.1`

(see [package.json](package.json) `engines`)

## 1. Install dependencies

```bash
npm install
```

This also runs `husky` via the `prepare` script to install the git hooks in `.husky/`.

## 2. Environment variables

[vite.config.ts](vite.config.ts) points Vite's `envDir` at `/etc/mycountrymobile-web` instead of the project root, so secrets (Stripe, PayPal, HubSpot, WhatsApp, Turnstile) never sit inside a folder that could be committed or shared.

Before running the app, create a `.env` file there:

- Linux/macOS: `/etc/mycountrymobile-web/.env`
- Windows: `<drive-root>\etc\mycountrymobile-web\.env` (e.g. `C:\etc\mycountrymobile-web\.env`, matching whatever drive you run the dev server from)

with the following keys set:

```
VITE_API_BASE_URL=
VITE_NOTIFICATION_SOCKET_URL=
VITE_CHAT_SOCKET_URL=
VITE_AI_SOCKET_URL=
VITE_AI_URL=
VITE_AI_PORTAL_HOST=
VITE_APP_ENV=
VITE_APP_SLUG=
VITE_APP_DOMAIN=
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_PAYPAL_CLIENT_ID=
VITE_TEMPLATE_BASE_URL=
VITE_HUBSPOT_CLIENT_ID=
VITE_HUBSPOT_SCOPE=
VITE_HUBSPOT_REDIRECT_URL=
VITE_WHATSAPP_CHAT_TOKEN=
VITE_TURNSTILE_SITE_KEY=
VITE_WHITEBOARD_BASE_URL=
VITE_TEXT_TO_SPEECH_CHAR_LENGTH=
```

Ask whoever manages deployment for the actual values — they are not stored in this repo. `VITE_API_BASE_URL` and the socket URLs must point at a reachable backend; there is no bundled mock server in this project.

Optional: set `VITE_CROSS_ORIGIN_ISOLATION=true` (in the same `.env`) to have the dev server send `Cross-Origin-Embedder-Policy`/`Cross-Origin-Opener-Policy` headers.

## 3. Run the dev server

```bash
npm run dev
```

Vite serves the app at `http://localhost:5173` by default.

## Other scripts

| Command | What it does |
| --- | --- |
| `npm run build` | Type-checks (`tsc -b`) then builds a production bundle with Vite |
| `npm run preview` | Serves the production build locally |
| `npm run lint` | Type-checks then runs ESLint |

## Tests

Tests are plain Node scripts under [tests/](tests/) (no framework, no backend/browser required) — each one compiles the relevant `src/lib/*.ts` module with `esbuild` and runs a `*-test.cjs` file against it. See [tests/README.md](tests/README.md) for the exact command per module.

## Repo layout notes

- `src/` — the app itself (Vite + React)
- `tests/` — standalone logic tests, see above
- `backend-patches/`, `ops/`, `scripts/`, `docs/`, `deliverables/` — auxiliary backend snippets, ops runbooks, one-off scripts, and planning docs; not part of the built frontend

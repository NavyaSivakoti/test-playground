# Test Playground

A public, reproducible web app for exercising test-automation steps against realistic, hard-to-automate UI. It covers a broad catalog of natural-language test step types, and any browser-automation tool can use it.

- **Every page reports what really happened.** The *Observable state* panel (`#tp-state`, JSON in its `data-state` attribute) records the real effect of each action: the option actually selected, the file actually received (name, size, SHA-256), the column a card was actually dropped in. A step that "passes" without effect shows up as unchanged state.
- **Every trap is a URL parameter**, off by default, so the same URL always reproduces the same page.
- **Every run can be isolated** with its own namespace (`?ns=`), and fully reset.

## Pages
- **Scenarios:** identity verification (camera and document upload), upload variants, an iframe lab, a widget zoo, timing traps, sign-in and roles, an admin data grid, downloads, tabs/windows/dialogs, a REST API explorer, procurement approvals with a canvas workflow builder, online store checkout, shadow DOM, a chat assistant, canvas and visual state, accessibility issues, heavy pages, parallel runs, console and network evidence.
- **Step baselines (`/steps/*`):** clean targets for each step family (navigation, click, input, select, verify, variables, loops, waits, scroll, alerts, windows, frames, storage, upload, download, extension, camera, AI, API, auth, drag). A failure here is a step problem, not an app trap.
- **General UI (`/ui/*`):** forms, toggles, tabs/accordions/steppers, menus, lists/trees, CRUD, booking, media, feedback, browser APIs, settings, survey, dashboard, checkout, and an odd-locators gallery.
- **System:** `/coverage` (step coverage matrix, also at `coverage/steps.csv`), `/system/reset`, `/system/drift`, `/samples?for=<page>`.

## Trap controls
| Param | Effect |
|---|---|
| `seed=42` | drives every random thing; same seed = same DOM (default `1`) |
| `unstableIds=true` | ids change on every render (deterministically per seed) |
| `unstableClasses=true` | class names change on every render (styling never depends on classes) |
| `duplicateLabels=true` | decoy elements with the same visible label |
| `overlay=true&overlayMs=1500` | transparent overlay that intercepts clicks for N ms after load |
| `popup=cookie,gotit,promo,survey&popupDelay=2000` | popups at an exact time (`popupRandom=true` = seeded random time) |
| `renderDelay=2000` / `netDelay=1500` | late content / slow data |
| `shuffle=true` | lists shuffled by seed |
| `variant=b` | drifted layout and labels (for self-heal testing) |
| `device=mobile` | mobile-only gate |
| `now=2026-10-06T10:00:00Z` | frozen clock |
| `bugs=cartTotal,savePersist,toastText,brokenLink,api500,consoleError` | deliberate functional bugs (app bug vs test problem) |
| `env=staging` | staging banner / data |
| `stress=true` | all traps at once |
| `ns=run42` | data namespace |

The footer of every page shows a **Repro URL** with the full active configuration, which is also written to `<html data-tp-config>`.

**Self-heal without changing the URL:** open `/system/drift?ns=X` and switch the namespace to variant b. Every page opened with `?ns=X` drifts, so a recorded test can rerun unchanged.

## Fixtures
Served from `<base>/fixtures/`:
- **ID card images:** front (green) and back (blue), as `png`, `jpg`, `y4m` and `mjpeg`.
- **Data files:** CSVs, `line-items.xlsx` (total 510.50), `invoice.pdf` (total $510.50).
- **Test data:** registration/survey data in `testdata/`.
- **Extension:** a test browser extension (`extension/test-extension.zip`).

The ID card pages detect which side was captured by colour, so a test can prove which camera file was used. All data is fictional.

Regenerate with `npm run gen:fixtures` (needs Python with `openpyxl`, and `ffmpeg`).

## Local development
```bash
npm install
npm run dev          # http://localhost:5199/test-playground/
npm run test:e2e     # Playwright suite (fake camera fed from fixtures/front.y4m)
npm run build        # dist/ with one folder per route (static hosting friendly)
```
Without a backend the app runs in **local mode**: server-backed features use browser storage, and the banner says so.

## Backend (optional)
The backend provides real HTTP endpoints for REST/API steps, HTTP Basic auth, a mock inbox (or real email), namespaces, reset, server-side drift, and a real Postgres for database-verification steps. It is one Deno function (`backend/api/index.ts`) plus one SQL migration (`backend/migrations/0001_playground.sql`), so it runs on any Deno-compatible serverless host with any Postgres database. Free tiers are enough.

1. Create a Postgres database and apply `backend/migrations/0001_playground.sql` (for example with `psql "$DATABASE_URL" -f …`). If `pg_cron` isn't available, drop the last statement and clean up old namespaces another way.
2. Deploy `backend/api/index.ts` with the environment variables:
   - `DATABASE_URL`;
   - optionally `SITE_URL`, to redirect `/openapi.json`;
   - optionally `EMAIL_API_URL`, `EMAIL_API_KEY` and `EMAIL_FROM`, for real OTP email.
3. In the repo settings, set the variables `API_URL` (the function's base URL, ending in `/api`) and optionally `API_KEY`, then redeploy the site.
4. Optional, for database-verification steps: `alter role playground_reader with login password '<choose one>';`, then give that read-only connection to your test tool. Never commit it.

Endpoints are listed in `docs/PAGE_CONTRACT.md` and `public/openapi.json`.

## Contributing pages
See `docs/PAGE_CONTRACT.md`. In short:
- one `*.page.tsx` file per route;
- record every real effect in the observable state;
- use `useTraps()` for ids and classes;
- everything random comes from the seed;
- generic names only: no real company, customer, product or person names anywhere.

## License
MIT

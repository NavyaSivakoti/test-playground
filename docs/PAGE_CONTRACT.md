# Page contract

Every page in the playground follows these rules. They keep pages reproducible, keep failures easy to diagnose, and keep the public repo free of private information.

## File layout
- A page is `src/pages/<area>/<Name>.page.tsx`. It exports `meta: PageMeta` (from `src/core/registry.ts`) and a default component. Routes are discovered automatically, so **never edit `App.tsx`, `registry.ts` or anything in `src/core` / `src/components`**.
- Helper components only used by your pages go next to them, in files **not** ending in `.page.tsx` (e.g. `src/pages/scenarios/identity/Camera.tsx`).
- The default component renders only the page body. The shell (title, summary, sample-tests link, Observable state panel) is added automatically. Use `meta.bare = true` (plus `hidden: true`) for content loaded inside iframes or child windows.
- `meta.path` starts with `/` and has no trailing slash. The deployed URL is `<base><path>/`, e.g. `https://…/test-playground/steps/click/`.

## Naming: no private information
- Never use the name of any real company, customer, product or person in UI text, code, comments, file names or test data. Use generic names ("Identity verification", "Procurement approvals", "Network admin console", "Learning portal", "CRM console", "Chat assistant", "Sidebar add-in").
- No ticket ids, chat links or internal URLs anywhere.
- People in sample data are fictional or historical computer scientists (Ada Lovelace, Grace Hopper…). Emails use `example.com`.

## Observable state: the most important rule
- Every meaningful user action must write its **real effect** to the page state with `usePageState().merge({...})` (or `set`). Examples: the value actually selected, the file name, size and sha256 actually received, the node's new column after a drop, the keys actually pressed, a counter of real clicks.
- A test then checks `#tp-state`'s `data-state` attribute (JSON). "Step passed but nothing happened" must be visible as unchanged state.
- State values are serialisable JSON. Don't store huge blobs (no data URLs over ~2 KB).

## Locators and traps: use `useTraps(scope)` from `src/core/tp.tsx`
- `t.id('name')` for every `id` attribute; it becomes unstable with `unstableIds=true`.
- `t.cls('block block--mod')` for every `className`; it becomes random with `unstableClasses=true`. **Never style with class names.** Styling uses plain elements and `data-ui` / `data-variant` / `data-tone` attributes (see `src/index.css`), or inline styles.
- `t.dup` is true with `duplicateLabels=true`: render a decoy element with the same visible label next to the real one (the decoy writes `decoy` into state if clicked).
- `t.v(a, b)` chooses by variant. Variant **b** must drift the page: different label text (e.g. "Save" → "Save changes"), different order or position, different ids and test ids, an extra wrapper. Every page with interactive targets supports variant b in at least 2–3 places.
- `t.shuffle(list, key)` for lists that may be shuffled. `t.rand(key)` gives a deterministic random number. `t.numericId('input')` gives CRM-style `input-1234` ids, `t.uuid('field')` gives UUID-like names.
- `useDelayed(ms?)` is true after `ms`, defaulting to the global `renderDelay`. Use it for content that should arrive late.
- `useConfig()` gives the full config: `seed`, `ns`, `overlay`, `popups`, `netDelay`, `bugs` and so on. Use `nowMs(config)` instead of `Date.now()` for anything shown to the user (frozen clock support).
- Global traps (overlay, popups, help widget, console-error bug) are already rendered by the shell; don't duplicate them.
- **Everything random must come from the seed.** Never use `Math.random()` or `Date.now()` for anything rendered.

## Deliberate bugs (`bugs=` param)
Only implement a bug where it fits your page:
- `cartTotal`: total off by one item;
- `savePersist`: Save shows success but doesn't persist;
- `toastText`: wrong toast wording;
- `brokenLink`: a link to a 404;
- `api500`: a request fails with 500.

## Data and backend
- Use `backend` from `src/core/backend.ts` for server-backed records (`list/create/update/remove` by kind), email (`sendEmail`/`inbox`) and namespaces. It works in local mode, with no server.
- Browser storage keys and cookie names **must** be prefixed with the namespace: `nsKey(config, 'token')` gives `default_token`.
- Pages with in-memory state that must survive a reset listen with `useResetListener(config.ns, cb)` from `src/core/reset.ts`.

## Shared UI
`src/components/ui.tsx` provides:
- `Field`, `Card`, `Badge` and `Modal` (portal, Esc to close);
- `useToast()` for toasts with a `data-testid="toast"`;
- `fileInfo(file)` (name/size/type/sha256);
- `publicUrl('fixtures/sample.csv')` for absolute fixture URLs.

`src/core/detect.ts` tells the green FRONT sample from the blue BACK sample in an image, video frame or canvas.

## Fixtures (`public/fixtures`, served at `<base>fixtures/…`)
- **ID images:** `front.png|jpg|y4m|mjpeg` (green, "FRONT"), `back.*` (blue, "BACK").
- **Images:** `avatar.png`, `receipt.png`, `heavy.png` (~2.8 MB).
- **Data files:** `sample.csv` (name,email,role; 10 rows), `bad-missing-email.csv`, `bad-empty.csv`, `notes.txt`, `line-items.xlsx` (5 items, total 510.50), `line-items-bad-headers.xlsx`.
- **Documents:** `invoice.pdf` (INV-2026-0042, 5 line items, total $510.50), `terms.pdf`.
- **Test data:** `testdata/registration.csv|xlsx`, `testdata/survey.csv`.
- **Extension:** `extension/test-extension.zip` (adds a "Test extension active" banner and `data-tp-extension="active"` on `<html>`).
- **Totals:** `expected.json` holds the known totals.

## meta fields
- `title`, `group` (`'Step baselines' | 'Scenarios' | 'General UI' | 'System'`), `summary` (1–2 sentences; **do not quote target labels**, because the summary is on the page).
- `covers`: the step-type ids this page is a target for (see `src/coverage/steps.json`; its `page`, `target` and `expected` columns are the spec for /steps pages).
- `samples`: 2–8 sample tests. `steps` are written in exact step-template wording, e.g.:
  - `Click on "Save"`
  - `Enter Ada in the "First name" field`
  - `Wait until the text "Saved" is present on the current page`
  - `Verify that the "Status" displays text "Paid"`
  - `Select option by text "Germany" in the list "Country"`
  - `Upload the file at "#file-plain" from URL <base>fixtures/sample.csv with name sample.csv`

  `expected` describes the state or text to check. `<base>` is replaced with the deployed base URL. Use `query` for trap params.
- `mock: true` for simulated integrations (OTP, SSO, captcha, SMS).
- `order` sorts within the group.

## Accessibility of targets
- Prefer real labels (`<label>` around or `htmlFor`) and real buttons, so label-based test steps can find targets, **except** where a page deliberately tests something harder (div-buttons with no role, icon-only buttons and so on). Say so in a visible hint.
- Every visible target label should be unique on the page unless the page deliberately tests duplicates.

## Tests
- Each agent writes Playwright tests in `tests/<area>.spec.ts` using `tests/helpers.ts` (`go`, `pageState`, `expectState`). The dev server already runs on port 5199; run only your file: `npx playwright test tests/<area>.spec.ts`.
- Test at least one real effect per page, plus one trap variant (e.g. `variant=b` or `unstableIds=true`) where relevant.
- Type-check with `npx tsc -p tsconfig.app.json --noEmit`. Don't run `npm install`, `vite build` or edit `package.json`.

## Requirements docs
For each page, write `docs/requirements/<path-with-dashes>.md` (e.g. `steps-click.md`), 10–30 lines: purpose, user stories, acceptance criteria (Given/When/Then), and the trap params that apply. These feed requirements-based test generation and knowledge bases.

## Server endpoints (backend function `backend/api/index.ts`; base = `API_BASE` from `src/core/backend.ts`, null in local mode)
| Method + path | Purpose |
|---|---|
| `GET /health` | `{ ok: true, version }` |
| `GET/POST /records?ns=&kind=` | list / create records (JSON body = data) |
| `PATCH/DELETE /records/:id?ns=` | update / delete |
| `GET/POST /state?ns=&page=` | observable page state |
| `GET/POST /config?ns=` | server-side drift override |
| `POST /reset?ns=` | delete everything for ns, returns `{ records }` |
| `GET /inbox?ns=` · `POST /inbox/send?ns=` | mock inbox (real email when EMAIL_API_URL / EMAIL_API_KEY / EMAIL_FROM are set) |
| `GET /basic` | HTTP Basic Auth (tester / playground), then text "Authenticated as tester" |
| `GET /slow?ms=3000` | responds after ms (max 15000) |
| `GET /status/:code` | responds with that HTTP status and a JSON body |
| `POST /echo` | echoes JSON body, headers subset and query |
| `GET /customers` · `GET /customers/:id` | static seeded customers (same rows as the `public.customers` table) |
| `POST /auth/login` | `{ username, password }` → `{ token }` for the seeded users; `GET /me` with `Authorization: Bearer` |
| `GET /openapi.json` | OpenAPI 3 spec of all of the above |

Seeded users (also in `src/core/users.ts`): `admin@example.com`, `approver@example.com`, `viewer@example.com`, all with password `Playground!1`. These are public test accounts.

In local mode, pages must still work: show a clear "Backend not configured – showing local simulation" hint, and simulate the response in the browser where possible.

## Words to avoid
Do not name third-party products or platforms in UI text, code or comments either. Say "CRM-style ids", "enterprise SSO" or "payment provider" instead of a vendor name.

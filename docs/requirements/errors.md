# Console and network evidence (`/errors`)

**Purpose:** a page with a known, exact set of console and network events, to check that run evidence (console log, network log) is captured correctly.

## User stories
- As a tester I compare the run's console log with the list on the page.
- As a tester I trigger failing, slow and erroring actions and find them in the evidence.

## Acceptance criteria
- On load exactly four messages are logged once: console.log "[tp] errors page loaded", console.info "[tp] info: 3 widgets initialised", console.warn "[tp] warning: legacyFormat() is deprecated", console.error "[tp] error: optional widget "news-feed" failed to load" (state.loadLogged = 4).
- "Trigger 404 request" fetches fixtures/does-not-exist.json → 404 ("404 request finished (status 404)").
- "Trigger 500" calls /status/500 on the backend, or in local mode logs console.error "[tp] simulated 500 from /status/500".
- "Trigger slow request" takes ≥ 3 s (backend /slow?ms=3000, or a delayed fixture fetch locally).
- "Throw uncaught error" and "Unhandled promise rejection" produce an uncaught Error and an unhandled rejection.
- A broken image (state.brokenImage = true) and a broken link are on the page.
- Every trigger is appended to state.events with the expected console/network entry.

## Trap params
`variant=b` (relabelled triggers), `unstableIds`, `unstableClasses`, `bugs=consoleError` (adds the global console error).

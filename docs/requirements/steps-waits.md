# Waits (/steps/waits)

**Purpose:** content and requests that arrive late, for wait steps.

## User stories
- As a tester I can wait for text, element states, images and network idle instead of using fixed sleeps.

## Acceptance criteria
- "Results ready" appears after `renderDelay` ms, or 2500 ms when renderDelay is not set; state.resultsReady = true.
- An elapsed clock shows whole seconds since the page opened.
- "Late button" is visible after 2 s and enabled after 4 s; clicking sets state.lateButtonClicked = true.
- Six images load; the last gets its source after 3 s; state.imagesLoaded = 6 when all have loaded.
- "Start background requests" fires 5 requests at 0.3–2.5 s; state.requestsDone = 5 when all finish.

## Trap params
`renderDelay=<ms>`, `variant=b` (late button id, extra label, card title), `unstableIds`, `unstableClasses`.

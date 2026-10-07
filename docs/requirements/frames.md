# Iframe lab — `/frames`

**Purpose:** frames as real apps use them, with every frame message recorded in the page state.

## User stories
- As a document author I use an add-in panel (iframe `sidebar-addin`) to insert text into the document.
- As a tester I reach controls inside three nested frames, a frame whose name changes, a hover-only menu in a frame, an opaque-origin sandboxed widget and a long scrolling frame.

## Acceptance criteria
- Given the add-in frame, when I click "Insert", then the document shows "Hello from the add-in" and state.inserts increments.
- Given frames nest-1 → nest-2 → nest-3, when I type in "Deep field" and click "Deep button", then state.deep = { value, clicks }.
- Given unstableIds=true, then the dynamic frame is named `frame-<token>`, seeded and different on each reload; clicking "Confirm" increments state.dynamicConfirms.
- Given the hover-menu frame, when I hover "Actions" and click "Export", then state.menu = "Export".
- Given the "Cross-origin widget" (sandbox without allow-same-origin), when I click "Send ping", then state.ping increments and state.pingOrigin = "null".
- Given the long frame, when I scroll inside it and click "Far button", then state.farClicks increments.
- Given overlay=true, then clicks on the add-in are intercepted until overlayMs passes (html[data-tp-intercepted-clicks]).

## Trap params
`variant=b` (embeds rename labels and ids: "Insert into document", "More actions", "Innermost field"), `unstableIds`, `overlay`, `overlayMs`, `seed`.

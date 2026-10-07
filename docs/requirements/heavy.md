# Heavy and slow pages (`/heavy`)

**Purpose:** tune timeouts and wait strategies against a huge DOM, a large image, late content and a long-running request.

## User stories
- As a tester I render a 10,000-row table and verify its last row.
- As a tester I wait for content that only appears after 10 s and for a request that answers after 8 s.

## Acceptance criteria
- "Render 10k rows" renders 10,000 rows × 4 cells (state.renderedRows = 10000, state.domNodes > 40000, state.renderMs). With `?autoload=1` the table renders on load (state.autoload = true).
- The ~2.8 MB image fixtures/heavy.png loads (state.image.loaded = true, naturalWidth).
- 10 s after load "Slow section loaded" appears (state.slowSectionMs ≥ 10000).
- A long-poll request starts on load (and with "Start long poll") and returns after ~8 s: "Long poll returned 10 rows" (state.longPoll.ms ≥ 8000).

## Trap params
`autoload=1`, `variant=b` ("Render 10,000 rows"), `unstableIds`, `unstableClasses`.

# Loops and conditions (/steps/loops)

**Purpose:** controls with a known number of iterations for while-loops, plus query flags for IF and AI-verification steps.

## User stories
- As a tester I can loop while an element is enabled, visible, not visible, or while an input does or doesn't contain a value, and the loop ends after a known count.

## Acceptance criteria
- "Load more" adds 5 items per click and is disabled after 5 clicks; state.loaded = 25.
- "Next page" is removed on page 4; state.pageNumber = 4.
- After 3 clicks on "Process one", "All done" shows.
- 4 requests show "Pending"; each "Approve next" approves one; state.approved = 4.
- "+1" raises "Counter" from 0; it reaches 5 after 5 clicks.
- "Mode" goes draft -> draft-reviewed -> published, so a "contains draft" loop runs exactly 2 times.
- "Locked action" is disabled until "Unlock step" is clicked 3 times.
- With `?promo=1`, "Promo available" and "Claim promo" show; clicking sets state.claimed = true.
- The header shows "Venues (7)"; with `?empty=1` it shows "Venues (0)"; with `?staleHeader=1` the list is empty but the header still says 7 (deliberate inconsistency; state.venueCount vs state.venueHeaderCount).

## Trap params
`promo=1`, `empty=1`, `staleHeader=1`, `variant=b` (card title, ids, extra progress hint), `unstableIds`, `unstableClasses`.

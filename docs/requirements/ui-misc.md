# Odd locators gallery (/ui/misc)

**Purpose:** each card isolates one locator pattern that commonly breaks recorded tests, with a target and a click counter in state.hits so a "passed" step that hit nothing is visible.

## Patterns
Split text ("Sub" + "mit"), visible text vs aria-label ("Go" / "Proceed to next step"), CSS ::before text ("Continue"), text-transform uppercase ("Download report"), non-breaking space ("Save draft") and zero-width space ("Publish"), icon-only SVG button (SVG title "Gear icon"), div without role ("Apply filter"), hidden display:none clone before the real "Confirm", off-screen checkbox with a visible proxy label ("I accept the terms"), duplicate data-testid="action-btn" (Approve/Reject), CRM-style numeric ids (input-1234, "Account name"), UUID name attributes ("Reference code"), 15 nested wrapper divs ("Deep target"), a list shuffled per seed, and "View details" rendered as a link or plain text depending on the seed.

## Acceptance criteria
- Given any card, when its target is activated, then state.hits.<key> increments (or records the chosen value) and the card's counter updates.
- When the hidden "Confirm" clone is clicked instead of the real one, then state.hits.hiddenConfirm is set and realConfirm is not.
- When "I accept the terms" is clicked, then state.offscreenChecked = true.
- When values are typed into "Account name" and "Reference code", then state.accountName / state.referenceCode record them with the generated id/name.
- Given shuffle=true, then the list order is the same for the same seed; clicking an item records state.hits.list.
- state.linkRendered tells whether "View details" is a link for this seed.

## Trap params
`seed`, `shuffle=true`, `unstableIds` (numeric ids and UUIDs change per render), `unstableClasses`, `variant=b` (cards in reverse order, "Submit form", "Apply filters").

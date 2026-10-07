# Typing, clearing and keys (/steps/input)

**Purpose:** baseline target for enter, fill, clear, Tab order and key-press steps.

## User stories
- As a tester I can type into, fill and clear fields and press single keys, key combinations and repeated keys.

## Acceptance criteria
- When I enter "Ada Lovelace" in "Full name", then state.fullName = "Ada Lovelace".
- Given focus in "Full name", when I press Tab, then "Email" is focused (state.focused = "email").
- When I fill "ada@example.com" in "Email" (prefilled with old text), then state.email = "ada@example.com".
- When I clear "Prefilled name" and the "Prefilled notes" textarea, then state.prefilled = "" and state.notes = "".
- When I type in "Search box" and press Enter, then state.searchSubmitted is the query.
- When I open "Open modal" and press Esc, then the dialog closes, state.modalOpen = false and state.lastKey = "Escape".
- Given focus in "Key log", when I press Shift+Delete, then state.lastKey = "Shift+Delete"; ArrowDown gives "ArrowDown".
- When I press ArrowUp 3 times in "Quantity" (starts at 1), then state.quantity = 4.
- When I press Backspace 4 times at the end of "Code" ("ABCDEFGH"), then state.code = "ABCD".
- When I clear all chips from "Tags", then state.tags = [].

## Trap params
`variant=b` ("Open dialog", "Search" label, wrapped fields, new ids), `unstableIds`, `unstableClasses`.

# Search, lists, tree and drag to reorder (/ui/lists)

**Purpose:** list interactions on seeded, deterministic data: 60 products in 5 categories, with prices from the seed.

## User stories
- As a shopper, I can search with suggestions (300 ms debounce), filter by category chips, sort and page through results (10 per page).
- As a reader, I can use "Load more" in News and scroll an infinite activity log (20 more entries each time, up to 200).
- As a user, I can expand a file tree and select folders with tri-state checkboxes.
- As a planner, I can drag items to reorder a list (HTML5 drag and drop, or pointer events with ?dnd=pointer) and move cards between "To do", "In progress" and "Done".

## Acceptance criteria
- When I type "lamp", then suggestions appear after 300 ms. Picking "Aurora Lamp" gives state.resultsCount = 1.
- Given the Monitors chip and "Price: high to low", then state.resultsCount = 12 and "Next page" sets state.page = 2.
- When I search for "zzz", then "No results for “zzz”" is shown and state.resultsCount = 0.
- When I check "Reports", then state.selectedNodes holds both reports and "Documents" is indeterminate.
- When I drag "Echo" onto "Alpha", then state.order = ["Echo","Alpha","Bravo","Charlie","Delta"].
- When I drag "Write release notes" to "Done", then state.board["Write release notes"] = "Done".

## Trap params
`shuffle=true` (product order), `seed` (prices), `variant=b` (search label "Find a product", different pager labels), `dnd=pointer`, `unstableIds`, `unstableClasses`.

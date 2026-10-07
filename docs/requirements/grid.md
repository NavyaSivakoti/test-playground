# Network admin console (`/grid`)

**Purpose:** an enterprise data grid (AG-style) that is hard to automate: virtualized rows, split header/body scrolling, hover-only actions and pagination below the fold.

## User stories
- As an operator I filter, sort and page through 500 devices.
- As an operator I rename a device inline and confirm the change.
- As an operator I export the devices that match my filter to CSV.

## Acceptance criteria
- 500 deterministic devices (hostname, IP, protocol UDP/TCP, status online/offline/disabled as icons with aria-labels, last seen from the page clock); only the rows in view exist in the DOM.
- Given text in "Filter devices", then only matching rows remain (state.filter, state.matching) and the page resets to 1.
- When I click a column header, rows sort ascending, a second click sorts descending (state.sort).
- Row actions "Edit", "Reboot", "Delete" are invisible until the row is hovered (state.lastAction).
- "Select all" selects every row on the current page (state.selected.count).
- Pagination ("Rows per page", "Previous page", "Next page", "Page 1 of N") sits below the fold (state.page, state.pageSize).
- Given I double-click a hostname, type a new name and press Enter, then "Save changes?" appears; "Save" stores the change via the backend so it survives a reload (state.edits[].persisted = true); "Cancel" keeps the old name.
- Given `bugs=savePersist`, "Save" still shows "Changes saved" but state.edits[].persisted = false and a reload restores the old name.
- Given `conflict=1`, the first save shows "Edited by another user" with "Overwrite" / "Discard my changes" (state.conflict).
- "Export CSV" downloads devices-filtered.csv (or devices-all.csv) with all matching rows (state.lastExport.rows, sha256).

## Trap params
`variant=b` (IP column first, "Search devices", "Download CSV", "Next"/"Previous"), `unstableIds`, `unstableClasses`, `seed`, `now`, `ns`, `bugs=savePersist`, `conflict=1`.

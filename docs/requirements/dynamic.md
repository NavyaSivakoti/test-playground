# Dynamic content lab — `/dynamic`

**Purpose:** timing and re-rendering problems that make steps flaky.

## User stories
- As a user I wait for results, fill a form, save, refresh data, use a menu, enter a shipping address and load more results while the page keeps changing.

## Acceptance criteria
- Given the page loads, then "Results ready" appears after renderDelay (2500 ms when the URL does not set it).
- Given "Name" is empty, then "Submit" is disabled; after entering a name and submitting, state.submitted is the name.
- Given overlay=true, when I click "Save" during overlayMs, then the click is intercepted; afterwards state.saved = true. It also works after dismissing popup=gotit.
- Given the "Refresh data" button is replaced by a new node 1 s after load, when I click it once, then state.refreshClicks = 1.
- Given the open menu, when I double click "Close menu" (which sits on top of "Save draft" and closes on mousedown), then state.saveDraftClicks ≥ 1.
- Given the shipping address loads after renderDelay (2000 ms default), then text typed before "Address loaded" is replaced (state.addressOverwritten) and text typed after stays (state.address).
- Given "Show toast", then "Changes applied" shows for 2 s. "Covered button" starts under a sticky header; "Moving target" moves 150 px after 1.5 s; "Load more results" adds 5 results after netDelay.

## Trap params
`renderDelay`, `netDelay`, `overlay`, `overlayMs`, `popup=gotit`, `variant=b` ("Send", "Save changes", "Reload data", "Show more results"), `bugs=savePersist,toastText`, `unstableIds`.

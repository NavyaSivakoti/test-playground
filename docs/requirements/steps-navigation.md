# Navigation (/steps/navigation)

**Purpose:** baseline target for page-load, URL, title, history and screenshot steps.

## User stories
- As a tester I can wait for a slow page, check the URL and title, and use browser Back, Forward and Refresh.
- As a tester I can tell DOMContentLoaded, load and network idle apart.

## Acceptance criteria
- Given `?slow=3000`, when the page opens, then the heading "Navigation page loaded" appears after about 3 s and state.loadedAfterMs = 3000.
- Given the page, then document.title is "Navigation | Test Playground" and the URL is `<base>/steps/navigation/`.
- When I click "Change title in 2s", then 2 s later document.title is "Title changed" (state.titleChanged = true).
- When I click "Go to step two in 2s", then 2 s later `step=2` is added to the URL (other params kept) and state.step = "2".
- When I click "Push history entry", then the heading shows "Entry 1" (state.historyIndex = 1); Back shows "Entry 0", Forward shows "Entry 1" again.
- When I refresh, then state.reloads grows by 1 (sessionStorage key `<ns>_nav_reloads`); clicks on "Reload counter" (state.counter) survive the refresh.
- Six small requests run during the first 2 s (state.lateRequestsDone = 6) and a large image gets its source at 3 s (state.lateImageLoaded), so DOMContentLoaded resolves before the image and network idle waits for the requests.
- A full-page screenshot includes the footer "End of navigation page".

## Trap params
`variant=b` (card title, button ids and an extra hint change), `unstableIds`, `unstableClasses`, `slow=<ms>`.

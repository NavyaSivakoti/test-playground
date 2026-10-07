# Browser APIs (/ui/browser)

**Purpose:** a target for steps that depend on browser permissions and APIs, each with a fallback so that a denied permission never blocks the flow.

## User stories
- As a user I can share my location, or pick a city when location is denied.
- As a user I can allow notifications and receive a test notification.
- As a user I can copy text and paste it back from the clipboard.
- As a user I can print, go fullscreen, change the tab title and navigate by hash or history.
- As a user I am told when I am offline.

## Acceptance criteria
- When I click "Get my location" with permission granted, then latitude/longitude are shown; state.geo = {status:"granted", lat, lon}. When denied, then "Location permission denied" is shown and the "Fallback city" select still works (state.city).
- When I click "Request notification permission", then state.notificationPermission is granted/denied/default; "Send test notification" sets state.notificationSent.
- When I click "Copy text" then "Paste from clipboard", then "Pasted text" equals the copied text; state.clipboard = {written, read}.
- When I click "Print page", then state.printed increments and window.print() is called.
- When I click "Enter fullscreen", then state.fullscreen = true (fullscreenchange event).
- When I enter a title and click "Update title", then document.title changes; state.documentTitle.
- When I click "Go to section 2", then the URL hash is #section-2, "Section 2 content" shows, state.hash = "#section-2".
- When I click "Push history entry", then the URL gains demoStep=N and state.history.step = N; Back fires popstate.
- When the network goes offline (real or "Simulate offline"), then "You are offline" shows; state.online / state.effectiveOnline.
- When the tab is hidden/shown, then state.visibility and state.visibilityChanges update.

## Trap params
`variant=b` ("Use my current location", "Copy", "Add history entry"), `shuffle=true` (city order), `unstableIds`, `unstableClasses`.

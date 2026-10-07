# Tabs, windows and dialogs (`/windows`)

**Purpose:** multi-window and dialog handling: late-loading tabs, popups, native alert/confirm/prompt, stacked modals and leave-page guards.

## User stories
- As a user I open the quarterly report in a new tab.
- As a user I sign in through a popup window.
- As a user I delete a project after confirming twice.

## Acceptance criteria
- "Open quarterly report" opens a tab titled "Quarterly report" that is blank for 2 s, then shows Revenue $1,284,000 (opener state.reportOpened, state.reportLoaded = true).
- "Sign in with popup" opens "Popup sign-in"; signing in with a seeded account closes the popup and shows "Signed in via popup as <email>" (state.popupLogin).
- "Delete project" shows confirm "Delete project?"; OK then shows prompt "Type DELETE to confirm"; typing DELETE shows "Project deleted" (state.projectDeleted = true). Cancel or another value keeps the project; every dialog and its result is in state.dialogs.
- "Open settings" opens a modal; "Advanced options" opens a second modal on top; Esc closes only the top one (state.modalDepth, state.advancedApplied).
- With "Warn about unsaved changes" checked and text in "Draft note", "Leave this page" triggers the browser's beforeunload prompt (state.guard, state.dirty).

## Trap params
`variant=b` (relabelled buttons, new ids), `unstableIds`, `unstableClasses`, `ns` (passed to child windows).

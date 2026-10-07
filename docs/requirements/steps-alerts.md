# Alerts, confirms and prompts

Route: `/steps/alerts/`

## Purpose
Baseline for native browser dialog steps: alert presence/absence, alert text, accept and dismiss, prompts and leave-page warnings.

## User stories
- As a tester I want to verify an alert text so I can check user feedback.
- As a tester I want to accept or dismiss a confirm and see the result recorded.

## Acceptance criteria
- Given the page has just loaded, when no button was clicked, then no alert is present.
- Given the page is open, when I click "Show alert", then an alert "Profile saved" is shown and state.alerts increments after OK.
- Given the page is open, when I click "Show confirm" and press OK, then state.confirm = true and "Confirm result: OK" is shown.
- Given the page is open, when I click "Show confirm" and press Cancel, then state.confirm = false.
- Given the page is open, when I click "Show prompt" and type a name, then state.promptValue equals the typed text (null when cancelled).
- Given the page is open, when I click "Show alert in 1s", then an alert appears after about 1 second; state.delayedAlert = true.
- Given "Warn before leaving" is ticked, when I reload or leave, then the browser shows a beforeunload dialog.

## Trap parameters
variant=b (button order, ids, prompt and checkbox labels drift), unstableIds, unstableClasses, duplicateLabels (decoy "Show alert").

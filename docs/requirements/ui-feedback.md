# Feedback and status (/ui/feedback)

**Purpose:** a target for verifying transient and persistent feedback: toasts, progress, skeletons, badges, banners, inline form states and a session-timeout dialog.

## User stories
- As a user I see a toast after an action, in the right severity (success, info, warning, error).
- As a user I can dismiss toasts that do not disappear by themselves.
- As a user I can follow an upload's progress until it completes.
- As a user I see placeholders while content loads, then the content.
- As a user I can clear my unread notifications and dismiss banners.
- As a user I am warned before my session expires and can extend it.

## Acceptance criteria
- Given auto-dismiss is on, when I click "Show success toast", then "Saved successfully" appears and disappears after `toastMs` (default 3000 ms); state.toasts.lastShown records tone, text and ms.
- Given auto-dismiss is off, when I show an error toast, then it stays until I click "Dismiss error toast"; state.toasts.dismissed increments.
- When I click "Start upload", then the progress bar goes from 0 to 100 over 5 s and "Upload complete" appears; state.upload = {progress:100, status:"done"}.
- Given renderDelay=N (default 1500), then the skeleton is replaced by content after N ms; state.skeleton.status = "loaded".
- Given "Notifications 3", when I click "Mark all read", then the badge shows 0; state.unread = 0.
- When I dismiss a banner, then it is removed and state.bannersDismissed lists it.
- When I subscribe with an invalid email, then "Enter a valid email address" appears (state.subscribe.status = "error"); with a valid one, "Subscribed <email>".
- When I click "Simulate session timeout", then the "Session about to expire" dialog counts down from 30 s (frozen clock aware); "Stay signed in" → state.session.status = "extended", "Sign out" → "signed-out", reaching 0 → "expired".

## Trap params
`toastMs`, `renderDelay`, `variant=b` (button order reversed, "Begin upload", "Mark all as read", dialog buttons swapped), `bugs=toastText` ("Saved succesfully"), `unstableIds`, `unstableClasses`, `duplicateLabels`, `now`.

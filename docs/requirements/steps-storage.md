# Cookies and browser storage

Route: `/steps/storage/`

## Purpose
Baseline for cookie, localStorage, sessionStorage steps and for Upload/Restore Session; all keys are namespaced (<ns>_session, <ns>_token, <ns>_step, IndexedDB <ns>_db).

## User stories
- As a tester I want to read and delete cookies and storage keys and see the effect.
- As a tester I want to know which stores survived a restored session.

## Acceptance criteria
- Given a first visit, when the page loads, then it seeds cookie <ns>_session=abc123, localStorage <ns>_token=tok-123, sessionStorage <ns>_step=3 and IndexedDB <ns>_db.
- Given the cookie was deleted, when I click "Re-read", then state.cookie = null.
- Given all cookies were deleted, when I click "Re-read", then state.cookies = {}.
- Given local storage was cleared, when I click "Re-read", then state.local = null.
- Given a cookie was added, when I click "Re-read", then it appears in state.cookies.
- Given I clicked "Sign in (sets session)" and uploaded the session, when a new run restores the session and opens the page, then the "Session probe" table and state.probe show which of cookie/local/session exist.

## Trap parameters
variant=b (button order and id, card title), unstableIds, unstableClasses, ns (key prefix).

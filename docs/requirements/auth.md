# Sign in and roles (`/auth`) — MOCK

**Purpose:** a reproducible sign-in flow with roles, a verification-code step, mock single sign-on, password reset and session expiry.

## User stories
- As a viewer, approver or admin I sign in with my email and password and see only the menu items of my role.
- As an admin I must enter a 6-digit code that is emailed to me (mock inbox on the page).
- As a user I can sign in with single sign-on in a popup window.
- As a user who forgot the password I can request a reset link by email.

## Acceptance criteria
- Given a seeded account (admin@, approver@, viewer@example.com, password `Playground!1`), when I click "Sign in", then the dashboard shows "Signed in as <name>" and the menu: admin → Users, Billing, Settings; approver → Approvals; viewer → Reports.
- Given a wrong password, when I click "Sign in", then "Invalid email or password" is shown and no session is stored.
- Given the admin account, when I sign in, then "Enter the code we sent" is shown, the inbox has "Your sign-in code", and only that code passes "Verify" (state.mfaPassed = true).
- Given "Remember me" is checked, when I sign in, then the cookie `<ns>_remember` holds the email.
- The session is stored in localStorage `<ns>_session` and survives a reload; "Sign out" removes it.
- Given `?expireAfter=5000`, 5 s after sign-in the user is signed out with "Your session has expired" (state.expired = true).
- When I click "Continue with SSO", a popup titled "Single sign-on" opens; "Approve" signs the opener in (state.ssoUsed = true) and closes the popup.
- When I submit "Send reset link", the inbox gets "Reset your password" (state.resetSentTo).

## State
`user, role, menu, mfaPassed, ssoUsed, expired, loginError, rememberCookie, signedOut, resetSentTo, section`.

## Trap params
`variant=b` ("Log in", "Email address", SSO button moved above the form with new wording), `unstableIds`, `unstableClasses`, `duplicateLabels` (decoy sign-in button), `ns`, `expireAfter`.

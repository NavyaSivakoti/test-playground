# Authentication helpers (mock)

Route: `/steps/auth/`

## Purpose
Baseline for authentication helper steps: HTTP Basic, email OTP with regex extraction, SMS OTP (mock), TOTP from a published secret and captchas (mock). Social/Enterprise sign-in are not provided.

## User stories
- As a tester I want to read an emailed code and complete verification.
- As a tester I want a TOTP generated from a known secret to be accepted.

## Acceptance criteria
- Given backend configured, when I authenticate tester/playground on {api}/basic, then page text "Authenticated as tester".
- Given I entered an email and clicked "Send code", when I extract \d{6} from the email and click "Verify email code", then state.emailOtpOk = true.
- Given I clicked "Send SMS code", when I read the code from the mock phone and verify, then state.smsOk = true.
- Given secret JBSWY3DPEHPK3PXP, issuer "Test Playground", when I enter the current TOTP and click "Verify authenticator code", then state.totpOk = true (±1 step accepted).
- Given the page is open, when I tick "I'm not a robot", then state.captcha = true.

## Trap parameters
variant=b (send-code wrapper and id, TOTP button id, captcha title), unstableIds, unstableClasses, seed (email/SMS codes; seed=1 gives 482913).

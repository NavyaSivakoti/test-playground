# Registration form (/ui/forms)

**Purpose:** a sign-up form with inline validation. It is the data-driven target for `fixtures/testdata/registration.csv` and `registration.xlsx`.

## User stories
- As a visitor, I can create an account with first name, last name, email, password, confirm password, phone (country code + masked number), date of birth and terms acceptance.
- As a visitor, I see a validation message when I leave an invalid field and when I submit.
- As a business user, I must enter a company name when "Account type" is Business.
- As a visitor, I can save a draft, find it restored after a reload, and clear it with Reset.

## Acceptance criteria
- Given valid data and accepted terms, when I click "Create account", then "Account created" is shown and an `accounts` record is created (state.submitted = true, state.accountId set).
- Given email "alan.example.com", when the field loses focus, then "Enter a valid email address" is shown.
- Given a password shorter than 8 characters, then "Password must be at least 8 characters" is shown.
- Given different passwords, then "Passwords do not match" is shown.
- Given the terms are not accepted, then "You must accept the terms" is shown.
- Given "+44 20 7946 0001" typed in Phone, then Country code becomes +44 and state.values.phone = "+44 20 7946 0001".
- The Bio counter shows "n / 160", and input stops at 160 characters.
- The password strength reads Weak, Fair or Strong. "Show password" switches the input type.
- The state never contains raw passwords (only their lengths).

## Trap params
`variant=b` changes the button to "Sign up", the email label to "Email address", puts Last name first and adds a fieldset wrapper. Also applies: `unstableIds`, `unstableClasses`, `duplicateLabels` (decoy submit button), `bugs=savePersist` (success shown, no record), `bugs=toastText` (toast reads "Account registered"), `bugs=api500` (create fails), `now=` (date of birth max).

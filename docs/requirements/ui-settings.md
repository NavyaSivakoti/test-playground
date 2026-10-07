# Account settings (/ui/settings)

**Purpose:** a typical settings screen with persistence (backend records of kind `settings`), file upload with canvas crop, validation and destructive-action confirmations.

## User stories
- As a user I can edit my display name and bio and they persist across reloads.
- As a user I can upload an avatar and choose a square crop by dragging.
- As a user I can change my password with clear validation messages.
- As a user I can choose which notifications I get per channel, my language and time zone.
- As a user I must confirm destructive actions explicitly.

## Acceptance criteria
- When I change "Display name" and click "Save profile", then "Profile saved" appears, state.profile.persisted = true, and after reload the field shows the saved value.
- When I upload an image to #avatar-upload, then a crop selection and "Crop preview" canvas appear; state.avatar = {name, size, sha256, width, height, crop:{x,y,size}}. Dragging or arrow keys move the crop; "Crop size" resizes it.
- When the new password is shorter than 8 characters, lacks an uppercase letter/digit, equals the current one, or the confirmation differs, then the matching error shows and state.password = {status:"invalid", errors:[…]}; otherwise status = "changed". Passwords are never stored in state.
- When I tick a matrix checkbox (e.g. "Billing SMS"), then state.matrix updates; "Save preferences" persists it with language and time zone.
- When I click "Reset preferences", then "Are you sure?" → "Continue" → "Really reset everything?" → "Yes, reset everything" restores defaults; cancelling at either step records which step.
- When I click "Delete account", then "Delete permanently" stays disabled until exactly DELETE is typed in "Type DELETE to confirm"; then state.account.deleted = true.

## Trap params
`bugs=savePersist` (success shown, nothing saved), `variant=b` ("Public name", "Update profile", "Restore defaults", matrix column order Push/Email/SMS), `netDelay`, `ns`, `unstableIds`, `unstableClasses`, `duplicateLabels`.

# Verify elements (/steps/verify)

**Purpose:** static targets for verification steps. Nothing changes over time, so a failure is always a real mismatch.

## User stories
- As a tester I can verify text, attributes, classes, CSS values, input values and element states.

## Acceptance criteria
- The page displays "Verification playground" and never displays "Fatal error" (that text is only inside an unrendered template).
- "Profile link" has an href containing "/profile".
- "Status message" text is "All changes saved at 10:00"; "Greeting" text is "Hello, tester".
- The readonly "Order number" input has value "ORD-1001" (not "ORD-9999"); "Coupon code" is empty.
- "Status badge" has class "badge--success", color "rgb(21, 128, 61)" and data-status="success".
- "Empty box" has no content; "Hidden notice" is display:none.
- "Disabled submit" is disabled; "Enabled submit" is enabled and each click increments state.enabledSubmitClicks.

## Trap params
`variant=b` (greeting/status order, extra wrapper, button order, badge text), `unstableIds`, `unstableClasses` (the class check is expected to fail).

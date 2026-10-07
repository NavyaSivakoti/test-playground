# Select, check and radio (/steps/select)

**Purpose:** baseline target for dropdown, multi-select, button group, radio and checkbox steps.

## User stories
- As a tester I can select options by value, text, text containing and index, and check or uncheck inputs.

## Acceptance criteria
- "Country" has a placeholder at index 0, then United States (us), Germany (de), France (fr), United Kingdom (uk), Spain (es), Japan (jp); there is no "Mars".
- When I select text "Germany" or value "de", then state.country = "de"; index 3 gives "fr"; text containing "King" gives "uk".
- When I select values "red,blue" (or texts "Red,Blue" or indexes "0,2") in "Colours", then state.colours = ["red","blue"].
- When I select value containing "us-" in "Region", then state.region = "us-east-1".
- When I select index 2 / text containing "Pro" / text "Starter" in button group "Plan", then state.plan = "Enterprise" / "Professional" / "Starter".
- When I select label "Monthly" in "Billing", then state.billing = "monthly".
- When I check "Accept terms", then state.terms = true; when I uncheck "Subscribe to newsletter" (checked by default), then state.newsletter = false.
- When I check "Express shipping", then state.shipping = "express".

## Trap params
`variant=b` (region order, shipping order, newsletter label "Subscribe to the newsletter", new country id), `unstableIds`, `unstableClasses`.

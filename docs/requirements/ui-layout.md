# Tabs, accordion, stepper and carousel (/ui/layout)

**Purpose:** layout widgets whose content changes or appears only after you interact with them.

## User stories
- As a shopper, I can switch between the Overview, Specs and Reviews tabs. A panel is rendered only after its tab is first opened. Vertical tabs cover the Account, Security and Billing settings.
- As a reader, I can open accordion sections one at a time, or several at once after checking "Allow multiple open".
- As a buyer, I go through a 4-step wizard (Details, Address, Payment, Review). Step 2 needs a postcode, and the step buttons at the top jump between steps.
- As a viewer, I can browse 5 slides with the arrows, the dots or autoplay. Autoplay is off by default.
- As a user, I can collapse the sidebar and click breadcrumbs.

## Acceptance criteria
- Given the page has loaded, the Reviews panel is not in the DOM. When I click "Specs", then state.activeTab = "specs" and state.renderedPanels = ["overview","specs"].
- In single mode, opening Returns closes Shipping (state.openSections = ["returns"]).
- Given step 2 with an empty postcode, when I click "Next", then "Enter a postcode" is shown and state.step stays 2. After a postcode is entered, state.step = 3.
- When I click "Go to slide 5", then "Slide 5 of 5" is shown and state.slide = 5. Autoplay uses `?autoplayMs=` (default 3000).
- "Collapse sidebar" sets state.sidebarCollapsed = true. Clicking a breadcrumb sets state.crumb.

## Trap params
`variant=b` renames Back/Next to Previous/Continue and the sidebar buttons to Hide/Show sidebar, reorders the accordion and puts the sidebar on the right. Also applies: `unstableIds`, `unstableClasses`. `autoplayMs` is page-specific.

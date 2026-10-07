# Custom widget lab — `/widgets`

**Purpose:** hand-made controls that break label- and role-based automation.

## User stories
- As a user I pick a department, city, skills, status, dates, timezone and plan with custom controls, and move a kanban card.

## Acceptance criteria
- Given "Department", when I choose "Finance", then state.department = "Finance"; the options are rendered in document.body. With duplicateLabels a decoy "Department" writes state.decoy.
- Given "City", when I type "Lis", then options appear after netDelay (600 ms default) and choosing "Lisbon" sets state.city.
- Given "Skills", when I add chips and press "Clear all", then state.skills becomes [] and state.skillsCleared increments.
- Given "Status" prefilled with "Active", when I press "Clear Status" and choose "Paused", then state.status = "Paused".
- Given "Start date" (native) and "End date" (custom calendar using the frozen clock), then state.startDate and state.endDate hold ISO dates; the calendar grid re-mounts on hover.
- Given the kanban board, when I drag "T-3" to "Done" (HTML5 or pointer), then state.kanban = { card: "T-3", column: "Done", index: 1, method }.
- Given role-less divs, when I click "Pro" and "Email alerts", then state.plan = "Pro" and state.emailAlerts = true.
- Given "Timezone" (120 options), when I choose "(UTC+09:00) Tokyo", then state.timezone is set (index 100).
- Given "Description" (contenteditable) and "Plain notes" (textarea), then only the edited one changes in state; "Volume" sets state.volume; hovering the icon-only "Preferences" button shows "Open preferences".

## Trap params
`variant=b` (reversed options, "Town or city", "Remove status", "Completed" column, "Options" icon label), `duplicateLabels`, `netDelay`, `now`, `shuffle`, `unstableIds`, `unstableClasses`.

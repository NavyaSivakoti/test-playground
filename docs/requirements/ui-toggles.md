# Switches and toggles (/ui/toggles)

**Purpose:** switches built in different ways, so that click and check steps can be tested against each one.

## User stories
- As a user, I can turn Wi-Fi (ARIA `role="switch"` button) and Bluetooth (checkbox-backed switch) on and off.
- As a user, I can turn on Airplane mode, which is a plain div with no role or keyboard support.
- As a user, I cannot change Location, because it is disabled and managed by an administrator.
- As a user, I am asked "Turn off notifications?" before Notifications is switched off.
- As a user, I can switch to a dark theme and turn five feature flags on or off.
- As a user, I can expand or collapse all settings sections at once.

## Acceptance criteria
- Given Wi-Fi is off, when I click it, then aria-checked = true, "Wi-Fi status" shows "On" and state.switches.wifi = true.
- Given Notifications is on, when I click it and choose "Turn off", then state.switches.notifications = false and state.lastConfirm = "confirmed". "Keep on" leaves it on and sets lastConfirm = "cancelled".
- When I click "Dark theme", then `<html data-theme="dark">` is set and state.theme = "dark". The previous theme comes back when I leave the page.
- Given the default flags (2 of 5 off), when I check "Beta search" and uncheck "Inline help", then "Enabled flags" shows "3 of 5".
- "Expand all" sets state.expanded to all 3 sections, and "Collapse all" sets it to [].

## Trap params
`variant=b` renames Wi-Fi to "Wireless" and the section buttons to "Open all"/"Close all", and reorders the switches. `shuffle=true` shuffles the flag order. Also applies: `duplicateLabels` (decoy Wi-Fi button), `unstableIds`, `unstableClasses`.

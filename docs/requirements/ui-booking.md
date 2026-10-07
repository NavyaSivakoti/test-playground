# Booking calendar (/ui/booking)

**Purpose:** date and time picking against a frozen clock (`now=`), with time zones and server-backed bookings (kind `bookings`).

## User stories
- As a customer, I can browse months ("Previous month"/"Next month") or weeks ("Week view"). Past dates are disabled.
- As a customer, I can pick a 30-minute slot between 09:00 and 16:30. Some slots are already booked (seeded) and cannot be chosen.
- As a customer, I can pick a time zone. The slots are wall-clock times in that zone.
- As a customer, I can make the booking repeat weekly or monthly until an end date.
- As a customer, I click "Book". The slot then becomes unavailable for everyone in the namespace.

## Acceptance criteria
- Given now=2026-10-06T08:00:00Z, the calendar opens on October 2026 and "Friday, October 2, 2026" is disabled.
- When I choose October 14, 10:00 and "Book", then "Booked 2026-10-14 at 10:00 (UTC)" is shown, a record is created and that slot is disabled (also after a reload).
- Given Asia/Kolkata, when I pick 09:30 on October 15, then state.slotUtc = "2026-10-15T04:00:00.000Z".
- Given Repeat with an end date before the booking date, then "End date must be after the booking date" is shown and nothing is booked.
- Week view with "Next week" shows "Oct 12 – Oct 18, 2026".

## Trap params
`now` (frozen clock), `seed` (which slots are pre-booked), `variant=b` (12-hour slot labels, "Confirm booking", time zone first), `duplicateLabels` (decoy Book button), `ns`, `unstableIds`, `unstableClasses`.

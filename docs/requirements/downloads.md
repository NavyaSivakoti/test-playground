# Downloads (`/downloads`)

**Purpose:** download targets with known content, for download steps and document questions.

## User stories
- As a user I download orders, a spreadsheet and an invoice, and open the invoice in a new tab.
- As a user I start an export that takes a few seconds and then downloads itself.

## Acceptance criteria
- "Orders CSV" downloads orders.csv with a header and 10 rows.
- "Line items spreadsheet" downloads line-items.xlsx (5 items, total 510.50).
- "Invoice PDF" downloads invoice.pdf (INV-2026-0042, 5 line items, total $510.50).
- "Open invoice in a new tab" has target=_blank (state.openedInNewTab).
- "Prepare export" shows "Preparing your file…" for 3 s, then downloads export-ready.csv and shows "Your file is ready" (state.prepared.ms ≥ 3000).
- "Daily report" downloads report-YYYY-MM-DD.csv using the page clock; with `now=2026-10-06T09:00:00Z` it is report-2026-10-06.csv.
- Every download is appended to state.downloads with name, size and sha256 or HTTP status.
- Given `bugs=brokenLink`, the spreadsheet link points to a missing file; state.downloads records status 404 and a "Download failed (404)" toast appears.

## Trap params
`variant=b` (relabelled links/buttons, new ids), `unstableIds`, `unstableClasses`, `now`, `bugs=brokenLink`.

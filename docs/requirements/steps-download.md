# File download and documents

Route: `/steps/download/`

## Purpose
Baseline for download-by-click steps, document questions about known fixtures and document generation from form data.

## User stories
- As a tester I want to download a CSV and check its row count.
- As a tester I want to ask questions about a downloaded invoice.

## Acceptance criteria
- Given the page is open, when I click "Download CSV", then orders.csv downloads with 11 lines (header + 10 rows) and state.downloads records it.
- Given the page is open, when I click "Download invoice PDF", then invoice.pdf downloads (INV-2026-0042, 5 line items, total $510.50).
- Given I filled "Customer" and "Amount", when I click "Generate document", then a preview "Quote for <customer>" with the amount is shown and state.document is set.

## Trap parameters
variant=b (CSV button id/wrapper, XLSX link text), unstableIds, unstableClasses, bugs=brokenLink (PDF link 404s).

# Browser extension

Route: `/steps/extension/`

## Purpose
Baseline for extension upload/download steps using a tiny content-script extension (fixtures/extension/test-extension.zip).

## User stories
- As a tester I want to confirm that an extension was really loaded into the test browser.

## Acceptance criteria
- Given the extension is not loaded, when I open the page, then "Extension not detected" and state.extension = "none".
- Given the extension is loaded (upload or URL), when I open the page, then banner "Test extension active", "Extension detected" and state.extension = "active".

## Trap parameters
variant=b (card title, link id and text), unstableIds, unstableClasses.

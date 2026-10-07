# File upload

Route: `/steps/upload/`

## Purpose
Baseline for upload-from-URL steps with CSS id targets, and for upload followed by a short-lived toast.

## User stories
- As a tester I want to upload a fixture into #file-plain and verify the received file.
- As a tester I want to verify a toast that appears after an upload.

## Acceptance criteria
- Given the page is open, when I upload fixtures/sample.csv to #file-plain, then state.files.plain = {name, size, type, sha256} of that file.
- Given the page is open, when I upload a file to #file-toast, then toast "Upload complete" appears about 1 s later and disappears after 3 s.
- Given bugs=toastText, when I upload to #file-toast, then the toast says "Upload finished" (deliberate bug).

## Trap parameters
unstableIds (ids are no longer file-plain / file-toast), variant=b (order, labels), unstableClasses, bugs=toastText.

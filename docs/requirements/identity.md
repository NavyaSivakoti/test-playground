# Identity verification (document capture) — `/identity`

**Purpose:** a multi-screen document capture flow in one route, modelling camera permission, live capture, a hidden upload fallback and session restore.

## User stories
- As an applicant I choose a document type, accept the terms, allow the camera and photograph the front and back of my document.
- As an applicant without a camera I can upload photos instead, and the flow never blocks.
- As an applicant I can reload or restore my session and continue where I left off.

## Acceptance criteria
- Given the "Choose your document" screen, when no document is chosen or the terms box is unchecked, then "Continue" is disabled.
- Given camera access is granted, when I press the round "Capture" button (data-testid `capture-button`) on "Front of document", then the preview shows "Detected: FRONT" for the green sample and state.captures.front = { detected: "FRONT", source: "camera" }.
- Given the camera is denied, when I press "Enable access", then "Camera unavailable" and "Upload instead" are shown and state.cameraStatus = "denied".
- Given any screen from camera access onwards, when I upload images to the hidden input `[data-testid=document-detector-capture-button]`, then the first missing side is filled (front, then back) from colour detection with source "upload".
- Given progress exists, when the page reloads, then it resumes on the saved screen and state.restoredFrom names the store used (localStorage, sessionStorage, cookie or backend).
- Given both sides are captured, when I continue from "Review", then "All set" / "Your documents were submitted" shows and state.completed = true.
- The back side needs a different camera feed: "Set camerafile and restore session" with fixtures/back.y4m.

## Trap params
`variant=b` ("Continue" → "Next", reordered documents, capture button on top of the video, other ids), `device=mobile` (device gate), `unstableIds`, `unstableClasses`, `ns` (storage keys are `<ns>_identity_progress`).

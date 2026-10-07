# Camera capture

Route: `/steps/camera/`

## Purpose
Baseline for camera-file steps: a fake camera (front.y4m green / back.y4m blue) is captured and classified; progress survives a restored session.

## User stories
- As a tester I want to feed a camera file and verify which card was captured.
- As a tester I want capture progress to survive Restore Session.

## Acceptance criteria
- Given the camera file is front.y4m, when I click "Capture", then "Detected: FRONT" and state.detected = "FRONT".
- Given the camera file is back.y4m and "Expected side" is Back, when I click "Capture", then state.detected = "BACK" and state.match = true.
- Given a capture was made and the session restored, when I open the page, then state.restoredFrom names the store that had the progress and state.captures keeps it.
- Given camera permission is denied, when I open the page, then "Camera unavailable — upload instead" with an upload input that runs the same detection.

## Trap parameters
variant=b (side selector position, capture id, card title), unstableIds, unstableClasses, ns.

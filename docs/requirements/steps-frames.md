# Frames and nested frames

Route: `/steps/frames/`

## Purpose
Baseline for frame switching by name, nested frames and srcdoc frames; frame content reports back to the parent state.

## User stories
- As a tester I want to switch into a named frame and act inside it.
- As a tester I want to reach an input three frames deep.

## Acceptance criteria
- Given the page is open, when I switch to frame "frame-a" and click "Insert", then the parent shows "Inserted from frame A" and state.inserted = true.
- Given the page is open, when I switch through frame-level-1, frame-level-2, frame-level-3 and type into "Deep value", then parent state.deepValue equals the typed text.
- Given the page is open, when I switch to "frame-srcdoc" and click "Srcdoc button", then state.srcdocClicked = true.

## Trap parameters
variant=b (frame order and frame-a id), unstableIds, unstableClasses. Frame content routes: /embed/frame-a, /embed/level-1..3.

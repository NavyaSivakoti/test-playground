# Scrolling (/steps/scroll)

**Purpose:** a very long page, a horizontal timeline and an inner scroll list for scroll steps.

## User stories
- As a tester I can scroll elements into view, scroll by screens, to the bottom, horizontally and inside a container.

## Acceptance criteria
- 60 blocks, each taller than the screen, are titled "Target 1" … "Target 60". When a title scrolls into view, state.visibleTarget is its name and state.visibleTargetTop its distance from the top of the viewport.
- On window scroll, state.scrollY and state.viewportHeight are recorded (one screen down/up changes scrollY by viewportHeight).
- When "Bottom marker" enters the viewport, state.atBottom = true.
- Scrolling "Wide timeline" (Column 1 … Column 60) sets state.scrollLeft and state.visibleColumnMax.
- Scrolling inside "Swipe list" sets state.swipeScrolled = true.

## Trap params
`variant=b` (card title, swipe list id, extra hint), `unstableIds`, `unstableClasses`.

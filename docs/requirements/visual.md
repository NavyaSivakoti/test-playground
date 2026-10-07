# Canvas, charts and visual state (/visual)

Purpose: targets that exist only as pixels or styling: a canvas bar chart with a drawn tooltip, an SVG line chart, a canvas map with clickable regions, a signature pad and cards whose selection is shown only by colour.

## User stories
- As an analyst I hover chart bars and points to read values.
- As a sales manager I click a region on the map.
- As a customer I sign on the pad and choose a plan.

## Acceptance criteria
- Hovering a bar sets state.hoveredBar = { index, label, value } and draws a tooltip "Mon: value" on the canvas; values come from the seed (state.barValues).
- Hovering an SVG point shows "Week N: value" and sets state.hoveredPoint.
- Clicking the map sets state.region to North, East, South or West (hit-testing on diagonal quadrants); the region is highlighted on the canvas only.
- Drawing on the signature pad increments state.strokes and sets state.signed = true; "Clear" resets them.
- Clicking a plan card sets state.selectedCard; only border and background colour change (no text or attribute change).
- variant=b moves the map first, recolours bars and the line, and shifts the cards, for screenshot comparison.

## Trap params
seed (chart values), variant=b (layout shift, "Clear signature"), unstableClasses.

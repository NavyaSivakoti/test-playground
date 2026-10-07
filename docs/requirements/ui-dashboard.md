# Analytics dashboard (/ui/dashboard)

**Purpose:** a target for waiting on staggered async widgets, verifying seeded numbers, hovering charts (SVG and canvas) and downloading a generated image.

## User stories
- As an analyst I see Revenue, Orders, Customers and Conversion for a chosen date range.
- As an analyst I can hover charts to read exact values and export the revenue chart.
- As an analyst I see the number of active users update live.

## Acceptance criteria
- On load, KPI cards appear after 500 ms, the orders (SVG) chart after 1500 ms and the revenue (canvas) chart after 3000 ms, each with a spinner first; state.loadedWidgets lists them in order.
- When I select "Last 7 days", "Last 30 days" or "Custom" (with "From" and "To" dates), then every widget reloads and recomputes; state.range = {key, days, from?, to?} and state.kpis change. Values are deterministic for a seed.
- Hovering a bar shows "Day N: M orders" (state.svgHover); moving over the canvas shows "Day N: $X" (state.canvasHover).
- "Export as image" downloads revenue-chart.png from canvas.toBlob; state.exported = {name, size, type}.
- "Active users now" updates every 2 s; the value is a function of seed and tick only (state.activeUsers = {tick, value}).
- "Refresh" reloads the widgets (spinners again) and increments state.refreshes.

## Trap params
`seed`, `variant=b` (KPI order Orders/Revenue/Conversion/Customers, "Reload data", "Download PNG"), `unstableIds`, `unstableClasses`.

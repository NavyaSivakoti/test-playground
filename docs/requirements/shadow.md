# Web components and shadow DOM (/shadow)

Purpose: targets inside custom elements: an open shadow root, a closed shadow root, a shadow host nested in another shadow root, a custom select with slotted options and a shadow root inside a same-origin iframe.

## User stories
- As a tester I fill and click controls inside shadow roots and verify the page received the result.

## Acceptance criteria
- Given "Grace" in "Shadow name", when I click "Save in shadow", then "Saved in shadow: Grace" is shown and state.shadowName = "Grace" (composed CustomEvent).
- When I click "Closed action" twice, then state.closedClicks = 2. The host's shadowRoot is null (closed), so locators that walk shadowRoot cannot reach it.
- Given "42" in "Nested value", when I click "Apply nested", then state.nestedValue = "42" and state.nestedDepth = 2.
- When I open the custom select ("Choose…") and click "Green", then state.selectValue = "green".
- In the frame "shadow-frame", given "Alan" in "Frame shadow name", when I click "Save in frame shadow", then the parent state.frameShadowName = "Alan".
- Custom elements are defined once per window; revisiting the page records them in state.redefinitionSkipped instead of throwing.

## Trap params
variant=b ("Store in shadow", "Run closed action", "Apply nested value", "Store in frame shadow", closed card first, extra wrapper), shuffle (select option order), unstableIds, unstableClasses.

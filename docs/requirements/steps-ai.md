# AI agent, ask and verify

Route: `/steps/ai/`

## Purpose
Baseline for AI agent, AI ask, AI verification and heatmap steps on a page with clear, checkable facts.

## User stories
- As a tester I want an AI agent to place an order and verify the real effect.
- As a tester I want to ask about and visually verify facts on the page.

## Acceptance criteria
- Given the page is open, when an agent adds 2 "Blue mug" and checks out, then state.order = {item: "Blue mug", qty: 2}.
- Given the page is open, when I ask for the delivery date, then the answer is "15 December 2026".
- Given the page is open, when I verify the order status and badge colour, then status is Shipped and the badge is green.
- Given the page is open, when I generate a heatmap, then hot spots: sale banner, checkout button, order card, help and newsletter tiles.

## Trap parameters
variant=b ("Add to basket", cart title, layout swap), unstableIds, unstableClasses, bugs=cartTotal.

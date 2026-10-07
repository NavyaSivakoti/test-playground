# Procurement approvals (/approvals)

Purpose: a realistic enterprise purchase-request flow that is hard to automate: generated field names, deep wrapper divs, a 12-step wizard, repeated button labels and a workflow builder drawn on a canvas.

## User stories
- As a requester I fill a 12-step purchase request (Requester, Department, Vendor, Line items, Budget code, Cost centre, Justification, Attachments, Delivery, Approvers, Review, Submit) and submit it.
- As an approver I approve or reject my task after confirming in a dialog, and see the activity log update with relative times.
- As a process owner I arrange and connect workflow nodes on a wide canvas.

## Acceptance criteria
- Given step 1 is empty, when I click "Next", then "Enter the requester name" is shown and state.step stays 1.
- Given valid values (Ada Lovelace, ada@example.com, General and Administrative, Summit Paper Co., 10 × 4.50, BC-2041, any cost centre, a 20+ character justification, 2026-12-01, an address, at least one approver), when I click "Submit request", then a `purchase-requests` record is created in the namespace and state.submitted = true, state.request.total = 45.
- Given a pending task, when I click its "Approve" and then "Confirm", then state.tasks[i].status = "approved" and the log shows "Approved by … · just now". Rejecting requires a "Rejection reason".
- Every input has a UUID-like `name` attribute; with unstableIds=true the names change per render.
- Clicking a step in the step jumper (e.g. "7. Justification") sets state.step and state.lastJump.
- Dragging a canvas node updates state.canvas.nodes; dragging from a node's right-hand dot onto another node adds [from, to] to state.canvas.edges. "Fit to view" sets state.view.zoom < 1. Nodes are not DOM elements; an accessible list mirrors them and "Add connection" offers a non-canvas alternative.
- "1 of 1 processed" renders as a link or as plain text depending on the seed (state.processedAs); the same seed always gives the same result.

## Trap params
variant=b (Continue/Previous, "Send for approval", "Approve request", "Fit all nodes", button order, other canvas layout), unstableIds, unstableClasses, duplicateLabels (decoy Next), shuffle (department order), netDelay, now (relative dates), bugs=api500 (submit fails).

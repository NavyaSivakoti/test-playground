# Drag and drop

Route: `/steps/drag/`

## Purpose
Baseline for drag-and-drop steps on a three-column board that accepts both native HTML5 drag events and plain pointer down/move/up.

## User stories
- As a tester I want to drag a card to a column and verify the board really changed.

## Acceptance criteria
- Given the board is in its initial state, when I drag "Card T-3" to "Done column", then state.board.Done[0] = "T-3" and state.lastMove = {card: "T-3", from: "Todo", to: "Done"}.
- Given a drag step reports success, when the board state did not change, then the step is a false pass.
- Given variant=b, when I drag "Card T-3" to "Done column", then columns are reordered but the move still lands.

## Trap parameters
variant=b (column order, test ids, board title), unstableIds, unstableClasses.

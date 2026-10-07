# Tasks: create, edit, delete (/ui/crud)

**Purpose:** create, read, update and delete on server-backed records (kind `tasks`, per namespace). Three tasks are seeded the first time a namespace is used.

## User stories
- As a user, I can create a task in the "New task" dialog (Title, Priority, Due date) and edit it with "Edit" and "Save changes".
- As a user, I can double-click a title to edit it in place: Enter saves and Esc cancels.
- As a user, I can delete a task after confirming. A snackbar offers "Undo" for 5 seconds.
- As a user, I can select all tasks and delete them in one action.
- As a user, I see the change at once, and it is rolled back if the server fails.

## Acceptance criteria
- When I create "Prepare demo data", then it is listed, state.lastAction = "create", and it is still there after a reload.
- When I edit a title inline and reload, then the new title is still shown.
- When I delete and then click "Undo", then the task is back and state.lastAction = "undo".
- Given ?failNext=1, when I save an edit, then "Could not save – changes reverted" is shown and the old title comes back (state.lastAction = "rollback").
- Given Select all and "Delete selected", then "No tasks yet" is shown.

## Trap params
`bugs=savePersist` shows Saved but changes are lost after a reload. `bugs=api500` makes create fail. `variant=b` renames "New task" to "Add task" and "Save changes" to "Update task". `failNext=1`, `ns`, `netDelay`, `unstableIds` and `unstableClasses` also apply. In local mode the records live in browser storage.

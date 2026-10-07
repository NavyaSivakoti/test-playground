# Windows, tabs and popups

Route: `/steps/windows/`

## Purpose
Baseline for window/tab steps: open and switch to windows, switch by title or index, popups, target=_blank links and closing windows.

## User stories
- As a tester I want to switch into a child window and verify its content.
- As a tester I want the parent to tell me when a child window was closed.

## Acceptance criteria
- Given the parent page is open, when I click "Open child window" and switch to it, then the child shows heading "Child window", its title is "Child window" and state.opened = true.
- Given a child window is open, when I close it (button or driver), then the parent shows "Child closed" and state.childClosed = true.
- Given the parent page is open, when I click "Open popup", then a 480x360 popup shows "Popup content".
- Given the parent page is open, when I inspect "Open docs in new tab", then it has target=_blank and points to /steps/windows/child/.
- Given the parent page is open, when I click "Open 3 children", then three named windows open and are listed under "Opened windows".
- Given several windows are open, when I close all except the current one, then only one window remains.

## Trap parameters
variant=b (button order, ids, link text), unstableIds, unstableClasses. Child pages: /steps/windows/child, /steps/windows/popup.

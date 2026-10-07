# Upload lab — `/uploads`

**Purpose:** every common way a web app receives files, including ones that defeat input-based upload steps.

## User stories
- As a user I upload a file through a plain input, a hidden input behind a styled button, a drop zone, or an input inside an iframe.
- As an admin I import users from CSV and line items from Excel, and get clear errors for bad files.

## Acceptance criteria
- Given `#file-plain-u`, when a file is uploaded, then state.uploads.plain holds its name, size, type and sha256.
- Given the display:none input `[data-testid=hidden-upload-input]`, when a file is set on it, then state.uploads.hidden is filled; the "Choose file" button only opens the chooser.
- Given the drop zone, then it contains no input element; only a real drop event fills state.uploads.dropped (state.dropZone.note explains this).
- Given the CSV input, when the file lacks the email column, then "Missing column: email" shows; an empty file shows "File is empty"; sample.csv gives state.csv.rows = 10.
- Given the receipt input, when a file is uploaded, then the "Uploaded" toast appears after renderDelay ms and disappears after 2 s.
- Given the iframe named `upload-frame`, when a file is uploaded inside it, then the frame posts its info and state.frameUpload.name is the file name.
- Given line-items.xlsx, then 5 rows and "Total: 510.50" are shown (state.excel.total = 510.5); wrong headers give an error starting "Wrong headers".
- Given the image-only input, when a non-image is chosen, then "Only image files are allowed" shows and state.imageRejected is the file name.

## Trap params
`variant=b` (labels and ids drift, e.g. `#file-plain-u` disappears), `renderDelay` (toast delay), `bugs=toastText`, `unstableIds`, `unstableClasses`.

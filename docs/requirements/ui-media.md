# Video, audio, images and PDF (/ui/media)

**Purpose:** media elements with real, observable playback state. No external media files are used: the video is drawn on a canvas and streamed through `captureStream()`, and the audio is a 440 Hz Web Audio oscillator.

## User stories
- As a viewer, I can Play, Pause, Mute and seek the video ("Video position", 0–30 s).
- As a listener, I can use "Start tone", "Stop tone", "Silence tone" and "Audio position".
- As a visitor, I see 20 lazy-loaded images, a broken image, a gallery with a lightbox (Esc closes it, arrows move between photos), zoom on hover and an embedded invoice PDF.

## Acceptance criteria
- When I click "Play" and wait 2 s, then state.video.time ≥ 1. "Mute" then "Pause" give playing = false and muted = true.
- When I set "Video position" to 20, then state.video.time = 20 and the frame shows 00:20.
- When I start the tone, then state.audio.playing = true and its time advances.
- Before scrolling, state.lazyLoaded < 20. After scrolling to the end, it is 20.
- state.brokenImage = "error" for fixtures/missing-photo.png.
- "Open photo 3", then "Next photo", then Esc gives state.lightboxHistory = [3,4] and state.lightbox = null.
- state.pdfStatus = 200 for fixtures/invoice.pdf. state.pdfLoaded = true once the frame loads.

## Trap params
`variant=b` changes the order of the video buttons and the labels ("Play video", "‹ Back"/"Forward ›"). Also applies: `seed` (video colour), `unstableIds`, `unstableClasses`.

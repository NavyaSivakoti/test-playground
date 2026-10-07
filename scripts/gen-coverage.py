"""Builds src/coverage/steps.json and coverage/steps.csv from scripts/steps.tsv + the spec below.
Spec per step id: (baseline page, target / sample usage, expected result, env, note)."""
import csv, json, os

W, S, I, X, B = 'web page', 'app server', 'tool integration', 'external account', 'browser feature'
SPEC = {
 # ---- navigation / page state ----
 1:  ('/steps/navigation', 'Visit /steps/navigation?slow=3000 then wait', 'Heading "Navigation page loaded" visible after ~3 s', W, ''),
 11: ('/steps/navigation', 'Store URL in variable currentUrl', 'Variable ends with /steps/navigation/', W, ''),
 33: ('/steps/navigation', 'Verify URL is <base>/steps/navigation/', 'Exact URL match (trailing slash included)', W, 'static hosting adds a trailing slash'),
 115:('/steps/waits', 'Wait until all images are loaded', '6 images (one delayed 3 s) all complete; state imagesLoaded=6', W, ''),
 123:('/steps/navigation', 'Click "Change title in 2s", wait for title "Title changed"', 'document.title becomes "Title changed" after 2 s', W, ''),
 127:('/steps/navigation', 'Store title in variable pageTitle', 'Value "Navigation | Test Playground"', W, ''),
 131:('/steps/navigation', 'Click "Go to step two in 2s", wait for url containing step=2', 'URL gets ?step=2 after 2 s', W, ''),
 156:('/steps/navigation', 'Verify title contains "Navigation"', 'Passes', W, ''),
 163:('/steps/navigation', 'Click "Go to step two in 2s", wait for exact URL', 'URL changes to …/steps/navigation/?step=2', W, ''),
 192:('/steps/navigation', 'Click "Push history entry", then browser Back', 'state.historyIndex goes 1 -> 0 and heading shows "Entry 0"', W, ''),
 320:('/steps/navigation', 'Verify title is "Navigation | Test Playground"', 'Passes', W, ''),
 372:('/steps/navigation', 'Visit <base>/steps/navigation/', 'Page loads with heading "Navigation"', W, ''),
 425:('/steps/navigation', 'Navigate to <base>/steps/navigation/', 'Page loads with heading "Navigation"', W, ''),
 495:('/steps/navigation', 'Verify title equals "Navigation | Test Playground"', 'Passes', W, ''),
 535:('/steps/waits', 'Click "Start background requests", wait for network idle', '5 staggered requests finish; state requestsDone=5', W, ''),
 537:('/steps/navigation', 'Set load state DOMContentLoaded then visit page', 'Next navigation resolves at DOMContentLoaded (late image still loading)', W, ''),
 538:('/steps/navigation', 'Set load state network idle then visit page', 'Next navigation waits for the 2 s late request', W, ''),
 565:('/steps/navigation', 'Wait until DOMContentLoaded', 'Passes before the delayed image finishes', W, ''),
 591:('/steps/navigation', 'Push history entry, Back, then Forward', 'Heading returns to "Entry 1"', W, ''),
 592:('/steps/navigation', 'Increment "Reload counter", click Refresh', 'state.reloads increments (kept in sessionStorage)', W, ''),
 455:('/steps/navigation', 'Take full page screenshot', 'Screenshot includes the footer marker "End of navigation page"', W, ''),
 # ---- click family ----
 22: ('/steps/click', 'Right click on "Right-click target"', 'Custom context menu opens; state.lastAction="contextmenu"', W, ''),
 23: ('/steps/click', 'Mouseover on "Hover to reveal"', 'Tooltip "Revealed by hover" appears; state.hovered=true', W, ''),
 26: ('/steps/click', 'Click on "Primary action"', 'state.clicks.primary=1, toast "Primary clicked"', W, ''),
 27: ('/steps/click', 'Double click on "Double-click target"', 'state.lastAction="dblclick"; single clicks do not count', W, ''),
 101:('/steps/click', 'Verify "Primary action" button is clickable', 'Passes; "Disabled action" fails the same check', W, ''),
 154:('/steps/click', 'Click on "Maybe banner close" if present', 'Banner present only with ?banner=1; step passes either way', W, ''),
 552:('/steps/click', 'Click on "Edit" located to the right of "Row B"', 'state.edited="Row B" (three identical Edit buttons)', W, ''),
 589:('/steps/click', 'Click on "Show panel in 2s" and verify "Delayed panel" visible within 5 s', 'Passes; with 1 s max wait it fails', W, ''),
 596:('/steps/click', 'Click on "Copy invite code" and store copied value', 'Clipboard and variable = "INV-7Q2K-2026"', W, 'Needs clipboard permission in the runner'),
 # ---- input / keys ----
 13: ('/steps/input', 'Clear the value displayed in "Prefilled name"', 'Input value empty; state.prefilled=""', W, ''),
 14: ('/steps/input', 'Clear the text displayed in "Prefilled notes" (textarea)', 'Textarea empty', W, ''),
 35: ('/steps/input', 'Type in "Search box" then Press Enter', 'state.searchSubmitted=<query>', W, ''),
 54: ('/steps/input', 'Open "Open modal", Press Esc', 'Modal closes; state.lastKey="Escape"', W, ''),
 55: ('/steps/input', 'Focus "Key log" then Press Shift+Delete', 'state.lastKey="Shift+Delete"', W, ''),
 70: ('/steps/input', 'Enter "Ada Lovelace" in "Full name"', 'state.fullName="Ada Lovelace"', W, ''),
 161:('/steps/input', 'Focus "Full name", Press Tab', 'Focus moves to "Email"; state.focused="email"', W, ''),
 456:('/steps/input', 'Focus "Key log", Press ArrowDown Key', 'state.lastKey="ArrowDown"', W, ''),
 572:('/steps/input', 'Fill "ada@example.com" in "Email"', 'state.email="ada@example.com" (fill replaces existing text)', W, ''),
 673:('/steps/input', 'Press ArrowUp 3 times in "Quantity"', 'Quantity 1 -> 4', W, ''),
 674:('/steps/input', 'Clear all chips from "Tags"', 'state.tags=[]', W, ''),
 675:('/steps/input', 'Press Backspace 4 times in "Code"', '"ABCDEFGH" -> "ABCD"', W, ''),
 # ---- select / check ----
 30: ('/steps/select', 'Check the checkbox "Accept terms"', 'state.terms=true', W, ''),
 417:('/steps/select', 'Select multiple by value "red,blue" in "Colours"', 'state.colours=["red","blue"]', W, ''),
 430:('/steps/select', 'Select by value "de" in "Country"', 'state.country="de"', W, ''),
 432:('/steps/select', 'Select by text "Germany" in "Country"', 'state.country="de"', W, ''),
 433:('/steps/select', 'Select by index 3 in "Country"', 'state.country = 4th option (index 3) "fr"', W, 'Index 0 is the placeholder'),
 434:('/steps/select', 'Select by text containing "King" in "Country"', 'state.country="uk" ("United Kingdom")', W, ''),
 437:('/steps/select', 'Select multiple by text "Red,Green" in "Colours"', 'state.colours=["red","green"]', W, ''),
 438:('/steps/select', 'Select multiple by index "0,2" in "Colours"', 'state.colours=["red","blue"]', W, ''),
 439:('/steps/select', 'Select index 2 in button group "Plan"', 'state.plan="Enterprise"', W, ''),
 440:('/steps/select', 'Select text containing "Pro" in button group "Plan"', 'state.plan="Professional"', W, ''),
 441:('/steps/select', 'Select text "Starter" in button group "Plan"', 'state.plan="Starter"', W, ''),
 442:('/steps/select', 'Select label "Monthly" in radio group "Billing"', 'state.billing="monthly"', W, ''),
 450:('/steps/select', 'Uncheck "Subscribe to newsletter" (checked by default)', 'state.newsletter=false', W, ''),
 451:('/steps/select', 'Check radio "Express shipping"', 'state.shipping="express"', W, ''),
 518:('/steps/select', 'Select by value containing "us-" in "Region"', 'state.region="us-east-1"', W, ''),
 519:('/steps/select', 'Verify option "Mars" not present in "Country"', 'Passes', W, ''),
 # ---- verify ----
 66: ('/steps/verify', 'Verify "Profile link" contains "/profile" for href', 'Passes', W, ''),
 105:('/steps/verify', 'Verify "Status message" text contains "saved"', 'Text "All changes saved at 10:00"', W, ''),
 114:('/steps/verify', 'Verify "Order number" has non-empty value', 'Readonly input value "ORD-1001"', W, ''),
 132:('/steps/verify', 'Verify "Order number" inputbox has value "ORD-1001"', 'Passes', W, ''),
 138:('/steps/verify', 'Verify "Greeting" displays text "Hello, tester"', 'Passes', W, ''),
 168:('/steps/verify', 'Verify page does not display "Fatal error"', 'Passes (the text is only inside a hidden template)', W, ''),
 179:('/steps/verify', 'Verify "Greeting" has non-empty text', 'Passes; "Empty box" fails', W, ''),
 184:('/steps/verify', 'Verify "Status message" is present', 'Passes', W, ''),
 464:('/steps/windows', 'Verify link "Open docs in new tab" opens a new tab', 'target=_blank link to /steps/windows/child/', W, ''),
 465:('/steps/verify', 'Verify "Status badge" has class "badge--success"', 'Passes', W, ''),
 467:('/steps/verify', 'Verify page displays text "Verification playground"', 'Passes', W, ''),
 469:('/steps/verify', 'Element "Empty box" is empty', 'Passes', W, ''),
 477:('/steps/verify', 'Verify "Status badge" displays "rgb(21, 128, 61)" for color', 'Passes', W, ''),
 478:('/steps/verify', 'Verify "Status badge" has value "success" for data-status', 'Passes', W, ''),
 529:('/steps/verify', 'Verify "Coupon code" has empty value', 'Passes', W, ''),
 545:('/steps/verify', 'Verify "Greeting" is visible or not null', 'Passes', W, ''),
 548:('/steps/verify', 'Verify "Hidden notice" is not displayed', 'Passes (display:none)', W, ''),
 549:('/steps/verify', 'Verify "Disabled submit" is disabled', 'Passes', W, ''),
 577:('/steps/verify', 'Verify "Order number" inputbox has not value "ORD-9999"', 'Passes', W, ''),
 590:('/steps/verify', 'Verify "Enabled submit" is enabled', 'Passes', W, ''),
 # ---- variables / control ----
 5:  ('/steps/variables', 'Store text of "Invoice total" in invoiceTotal', 'Value "$1,234.50"', W, ''),
 25: ('/steps/variables', 'Store value displayed in "Reference code" in refCode', 'Value "REF-42-ALPHA"', W, ''),
 130:('/steps/variables', 'Store text from "Invoice total" in invoiceTotal', 'Value "$1,234.50"', W, ''),
 158:('/steps/variables', 'Update parameter with data-sku attribute of "Product card"', 'Value "SKU-778"', W, ''),
 487:('/steps/variables', 'Store tag name of "Invoice total"', 'Value "strong"', W, ''),
 499:('/steps/variables', 'Update parameter with text of "Customer name"', 'Value "Grace Hopper"', W, ''),
 561:('/steps/variables', 'Paste stored refCode into "Echo field", verify equals', 'state.echo equals "REF-42-ALPHA"', W, ''),
 566:('/steps/variables', 'Store value from "Reference code" inputbox', 'Value "REF-42-ALPHA"', W, ''),
 567:('/steps/variables', 'Generate 8-char string, enter into "Unique name"', 'state.uniqueName length 8', W, ''),
 574:('/steps/variables', 'Verify stored invoiceTotal equals "$1,234.50"', 'Passes', W, ''),
 575:('/steps/variables', 'Push "apple","pear" into array, enter joined into "Echo field"', 'state.echo="apple,pear"', W, ''),
 669:('/steps/variables', 'Store refCode into env/global variable', 'Reusable in a later test case', W, ''),
 560:('/steps/variables', 'Note: any text', 'No page effect; appears in the run report', W, ''),
 452:('/steps/variables', 'Custom step: read window.testPlayground.version', 'Returns "1.0.0" (exposed on window)', W, ''),
 # ---- loops / conditions ----
 190:('/steps/loops', 'While "Load more" is enabled: click it', 'Stops after 5 clicks; state.loaded=25', W, ''),
 191:('/steps/loops', 'While "Next page" is visible: click it', 'Stops on page 4 (button removed)', W, ''),
 553:('/steps/loops', 'While "All done" is not visible: click "Process one"', 'After 3 clicks "All done" shows', W, ''),
 554:('/steps/loops', 'While text "Pending" is visible: click "Approve next"', '4 pending items approved', W, ''),
 569:('/steps/loops', 'While "Counter" inputbox does not contain 5: click "+1"', 'Counter reaches 5', W, ''),
 570:('/steps/loops', 'While "Mode" inputbox contains "draft": click "Advance"', 'Mode becomes "published" after 2 clicks', W, ''),
 582:('/steps/loops', 'While "Locked action" is disabled: click "Unlock step"', 'Enabled after 3 unlocks', W, ''),
 564:('/steps/loops', 'IF text "Promo available" present -> click "Claim promo"', 'Promo present only with ?promo=1; state.claimed', W, ''),
 586:('/steps/loops', 'AI Verification (IF): "Is the result count zero?"', 'Count header "Venues (0)" with ?empty=1, else "Venues (7)"', W, 'Header deliberately stays "Venues (7)" with ?staleHeader=1'),
 594:('/steps/loops', 'AI Verification (IF) variant', 'Same as 586', W, ''),
 # ---- waits ----
 116:('/steps/waits', 'Wait for 3 seconds', 'Elapsed clock shows >= 3 s', W, ''),
 185:('/steps/waits', 'Wait until "Late button" is visible / enabled', 'Visible after 2 s, enabled after 4 s', W, ''),
 348:('/steps/waits', 'Wait until text "Results ready" is present', 'Appears after renderDelay (default 2500 ms)', W, ''),
 597:('/steps/waits', 'Wait until "Late button" is enabled', 'Enabled after 4 s', W, ''),
 # ---- scroll ----
 186:('/steps/scroll', 'Scroll to "Target 50" into view', 'state.visibleTarget="Target 50"', W, ''),
 523:('/steps/scroll', 'Scroll to bottom', '"Bottom marker" in viewport; state.atBottom=true', W, ''),
 584:('/steps/scroll', 'Scroll one screen bottom', 'scrollY grows by one viewport height', W, ''),
 585:('/steps/scroll', 'Scroll one screen up', 'scrollY shrinks by one viewport height', W, ''),
 593:('/steps/scroll', 'Scroll "Target 30" at the top/center of the screen', 'Target 30 aligned as requested', W, ''),
 642:('/steps/scroll', 'Scroll horizontally in "Wide timeline"', '"Column 40" becomes visible; state.scrollLeft>0', W, ''),
 556:('/steps/scroll', 'Scroll using gesture on "Swipe list"', 'state.swipeScrolled=true', W, 'Gesture step is mobile-oriented'),
 # ---- alerts ----
 103:('/steps/alerts', 'Verify alert is not present', 'Passes before clicking any button', W, ''),
 110:('/steps/alerts', 'Click "Show alert", verify alert "Profile saved"', 'Passes', W, ''),
 147:('/steps/alerts', 'Click "Show confirm", click OK', 'state.confirm=true', W, ''),
 148:('/steps/alerts', 'Click "Show confirm", click Cancel', 'state.confirm=false', W, ''),
 410:('/steps/alerts', 'Click "Show alert in 1s", verify alert present', 'Passes', W, ''),
 # ---- windows ----
 12: ('/steps/windows', 'Open popup, switch to window titled "Child window"', 'Child heading "Child window" visible', W, ''),
 34: ('/steps/windows', 'Click "Open child window" and switch', 'In child: state.opened=true', W, ''),
 42: ('/steps/windows', 'Open a new tab', 'A blank tab opens', W, ''),
 145:('/steps/windows', 'In child, close current window', 'Back on parent; parent shows "Child closed"', W, ''),
 172:('/steps/windows', 'Open 3 children, close all except current', 'Only parent remains', W, ''),
 541:('/steps/windows', 'Open 2 tabs, switch into 2nd tab', 'Tab with heading "Child window"', W, ''),
 544:('/steps/windows', 'Click "Open popup" to open link in popup', 'Popup page "Popup content" shown', W, ''),
 # ---- frames ----
 491:('/steps/frames', 'Switch to frame named "frame-a", click "Insert"', 'Parent state.inserted=true', W, ''),
 # ---- storage / session ----
 67: ('/steps/storage', 'Store all cookies in variable', 'Includes "<ns>_session=abc123"', B, ''),
 68: ('/steps/storage', 'Store cookie named "<ns>_session"', 'Value "abc123"', B, ''),
 141:('/steps/storage', 'Delete cookie "<ns>_session", click "Re-read"', 'state.cookie=null', B, ''),
 143:('/steps/storage', 'Delete all cookies, click "Re-read"', 'state.cookies={}', B, ''),
 170:('/steps/storage', 'Delete local storage, click "Re-read"', 'state.local=null', B, ''),
 587:('/steps/storage', 'Get session storage key "<ns>_step"', 'Value "3"', B, ''),
 588:('/steps/storage', 'Get local storage key "<ns>_token"', 'Value "tok-123"', B, ''),
 637:('/steps/storage', 'Add cookies, click "Re-read"', 'Added cookie appears in state.cookies', B, ''),
 562:('/steps/storage', 'Click "Sign in (sets session)", then Upload Session', 'Session uploaded', B, 'Pair with 563'),
 563:('/steps/storage', 'New run: Restore Session, visit page', 'Page reports which of cookie/local/session survived', B, 'Probe result decides the camera flow'),
 # ---- upload / download / extension ----
 547:('/steps/upload', 'Upload <base>/fixtures/sample.csv to "#file-plain"', 'state.files.plain={name,size,sha256}', W, ''),
 672:('/steps/upload', 'Upload to "#file-toast" and verify toast "Upload complete" within 5 s', 'Toast shows ~1 s after upload, for 3 s', W, ''),
 540:('/steps/extension', 'Upload the extension (fixtures/extension/test-extension.zip)', 'Banner "Test extension active" on every page', B, ''),
 542:('/steps/extension', 'Download extension from <base>/fixtures/extension/test-extension.zip', 'Same banner', B, ''),
 580:('/steps/download', 'Download file by click on "Download CSV"', 'File orders.csv, 11 lines (header + 10)', W, ''),
 581:('/steps/download', 'AI Document Ask: how many rows in invoice.pdf?', 'Answer: 5 line items, total $510.50', W, ''),
 644:('/steps/download', 'Generate Document', 'Platform feature; page offers a form whose data a generated document can use', W, ''),
 # ---- camera ----
 638:('/steps/camera', 'Set camerafile (front.y4m) and restore session, capture', 'state.detected="FRONT" (green frame); with back file "BACK" (blue)', B, 'Camera + restore are tested separately from upload'),
 # ---- AI ----
 568:('/steps/ai', 'AI Agent: add 2 "Blue mug" to the cart and check out', 'state.order={item:"Blue mug",qty:2}', W, ''),
 573:('/steps/ai', 'AI Ask: what is the delivery date shown?', 'Answer "15 December 2026"', W, ''),
 583:('/steps/ai', 'AI Verification: the order status is Shipped and the badge is green', 'True', W, ''),
 576:('/steps/ai', 'Generate heatmap', 'Heatmap over a page with known hot spots', W, ''),
 # ---- api / server ----
 2:  ('/steps/api', 'REST_API GET {api}/records?ns=<ns>&kind=demo', '200 JSON array', S, 'Needs the playground backend'),
 595:('/steps/api', 'Gets the value of api "getRecords" -> firstId', 'First record id', S, 'Needs the playground backend'),
 641:('/steps/api', 'Database Verification: SELECT name FROM public.customers WHERE id=1', '"Ada Lovelace"', I, 'Needs a database connection from the test tool to the playground Postgres (read-only role)'),
 532:('/steps/auth', 'Authentication with tester / playground on {api}/basic', 'Page text "Authenticated as tester"', S, 'Needs the playground backend'),
 # ---- auth integrations ----
 539:('/steps/auth', 'Login social account', 'Not provided by the playground', X, 'Needs a real social-login account'),
 543:('/steps/auth', 'Login social account + Authenticator', 'Not provided by the playground', X, 'Needs a real social-login account'),
 598:('/steps/auth', 'Login enterprise account + Authenticator', 'Not provided by the playground', X, 'Needs a real enterprise account'),
 634:('/steps/auth', 'Login enterprise account', 'Not provided by the playground', X, 'Needs a real enterprise account'),
 546:('/steps/auth', 'Get OTP from the phone number', 'Page shows SMS-style code (mock)', I, 'Needs a real SMS sender; mock only'),
 550:('/steps/auth', 'Extract value from <email> email using regex \\d{6}', 'The 6-digit code', I, 'Real only when the server has an email key; mock inbox otherwise'),
 551:('/steps/auth', 'Create email and store in variable, use on "Email OTP" form', 'Form accepts the address', I, 'Real only when the server has an email key'),
 648:('/steps/auth', 'Get TOTP from issuer "Test Playground" (secret shown on page)', 'Code accepted; state.totpOk=true', I, 'Configure the published secret in the test tool'),
 671:('/steps/auth', 'Solve the checkbox captcha', 'Mock captcha ticks; state.captcha=true', I, 'Mock captcha only'),
 # ---- drag ----
 559:('/steps/drag', 'Drag from "Card T-3" to "Done column"', 'state.board.Done[0]="T-3"; success without state change = fail', W, ''),
}
UNSUPPORTED = {539, 543, 598, 634}
BLOCKED = {641: 'Needs a database connection from the test tool', 546: 'No free SMS sender'}

rows = []
with open('scripts/steps.tsv') as f:
    for line in f:
        sid, name, text = line.rstrip('\n').split('\t')
        sid = int(sid)
        page, target, expected, env, note = SPEC[sid]
        status = 'unsupported' if sid in UNSUPPORTED else 'blocked' if sid in BLOCKED else 'implemented'
        rows.append(dict(id=sid, name=name, text=text, env=env, page=page, target=target, expected=expected,
                         status=status, note=note or BLOCKED.get(sid, '')))
missing = [r['id'] for r in rows if r['id'] not in SPEC]
assert not missing, missing
os.makedirs('src/coverage', exist_ok=True); os.makedirs('coverage', exist_ok=True)
json.dump(rows, open('src/coverage/steps.json', 'w'), indent=1)
with open('coverage/steps.csv', 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
pages = sorted({r['page'] for r in rows})
print(len(rows), 'steps;', len(pages), 'baseline pages:', ' '.join(pages))

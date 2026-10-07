import { expect, test, type Page } from '@playwright/test'
import { expectState, go, pageState } from './helpers'

type S = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

async function startIdentity(page: Page, query = '', doc = 'ID card', next = 'Continue') {
  await go(page, `identity/${query}`)
  await page.getByRole('button', { name: 'Start' }).click()
  await page.getByLabel(doc).check()
  await page.getByLabel('I agree to the Terms of Use and Privacy Policy').check()
  await page.getByRole('button', { name: next, exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Enable camera access' })).toBeVisible()
}

test.describe('identity', () => {
  test('I1 camera path captures FRONT from the fake camera and resumes after reload', async ({ page }) => {
    await startIdentity(page)
    await page.getByRole('button', { name: 'Enable access' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Take photo' }).click()
    await expect(page.getByText('Front of document')).toBeVisible()
    await expect(page.getByTestId('camera-ready')).toHaveText('Camera ready')
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: 'Capture' }).click()
    await expect(page.getByText('Detected: FRONT')).toBeVisible()
    await expectState(page, (s: S) => s.captures.front.detected === 'FRONT' && s.captures.front.source === 'camera')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Back of document')).toBeVisible()
    await expectState(page, (s: S) => s.screen === 'back')
    // the session is restored: same screen after reload (back.y4m would be swapped in by "Set camerafile and restore session")
    await page.reload()
    await expect(page.getByText('Back of document')).toBeVisible()
    await expectState(page, (s: S) => s.restoredFrom === 'localStorage' && s.captures.front.detected === 'FRONT')
  })

  test('I2 upload path fills FRONT then BACK and completes', async ({ page }) => {
    await startIdentity(page, '', 'Passport')
    const input = page.getByTestId('document-detector-capture-button')
    await input.setInputFiles('public/fixtures/front.png')
    await expectState(page, (s: S) => s.captures.front.detected === 'FRONT' && s.captures.front.source === 'upload')
    await input.setInputFiles('public/fixtures/back.png')
    await expectState(page, (s: S) => s.captures.back.detected === 'BACK' && s.captures.back.source === 'upload')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Your documents were submitted')).toBeVisible()
    await expectState(page, (s: S) => s.completed === true && s.docType === 'Passport')
  })

  test('I3 denied camera offers upload and never blocks', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'))
    })
    await startIdentity(page, '', 'Driver licence')
    await page.getByRole('button', { name: 'Enable access' }).click()
    await expect(page.getByText('Camera unavailable')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Upload instead' })).toBeVisible()
    await expectState(page, (s: S) => s.cameraStatus === 'denied')
    await page.getByTestId('document-detector-capture-button').setInputFiles('public/fixtures/front.png')
    await expectState(page, (s: S) => s.captures.front.detected === 'FRONT')
  })

  test('I5 variant b uses Next', async ({ page }) => {
    await startIdentity(page, '?variant=b', 'Passport', 'Next')
    await expectState(page, (s: S) => s.screen === 'camera')
  })
})

test.describe('uploads', () => {
  test('U1 U2 plain and hidden inputs record the real file', async ({ page }) => {
    await go(page, 'uploads/')
    await page.locator('#file-plain-u').setInputFiles('public/fixtures/sample.csv')
    await page.getByTestId('hidden-upload-input').setInputFiles('public/fixtures/avatar.png')
    await expectState(page, (s: S) => s.uploads.plain.name === 'sample.csv' && s.uploads.plain.sha256.length === 64 && s.uploads.hidden.name === 'avatar.png')
  })

  test('U3 drop zone has no input and only accepts drop events', async ({ page }) => {
    await go(page, 'uploads/')
    const zone = page.getByTestId('drop-zone')
    await expect(zone.locator('input')).toHaveCount(0)
    await expectState(page, (s: S) => /no input element/.test(s.dropZone.note))
    const dt = await page.evaluateHandle(() => {
      const d = new DataTransfer()
      d.items.add(new File(['hello'], 'notes.txt', { type: 'text/plain' }))
      return d
    })
    await zone.dispatchEvent('drop', { dataTransfer: dt })
    await expectState(page, (s: S) => s.uploads.dropped[0].name === 'notes.txt' && s.uploads.dropped[0].size === 5)
  })

  test('U4 CSV validation', async ({ page }) => {
    await go(page, 'uploads/')
    const input = page.locator('#users-csv')
    await input.setInputFiles('public/fixtures/bad-missing-email.csv')
    await expect(page.getByText('Missing column: email')).toBeVisible()
    await input.setInputFiles('public/fixtures/bad-empty.csv')
    await expect(page.getByText('File is empty')).toBeVisible()
    await input.setInputFiles('public/fixtures/sample.csv')
    await expectState(page, (s: S) => s.csv.rows === 10 && s.csv.error === null)
  })

  test('U5 toast appears after renderDelay and disappears', async ({ page }) => {
    await go(page, 'uploads/?renderDelay=1000')
    await page.locator('#toast-upload').setInputFiles('public/fixtures/receipt.png')
    await expectState(page, (s: S) => s.uploads.toast.name === 'receipt.png')
    await expect(page.getByTestId('toast').filter({ hasText: 'Uploaded' })).toHaveCount(0)
    await expect(page.getByTestId('toast').filter({ hasText: 'Uploaded' })).toBeVisible({ timeout: 3000 })
    await expect(page.getByTestId('toast').filter({ hasText: 'Uploaded' })).toHaveCount(0, { timeout: 4000 })
  })

  test('U6 upload inside a named iframe reaches the parent', async ({ page }) => {
    await go(page, 'uploads/')
    const frame = page.frameLocator('iframe[name="upload-frame"]')
    await frame.getByTestId('framed-file').setInputFiles('public/fixtures/sample.csv')
    await expect(frame.getByTestId('framed-received')).toContainText('sample.csv')
    await expectState(page, (s: S) => s.frameUpload.name === 'sample.csv')
  })

  test('U7 Excel line items total and header check', async ({ page }) => {
    await go(page, 'uploads/')
    await page.locator('#line-items').setInputFiles('public/fixtures/line-items.xlsx')
    await expect(page.getByText('Total: 510.50')).toBeVisible()
    await expectState(page, (s: S) => s.excel.rows === 5 && s.excel.total === 510.5)
    await page.locator('#line-items').setInputFiles('public/fixtures/line-items-bad-headers.xlsx')
    await expectState(page, (s: S) => /^Wrong headers/.test(s.excel.error))
  })

  test('U8 multiple files and image filter', async ({ page }) => {
    await go(page, 'uploads/')
    await page.locator('#attachments').setInputFiles(['public/fixtures/sample.csv', 'public/fixtures/notes.txt'])
    await page.locator('#profile-photo').setInputFiles('public/fixtures/notes.txt')
    await expect(page.getByText('Only image files are allowed')).toBeVisible()
    await expectState(page, (s: S) => s.uploads.multi.length === 2 && s.imageRejected === 'notes.txt')
  })

  test('variant b drifts the plain input id', async ({ page }) => {
    await go(page, 'uploads/?variant=b')
    await expect(page.locator('#file-plain-u')).toHaveCount(0)
    await expect(page.getByLabel('Attachment (plain)')).toBeVisible()
  })
})

test.describe('frames', () => {
  test('F1 named add-in inserts into the document', async ({ page }) => {
    await go(page, 'frames/')
    await page.frameLocator('iframe[name="sidebar-addin"]').getByRole('button', { name: 'Insert' }).click()
    await expect(page.getByTestId('inserted-text')).toHaveText('Hello from the add-in')
    await expectState(page, (s: S) => s.inserts === 1 && s.messages.length === 1)
  })

  test('F2 three nested frames', async ({ page }) => {
    await go(page, 'frames/')
    const deep = page.frameLocator('iframe[name="nest-1"]').frameLocator('iframe[name="nest-2"]').frameLocator('iframe[name="nest-3"]')
    await deep.getByLabel('Deep field').fill('Turing')
    await deep.getByRole('button', { name: 'Deep button' }).click()
    await expectState(page, (s: S) => s.deep.value === 'Turing' && s.deep.clicks === 1)
  })

  test('F3 frame name changes per load with unstableIds', async ({ page }) => {
    await go(page, 'frames/?unstableIds=true&seed=3')
    const first = await page.getByTestId('dynamic-frame-name').textContent()
    expect(first).toMatch(/^frame-[a-z0-9]{6}$/)
    await page.reload()
    const second = await page.getByTestId('dynamic-frame-name').textContent()
    expect(second).not.toBe(first)
    await page.frameLocator(`iframe[name="${second}"]`).getByRole('button', { name: 'Confirm' }).click()
    await expectState(page, (s: S) => s.dynamicConfirms === 1 && s.dynamicFrameName === second)
  })

  test('F4 hover menu inside a frame', async ({ page }) => {
    await go(page, 'frames/')
    const f = page.frameLocator('iframe[name="hover-menu"]')
    await f.getByText('Actions', { exact: true }).hover()
    await f.getByRole('menuitem', { name: 'Export' }).click()
    await expectState(page, (s: S) => s.menu === 'Export')
  })

  test('F5 variant b drifts embed labels', async ({ page }) => {
    await go(page, 'frames/?variant=b')
    const f = page.frameLocator('iframe[name="sidebar-addin"]')
    await expect(f.getByRole('button', { name: 'Insert', exact: true })).toHaveCount(0)
    await f.getByRole('button', { name: 'Insert into document' }).click()
    await expectState(page, (s: S) => s.inserts === 1)
  })

  test('F6 overlay intercepts clicks on the add-in', async ({ page }) => {
    await go(page, 'frames/?overlay=true&overlayMs=5000')
    await expect(page.getByTestId('trap-overlay')).toBeAttached()
    await page.mouse.click(10, 10)
    await expect(page.locator('html')).toHaveAttribute('data-tp-intercepted-clicks', '1')
    expect(((await pageState(page)) as S).inserts).toBeUndefined()
    await page.frameLocator('iframe[name="sidebar-addin"]').getByRole('button', { name: 'Insert' }).click({ timeout: 9000 })
    await expectState(page, (s: S) => s.inserts === 1)
  })

  test('F7 opaque-origin widget and long frame', async ({ page }) => {
    await go(page, 'frames/')
    await page.frameLocator('iframe[name="cross-origin-widget"]').getByRole('button', { name: 'Send ping' }).click()
    await expectState(page, (s: S) => s.ping === 1 && s.pingOrigin === 'null')
    await page.frameLocator('iframe[name="long-frame"]').getByRole('button', { name: 'Far button' }).click()
    await expectState(page, (s: S) => s.farClicks === 1)
  })
})

test.describe('widgets', () => {
  test('W1 portal dropdown and decoy', async ({ page }) => {
    await go(page, 'widgets/?duplicateLabels=true')
    await page.getByTestId('department').click()
    const list = page.getByTestId('department-listbox')
    await expect(list.locator('xpath=..')).toHaveJSProperty('tagName', 'BODY')
    await list.getByRole('option', { name: 'Finance' }).click()
    await expectState(page, (s: S) => s.department === 'Finance' && s.decoy === undefined)
    await page.getByTestId('department-decoy').click()
    await page.getByTestId('department-decoy-listbox').getByRole('option', { name: 'Sales' }).click()
    await expectState(page, (s: S) => s.decoy === 'department:Sales' && s.department === 'Finance')
  })

  test('W2 autocomplete options arrive after netDelay', async ({ page }) => {
    await go(page, 'widgets/?netDelay=1200')
    await page.getByLabel('City').fill('Lis')
    await expect(page.getByRole('option', { name: 'Lisbon' })).toHaveCount(0)
    await page.getByRole('option', { name: 'Lisbon' }).click()
    await expectState(page, (s: S) => s.city === 'Lisbon')
  })

  test('W3 chips and clear all', async ({ page }) => {
    await go(page, 'widgets/')
    await page.getByLabel('Skills', { exact: true }).click()
    await page.getByRole('option', { name: 'Testing' }).click()
    await page.getByRole('option', { name: 'Design' }).click()
    await expectState(page, (s: S) => s.skills.join() === 'Testing,Design')
    await page.getByRole('button', { name: 'Clear all' }).click()
    await expectState(page, (s: S) => s.skills.length === 0 && s.skillsCleared === 1)
  })

  test('W4 prefilled status must be cleared first', async ({ page }) => {
    await go(page, 'widgets/')
    await expectState(page, (s: S) => s.status === 'Active')
    await page.getByRole('button', { name: 'Clear Status' }).click()
    await page.getByRole('combobox', { name: 'Status' }).click()
    await page.getByRole('option', { name: 'Paused' }).click()
    await expectState(page, (s: S) => s.status === 'Paused' && s.statusCleared === true)
  })

  test('W5 native and custom date with frozen clock', async ({ page }) => {
    await go(page, 'widgets/?now=2026-03-10T09:00:00Z')
    await page.getByLabel('Start date').fill('2026-03-15')
    await page.getByLabel('End date', { exact: true }).click()
    await expect(page.getByTestId('calendar-month')).toHaveText('March 2026')
    await page.getByTestId('calendar').getByRole('gridcell', { name: '20', exact: true }).click()
    await expectState(page, (s: S) => s.startDate === '2026-03-15' && s.endDate === '2026-03-20' && s.calendarRenders >= 1)
  })

  test('W6 kanban drag T-3 to Done', async ({ page }) => {
    await go(page, 'widgets/')
    await page.getByTestId('card-T-3').dragTo(page.getByTestId('column-Done'))
    await expectState(page, (s: S) => s.kanban.card === 'T-3' && s.kanban.column === 'Done' && s.kanban.index === 1)
  })

  test('W6 kanban pointer drag without HTML5 events', async ({ page }) => {
    await go(page, 'widgets/')
    await page.getByTestId('column-Doing').scrollIntoViewIfNeeded()
    await page.getByTestId('card-T-1').dispatchEvent('pointerdown', { clientX: 0, clientY: 0, bubbles: true })
    const box = (await page.getByTestId('column-Doing').boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + box.height - 10
    await page.evaluate(([x, y]) => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y }))
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y }))
    }, [x, y])
    await expectState(page, (s: S) => s.kanban.card === 'T-1' && s.kanban.column === 'Doing' && s.kanban.method === 'pointer')
  })

  test('W7 role-less radios and toggle', async ({ page }) => {
    await go(page, 'widgets/')
    await expect(page.getByRole('radio')).toHaveCount(0)
    await page.getByText('Pro', { exact: true }).click()
    await page.getByText('Email alerts').click()
    await expectState(page, (s: S) => s.plan === 'Pro' && s.emailAlerts === true)
  })

  test('W8 long list, editors, slider, tooltip', async ({ page }) => {
    await go(page, 'widgets/')
    await page.getByRole('combobox', { name: 'Timezone' }).click()
    await page.getByRole('option', { name: '(UTC+09:00) Tokyo' }).click()
    await page.getByRole('textbox', { name: 'Description' }).fill('Quarterly plan')
    await page.getByLabel('Volume').fill('70')
    await page.getByRole('button', { name: 'Preferences' }).hover()
    await expect(page.getByRole('tooltip')).toHaveText('Open preferences')
    await expectState(page, (s: S) => s.timezone === '(UTC+09:00) Tokyo' && s.timezoneIndex === 100 && s.description === 'Quarterly plan' && s.plainNotes === undefined && s.volume === 70)
  })

  test('variant b drifts widget labels', async ({ page }) => {
    await go(page, 'widgets/?variant=b')
    await expect(page.getByLabel('Town or city')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove status' })).toBeVisible()
    await expect(page.getByTestId('column-Done')).toContainText('Completed')
  })
})

test.describe('dynamic', () => {
  test('D1 results ready after the default delay', async ({ page }) => {
    await go(page, 'dynamic/')
    await expect(page.getByText('Results ready')).toHaveCount(0)
    await expect(page.getByText('Results ready')).toBeVisible({ timeout: 5000 })
    await expectState(page, (s: S) => s.ready === true && s.resultsReadyAfterMs >= 2400)
  })

  test('D2 submit enabled after name', async ({ page }) => {
    await go(page, 'dynamic/')
    await expect(page.getByRole('button', { name: 'Submit' })).toBeDisabled()
    await page.getByLabel('Name').fill('Ada')
    await page.getByRole('button', { name: 'Submit' }).click()
    await expectState(page, (s: S) => s.submitted === 'Ada')
  })

  test('D3 overlay intercepts the first click on Save', async ({ page }) => {
    await go(page, 'dynamic/?overlay=true&overlayMs=5000')
    await expect(page.getByTestId('trap-overlay')).toBeAttached()
    const box = (await page.getByRole('button', { name: 'Save', exact: true }).boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.locator('html')).toHaveAttribute('data-tp-intercepted-clicks', '1')
    expect(((await pageState(page)) as S).saved).toBeUndefined()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expectState(page, (s: S) => s.saved === true)
  })

  test('D4 works with the got-it popup', async ({ page }) => {
    await go(page, 'dynamic/?popup=gotit&popupDelay=500')
    await page.getByRole('button', { name: 'Got it' }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expectState(page, (s: S) => s.saved === true)
  })

  test('D5 replaced button counts one click', async ({ page }) => {
    await go(page, 'dynamic/')
    await expect(page.getByText('Data refreshed')).toBeVisible()
    await page.getByRole('button', { name: 'Refresh data' }).click()
    await expectState(page, (s: S) => s.refreshClicks === 1 && s.refreshClickedNode === 2 && s.refreshNodeVersion === 2)
  })

  test('D6 double click on the menu item hits Save draft', async ({ page }) => {
    await go(page, 'dynamic/')
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('menuitem', { name: 'Close menu' }).click()
    await expectState(page, (s: S) => s.menuClosed === 1 && s.saveDraftClicks === 0)
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('menuitem', { name: 'Close menu' }).dblclick()
    await expectState(page, (s: S) => s.menuClosed === 2 && s.saveDraftClicks >= 1)
  })

  test('D7 late address overwrites early typing only', async ({ page }) => {
    await go(page, 'dynamic/?renderDelay=2000')
    await page.getByLabel('Street').fill('Early Street')
    await expect(page.getByText('Address loaded')).toBeVisible()
    await expect(page.getByLabel('Street')).toHaveValue('1 Analytical Way')
    await expectState(page, (s: S) => s.addressOverwritten.includes('street'))
    await page.getByLabel('Street').fill('12 Engine Street')
    await expectState(page, (s: S) => s.address.street === '12 Engine Street')
  })

  test('D8 toast, covered and moving targets, load more', async ({ page }) => {
    await go(page, 'dynamic/?netDelay=700')
    await page.getByRole('button', { name: 'Show toast' }).click()
    await expect(page.getByTestId('toast').filter({ hasText: 'Changes applied' })).toBeVisible()
    await expect(page.getByTestId('toast').filter({ hasText: 'Changes applied' })).toHaveCount(0, { timeout: 4000 })
    await page.getByRole('button', { name: 'Covered button' }).click()
    await expectState(page, (s: S) => s.movingPosition === 'moved')
    await page.getByRole('button', { name: 'Moving target' }).click()
    await page.getByRole('button', { name: 'Load more results' }).click()
    await expect(page.getByText('Result 10')).toBeVisible()
    await expectState(page, (s: S) => s.coveredClicks === 1 && s.movingClicks === 1 && s.movingPositionAtClick === 'moved' && s.results === 10)
  })

  test('variant b renames buttons', async ({ page }) => {
    await go(page, 'dynamic/?variant=b')
    await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled()
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expectState(page, (s: S) => s.saved === true)
  })
})

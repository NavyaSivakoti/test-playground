import { expect, test } from '@playwright/test'
import { createHmac } from 'node:crypto'
import { expectState, go, pageState } from './helpers'

// ---------- alerts ----------
test('alerts: alert, confirm, prompt and delayed alert record their results', async ({ page }) => {
  await go(page, 'steps/alerts/?ns=pwalerts')
  const seen: string[] = []
  let confirmAnswer = true
  page.on('dialog', async (d) => {
    seen.push(`${d.type()}:${d.message()}`)
    if (d.type() === 'confirm') await (confirmAnswer ? d.accept() : d.dismiss())
    else if (d.type() === 'prompt') await d.accept('Grace')
    else await d.accept()
  })
  await page.getByRole('button', { name: 'Show alert', exact: true }).click()
  await expectState(page, (s) => s.alerts === 1)
  expect(seen).toContain('alert:Profile saved')
  await page.getByRole('button', { name: 'Show confirm' }).click()
  await expectState(page, (s) => s.confirm === true)
  await expect(page.getByText('Confirm result: OK')).toBeVisible()
  confirmAnswer = false
  await page.getByRole('button', { name: 'Show confirm' }).click()
  await expectState(page, (s) => s.confirm === false)
  await page.getByRole('button', { name: 'Show prompt' }).click()
  await expectState(page, (s) => s.promptValue === 'Grace')
  await page.getByRole('button', { name: 'Show alert in 1s' }).click()
  await expectState(page, (s) => s.delayedAlert === true)
  expect(seen).toContain('alert:Delayed alert')
})

test('alerts: variant b drifts labels', async ({ page }) => {
  await go(page, 'steps/alerts/?variant=b')
  await expect(page.getByRole('button', { name: 'Ask for name' })).toBeVisible()
  await expect(page.getByTestId('alert-open')).toBeVisible()
})

// ---------- windows ----------
test('windows: child window opens, records state, closes and parent notices', async ({ page, context }) => {
  await go(page, 'steps/windows/?ns=pwwin')
  const [child] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Open child window' }).click()])
  await child.waitForLoadState()
  await expect(child.getByRole('heading', { name: 'Child window' })).toBeVisible()
  await expect(child).toHaveTitle('Child window')
  await expectState(child, (s) => s.opened === true && s.hasOpener === true && s.windowName === 'tp-child')
  await page.getByRole('button', { name: 'Message children' }).click()
  await expectState(child, (s) => (s.messages as string[])?.[0] === 'Hello tp-child')
  await child.getByRole('button', { name: 'Close this window' }).click()
  await expect(page.getByText('Child closed')).toBeVisible()
  await expectState(page, (s) => s.childClosed === true)
})

test('windows: popup, new-tab link and three children', async ({ page, context }) => {
  await go(page, 'steps/windows/?ns=pwwin2')
  const [popup] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Open popup' }).click()])
  await expect(popup.getByRole('heading', { name: 'Popup content' })).toBeVisible()
  const link = page.getByRole('link', { name: 'Open docs in new tab' })
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('href', /\/steps\/windows\/child\//)
  const [tab] = await Promise.all([context.waitForEvent('page'), link.click()])
  await expect(tab.getByRole('heading', { name: 'Child window' })).toBeVisible()
  await expectState(tab, (s) => s.hasOpener === false)
  await page.getByRole('button', { name: 'Open 3 children' }).click()
  await expect.poll(() => context.pages().length).toBe(6)
  await expectState(page, (s) => (s.opened as string[]).includes('tp-child-3') && (s.opened as string[]).includes('tp-popup'))
  // close all except the current window
  for (const p of context.pages()) if (p !== page) await p.close()
  expect(context.pages()).toHaveLength(1)
  await expect(page.getByText('Child closed')).toBeVisible()
})

// ---------- frames ----------
test('frames: named frame, nested chain and srcdoc report to the parent', async ({ page }) => {
  await go(page, 'steps/frames/?ns=pwframes')
  await page.frameLocator('iframe[name="frame-a"]').getByRole('button', { name: 'Insert' }).click()
  await expectState(page, (s) => s.inserted === true)
  await expect(page.getByText('Inserted from frame A')).toBeVisible()
  const deep = page.frameLocator('iframe[name="frame-level-1"]').frameLocator('iframe[name="frame-level-2"]').frameLocator('iframe[name="frame-level-3"]')
  await deep.getByLabel('Deep value').fill('deep-42')
  await expectState(page, (s) => s.deepValue === 'deep-42')
  await page.frameLocator('iframe[name="frame-srcdoc"]').getByRole('button', { name: 'Srcdoc button' }).click()
  await expectState(page, (s) => s.srcdocClicked === true)
  // Playwright's frame-by-name API
  const names = page.frames().map((f) => f.name())
  expect(names).toEqual(expect.arrayContaining(['frame-a', 'frame-level-1', 'frame-level-2', 'frame-level-3', 'frame-srcdoc']))
})

// ---------- storage ----------
test('storage: seed, read, delete and probe', async ({ page, context }) => {
  await go(page, 'steps/storage/?ns=pwstore')
  await expectState(page, (s) => s.autoSeeded === true && s.cookie === 'abc123' && s.local === 'tok-123' && s.session === '3' && s.idb === 'tok-123')
  const s0 = await pageState(page)
  expect(s0.probe).toEqual({ cookie: false, local: false, session: false })
  const cookies = await context.cookies()
  expect(cookies.find((c) => c.name === 'pwstore_session')?.value).toBe('abc123')
  expect(await page.evaluate(() => localStorage.getItem('pwstore_token'))).toBe('tok-123')
  expect(await page.evaluate(() => sessionStorage.getItem('pwstore_step'))).toBe('3')

  await context.clearCookies({ name: 'pwstore_session' })
  await page.getByRole('button', { name: 'Re-read' }).click()
  await expectState(page, (s) => s.cookie === null)
  await expect(page.getByTestId('cookie-value')).toHaveText('(none)')

  await context.addCookies([{ name: 'pwstore_added', value: 'yes', url: page.url() }])
  await page.getByRole('button', { name: 'Re-read' }).click()
  await expectState(page, (s) => (s.cookies as Record<string, string>).pwstore_added === 'yes')

  await context.clearCookies()
  await page.evaluate(() => localStorage.clear())
  await page.getByRole('button', { name: 'Re-read' }).click()
  await expectState(page, (s) => JSON.stringify(s.cookies) === '{}' && s.local === null)

  await page.getByRole('button', { name: 'Sign in (sets session)' }).click()
  await expectState(page, (s) => typeof s.signedInAt === 'string' && s.cookie === 'abc123')
  // a reload keeps cookie + local + session: the probe reports all three
  await page.reload()
  await expectState(page, (s) => JSON.stringify(s.probe) === JSON.stringify({ cookie: true, local: true, session: true }) && s.autoSeeded === false)
  await expect(page.getByTestId('probe-session')).toHaveText('yes')
})

test('storage: restore of a saved session (new context) reports which stores survived', async ({ browser, page }) => {
  await go(page, 'steps/storage/?ns=pwrestore')
  await page.getByRole('button', { name: 'Sign in (sets session)' }).click()
  await expectState(page, (s) => typeof s.signedInAt === 'string')
  const saved = await page.context().storageState()
  const ctx = await browser.newContext({ storageState: saved, baseURL: test.info().project.use.baseURL })
  const p2 = await ctx.newPage()
  await go(p2, 'steps/storage/?ns=pwrestore')
  // storageState carries cookies + localStorage, not sessionStorage
  await expectState(p2, (s) => JSON.stringify(s.probe) === JSON.stringify({ cookie: true, local: true, session: false }))
  await ctx.close()
})

// ---------- upload ----------
test('upload: plain file and toast file', async ({ page }) => {
  await go(page, 'steps/upload/?ns=pwupload')
  await page.locator('#file-plain').setInputFiles('public/fixtures/sample.csv')
  await expectState(page, (s) => {
    const f = (s.files as Record<string, { name: string; size: number; sha256: string }>).plain
    return f.name === 'sample.csv' && f.size > 0 && f.sha256.length === 64
  })
  await page.locator('#file-toast').setInputFiles('public/fixtures/notes.txt')
  await expectState(page, (s) => (s.files as Record<string, { name: string }>).toast?.name === 'notes.txt')
  await expect(page.getByTestId('toast').filter({ hasText: 'Upload complete' })).toBeVisible({ timeout: 5000 })
  await expect(page.getByTestId('toast').filter({ hasText: 'Upload complete' })).toBeHidden({ timeout: 6000 })
})

test('upload: unstableIds changes the id', async ({ page }) => {
  await go(page, 'steps/upload/?unstableIds=true&seed=3')
  await expect(page.locator('#file-plain')).toHaveCount(0)
  await expect(page.getByTestId('file-plain')).toHaveCount(1)
})

// ---------- download ----------
test('download: CSV has 11 lines, fixtures download, document preview', async ({ page }) => {
  await go(page, 'steps/download/?ns=pwdl')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download CSV' }).click()])
  expect(dl.suggestedFilename()).toBe('orders.csv')
  const fs = await import('node:fs')
  const text = fs.readFileSync((await dl.path())!, 'utf8')
  expect(text.trim().split('\n')).toHaveLength(11)
  await expectState(page, (s) => (s.downloads as { name: string; lines: number }[])[0].lines === 11)
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download invoice PDF' }).click()])
  expect(pdf.suggestedFilename()).toBe('invoice.pdf')
  await page.getByLabel('Customer').fill('Grace Hopper')
  await page.getByLabel('Amount').fill('510.50')
  await page.getByRole('button', { name: 'Generate document' }).click()
  await expect(page.getByTestId('document-preview')).toContainText('Quote for Grace Hopper')
  await expect(page.getByTestId('document-preview')).toContainText('Amount: $510.50')
  await expectState(page, (s) => (s.document as { customer: string }).customer === 'Grace Hopper')
})

// ---------- extension ----------
test('extension: detects the marker attribute', async ({ page }) => {
  await go(page, 'steps/extension/')
  await expect(page.getByText('Extension not detected')).toBeVisible()
  await expectState(page, (s) => s.extension === 'none')
  // simulate the content script
  await page.evaluate(() => document.documentElement.setAttribute('data-tp-extension', 'active'))
  await expect(page.getByText('Extension detected', { exact: true })).toBeVisible()
  await expectState(page, (s) => s.extension === 'active')
  const res = await page.request.get('fixtures/extension/test-extension.zip')
  expect(res.ok()).toBe(true)
})

// ---------- camera ----------
test('camera: fake device shows the FRONT card and progress survives reload', async ({ page }) => {
  await page.context().grantPermissions(['camera'])
  await go(page, 'steps/camera/?ns=pwcam')
  await expectState(page, (s) => s.camera === 'live')
  await expect.poll(() => page.getByTestId('camera-preview').evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0)
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Capture' }).click()
  await expectState(page, (s) => s.detected === 'FRONT' && (s.captures as unknown[]).length === 1 && s.match === true)
  await expect(page.getByText('Detected: FRONT')).toBeVisible()
  await page.reload()
  await expectState(page, (s) => s.restoredFrom === 'localStorage' && (s.captures as unknown[]).length === 1)
  await page.evaluate(() => localStorage.removeItem('pwcam_camera'))
  await page.reload()
  await expectState(page, (s) => s.restoredFrom === 'sessionStorage')
})

test('camera: denied permission falls back to upload', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL })
  const page = await ctx.newPage()
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'))
  })
  await go(page, 'steps/camera/?ns=pwcamdeny')
  await expect(page.getByText('Camera unavailable — upload instead')).toBeVisible()
  await page.locator('#camera-upload').setInputFiles('public/fixtures/back.png')
  await expectState(page, (s) => s.detected === 'BACK' && s.camera === 'unavailable')
  await ctx.close()
})

// ---------- ai ----------
test('ai: order flow and facts', async ({ page }) => {
  await go(page, 'steps/ai/')
  await page.getByLabel('Quantity').fill('2')
  await page.getByRole('button', { name: 'Add to cart' }).click()
  await page.getByRole('button', { name: 'Checkout' }).click()
  await expectState(page, (s) => JSON.stringify(s.order) === JSON.stringify({ item: 'Blue mug', qty: 2 }))
  await expect(page.getByText('Delivery date: 15 December 2026')).toBeVisible()
  await expect(page.getByTestId('status-badge')).toHaveText('Shipped')
  const bg = await page.getByTestId('status-badge').evaluate((e) => getComputedStyle(e).backgroundColor)
  expect(bg).toBe('rgb(22, 163, 74)')
})

test('ai: variant b drifts the cart button', async ({ page }) => {
  await go(page, 'steps/ai/?variant=b')
  await page.getByRole('button', { name: 'Add to basket' }).click()
  await page.getByRole('button', { name: 'Checkout' }).click()
  await expectState(page, (s) => (s.order as { qty: number }).qty === 1)
})

// ---------- api ----------
test('api: local simulation of records and customers', async ({ page }) => {
  await go(page, 'steps/api/?ns=pwapi')
  await page.getByRole('button', { name: 'Seed demo records' }).click()
  await expectState(page, (s) => typeof s.firstId === 'string' && s.demoCount === 3)
  await page.getByRole('button', { name: 'Send request' }).click()
  await expectState(page, (s) => {
    const r = s.lastResponse as { status: number; body: unknown[] }
    return r.status === 200 && Array.isArray(r.body) && r.body.length === 3
  })
  await page.getByLabel('Example request').selectOption({ label: 'GET customers/1' })
  await page.getByRole('button', { name: 'Send request' }).click()
  await expectState(page, (s) => (s.lastResponse as { body: { name: string } }).body.name === 'Ada Lovelace')
  await expect(page.getByTestId('db-sql')).toHaveText('SELECT name FROM public.customers WHERE id=1')
  await expect(page.getByTestId('db-expected')).toHaveText('Ada Lovelace')
})

test('api: api500 bug', async ({ page }) => {
  await go(page, 'steps/api/?bugs=api500')
  await page.getByRole('button', { name: 'Send request' }).click()
  await expect(page.getByText('Status 500')).toBeVisible()
  await expectState(page, (s) => (s.lastResponse as { status: number }).status === 500)
})

// ---------- auth ----------
function b32(s: string) {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0, v = 0
  const out: number[] = []
  for (const c of s) {
    v = (v << 5) | a.indexOf(c)
    bits += 5
    if (bits >= 8) {
      out.push((v >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(out)
}
function totpNode(secret: string, t = Date.now()) {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(t / 30000)))
  const mac = createHmac('sha1', b32(secret)).update(counter).digest()
  const off = mac[mac.length - 1] & 0xf
  return String((mac.readUInt32BE(off) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}

test('auth: email OTP, SMS, TOTP and captcha', async ({ page }) => {
  await go(page, 'steps/auth/?ns=pwauth')
  await page.getByLabel('Email address').fill('ada@example.com')
  await page.getByRole('button', { name: 'Send code' }).click()
  await expect(page.getByTestId('email-sent')).toContainText('ada@example.com')
  await page.getByText(/View mock inbox/).click()
  const mail = await page.getByTestId('mock-inbox').innerText()
  const code = mail.match(/\d{6}/)?.[0]
  expect(code).toBe('482913')
  await page.getByLabel('Verification code').fill('000000')
  await page.getByRole('button', { name: 'Verify email code' }).click()
  await expectState(page, (s) => s.emailOtpOk === false)
  await page.getByLabel('Verification code').fill(code!)
  await page.getByRole('button', { name: 'Verify email code' }).click()
  await expectState(page, (s) => s.emailOtpOk === true)

  await page.getByRole('button', { name: 'Send SMS code' }).click()
  await expect(page.getByText('Code sent to +1 202 555 0100')).toBeVisible()
  const sms = (await page.getByTestId('sms-message').innerText()).match(/\d{6}/)![0]
  await page.getByLabel('SMS code').fill(sms)
  await page.getByRole('button', { name: 'Verify SMS code' }).click()
  await expectState(page, (s) => s.smsOk === true)

  await page.getByLabel('Authenticator code').fill('123456' === totpNode('JBSWY3DPEHPK3PXP') ? '654321' : '123456')
  await page.getByRole('button', { name: 'Verify authenticator code' }).click()
  await expectState(page, (s) => s.totpOk === false)
  await page.getByLabel('Authenticator code').fill(totpNode('JBSWY3DPEHPK3PXP'))
  await page.getByRole('button', { name: 'Verify authenticator code' }).click()
  await expectState(page, (s) => s.totpOk === true)

  await page.getByLabel("I'm not a robot").check()
  await expectState(page, (s) => s.captcha === true)
  for (const tile of await page.locator('[data-mug="true"]').all()) await tile.click()
  await page.getByRole('button', { name: 'Verify images' }).click()
  await expectState(page, (s) => s.imageCaptcha === true)
})

test('auth: TOTP matches the RFC 6238 test vector', async ({ page }) => {
  await go(page, 'steps/auth/')
  // RFC 6238 appendix B, SHA-1, T=59 -> 94287082 (8 digits) -> last 6 digits 287082
  const code = await page.evaluate(async () => {
    const enc = new TextEncoder().encode('12345678901234567890')
    const key = await crypto.subtle.importKey('raw', enc, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
    const msg = new Uint8Array(8)
    msg[7] = 1
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg))
    const off = mac[19] & 0xf
    const bin = ((mac[off] & 0x7f) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3]
    return String(bin % 1e8)
  })
  expect(code).toBe('94287082')
  await expect(page.getByTestId('otpauth-uri')).toContainText('secret=JBSWY3DPEHPK3PXP&issuer=Test%20Playground')
})

// ---------- drag ----------
test('drag: HTML5 dragTo moves a card to the top of Done', async ({ page }) => {
  await go(page, 'steps/drag/?ns=pwdrag')
  await page.getByText('Card T-3').dragTo(page.getByLabel('Done column'))
  await expectState(page, (s) => (s.board as Record<string, string[]>).Done[0] === 'T-3' && (s.lastMove as { from: string }).from === 'Todo')
})

test('drag: plain mouse events (pointer path) also move cards', async ({ page }) => {
  await go(page, 'steps/drag/?ns=pwdrag2')
  // strip native dragging so only pointer events are delivered
  await page.evaluate(() => document.querySelectorAll('[draggable]').forEach((e) => e.setAttribute('draggable', 'false')))
  const src = await page.getByText('Card T-4').boundingBox()
  const dst = await page.getByLabel('Todo column').boundingBox()
  await page.mouse.move(src!.x + 5, src!.y + 5)
  await page.mouse.down()
  await page.mouse.move(dst!.x + 40, dst!.y + 200, { steps: 8 })
  await page.mouse.up()
  await expectState(page, (s) => (s.board as Record<string, string[]>).Todo[0] === 'T-4' && (s.lastMove as { method: string }).method === 'pointer')
})

test('drag: variant b reorders columns but drop still lands', async ({ page }) => {
  await go(page, 'steps/drag/?variant=b')
  await page.getByText('Card T-3').dragTo(page.getByLabel('Done column'))
  await expectState(page, (s) => (s.board as Record<string, string[]>).Done[0] === 'T-3')
})

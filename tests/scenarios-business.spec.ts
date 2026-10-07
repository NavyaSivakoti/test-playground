import { expect, test, type Page } from '@playwright/test'
import { expectState, go, pageState } from './helpers'

const uniq = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`

async function signIn(page: Page, email: string, password = 'Playground!1') {
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

// ---------------- Auth ----------------
test.describe('auth', () => {
  test('viewer sees only reports; wrong password errors', async ({ page }) => {
    const ns = uniq('auth')
    await go(page, `auth/?ns=${ns}`)
    await signIn(page, 'approver@example.com', 'nope')
    await expect(page.getByText('Invalid email or password')).toBeVisible()
    await expectState(page, (s) => s.loginError === 'Invalid email or password' && s.user === null)
    await signIn(page, 'viewer@example.com')
    await expect(page.getByText('Signed in as Alan Viewer')).toBeVisible()
    await expectState(page, (s) => s.role === 'viewer' && JSON.stringify(s.menu) === '["Reports"]')
    await expect(page.getByRole('button', { name: 'Billing' })).toHaveCount(0)
    expect(await page.evaluate((k) => localStorage.getItem(k), `${ns}_session`)).toContain('viewer@example.com')
    // session survives reload
    await page.reload()
    await expect(page.getByText('Signed in as Alan Viewer')).toBeVisible()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expectState(page, (s) => s.signedOut === true && s.user === null)
  })

  test('admin needs the code from the mock inbox', async ({ page }) => {
    await go(page, `auth/?ns=${uniq('mfa')}`)
    await signIn(page, 'admin@example.com')
    await expect(page.getByRole('heading', { name: 'Enter the code we sent' })).toBeVisible()
    const mail = await page.getByTestId('latest-email').innerText()
    const code = mail.match(/\d{6}/)?.[0] ?? ''
    expect(code).toHaveLength(6)
    await page.getByLabel('Verification code').fill('000000')
    await page.getByRole('button', { name: 'Verify' }).click()
    await expect(page.getByText('That code is not valid')).toBeVisible()
    await page.getByLabel('Verification code').fill(code)
    await page.getByRole('button', { name: 'Verify' }).click()
    await expectState(page, (s) => s.mfaPassed === true && s.role === 'admin' && JSON.stringify(s.menu) === '["Users","Billing","Settings"]')
  })

  test('remember me cookie, forgot password and session expiry', async ({ page, context }) => {
    const ns = uniq('rem')
    await go(page, `auth/?ns=${ns}&expireAfter=1500`)
    await page.getByLabel('Remember me').check()
    await signIn(page, 'viewer@example.com')
    await expect(page.getByText('Signed in as Alan Viewer')).toBeVisible()
    const cookies = await context.cookies()
    expect(cookies.find((c) => c.name === `${ns}_remember`)?.value).toBe(encodeURIComponent('viewer@example.com'))
    await expect(page.getByText('Your session has expired')).toBeVisible({ timeout: 5000 })
    await expectState(page, (s) => s.expired === true && s.user === null)
    await page.getByRole('button', { name: 'Forgot password?' }).click()
    await page.getByLabel('Reset email').fill('viewer@example.com')
    await page.getByRole('button', { name: 'Send reset link' }).click()
    await expect(page.getByTestId('inbox')).toContainText('Reset your password')
    await expectState(page, (s) => s.resetSentTo === 'viewer@example.com')
  })

  test('SSO popup signs in', async ({ page }) => {
    await go(page, `auth/?ns=${uniq('sso')}`)
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Continue with SSO' }).click()])
    await expect(popup).toHaveTitle('Single sign-on')
    await popup.getByRole('button', { name: 'Approve' }).click()
    await expect(page.getByText('Signed in as Grace Approver')).toBeVisible()
    await expectState(page, (s) => s.ssoUsed === true && s.role === 'approver')
  })

  test('variant b drifts labels', async ({ page }) => {
    await go(page, 'auth/?variant=b')
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
    await expect(page.getByLabel('Email address')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue with single sign-on' })).toBeVisible()
  })
})

// ---------------- Grid ----------------
test.describe('grid', () => {
  test('virtualized rows, filter, sort, pagination', async ({ page }) => {
    await go(page, 'grid/')
    const rows = page.getByTestId('grid-body').getByRole('row')
    const n = await rows.count()
    expect(n).toBeGreaterThan(5)
    expect(n).toBeLessThan(40)
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 1 of 10')
    await page.getByLabel('Filter devices').fill('fra')
    await expectState(page, (s) => s.filter === 'fra' && (s.matching as number) < 500 && (s.matching as number) > 0)
    await page.getByRole('button', { name: 'Hostname' }).click()
    await page.getByRole('button', { name: /^Hostname/ }).click()
    await expectState(page, (s) => JSON.stringify(s.sort) === '{"key":"hostname","dir":"desc"}')
    await page.getByLabel('Filter devices').fill('')
    await page.getByRole('button', { name: 'Next page' }).scrollIntoViewIfNeeded()
    await page.getByRole('button', { name: 'Next page' }).click()
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 2 of 10')
    await expectState(page, (s) => s.page === 2)
  })

  test('hover actions, select all, export', async ({ page }) => {
    await go(page, 'grid/')
    const row = page.getByTestId('row-dev-001')
    const reboot = row.getByRole('button', { name: 'Reboot' })
    await expect(reboot).toBeHidden()
    await row.hover()
    await reboot.click()
    await expectState(page, (s) => String(s.lastAction).startsWith('reboot:'))
    await page.getByLabel('Select all').check()
    await expectState(page, (s) => (s.selected as { count: number }).count === 50)
    await page.getByLabel('Filter devices').fill('offline')
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()])
    expect(dl.suggestedFilename()).toBe('devices-filtered.csv')
    const s = await pageState(page)
    await expectState(page, (st) => (st.lastExport as { rows: number })?.rows === s.matching)
  })

  test('inline edit persists after reload', async ({ page }) => {
    const ns = uniq('grid')
    await go(page, `grid/?ns=${ns}`)
    await page.getByTestId('host-dev-002').dblclick()
    await page.getByLabel('Hostname', { exact: true }).fill('renamed-switch-02')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: 'Save changes?' })).toBeVisible()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expectState(page, (s) => (s.edits as { persisted: boolean }[])?.[0]?.persisted === true)
    await page.reload()
    await expect(page.getByTestId('host-dev-002')).toHaveText('renamed-switch-02')
  })

  test('savePersist bug: success but not persisted', async ({ page }) => {
    const ns = uniq('gridbug')
    await go(page, `grid/?ns=${ns}&bugs=savePersist`)
    const before = await page.getByTestId('host-dev-003').innerText()
    await page.getByTestId('host-dev-003').dblclick()
    await page.getByLabel('Hostname', { exact: true }).fill('lost-edit')
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByTestId('toast').filter({ hasText: 'Changes saved' })).toBeVisible()
    await expectState(page, (s) => (s.edits as { persisted: boolean }[])?.[0]?.persisted === false)
    await page.reload()
    await expect(page.getByTestId('host-dev-003')).toHaveText(before)
  })

  test('conflict banner and variant b', async ({ page }) => {
    await go(page, `grid/?ns=${uniq('conf')}&conflict=1&variant=b`)
    await expect(page.getByLabel('Search devices')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Download CSV' })).toBeVisible()
    await page.getByTestId('host-dev-001').dblclick()
    await page.getByLabel('Hostname', { exact: true }).fill('conflicted')
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Edited by another user')).toBeVisible()
    await page.getByRole('button', { name: 'Overwrite' }).click()
    await expectState(page, (s) => s.conflict === 'overwritten' && (s.edits as unknown[])?.length === 1)
  })
})

// ---------------- Downloads ----------------
test.describe('downloads', () => {
  test('csv, pdf, dated name, delayed export', async ({ page }) => {
    await go(page, 'downloads/?now=2026-10-06T09:00:00Z')
    const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Orders CSV' }).click()])
    expect(csv.suggestedFilename()).toBe('orders.csv')
    const text = await (await csv.createReadStream()).toArray().then((b) => Buffer.concat(b).toString())
    expect(text.trim().split('\n')).toHaveLength(11)
    const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Invoice PDF' }).click()])
    expect(pdf.suggestedFilename()).toBe('invoice.pdf')
    const [rep] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Daily report' }).click()])
    expect(rep.suggestedFilename()).toBe('report-2026-10-06.csv')
    await page.getByRole('button', { name: 'Prepare export' }).click()
    await expect(page.getByText('Preparing your file…')).toBeVisible()
    const late = await page.waitForEvent('download', { timeout: 12000 })
    expect(late.suggestedFilename()).toBe('export-ready.csv')
    await expectState(page, (s) => {
      const names = (s.downloads as { name: string }[]).map((d) => d.name)
      return ['orders.csv', 'invoice.pdf', 'report-2026-10-06.csv', 'export-ready.csv'].every((n) => names.includes(n)) && (s.prepared as { ms: number }).ms >= 3000
    })
  })

  test('pdf opens in new tab; brokenLink records 404', async ({ page }) => {
    await go(page, 'downloads/?bugs=brokenLink')
    const [tab] = await Promise.all([page.waitForEvent('popup'), page.getByRole('link', { name: 'Open invoice in a new tab' }).click()])
    // Headless Chromium downloads PDFs instead of rendering them, so check the link itself.
    const link = page.getByRole('link', { name: 'Open invoice in a new tab' })
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('href', /fixtures\/invoice\.pdf$/)
    await tab.close().catch(() => undefined)
    await expectState(page, (s) => s.openedInNewTab === 1)
    await page.getByRole('link', { name: 'Line items spreadsheet' }).click({ modifiers: [] }).catch(() => undefined)
    await expectState(page, (s) => (s.downloads as { name: string; status: number }[])?.some((d) => d.name === 'line-items.xlsx' && d.status === 404))
  })
})

// ---------------- Windows ----------------
test.describe('windows', () => {
  test('late-loading report tab and popup login', async ({ page }) => {
    const ns = uniq('win')
    await go(page, `windows/?ns=${ns}`)
    const [tab] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Open quarterly report' }).click()])
    await expect(tab).toHaveTitle('Quarterly report')
    await expect(tab.getByText('Revenue')).toHaveCount(0)
    await expect(tab.getByText('Revenue')).toBeVisible({ timeout: 5000 })
    await expectState(page, (s) => s.reportOpened === 1 && s.reportLoaded === true)
    await tab.close()
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Sign in with popup' }).click()])
    await popup.getByLabel('Username').fill('viewer@example.com')
    await popup.getByLabel('Password').fill('Playground!1')
    await popup.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Signed in via popup as viewer@example.com')).toBeVisible()
    await expectState(page, (s) => s.popupLogin === 'viewer@example.com')
  })

  test('confirm then prompt chain', async ({ page }) => {
    await go(page, 'windows/')
    const seen: string[] = []
    page.on('dialog', (d) => {
      seen.push(`${d.type()}:${d.message()}`)
      if (d.type() === 'prompt') void d.accept('DELETE')
      else void d.accept()
    })
    await page.getByRole('button', { name: 'Delete project' }).click()
    await expect(page.getByText('Project deleted')).toBeVisible()
    expect(seen).toEqual(['confirm:Delete project?', 'prompt:Type DELETE to confirm'])
    await expectState(page, (s) => s.projectDeleted === true && (s.dialogs as unknown[]).length === 2)
  })

  test('stacked modals and guard state', async ({ page }) => {
    await go(page, 'windows/')
    await page.getByRole('button', { name: 'Open settings' }).click()
    await page.getByRole('button', { name: 'Advanced options' }).click()
    await expectState(page, (s) => s.modalDepth === 2)
    await page.getByRole('button', { name: 'Apply advanced' }).click()
    await expectState(page, (s) => s.modalDepth === 1 && s.advancedApplied === true)
    await page.keyboard.press('Escape')
    await expectState(page, (s) => s.modalDepth === 0)
    await page.getByLabel('Warn about unsaved changes').check()
    await page.getByLabel('Draft note').fill('draft text')
    await expectState(page, (s) => s.guard === true && s.dirty === true)
  })
})

// ---------------- API ----------------
test.describe('api', () => {
  test('local simulation: health, login + me, 500 and curl', async ({ page }) => {
    await go(page, 'api/')
    await expect(page.getByTestId('api-base')).toContainText(/Backend not configured – showing local simulation|API base/)
    await page.getByRole('button', { name: 'Try GET /health' }).click()
    await page.getByRole('button', { name: 'Send request' }).click()
    await expect(page.getByTestId('response-status')).toHaveText('200')
    await expectState(page, (s) => (s.lastResponse as { status: number }).status === 200)
    await page.getByLabel('Method').selectOption('POST')
    await page.getByLabel('Path').fill('/auth/login')
    await page.getByLabel('Request body (JSON)').fill('{"username":"viewer@example.com","password":"Playground!1"}')
    await page.getByRole('button', { name: 'Send request' }).click()
    await expect(page.getByTestId('response-body')).toContainText('token')
    const token = JSON.parse(await page.getByTestId('response-body').innerText()).token as string
    await page.getByLabel('Method').selectOption('GET')
    await page.getByLabel('Path').fill('/me')
    await page.getByLabel('Authorization').fill(`Bearer ${token}`)
    await page.getByRole('button', { name: 'Send request' }).click()
    await expect(page.getByTestId('response-body')).toContainText('viewer@example.com')
    await page.getByLabel('Path').fill('/status/500')
    await page.getByLabel('Authorization').fill('')
    await page.getByRole('button', { name: 'Send request' }).click()
    await expect(page.getByTestId('response-status')).toHaveText('500')
    await page.getByRole('button', { name: 'Copy as cURL' }).click()
    await expectState(page, (s) => String(s.curl).startsWith("curl -X GET '") && String(s.curl).includes('/status/500'))
  })

  test('openapi.json is valid and lists every endpoint', async ({ request }) => {
    const res = await request.get('openapi.json', { headers: { accept: 'application/json' } })
    expect(res.status()).toBe(200)
    const spec = await res.json()
    expect(spec.openapi).toMatch(/^3\./)
    for (const p of ['/health', '/records', '/records/{id}', '/state', '/config', '/reset', '/inbox', '/inbox/send', '/basic', '/slow', '/status/{code}', '/echo', '/customers', '/customers/{id}', '/auth/login', '/me', '/openapi.json'])
      expect(spec.paths[p], p).toBeTruthy()
  })
})

// ---------------- Heavy ----------------
test.describe('heavy', () => {
  test('renders 10k rows on demand and long poll returns', async ({ page }) => {
    test.setTimeout(45_000)
    await go(page, 'heavy/')
    await page.getByRole('button', { name: 'Render 10k rows' }).click()
    await expect(page.getByText('Row 10000', { exact: true })).toBeAttached({ timeout: 15000 })
    await expectState(page, (s) => s.renderedRows === 10000 && (s.domNodes as number) > 40000 && typeof s.renderMs === 'number')
    await expectState(page, (s) => (s.image as { loaded: boolean })?.loaded === true)
    await expect(page.getByText('Long poll returned 10 rows')).toBeVisible({ timeout: 12000 })
    await expectState(page, (s) => (s.longPoll as { ms: number }).ms >= 8000)
    await expect(page.getByText('Slow section loaded')).toBeVisible({ timeout: 12000 })
  })

  test('autoload renders on load', async ({ page }) => {
    await go(page, 'heavy/?autoload=1')
    await expectState(page, (s) => s.autoload === true && s.renderedRows === 10000)
  })
})

// ---------------- Parallel ----------------
test.describe('parallel', () => {
  test('counter is shared within a namespace and jumps across tabs', async ({ page, context }) => {
    const ns = uniq('par')
    await go(page, `parallel/?ns=${ns}`)
    await page.getByRole('button', { name: 'Reset counter' }).click()
    await page.getByRole('button', { name: 'Increment' }).click()
    await page.getByRole('button', { name: 'Increment' }).click()
    await page.getByRole('button', { name: 'Read' }).click()
    await expect(page.getByTestId('counter-value')).toHaveText('2')
    await expectState(page, (s) => s.counter === 2 && s.ns === ns && s.jumped === false)
    const other = await context.newPage()
    await go(other, `parallel/?ns=${ns}`)
    await other.getByRole('button', { name: 'Increment' }).click()
    await expect(other.getByTestId('counter-value')).toHaveText('3')
    await page.getByRole('button', { name: 'Read' }).click()
    await expect(page.getByTestId('jump-warning')).toBeVisible()
    await expectState(page, (s) => s.jumped === true && s.counter === 3 && s.expected === 2)
    // a different namespace is isolated
    await go(other, `parallel/?ns=${ns}x`)
    await expect(other.getByTestId('counter-value')).toHaveText('0')
  })
})

// ---------------- Errors ----------------
test.describe('errors', () => {
  test('console and network evidence', async ({ page }) => {
    const messages: string[] = []
    const pageErrors: string[] = []
    page.on('console', (m) => messages.push(`${m.type()}:${m.text()}`))
    page.on('pageerror', (e) => pageErrors.push(e.message))
    await go(page, 'errors/')
    await expectState(page, (s) => s.loadLogged === 4)
    for (const m of ['log:[tp] errors page loaded', 'info:[tp] info: 3 widgets initialised', 'warning:[tp] warning: legacyFormat() is deprecated', 'error:[tp] error: optional widget "news-feed" failed to load'])
      expect(messages.filter((x) => x === m)).toHaveLength(1)
    const [resp] = await Promise.all([page.waitForResponse((r) => r.url().includes('does-not-exist.json')), page.getByRole('button', { name: 'Trigger 404 request' }).click()])
    expect(resp.status()).toBe(404)
    await expect(page.getByText('404 request finished (status 404)')).toBeVisible()
    await page.getByRole('button', { name: 'Trigger 500' }).click()
    await expect(page.getByText('500 request finished (status 500)')).toBeVisible()
    await page.getByRole('button', { name: 'Throw uncaught error' }).click()
    await page.getByRole('button', { name: 'Unhandled promise rejection' }).click()
    await page.getByRole('button', { name: 'Trigger slow request' }).click()
    await expect(page.getByText(/Slow request finished after \d+ ms/)).toBeVisible({ timeout: 6000 })
    await expectState(page, (s) => {
      const ev = (s.events as { event: string; ms?: number }[]).map((e) => e.event)
      return ['404', '500', 'uncaught-error', 'unhandled-rejection', 'slow'].every((e) => ev.includes(e)) && s.brokenImage === true
    })
    expect(pageErrors.some((e) => e.includes('Deliberate uncaught error'))).toBe(true)
  })

  test('variant b renames triggers', async ({ page }) => {
    await go(page, 'errors/?variant=b')
    await expect(page.getByRole('button', { name: 'Send 404 request' })).toBeVisible()
  })
})

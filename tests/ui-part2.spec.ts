import { expect, test } from '@playwright/test'
import { expectState, go, pageState } from './helpers'

// ---------------- Feedback ----------------
test.describe('ui/feedback', () => {
  test('toasts, progress, badge, banners, form', async ({ page }) => {
    await go(page, 'ui/feedback/?toastMs=1000&ns=pwfeedback')
    await page.getByRole('button', { name: 'Show success toast' }).click()
    await expect(page.getByTestId('feedback-toast-success')).toHaveText('Saved successfully')
    await expectState(page, (s) => (s.toasts as { lastShown: { text: string; ms: number } }).lastShown.ms === 1000)
    await expect(page.getByTestId('feedback-toast-success')).toBeHidden({ timeout: 3000 })
    await expectState(page, (s) => (s.toasts as { visible: number }).visible === 0)

    await page.getByLabel('Auto-dismiss toasts').uncheck()
    await page.getByRole('button', { name: 'Show error toast' }).click()
    await page.getByRole('button', { name: 'Dismiss error toast' }).click()
    await expectState(page, (s) => (s.toasts as { dismissed: number }).dismissed === 1)

    await page.getByRole('button', { name: 'Notifications 3' }).isVisible()
    await page.getByRole('button', { name: 'Mark all read' }).click()
    await expectState(page, (s) => s.unread === 0 && s.markedAllRead === true)
    await expect(page.getByTestId('unread-count')).toHaveText('0')

    await page.getByRole('button', { name: 'Dismiss trial banner' }).click()
    await expectState(page, (s) => (s.bannersDismissed as string[]).includes('trial'))

    await page.getByLabel('Newsletter email').fill('not-an-email')
    await page.getByRole('button', { name: 'Subscribe' }).click()
    await expect(page.getByTestId('subscribe-result')).toHaveText('Enter a valid email address')
    await page.getByLabel('Newsletter email').fill('ada@example.com')
    await page.getByRole('button', { name: 'Subscribe' }).click()
    await expectState(page, (s) => (s.subscribe as { status: string }).status === 'success')
  })

  test('upload progress, skeleton and session dialog', async ({ page }) => {
    await go(page, 'ui/feedback/?renderDelay=500')
    await expect(page.getByTestId('skeleton')).toBeVisible()
    await expect(page.getByTestId('skeleton-content')).toBeVisible()
    await expectState(page, (s) => (s.skeleton as { status: string }).status === 'loaded')
    await page.getByRole('button', { name: 'Start upload' }).click()
    await expect(page.getByText('Upload complete')).toBeVisible({ timeout: 8000 })
    await expectState(page, (s) => (s.upload as { progress: number }).progress === 100)

    await page.getByRole('button', { name: 'Simulate session timeout' }).click()
    await expect(page.getByRole('dialog', { name: 'Session about to expire' })).toBeVisible()
    await page.getByRole('button', { name: 'Stay signed in' }).click()
    await expectState(page, (s) => {
      const x = s.session as { status: string; secondsLeftAtAction: number }
      return x.status === 'extended' && x.secondsLeftAtAction > 0 && x.secondsLeftAtAction <= 30
    })
  })

  test('toastText bug and variant b', async ({ page }) => {
    await go(page, 'ui/feedback/?bugs=toastText&variant=b')
    await page.getByRole('button', { name: 'Show success toast' }).click()
    await expect(page.getByTestId('feedback-toast-success')).toHaveText('Saved succesfully')
    await expect(page.getByRole('button', { name: 'Begin upload' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mark all as read' })).toBeVisible()
  })
})

// ---------------- Browser ----------------
test.describe('ui/browser', () => {
  test('geolocation fallback, clipboard, title, hash', async ({ page, context }) => {
    await context.grantPermissions(['geolocation', 'clipboard-read', 'clipboard-write'])
    await context.setGeolocation({ latitude: 38.7223, longitude: -9.1393 })
    await go(page, 'ui/browser/')
    await page.getByRole('button', { name: 'Get my location' }).click()
    await expectState(page, (s) => (s.geo as { status: string; lat: number }).status === 'granted' && (s.geo as { lat: number }).lat === 38.7223)
    await page.getByLabel('Fallback city').selectOption('Oslo')
    await expectState(page, (s) => s.city === 'Oslo')

    await page.getByLabel('Text to copy').fill('Hello Ada')
    await page.getByRole('button', { name: 'Copy text' }).click()
    await page.getByRole('button', { name: 'Paste from clipboard' }).click()
    await expect(page.getByTestId('pasted-text')).toHaveText('Hello Ada')
    await expectState(page, (s) => (s.clipboard as { read: string }).read === 'Hello Ada')

    await page.getByLabel('New page title').fill('Release notes')
    await page.getByRole('button', { name: 'Update title' }).click()
    await expect(page).toHaveTitle('Release notes')
    await expectState(page, (s) => s.documentTitle === 'Release notes')

    await page.getByRole('link', { name: 'Go to section 2' }).click()
    await expect(page.getByTestId('hash-view')).toHaveText('Section 2 content')
    await expectState(page, (s) => s.hash === '#section-2')
  })

  test('denied geolocation never blocks; offline, print, history', async ({ page, context }) => {
    await context.clearPermissions()
    await go(page, 'ui/browser/')
    await page.getByRole('button', { name: 'Get my location' }).click()
    await expect(page.getByText('Location permission denied')).toBeVisible({ timeout: 8000 })
    await page.getByLabel('Fallback city').selectOption('Kyoto')
    await expectState(page, (s) => (s.geo as { status: string }).status === 'denied' && s.city === 'Kyoto')

    await page.getByLabel('Simulate offline').check()
    await expect(page.getByTestId('offline-banner')).toBeVisible()
    await expectState(page, (s) => s.effectiveOnline === false)
    await page.getByLabel('Simulate offline').uncheck()
    await context.setOffline(true)
    await expectState(page, (s) => s.online === false && s.lastNetworkEvent === 'offline')
    await context.setOffline(false)
    await expectState(page, (s) => s.online === true)

    await page.getByRole('button', { name: 'Print page' }).click()
    await expectState(page, (s) => s.printed === 1)

    await page.getByRole('button', { name: 'Push history entry' }).click()
    await expect(page).toHaveURL(/demoStep=1/)
    await expectState(page, (s) => (s.history as { step: number }).step === 1)
  })
})

// ---------------- Settings ----------------
test.describe('ui/settings', () => {
  test('profile persists, avatar crop, password validation', async ({ page }) => {
    await go(page, 'ui/settings/?ns=pwsettings1')
    await page.getByLabel('Display name').fill('Grace Hopper')
    await page.getByLabel('Bio').fill('Compiler pioneer')
    await page.getByRole('button', { name: 'Save profile' }).click()
    await expectState(page, (s) => (s.profile as { persisted: boolean; displayName: string }).persisted === true)
    await page.reload()
    await expect(page.getByLabel('Display name')).toHaveValue('Grace Hopper')

    await page.locator('#avatar-upload').setInputFiles('public/fixtures/avatar.png')
    await expect(page.getByTestId('crop-preview')).toBeVisible()
    await expectState(page, (s) => {
      const a = s.avatar as { name: string; sha256: string; crop: { x: number } }
      return a.name === 'avatar.png' && /^[0-9a-f]{64}$/.test(a.sha256) && typeof a.crop.x === 'number'
    })
    const before = ((await pageState(page)).avatar as { crop: { x: number; y: number } }).crop
    const sel = page.getByTestId('crop-selection')
    await sel.focus()
    await page.keyboard.press('ArrowLeft')
    await expectState(page, (s) => (s.avatar as { crop: { x: number } }).crop.x === Math.max(0, before.x - 10))
    const box = (await sel.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 15, box.y + box.height / 2 + 15, { steps: 5 })
    await page.mouse.up()
    await expectState(page, (s) => (s.avatar as { crop: { y: number } }).crop.y !== before.y)

    await page.getByLabel('Current password').fill('Old-pass1')
    await page.getByLabel('New password', { exact: true }).fill('NewPass2026')
    await page.getByLabel('Confirm new password').fill('NewPass2027')
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page.getByText('Passwords do not match')).toBeVisible()
    await expectState(page, (s) => (s.password as { errors: string[] }).errors.includes('mismatch'))
  })

  test('matrix, two-step reset, delete account, savePersist bug', async ({ page }) => {
    await go(page, 'ui/settings/?ns=pwsettings2')
    await page.getByLabel('Billing SMS').check()
    await page.getByLabel('Time zone').selectOption('Asia/Tokyo')
    await page.getByRole('button', { name: 'Save preferences' }).click()
    await expectState(page, (s) => (s.matrix as Record<string, Record<string, boolean>>).Billing.SMS === true && s.timeZone === 'Asia/Tokyo')
    await expectState(page, (s) => (s.preferences as { saved: boolean }).saved === true)

    await page.getByRole('button', { name: 'Reset preferences' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Yes, reset everything' }).click()
    await expectState(page, (s) => s.preferencesReset === true && (s.matrix as Record<string, Record<string, boolean>>).Billing.SMS === false)

    await page.getByRole('button', { name: 'Delete account' }).click()
    const del = page.getByRole('button', { name: 'Delete permanently' })
    await page.getByLabel('Type DELETE to confirm').fill('delete')
    await expect(del).toBeDisabled()
    await page.getByLabel('Type DELETE to confirm').fill('DELETE')
    await del.click()
    await expectState(page, (s) => (s.account as { deleted: boolean }).deleted === true)

    await go(page, 'ui/settings/?ns=pwsettings3&bugs=savePersist&variant=b')
    await page.getByLabel('Public name').fill('Grace Hopper')
    await page.getByRole('button', { name: 'Update profile' }).click()
    await expectState(page, (s) => (s.profile as { persisted: boolean }).persisted === false)
    await page.reload()
    await expect(page.getByLabel('Public name')).toHaveValue('Ada Lovelace')
  })
})

// ---------------- Survey ----------------
const surveyRows = [
  { case: 'happy', stars: 5, nps: 9, recommend: 'Yes', score: 96, cat: 'Promoter' },
  { case: 'neutral', stars: 3, nps: 6, recommend: 'No', score: 60, cat: 'Detractor' },
  { case: 'unhappy', stars: 1, nps: 2, recommend: 'No', score: 20, cat: 'Detractor' },
]
test.describe('ui/survey', () => {
  for (const r of surveyRows) {
    test(`data-driven ${r.case}`, async ({ page }) => {
      await go(page, 'ui/survey/')
      await page.getByRole('radio', { name: r.stars === 1 ? '1 star' : `${r.stars} stars` }).click()
      await page.getByRole('radio', { name: String(r.nps), exact: true }).check()
      await page.getByRole('radio', { name: r.recommend, exact: true }).check()
      if (r.recommend === 'No') await page.getByLabel('What should we improve?').fill('Too slow')
      await page.getByRole('button', { name: 'Submit' }).click()
      await expect(page.getByTestId('survey-score')).toHaveText(String(r.score))
      await expectState(page, (s) => s.score === r.score && s.npsCategory === r.cat)
    })
  }

  test('required, branching, keyboard stars, timer', async ({ page }) => {
    await go(page, 'ui/survey/')
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByText('Please answer all required questions')).toBeVisible()
    await expectState(page, (s) => (s.missing as string[]).join() === 'stars,nps,recommend')
    await page.getByRole('radio', { name: 'No', exact: true }).check()
    await expect(page.getByLabel('What should we improve?')).toBeVisible()
    await page.getByRole('radio', { name: 'Yes', exact: true }).check()
    await expect(page.getByLabel('What should we improve?')).toBeHidden()
    await page.getByRole('radio', { name: '1 star' }).focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expectState(page, (s) => (s.answers as { stars: number }).stars === 4)
    await page.getByRole('checkbox', { name: 'Alerts' }).check()
    await page.getByRole('radio', { name: 'Pricing is fair: Agree', exact: true }).check()
    await expectState(page, (s) => (s.answers as { likert: Record<string, string> }).likert['Pricing is fair'] === 'Agree')

    await go(page, 'ui/survey/?timerSec=2&variant=b')
    await expect(page.getByText('Time is up')).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: 'Submit survey' })).toBeDisabled()
    await expectState(page, (s) => s.timedOut === true)
  })
})

// ---------------- Dashboard ----------------
test.describe('ui/dashboard', () => {
  test('staggered loading, range recompute, hover, export', async ({ page }) => {
    await go(page, 'ui/dashboard/?seed=3')
    await expect(page.getByTestId('widget-spinner').first()).toBeVisible()
    await expect(page.getByTestId('revenue-chart')).toBeVisible({ timeout: 6000 })
    await expectState(page, (s) => (s.loadedWidgets as string[]).join() === 'kpis,ordersChart,revenueChart')
    const k7 = (await pageState(page)).kpis as { revenue: number }

    await page.getByLabel('Date range').selectOption({ label: 'Last 30 days' })
    await expectState(page, (s) => (s.range as { days: number }).days === 30 && (s.kpis as { revenue: number }).revenue !== k7.revenue)
    await expect(page.getByTestId('kpi-revenue')).toBeVisible()

    await page.getByLabel('Date range').selectOption({ label: 'Custom' })
    await page.getByLabel('From', { exact: true }).fill('2026-03-01')
    await page.getByLabel('To', { exact: true }).fill('2026-03-10')
    await expectState(page, (s) => (s.range as { days: number }).days === 10)

    await expect(page.getByTestId('orders-chart')).toBeVisible({ timeout: 4000 })
    await page.locator('[data-testid=orders-chart] rect[data-day="3"]').hover()
    await expect(page.getByTestId('svg-tooltip')).toContainText('Day 3:')
    await expectState(page, (s) => (s.svgHover as { day: number }).day === 3)

    const cv = page.getByTestId('revenue-chart')
    await expect(cv).toBeVisible({ timeout: 6000 })
    await cv.hover({ position: { x: 4, y: 60 } })
    await expect(page.getByTestId('canvas-tooltip')).toContainText('Day 1:')
    await expectState(page, (s) => (s.canvasHover as { day: number }).day === 1)

    const dl = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export as image' }).click()
    expect((await dl).suggestedFilename()).toBe('revenue-chart.png')
    await expectState(page, (s) => (s.exported as { size: number }).size > 0)
  })

  test('live counter is deterministic per seed and tick; variant b', async ({ page }) => {
    await go(page, 'ui/dashboard/?seed=9&variant=b')
    await expectState(page, (s) => (s.activeUsers as { tick: number }).tick >= 1)
    const a = (await pageState(page)).activeUsers as { tick: number; value: number }
    await page.reload()
    await expectState(page, (s) => (s.activeUsers as { tick: number }).tick === a.tick)
    const b = (await pageState(page)).activeUsers as { value: number }
    expect(b.value).toBe(a.value)
    await page.getByRole('button', { name: 'Reload data' }).click()
    await expectState(page, (s) => s.refreshes === 1)
  })
})

// ---------------- Checkout ----------------
async function fillCheckout(page: import('@playwright/test').Page, card = '4242 4242 4242 4242') {
  await page.getByLabel('Full name', { exact: true }).fill('Ada Lovelace')
  await page.getByLabel('Street', { exact: true }).fill('12 Analytical Way')
  await page.getByLabel('City', { exact: true }).fill('Springfield')
  await page.getByLabel('Postal code', { exact: true }).fill('10001')
  await page.getByLabel('Card number').fill(card)
  await page.getByLabel('Expiry (MM/YY)').fill('12/30')
  await page.getByLabel('CVC').fill('123')
}
test.describe('ui/checkout', () => {
  test('totals recalculate and order is placed', async ({ page }) => {
    await go(page, 'ui/checkout/?ns=pwcheckout')
    await expectState(page, (s) => (s.totals as { total: number }).total === 109.38)
    await page.getByRole('radio', { name: 'Express' }).check()
    await expectState(page, (s) => (s.totals as { total: number }).total === 117.38)
    await page.getByLabel('Promo code').fill('WELCOME5')
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(page.getByText('WELCOME5 applied')).toBeVisible()
    await expectState(page, (s) => (s.totals as { discount: number }).discount === 5)
    await page.getByLabel('Promo code').fill('FREESHIP')
    await page.getByRole('button', { name: 'Apply' }).click()
    await expectState(page, (s) => (s.totals as { shipping: number }).shipping === 0)
    await page.getByLabel('Region').selectOption({ label: 'Tax-free zone (0%)' })
    await page.getByLabel('Quantity for USB-C cable').fill('3')
    await expectState(page, (s) => (s.totals as { total: number; tax: number }).total === 117.48 && (s.totals as { tax: number }).tax === 0)

    await fillCheckout(page, '4000 1234 5678 9010')
    await page.getByRole('button', { name: 'Place order' }).click()
    await expect(page.getByText('Only the test card')).toBeVisible()
    await expectState(page, (s) => (s.errors as string[]).includes('card') && !s.order)

    await page.getByLabel('Card number').fill('4242 4242 4242 4242')
    await page.getByRole('button', { name: 'Place order' }).click()
    await expect(page.getByText('Order confirmed')).toBeVisible()
    await expectState(page, (s) => /^ORD-[A-Z0-9]{6}$/.test((s.order as { number: string }).number) && (s.order as { total: number }).total === 117.48)
  })

  test('billing toggle, cartTotal bug, variant b', async ({ page }) => {
    await go(page, 'ui/checkout/?bugs=cartTotal')
    await expect(page.getByTestId('order-total')).toHaveText('$134.37')
    await page.getByLabel('Billing same as shipping').uncheck()
    await expect(page.getByLabel('Billing street')).toBeVisible()
    await expectState(page, (s) => s.billingSameAsShipping === false)

    await go(page, 'ui/checkout/?variant=b')
    await expect(page.getByRole('button', { name: 'Complete purchase' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Redeem' })).toBeVisible()
    await fillCheckout(page)
    await page.getByRole('button', { name: 'Complete purchase' }).click()
    await expectState(page, (s) => (s.order as { total: number }).total === 109.38)
  })
})

// ---------------- Misc ----------------
test.describe('ui/misc', () => {
  test('odd locators record real clicks', async ({ page }) => {
    await go(page, 'ui/misc/')
    await page.getByRole('button', { name: 'Submit' }).click()
    await page.getByRole('button', { name: 'Confirm' }).click()
    await page.getByRole('button', { name: 'Proceed to next step' }).click()
    await page.getByTestId('css-before-btn').click()
    await page.getByText('Apply filter', { exact: true }).click()
    await page.getByText('I accept the terms').click()
    await page.getByRole('button', { name: 'Gear icon' }).click()
    await page.getByRole('button', { name: 'Deep target' }).click()
    await expectState(page, (s) => {
      const h = s.hits as Record<string, number>
      return h.split === 1 && h.realConfirm === 1 && !h.hiddenConfirm && h.aria === 1 && h.before === 1 && h.div === 1 && h.icon === 1 && h.deep === 1 && s.offscreenChecked === true
    })
    await page.getByTestId('action-btn').nth(1).click()
    await expectState(page, (s) => (s.hits as Record<string, string>).action === 'Reject')
    await page.getByLabel('Account name').fill('Example Ltd')
    await page.getByLabel('Reference code').fill('REF-42')
    await expectState(page, (s) => s.accountName === 'Example Ltd' && /^input-\d{4}$/.test(s.accountInputId as string) && s.referenceCode === 'REF-42')
  })

  test('shuffle is seeded and link renders per seed', async ({ page }) => {
    await go(page, 'ui/misc/?shuffle=true&seed=5')
    const order1 = await page.getByTestId('shuffled-list').innerText()
    await page.reload()
    expect(await page.getByTestId('shuffled-list').innerText()).toBe(order1)
    await page.getByRole('button', { name: 'Charlie' }).click()
    await expectState(page, (s) => (s.hits as Record<string, string>).list === 'Charlie')
    const s = await pageState(page)
    const link = page.getByRole('link', { name: 'View details' })
    expect(await link.count()).toBe(s.linkRendered ? 1 : 0)
    if (s.linkRendered) {
      await link.click()
      await expectState(page, (x) => (x.hits as Record<string, number>).link === 1)
    }
    await go(page, 'ui/misc/?variant=b')
    await expect(page.getByText('Apply filters', { exact: true })).toBeVisible()
  })
})

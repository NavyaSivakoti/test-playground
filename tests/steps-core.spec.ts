import { expect, test } from '@playwright/test'
import { expectState, go, pageState } from './helpers'

// Timing-based pages: allow for a busy machine.
test.describe.configure({ timeout: 60_000 })

async function waitState(page: import('@playwright/test').Page, check: (s: Record<string, unknown>) => boolean, timeout = 20_000) {
  await expect.poll(async () => check(await pageState(page)), { timeout }).toBe(true)
}

test.describe('navigation', () => {
  test('title, slow heading and delayed title change', async ({ page }) => {
    await go(page, 'steps/navigation/?slow=1500')
    await expect(page).toHaveTitle('Navigation | Test Playground')
    await expect(page.getByRole('heading', { name: 'Navigation', exact: true })).toBeVisible()
    await expect(page.getByText('Navigation page loaded')).toHaveCount(0)
    await expect(page.getByText('Navigation page loaded')).toBeVisible({ timeout: 10_000 })
    await expectState(page, (s) => s.loadedAfterMs === 1500)
    await page.getByRole('button', { name: 'Change title in 2s' }).click()
    await expect(page).toHaveTitle('Navigation | Test Playground')
    await expect(page).toHaveTitle('Title changed', { timeout: 10_000 })
    await expect(page.getByText('End of navigation page')).toBeAttached()
  })

  test('delayed url change keeps params', async ({ page }) => {
    await go(page, 'steps/navigation/?seed=3')
    await page.getByRole('button', { name: 'Go to step two in 2s' }).click()
    await page.waitForURL(/\/steps\/navigation\/\?seed=3&step=2$/, { timeout: 10_000 })
    await expectState(page, (s) => s.step === '2')
  })

  test('history back/forward and refresh counter', async ({ page }) => {
    await go(page, 'steps/navigation/')
    await page.getByRole('button', { name: 'Push history entry' }).click()
    await expect(page.getByTestId('history-entry')).toHaveText('Entry 1')
    await expectState(page, (s) => s.historyIndex === 1)
    await page.goBack()
    await expect(page.getByTestId('history-entry')).toHaveText('Entry 0')
    await expectState(page, (s) => s.historyIndex === 0)
    await page.goForward()
    await expect(page.getByTestId('history-entry')).toHaveText('Entry 1')

    await page.getByRole('button', { name: 'Reload counter' }).click()
    await expectState(page, (s) => s.counter === 1)
    const before = (await pageState(page)).reloads as number
    await page.reload()
    await expectState(page, (s) => s.reloads === before + 1 && s.counter === 1)
  })

  test('domcontentloaded resolves before the late image', async ({ page }) => {
    await page.goto('steps/navigation/', { waitUntil: 'domcontentloaded' })
    expect(await page.getByTestId('late-image').count()).toBe(0)
    await expect(page.getByTestId('late-image')).toBeAttached({ timeout: 15_000 })
    await waitState(page, (s) => s.lateRequestsDone === 6)
  })
})

test.describe('input', () => {
  test('enter, fill, tab and clear', async ({ page }) => {
    await go(page, 'steps/input/')
    await page.getByLabel('Full name').fill('Ada Lovelace')
    await expectState(page, (s) => s.fullName === 'Ada Lovelace')
    await page.getByLabel('Full name').focus()
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Email')).toBeFocused()
    await expectState(page, (s) => s.focused === 'email')
    await page.getByLabel('Email').fill('ada@example.com')
    await expectState(page, (s) => s.email === 'ada@example.com')
    await page.getByLabel('Prefilled name').clear()
    await page.getByLabel('Prefilled notes').clear()
    await expectState(page, (s) => s.prefilled === '' && s.notes === '')
  })

  test('keys: enter, esc, modifiers, repeats, chips', async ({ page }) => {
    await go(page, 'steps/input/')
    await page.getByLabel('Search box').fill('keyboard')
    await page.keyboard.press('Enter')
    await expectState(page, (s) => s.searchSubmitted === 'keyboard')
    await page.getByRole('button', { name: 'Open modal' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expectState(page, (s) => s.lastKey === 'Escape' && s.modalOpen === false)
    await page.getByLabel('Key log').focus()
    await page.keyboard.press('Shift+Delete')
    await expectState(page, (s) => s.lastKey === 'Shift+Delete')
    await page.keyboard.press('ArrowDown')
    await expectState(page, (s) => s.lastKey === 'ArrowDown')
    await page.getByLabel('Quantity').focus()
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowUp')
    await expectState(page, (s) => s.quantity === 4)
    await page.getByLabel('Code').focus()
    await page.keyboard.press('End')
    for (let i = 0; i < 4; i++) await page.keyboard.press('Backspace')
    await expectState(page, (s) => s.code === 'ABCD')
    await page.getByRole('button', { name: 'Clear all tags' }).click()
    await expectState(page, (s) => Array.isArray(s.tags) && (s.tags as string[]).length === 0)
  })
})

test.describe('select', () => {
  test('native selects', async ({ page }) => {
    await go(page, 'steps/select/')
    const country = page.getByLabel('Country')
    await country.selectOption({ label: 'Germany' })
    await expectState(page, (s) => s.country === 'de')
    await country.selectOption({ index: 3 })
    await expectState(page, (s) => s.country === 'fr')
    await country.selectOption('uk')
    await expectState(page, (s) => s.country === 'uk')
    await expect(country.locator('option', { hasText: 'Mars' })).toHaveCount(0)
    await page.getByLabel('Colours').selectOption(['red', 'blue'])
    await expectState(page, (s) => JSON.stringify(s.colours) === '["red","blue"]')
    await page.getByLabel('Region').selectOption('us-east-1')
    await expectState(page, (s) => s.region === 'us-east-1')
  })

  test('groups, checkboxes and radios', async ({ page }) => {
    await go(page, 'steps/select/')
    await page.getByRole('group', { name: 'Plan' }).getByRole('button').nth(2).click()
    await expectState(page, (s) => s.plan === 'Enterprise')
    await page.getByRole('radiogroup', { name: 'Billing' }).getByLabel('Monthly').check()
    await expectState(page, (s) => s.billing === 'monthly')
    await page.getByLabel('Accept terms').check()
    await expect(page.getByLabel('Subscribe to newsletter')).toBeChecked()
    await page.getByLabel('Subscribe to newsletter').uncheck()
    await page.getByLabel('Express shipping').check()
    await expectState(page, (s) => s.terms === true && s.newsletter === false && s.shipping === 'express')
  })
})

test.describe('verify', () => {
  test('static verification targets', async ({ page }) => {
    await go(page, 'steps/verify/')
    await expect(page.getByText('Verification playground')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Profile link' })).toHaveAttribute('href', /\/profile/)
    await expect(page.getByTestId('status-message')).toContainText('saved')
    await expect(page.getByLabel('Order number')).toHaveValue('ORD-1001')
    await expect(page.getByLabel('Coupon code')).toHaveValue('')
    await expect(page.getByTestId('greeting')).toHaveText('Hello, tester')
    expect(await page.locator('body').innerText()).not.toContain('Fatal error')
    expect(await page.locator('body').textContent()).not.toContain('Fatal error')
    const badge = page.getByTestId('status-badge')
    await expect(badge).toHaveClass(/badge--success/)
    await expect(badge).toHaveCSS('color', 'rgb(21, 128, 61)')
    await expect(badge).toHaveAttribute('data-status', 'success')
    await expect(page.getByTestId('empty-box')).toBeEmpty()
    await expect(page.getByTestId('hidden-notice')).toBeHidden()
    await expect(page.getByRole('button', { name: 'Disabled submit' })).toBeDisabled()
    await page.getByRole('button', { name: 'Enabled submit' }).click()
    await expectState(page, (s) => s.enabledSubmitClicks === 1)
  })
})

test.describe('variables', () => {
  test('stored values and echo fields', async ({ page }) => {
    await go(page, 'steps/variables/')
    const total = page.getByTestId('invoice-total')
    await expect(total).toHaveText('$1,234.50')
    expect(await total.evaluate((el) => el.tagName.toLowerCase())).toBe('strong')
    const ref = await page.getByLabel('Reference code').inputValue()
    expect(ref).toBe('REF-42-ALPHA')
    await expect(page.getByLabel('Product card')).toHaveAttribute('data-sku', 'SKU-778')
    await expect(page.getByTestId('customer-name')).toHaveText('Grace Hopper')
    expect(await page.evaluate(() => (window as unknown as { testPlayground: { version: string } }).testPlayground.version)).toBe('1.0.0')
    await page.getByLabel('Echo field').fill(ref)
    await expectState(page, (s) => s.echo === 'REF-42-ALPHA')
    await page.getByLabel('Unique name').fill('abcd1234')
    await expectState(page, (s) => s.uniqueNameLength === 8)
  })
})

test.describe('loops', () => {
  test('while loops terminate with the right counts', async ({ page }) => {
    await go(page, 'steps/loops/')
    const loadMore = page.getByRole('button', { name: 'Load more' })
    let n = 0
    while (await loadMore.isEnabled()) {
      await loadMore.click()
      if (++n > 10) break
    }
    expect(n).toBe(5)
    await expectState(page, (s) => s.loaded === 25)

    const next = page.getByRole('button', { name: 'Next page' })
    n = 0
    while (await next.isVisible()) {
      await next.click()
      if (++n > 10) break
    }
    await expectState(page, (s) => s.pageNumber === 4)

    n = 0
    while ((await page.getByText('Pending').count()) > 0) {
      await page.getByRole('button', { name: 'Approve next' }).click()
      if (++n > 10) break
    }
    expect(n).toBe(4)

    n = 0
    while ((await page.getByLabel('Mode').inputValue()).includes('draft')) {
      await page.getByRole('button', { name: 'Advance' }).click()
      if (++n > 10) break
    }
    expect(n).toBe(2)
    await expectState(page, (s) => s.mode === 'published')

    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Process one' }).click()
    await expect(page.getByText('All done')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Locked action' })).toBeDisabled()
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Unlock step' }).click()
    await page.getByRole('button', { name: 'Locked action' }).click()
    await expectState(page, (s) => s.lockedActionClicked === true)
  })

  test('query-driven conditions', async ({ page }) => {
    await go(page, 'steps/loops/')
    await expect(page.getByText('Promo available')).toHaveCount(0)
    await expect(page.getByTestId('venues-header')).toHaveText('Venues (7)')
    await go(page, 'steps/loops/?promo=1&empty=1')
    await page.getByRole('button', { name: 'Claim promo' }).click()
    await expectState(page, (s) => s.claimed === true)
    await expect(page.getByTestId('venues-header')).toHaveText('Venues (0)')
    await go(page, 'steps/loops/?staleHeader=1')
    await expect(page.getByTestId('venues-header')).toHaveText('Venues (7)')
    await expectState(page, (s) => s.venueCount === 0 && s.venueHeaderCount === 7)
  })
})

test.describe('waits', () => {
  test('late text, late button and images', async ({ page }) => {
    await go(page, 'steps/waits/')
    await expect(page.getByText('Results ready')).toHaveCount(0)
    await expect(page.getByText('Results ready')).toBeVisible({ timeout: 10_000 })
    const late = page.getByRole('button', { name: 'Late button' })
    await expect(late).toBeVisible()
    await expect(late).toBeEnabled({ timeout: 10_000 })
    await late.click()
    await waitState(page, (s) => s.lateButtonClicked === true && s.imagesLoaded === 6, 40_000)
    expect(Number((await page.getByTestId('elapsed-value').innerText()).replace(/\D/g, ''))).toBeGreaterThanOrEqual(3)
  })

  test('background requests and renderDelay', async ({ page }) => {
    await go(page, 'steps/waits/?renderDelay=500')
    await expect(page.getByText('Results ready')).toBeVisible({ timeout: 2400 })
    await page.getByRole('button', { name: 'Start background requests' }).click()
    await waitState(page, (s) => s.requestsDone === 5)
  })
})

test.describe('scroll', () => {
  test('targets, bottom and screens', async ({ page }) => {
    await go(page, 'steps/scroll/')
    await page.getByText('Target 50', { exact: true }).scrollIntoViewIfNeeded()
    await expectState(page, (s) => s.visibleTarget === 'Target 50')
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.evaluate(() => window.scrollBy(0, window.innerHeight))
    await expectState(page, (s) => s.scrollY === s.viewportHeight)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expectState(page, (s) => s.atBottom === true)
  })

  test('horizontal and inner scroll', async ({ page }) => {
    await go(page, 'steps/scroll/')
    await page.getByText('Column 40', { exact: true }).scrollIntoViewIfNeeded()
    await expectState(page, (s) => (s.scrollLeft as number) > 0 && (s.visibleColumnMax as number) >= 40)
    await page.getByTestId('swipe-list').hover()
    await page.mouse.wheel(0, 300)
    await expectState(page, (s) => s.swipeScrolled === true)
  })
})

test('variant b and unstable ids drift', async ({ page }) => {
  await go(page, 'steps/input/?variant=b')
  await expect(page.getByRole('button', { name: 'Open dialog' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open modal' })).toHaveCount(0)
  await go(page, 'steps/select/?variant=b')
  await expect(page.getByLabel('Subscribe to the newsletter')).toBeChecked()
  await go(page, 'steps/verify/?seed=5&unstableIds=true&unstableClasses=true')
  const id = await page.getByTestId('order-number').getAttribute('id')
  expect(id).not.toBe('order-number')
  await expect(page.getByTestId('status-badge')).not.toHaveClass(/badge--success/)
  await expect(page.getByTestId('status-badge')).toHaveCSS('color', 'rgb(21, 128, 61)')
})

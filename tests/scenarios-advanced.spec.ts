import { expect, test, type Page } from '@playwright/test'
import { expectState, go, pageState } from './helpers'

// The shared dev server is busy while other suites run; give flows room.
test.describe.configure({ timeout: 60_000 })

const uniqueNs = (name: string) => `pw${name}${Date.now().toString(36)}`

// ---------------------------------------------------------------- approvals
async function fillWizard(page: Page) {
  await page.getByLabel('Requester name').fill('Ada Lovelace')
  await page.getByLabel('Requester email').fill('ada@example.com')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('Department').selectOption({ label: 'General and Administrative' })
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('Vendor name').fill('Summit Paper Co.')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('Item 1 description').fill('Printer paper')
  await page.getByLabel('Item 1 quantity').fill('10')
  await page.getByLabel('Item 1 unit price').fill('4.50')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('Budget code').fill('BC-2041')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('Cost centre').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('Business justification').fill('Paper for the quarterly reports print run.')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click() // attachments optional
  await page.getByLabel('Delivery date').fill('2026-12-01')
  await page.getByLabel('Delivery address').fill('12 Analytical Engine Lane, London')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('Grace Hopper (Manager)').check()
  await page.getByLabel('Katherine Johnson (Finance)').check()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByTestId('review-department')).toHaveText('General and Administrative')
  await page.getByRole('button', { name: 'Next' }).click()
}

test('approvals: validation blocks Next, fields have uuid names', async ({ page }) => {
  await go(page, 'approvals/')
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByTestId('wizard-error')).toHaveText('Enter the requester name')
  await expectState(page, (s) => s.step === 1 && s.validationError === 'Enter the requester name')
  const name = await page.getByLabel('Requester name').getAttribute('name')
  expect(name).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/)
  await page.getByRole('button', { name: '7. Justification' }).click()
  await expect(page.getByTestId('step-heading')).toHaveText('Step 7 of 12: Justification')
  await expectState(page, (s) => s.step === 7 && s.lastJump === 7)
})

test('approvals: submit creates a record, approve via confirm modal', async ({ page }) => {
  const ns = uniqueNs('appr')
  await go(page, `approvals/?ns=${ns}`)
  await fillWizard(page)
  await page.getByRole('button', { name: 'Submit request' }).click()
  await expect(page.getByRole('heading', { name: 'Request submitted' })).toBeVisible()
  await expectState(page, (s) => s.submitted === true && typeof s.recordId === 'string' && (s.request as { total: number }).total === 45)
  await expect(page.getByTestId('saved-count')).toContainText(': 1')
  await page.getByTestId('task-manager').getByRole('button', { name: 'Approve' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByTestId('activity-log')).toContainText('Approved by Grace Hopper (Manager approval) · just now')
  await page.getByTestId('task-finance').getByRole('button', { name: 'Reject' }).click()
  await page.getByLabel('Rejection reason').fill('Over budget')
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click()
  await expectState(page, (s) => s.requestStatus === 'rejected' && s.recordStatus === 'rejected')
  const st = await pageState(page)
  expect((st.tasks as { status: string }[]).map((x) => x.status)).toEqual(['approved', 'rejected'])
  await expect(page.getByTestId('activity-log')).toContainText('3 days ago')
})

test('approvals: canvas drag and connect via pointer events', async ({ page }) => {
  await go(page, 'approvals/')
  const canvas = page.getByTestId('workflow-canvas')
  await canvas.scrollIntoViewIfNeeded()
  let box = (await canvas.boundingBox())!
  // drag the Request node (x 80..260, y 150..214) down by 100 px
  await page.mouse.move(box.x + 150, box.y + 182)
  await page.mouse.down()
  await page.mouse.move(box.x + 160, box.y + 230, { steps: 5 })
  await page.mouse.move(box.x + 150, box.y + 282, { steps: 5 })
  await page.mouse.up()
  await expectState(page, (s) => (s.canvas as { nodes: { id: string; y: number }[] }).nodes.find((n) => n.id === 'request')!.y === 250)
  // connect Finance approval (port at 1500,182) to Legal review (1940..2120)
  await page.getByTestId('canvas-scroller').evaluate((el) => (el.scrollLeft = 1200))
  box = (await canvas.boundingBox())!
  await page.mouse.move(box.x + 1500, box.y + 182)
  await page.mouse.down()
  await page.mouse.move(box.x + 1800, box.y + 190, { steps: 6 })
  await page.mouse.move(box.x + 2030, box.y + 182, { steps: 6 })
  await page.mouse.up()
  await expectState(page, (s) => JSON.stringify((s.canvas as { edges: unknown }).edges).includes('["finance","legal"]'))
  await expect(page.getByTestId('edge-list')).toContainText('Finance approval → Legal review')
  // no DOM node for canvas items
  await expect(page.locator('[data-testid="canvas-fallback"]')).toContainText('Request at x 80, y 250')
  await page.getByRole('button', { name: 'Fit to view' }).click()
  await expectState(page, (s) => (s.view as { zoom: number }).zoom < 1)
})

test('approvals: "1 of 1 processed" is link or text, reproducibly by seed', async ({ page }) => {
  const seen = new Set<string>()
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    await go(page, `approvals/?seed=${seed}`)
    await expectState(page, (s) => s.processedAs === 'link' || s.processedAs === 'text')
    const as = (await pageState(page)).processedAs as string
    seen.add(as)
    const link = page.getByRole('link', { name: '1 of 1 processed' })
    if (as === 'link') {
      await link.click()
      await expectState(page, (s) => s.processedOpened === true)
    } else {
      await expect(link).toHaveCount(0)
      await expect(page.getByText('1 of 1 processed')).toBeVisible()
    }
    await page.reload()
    await expectState(page, (s) => s.processedAs === as)
  }
  expect(seen.size).toBe(2)
})

test('approvals: variant b drifts labels', async ({ page }) => {
  await go(page, 'approvals/?variant=b')
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Fit all nodes' })).toBeVisible()
})

// ---------------------------------------------------------------- shop
async function addTote(page: Page) {
  await page.getByRole('group', { name: 'Canvas Tote Bag colour' }).getByRole('button', { name: 'Blue' }).click()
  await page.getByRole('group', { name: 'Canvas Tote Bag size' }).getByRole('button', { name: 'M' }).click()
  await page.getByRole('button', { name: 'Add Canvas Tote Bag to cart' }).click()
}

test('shop: variants, cart and coupon', async ({ page }) => {
  await go(page, 'shop/')
  await page.getByRole('button', { name: 'Add Canvas Tote Bag to cart' }).click()
  await expect(page.getByText('Choose a colour and size')).toBeVisible()
  await addTote(page)
  await expect(page.getByTestId('open-cart')).toHaveText('Cart (1)')
  await expectState(page, (s) => (s.cart as { id: string; colour: string; size: string }[])[0]?.colour === 'Blue')
  const s1 = await pageState(page)
  const price = s1.subtotal as number
  await page.getByTestId('open-cart').click()
  await page.getByLabel('Coupon code').fill('NOPE')
  await page.getByRole('button', { name: 'Apply coupon' }).click()
  await expect(page.getByText('Coupon not recognised')).toBeVisible()
  await page.getByLabel('Coupon code').fill('SAVE10')
  await page.getByRole('button', { name: 'Apply coupon' }).click()
  await expect(page.getByTestId('coupon-applied')).toContainText('SAVE10 applied')
  const disc = Math.round(price * 100 * 0.1) / 100
  await expectState(page, (s) => s.discount === disc && Math.abs((s.total as number) - (price - disc)) < 0.001)
  await page.getByRole('button', { name: 'Increase quantity of Canvas Tote Bag' }).click()
  await expectState(page, (s) => s.subtotal === Math.round(price * 200) / 100)
})

test('shop: infinite scroll loads 12 per batch', async ({ page }) => {
  await go(page, 'shop/')
  await expect(page.getByTestId('products-count')).toHaveText('Showing 12 of 60 products')
  await page.getByTestId('scroll-sentinel').scrollIntoViewIfNeeded()
  await expect(page.getByTestId('products-count')).toHaveText('Showing 24 of 60 products')
  await expectState(page, (s) => s.productsLoaded === 24)
  for (let i = 0; i < 6; i++) {
    await page.getByTestId('scroll-sentinel').scrollIntoViewIfNeeded()
    await page.waitForTimeout(450)
  }
  await expect(page.getByTestId('products-count')).toHaveText('All 60 products loaded')
  await expect(page.getByTestId('product-grid').locator('article')).toHaveCount(60)
})

async function checkout(page: Page, card: string) {
  await addTote(page)
  await page.getByTestId('open-cart').click()
  await page.getByRole('button', { name: 'Checkout' }).click()
  await page.getByLabel('Full name').fill('Ada Lovelace')
  await page.getByLabel('Address').fill('Anal')
  await page.getByRole('option', { name: '12 Analytical Engine Lane, London' }).click()
  await expectState(page, (s) => s.address === '12 Analytical Engine Lane, London' && s.addressFromSuggestion === true)
  const pay = page.frameLocator('iframe[name="payment-form"]')
  await expect(pay.getByText('Test mode – no real payments')).toBeVisible({ timeout: 30_000 })
  await pay.getByLabel('Name on card').fill('Ada Lovelace')
  await pay.getByLabel('Expiry date').fill('12/30')
  await pay.getByLabel('CVC').fill('123')
  await pay.frameLocator('iframe[name="card-number"]').getByLabel('Card number').fill(card)
  await expectState(page, (s) => s.cardDigitsEntered === 16 && s.paymentFrameReady === true)
  await page.getByRole('button', { name: 'Place order' }).click()
}

test('shop: pay with the test card through nested frames', async ({ page }) => {
  await go(page, `shop/?ns=${uniqueNs('shop')}`)
  await checkout(page, '4242 4242 4242 4242')
  await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible()
  await expectState(page, (s) => /^ORD-\d{5}-1$/.test((s.order as { number: string }).number) && (s.order as { last4: string }).last4 === '4242')
  const toast = page.getByTestId('toast').filter({ hasText: 'Order placed' })
  await expect(toast).toBeVisible()
  await expect(toast).toHaveCount(0, { timeout: 4500 })
  await expect(page.getByTestId('open-cart')).toHaveText('Cart (0)')
})

test('shop: non-test card is declined', async ({ page }) => {
  await go(page, 'shop/')
  await checkout(page, '4000 0000 0000 0002')
  await expect(page.getByTestId('pay-error')).toContainText('Card declined')
  await expectState(page, (s) => String(s.paymentError).startsWith('Card declined') && !s.order)
})

test('shop: bugs=cartTotal makes the total wrong by one item', async ({ page }) => {
  await go(page, 'shop/?bugs=cartTotal')
  await addTote(page)
  await expectState(page, (s) => (s.subtotal as number) > 0)
  const s = await pageState(page)
  expect(s.total).toBeCloseTo((s.subtotal as number) * 2, 2)
})

test('shop: variant b drifts labels', async ({ page }) => {
  await go(page, 'shop/?variant=b')
  await expect(page.getByTestId('open-cart')).toHaveText('Bag (0)')
  await expect(page.getByText('Add to bag', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Put Canvas Tote Bag in bag' })).toBeVisible()
})

// ---------------------------------------------------------------- shadow
test('shadow: open, closed, nested, select and framed shadow roots', async ({ page }) => {
  await go(page, 'shadow/')
  await expectState(page, (s) => Array.isArray(s.elementsDefined) || Array.isArray(s.redefinitionSkipped))
  await page.getByLabel('Shadow name').fill('Grace')
  await page.getByRole('button', { name: 'Save in shadow' }).click()
  await expect(page.getByText('Saved in shadow: Grace')).toBeVisible()
  await expectState(page, (s) => s.shadowName === 'Grace')

  // closed root: not reachable by locators; click by coordinates
  await expect(page.getByRole('button', { name: 'Closed action' })).toHaveCount(0)
  expect(await page.getByTestId('closed-card').evaluate((el) => el.shadowRoot)).toBeNull()
  const box = (await page.getByTestId('closed-card').boundingBox())!
  await page.mouse.click(box.x + 30, box.y + 28)
  await page.mouse.click(box.x + 30, box.y + 28)
  await expectState(page, (s) => s.closedClicks === 2)

  await page.getByLabel('Nested value').fill('42')
  await page.getByRole('button', { name: 'Apply nested' }).click()
  await expectState(page, (s) => s.nestedValue === '42' && s.nestedDepth === 2)

  await page.getByRole('button', { name: /Choose/ }).click()
  await page.getByRole('option', { name: 'Green' }).click()
  await expectState(page, (s) => s.selectValue === 'green')

  const frame = page.frameLocator('iframe[name="shadow-frame"]')
  await frame.getByLabel('Frame shadow name').fill('Alan')
  await frame.getByRole('button', { name: 'Save in frame shadow' }).click()
  await expectState(page, (s) => s.frameShadowName === 'Alan')
})

test('shadow: re-navigation does not redefine elements; variant b drifts', async ({ page }) => {
  await go(page, 'shadow/')
  await expectState(page, (s) => Array.isArray(s.elementsDefined))
  // client-side navigation away and back (same document, so the registry keeps the definitions)
  const spa = (path: string) =>
    page.evaluate((p) => {
      history.pushState({}, '', p)
      dispatchEvent(new PopStateEvent('popstate'))
    }, path)
  await spa('/test-playground/a11y/')
  await expect(page.getByRole('heading', { name: 'Accessibility issues (deliberate)' })).toBeVisible()
  await spa('/test-playground/shadow/')
  await expectState(page, (s) => (s.redefinitionSkipped as string[]).includes('tp-open-card'))
  await go(page, 'shadow/?variant=b')
  await expect(page.getByRole('button', { name: 'Store in shadow' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save in shadow' })).toHaveCount(0)
})

// ---------------------------------------------------------------- chat
async function say(page: Page, text: string) {
  await page.getByLabel('Type a message').fill(text)
  await page.getByRole('button', { name: 'Send' }).click()
}

test('chat: streamed replies carry the facts', async ({ page }) => {
  await go(page, 'chat/')
  await say(page, 'What is my order status?')
  await expect(page.getByTestId('typing-indicator')).toBeVisible()
  await expect(page.getByRole('log')).toContainText('15 December 2026')
  await expectState(page, (s) => {
    const m = s.messages as { role: string; text: string }[]
    return m.length === 2 && m[1].text.includes('Shipped') && m[1].text.includes('15 December 2026')
  })
  const first = ((await pageState(page)).messages as { text: string }[])[1].text
  await page.getByRole('button', { name: 'Detailed' }).click()
  await say(page, 'How do refunds work?')
  await expect(page.getByRole('log')).toContainText('5 business days')
  await expectState(page, (s) => s.mode === 'detailed' && (s.messages as unknown[]).length === 4)
  // same seed → same wording
  await page.reload()
  await say(page, 'What is my order status?')
  await expectState(page, (s) => (s.messages as { text: string }[])[1]?.text === first)
})

test('chat: wording varies by seed but facts stay', async ({ page }) => {
  const replies = new Set<string>()
  for (const seed of [1, 2, 3, 4, 5]) {
    await go(page, `chat/?seed=${seed}`)
    await say(page, 'order status')
    await expectState(page, (s) => (s.messages as unknown[]).length === 2)
    const r = ((await pageState(page)).messages as { text: string }[])[1].text
    expect(r).toContain('Shipped')
    expect(r).toContain('15 December 2026')
    replies.add(r)
  }
  expect(replies.size).toBeGreaterThan(1)
})

test('chat: bye ends the conversation; New chat restarts', async ({ page }) => {
  await go(page, 'chat/')
  await say(page, 'bye')
  await expect(page.getByText('This conversation has ended')).toBeVisible()
  await expect(page.getByLabel('Type a message')).toBeDisabled()
  await expectState(page, (s) => s.ended === true && s.endedReason === 'user said bye')
  await page.getByRole('button', { name: 'New chat' }).click()
  await expect(page.getByLabel('Type a message')).toBeEnabled()
  await expectState(page, (s) => s.ended === false && (s.messages as unknown[]).length === 0)
})

test('chat: ends after 8 user messages', async ({ page }) => {
  await go(page, 'chat/')
  for (let i = 0; i < 8; i++) {
    await say(page, `hello ${i}`)
    await expectState(page, (s) => (s.messages as unknown[]).length === (i + 1) * 2)
  }
  await expectState(page, (s) => s.ended === true && s.endedReason === 'message limit reached')
})

// ---------------------------------------------------------------- visual
test('visual: map regions, bar hover, signature, colour-only selection', async ({ page }) => {
  await go(page, 'visual/')
  const map = page.getByTestId('region-map')
  await map.scrollIntoViewIfNeeded()
  let box = (await map.boundingBox())!
  const k = box.width / 400
  await page.mouse.click(box.x + 340 * k, box.y + 150 * k)
  await expectState(page, (s) => s.region === 'East')
  await page.mouse.click(box.x + 200 * k, box.y + 30 * k)
  await expectState(page, (s) => s.region === 'North')

  await expectState(page, (s) => Array.isArray(s.barValues))
  const values = (await pageState(page)).barValues as number[]
  const bar = page.getByTestId('bar-chart')
  await bar.scrollIntoViewIfNeeded()
  box = (await bar.boundingBox())!
  const kb = box.width / 600
  await page.mouse.move(box.x + (50 + 2 * 90 + 30) * kb, box.y + 255 * kb)
  await expectState(page, (s) => (s.hoveredBar as { label: string; value: number })?.label === 'Mar' && (s.hoveredBar as { value: number }).value === values[2])

  const pad = page.getByTestId('signature-pad')
  await pad.scrollIntoViewIfNeeded()
  box = (await pad.boundingBox())!
  await page.mouse.move(box.x + 20, box.y + 80)
  await page.mouse.down()
  await page.mouse.move(box.x + 120, box.y + 40, { steps: 8 })
  await page.mouse.move(box.x + 220, box.y + 120, { steps: 8 })
  await page.mouse.up()
  await expectState(page, (s) => s.strokes === 1 && s.signed === true)
  await page.getByRole('button', { name: 'Clear' }).click()
  await expectState(page, (s) => s.strokes === 0 && s.signed === false)

  const std = page.getByTestId('plan-standard')
  const before = await std.evaluate((el) => ({ text: el.textContent, attrs: el.getAttributeNames().join(',') }))
  await std.click()
  await expectState(page, (s) => s.selectedCard === 'Standard')
  const after = await std.evaluate((el) => ({ text: el.textContent, attrs: el.getAttributeNames().join(','), border: getComputedStyle(el).borderTopColor }))
  expect(after.text).toBe(before.text)
  expect(after.attrs).toBe(before.attrs)
  expect(after.border).toBe('rgb(53, 84, 209)')
})

test('visual: variant b shifts layout', async ({ page }) => {
  await go(page, 'visual/')
  const a = await page.locator('section[data-ui="card"] h2').first().textContent()
  await go(page, 'visual/?variant=b')
  const b = await page.locator('section[data-ui="card"] h2').first().textContent()
  expect(a).toBe('Monthly orders (canvas)')
  expect(b).toBe('Sales regions (canvas map)')
})

// ---------------------------------------------------------------- a11y
test('a11y: violations listed and fixed version toggles', async ({ page }) => {
  await go(page, 'a11y/')
  await expect(page.getByTestId('violation-table').locator('tbody tr')).toHaveCount(7)
  await expect(page.getByText('1.1.1 Non-text Content')).toBeVisible()
  await expect(page.getByLabel('Violations present')).toHaveText('7')
  await expect(page.getByLabel('Email address')).toHaveCount(0)
  await expect(page.getByTestId('demo').locator('img:not([alt])')).toHaveCount(1)
  await expect(page.getByTestId('demo').locator('[tabindex="3"]')).toHaveCount(1)
  await expectState(page, (s) => s.mode === 'broken' && s.violations === 7)
  await page.getByLabel('Show fixed version').check()
  await expectState(page, (s) => s.mode === 'fixed' && s.violations === 0)
  await page.getByLabel('Email address').fill('ada@example.com')
  await expectState(page, (s) => s.email === 'ada@example.com')
  await page.getByRole('button', { name: 'Search' }).click()
  await expectState(page, (s) => s.iconClicks === 1)
  await expect(page.getByTestId('french-text')).toHaveAttribute('lang', 'fr')
  await expect(page.getByTestId('demo').locator('img:not([alt])')).toHaveCount(0)
})

test('a11y: variant b drifts the toggle label', async ({ page }) => {
  await go(page, 'a11y/?variant=b')
  await expect(page.getByLabel('Show accessible version')).toBeVisible()
})

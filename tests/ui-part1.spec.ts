import { expect, test } from '@playwright/test'
import { expectState, go, pageState } from './helpers'

const uniq = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`

// ---------------- Forms ----------------
test.describe('ui/forms', () => {
  const fill = async (page: import('@playwright/test').Page, row: Record<string, string>) => {
    await page.getByLabel('First name').fill(row.firstName)
    await page.getByLabel('Last name').fill(row.lastName)
    await page.getByLabel('Email', { exact: true }).fill(row.email)
    await page.getByLabel('Password', { exact: true }).fill(row.password)
    await page.getByLabel('Confirm password').fill(row.confirmPassword)
    await page.getByLabel('Phone', { exact: true }).fill(row.phone)
    if (row.acceptTerms === 'true') await page.getByLabel('I accept the terms').check()
  }

  test('data-driven rows from registration.csv show expectedMessage', async ({ page, request }) => {
    test.setTimeout(120_000)
    const csv = await (await request.get('fixtures/testdata/registration.csv')).text()
    const [head, ...lines] = csv.trim().split(/\r?\n/)
    const cols = head.split(',')
    for (const line of lines) {
      const vals = line.split(',')
      const row = Object.fromEntries(cols.map((c, i) => [c, vals[i]]))
      await go(page, `ui/forms/?ns=${uniq('pwf')}`)
      await fill(page, row)
      await page.getByRole('button', { name: 'Create account' }).click()
      await expect(page.getByText(row.expectedMessage, { exact: true }).first()).toBeVisible()
      if (row.expectedMessage === 'Account created') {
        await expectState(page, (s) => s.submitted === true && typeof s.accountId === 'string')
        const s = await pageState(page)
        expect((s.values as Record<string, string>).phone).toBe(row.phone)
      } else {
        await expectState(page, (s) => s.submitted === false && Object.values(s.errors as object).includes(row.expectedMessage))
      }
    }
  })

  test('blur validation, dependent field, counter, draft restore', async ({ page }) => {
    const ns = uniq('pwf')
    await go(page, `ui/forms/?ns=${ns}`)
    await page.getByLabel('Email', { exact: true }).fill('alan.example.com')
    await page.keyboard.press('Tab')
    await expectState(page, (s) => (s.errors as Record<string, string>).email === 'Enter a valid email address')
    await page.getByLabel('Account type').selectOption({ label: 'Business' })
    await page.getByLabel('Company name').fill('Analytical Engines Ltd')
    await page.getByLabel('Bio', { exact: true }).fill('Writes the first published algorithm')
    await expect(page.getByTestId('bio-counter')).toHaveText('36 / 160')
    await page.getByLabel('First name').fill('Grace')
    await page.getByRole('button', { name: 'Save draft' }).click()
    await page.reload()
    await expect(page.getByLabel('First name')).toHaveValue('Grace')
    await expectState(page, (s) => s.draftRestored === true)
    await page.getByRole('button', { name: 'Reset' }).click()
    await page.reload()
    await expect(page.getByLabel('First name')).toHaveValue('')
  })

  test('variant b drifts labels', async ({ page }) => {
    await go(page, 'ui/forms/?variant=b')
    await expect(page.getByRole('button', { name: 'Sign up' })).toBeVisible()
    await expect(page.getByLabel('Email address')).toBeVisible()
    await page.getByRole('button', { name: 'Sign up' }).click()
    await expectState(page, (s) => s.submitAttempts === 1)
  })
})

// ---------------- Toggles ----------------
test.describe('ui/toggles', () => {
  test('switches, confirmation and theme', async ({ page }) => {
    await go(page, 'ui/toggles/')
    await page.getByRole('switch', { name: 'Wi-Fi' }).click()
    await page.getByLabel('Bluetooth').check()
    await page.getByText('Airplane mode').click()
    await expectState(page, (s) => {
      const sw = s.switches as Record<string, boolean>
      return sw.wifi && sw.bluetooth && sw.airplane
    })
    await expect(page.getByRole('switch', { name: 'Location' })).toBeDisabled()
    await page.getByRole('switch', { name: 'Notifications' }).click()
    await expect(page.getByText('Turn off notifications?')).toBeVisible()
    await page.getByRole('button', { name: 'Keep on' }).click()
    await expectState(page, (s) => s.lastConfirm === 'cancelled' && (s.switches as Record<string, boolean>).notifications === true)
    await page.getByRole('switch', { name: 'Notifications' }).click()
    await page.getByRole('button', { name: 'Turn off' }).click()
    await expectState(page, (s) => s.lastConfirm === 'confirmed' && (s.switches as Record<string, boolean>).notifications === false)
    await page.getByRole('switch', { name: 'Dark theme' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expectState(page, (s) => s.theme === 'dark')
  })

  test('feature flags and expand all; variant b labels', async ({ page }) => {
    await go(page, 'ui/toggles/')
    await page.getByLabel('Beta search').check()
    await page.getByLabel('Inline help').uncheck()
    await expect(page.getByTestId('enabled-flags')).toHaveText('3 of 5')
    await expectState(page, (s) => s.enabledFlags === 3 && (s.flags as Record<string, boolean>).betaSearch === true)
    await page.getByRole('button', { name: 'Expand all' }).click()
    await expectState(page, (s) => (s.expanded as string[]).length === 3)
    await page.getByRole('button', { name: 'Collapse all' }).click()
    await expectState(page, (s) => (s.expanded as string[]).length === 0)
    await go(page, 'ui/toggles/?variant=b')
    await expect(page.getByRole('switch', { name: 'Wireless' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open all' })).toBeVisible()
  })
})

// ---------------- Layout ----------------
test.describe('ui/layout', () => {
  test('lazy tabs, accordion modes, stepper validation', async ({ page }) => {
    await go(page, 'ui/layout/')
    await expect(page.getByText('4.6 out of 5')).toHaveCount(0)
    await page.getByRole('tab', { name: 'Specs' }).click()
    await expect(page.getByText(/Weight: 1.2 kg/)).toBeVisible()
    await expectState(page, (s) => s.activeTab === 'specs' && (s.renderedPanels as string[]).join() === 'overview,specs')
    await page.getByRole('button', { name: 'Shipping' }).click()
    await page.getByRole('button', { name: 'Returns' }).click()
    await expectState(page, (s) => (s.openSections as string[]).join() === 'returns')
    await page.getByLabel('Allow multiple open').check()
    await page.getByRole('button', { name: 'Warranty' }).click()
    await expectState(page, (s) => (s.openSections as string[]).join() === 'returns,warranty')
    const next = page.getByRole('button', { name: 'Next', exact: true })
    await next.click()
    await next.click()
    await expect(page.getByText('Enter a postcode')).toBeVisible()
    await expectState(page, (s) => s.step === 2 && s.stepErrors === 1)
    await page.getByLabel('Postcode').fill('SW1A 1AA')
    await next.click()
    await expectState(page, (s) => s.step === 3)
  })

  test('carousel, autoplay, sidebar, breadcrumbs', async ({ page }) => {
    await go(page, 'ui/layout/?autoplayMs=400')
    await page.getByRole('button', { name: 'Next slide' }).click()
    await page.getByRole('button', { name: 'Go to slide 5' }).click()
    await expect(page.getByTestId('slide-caption')).toHaveText('Slide 5 of 5')
    await expectState(page, (s) => s.slide === 5)
    await page.getByLabel('Autoplay').check()
    await expectState(page, (s) => s.slideVia === 'autoplay' && s.slide !== 5)
    await page.getByLabel('Autoplay').uncheck()
    await page.getByRole('button', { name: 'Collapse sidebar' }).click()
    await page.getByRole('link', { name: 'Laptops' }).click()
    await expectState(page, (s) => s.sidebarCollapsed === true && s.crumb === 'Laptops')
  })
})

// ---------------- Navigation ----------------
test.describe('ui/navigation', () => {
  test('nested menu, mega menu, deep link', async ({ page }) => {
    await go(page, 'ui/navigation/')
    await page.getByRole('button', { name: 'Products' }).click()
    await page.getByRole('menuitem', { name: 'Laptops' }).hover()
    await page.getByRole('menuitem', { name: 'Ultrabooks' }).click()
    await expectState(page, (s) => s.lastMenu === 'Products > Laptops > Ultrabooks')
    await page.getByRole('button', { name: 'Solutions' }).hover()
    await page.getByText('Data pipelines').click()
    await expectState(page, (s) => s.lastMenu === 'Solutions > Engineering > Data pipelines')
    await go(page, 'ui/navigation/?q=laptop&sort=price')
    await expect(page.getByLabel('Search products')).toHaveValue('laptop')
    await expect(page.getByLabel('Sort by')).toHaveValue('price')
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expectState(page, (s) => JSON.stringify(s.prefilled) === '{"q":"laptop","sort":"price"}' && (s.search as { q: string }).q === 'laptop')
  })

  test('scroll spy, redirect chain, 404, hamburger', async ({ page }) => {
    await go(page, 'ui/navigation/')
    await page.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Configuration' }).click()
    await expect(page).toHaveURL(/#configuration$/)
    await expectState(page, (s) => s.activeSection === 'configuration')
    await page.getByRole('link', { name: 'Start redirect chain' }).click()
    await expect(page).toHaveURL(/from=b/)
    await expectState(page, (s) => (s.redirects as string[]).join() === 'a,b')
    await page.getByRole('link', { name: 'Broken page link' }).click()
    await expect(page.getByTestId('not-found')).toBeVisible()
    await page.setViewportSize({ width: 600, height: 900 })
    await go(page, 'ui/navigation/')
    await page.getByRole('button', { name: 'Open site menu' }).click()
    await page.getByRole('navigation', { name: 'Site menu' }).getByRole('link', { name: 'Support' }).click()
    await expectState(page, (s) => s.lastMenu === 'Support')
  })
})

// ---------------- Lists ----------------
test.describe('ui/lists', () => {
  test('search suggestions, chips, sort, pagination, empty state', async ({ page }) => {
    await go(page, 'ui/lists/')
    await page.getByLabel('Search products').fill('lamp')
    await page.getByRole('option', { name: 'Aurora Lamp' }).click()
    await expectState(page, (s) => s.query === 'Aurora Lamp' && s.resultsCount === 1)
    await page.getByLabel('Search products').fill('')
    await page.getByRole('button', { name: 'Monitors' }).click()
    await page.getByLabel('Sort by').selectOption({ label: 'Price: high to low' })
    await page.getByRole('button', { name: 'Next page' }).click()
    await expectState(page, (s) => s.resultsCount === 12 && s.sort === 'price-desc' && s.page === 2)
    await page.getByLabel('Search products').fill('zzz')
    await expect(page.getByText('No results for “zzz”')).toBeVisible()
    await expectState(page, (s) => s.resultsCount === 0)
    await page.getByRole('button', { name: 'Load more' }).click()
    await expectState(page, (s) => s.loadMoreShown === 10)
  })

  test('tree tri-state, sortable (html5 + pointer), board', async ({ page }) => {
    await go(page, 'ui/lists/')
    await page.getByRole('button', { name: 'Expand Documents' }).click()
    await page.getByRole('checkbox', { name: 'Reports' }).check()
    await expectState(page, (s) => (s.selectedNodes as string[]).join() === 'Documents/Reports/Q1.pdf,Documents/Reports/Q2.pdf' && (s.indeterminate as string[]).includes('Documents'))
    await page.getByTestId('sortable-Echo').dragTo(page.getByTestId('sortable-Alpha'))
    await expectState(page, (s) => (s.order as string[]).join() === 'Echo,Alpha,Bravo,Charlie,Delta')
    await page.getByTestId('card-Write release notes').dragTo(page.getByTestId('column-Done'))
    await expectState(page, (s) => (s.board as Record<string, string>)['Write release notes'] === 'Done')

    await go(page, 'ui/lists/?dnd=pointer')
    await page.getByTestId('sortable').scrollIntoViewIfNeeded()
    const src = await page.getByTestId('sortable-Delta').boundingBox()
    const dst = await page.getByTestId('sortable-Alpha').boundingBox()
    await page.mouse.move(src!.x + 30, src!.y + src!.height / 2)
    await page.mouse.down()
    await page.mouse.move(dst!.x + 30, dst!.y + 4, { steps: 8 })
    await page.mouse.up()
    await expectState(page, (s) => (s.order as string[]).join() === 'Delta,Alpha,Bravo,Charlie,Echo' && (s.lastMove as { via: string }).via === 'pointer')
  })
})

// ---------------- CRUD ----------------
test.describe('ui/crud', () => {
  test('create, inline edit persists, delete + undo, bulk delete', async ({ page }) => {
    const ns = uniq('pwc')
    await go(page, `ui/crud/?ns=${ns}`)
    await expect(page.getByText('Write release notes')).toBeVisible()
    await expectState(page, (s) => s.count === 3)
    await page.getByRole('button', { name: 'New task' }).click()
    await page.getByLabel('Title').fill('Prepare demo data')
    await page.getByLabel('Priority').selectOption('High')
    await page.getByRole('button', { name: 'Create task' }).click()
    await expectState(page, (s) => s.lastAction === 'create' && s.count === 4)

    await page.getByText('Write release notes').dblclick()
    await page.getByLabel('Edit title').fill('Write release notes v2')
    await page.keyboard.press('Enter')
    await expectState(page, (s) => s.lastAction === 'inline-edit' && s.pending === false)
    await page.reload()
    await expect(page.getByText('Write release notes v2')).toBeVisible()
    await expect(page.getByText('Prepare demo data')).toBeVisible()

    await page.getByRole('row', { name: /Fix login bug/ }).getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('button', { name: 'Confirm delete' }).click()
    await expect(page.getByText('Fix login bug')).toHaveCount(0)
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByText('Fix login bug')).toBeVisible()
    await expectState(page, (s) => s.lastAction === 'undo' && s.count === 4)

    await page.getByLabel('Select all').check()
    await page.getByRole('button', { name: /Delete selected/ }).click()
    await page.getByRole('button', { name: 'Confirm delete' }).click()
    await expect(page.getByText('No tasks yet')).toBeVisible()
    await expectState(page, (s) => s.lastAction === 'bulk-delete' && s.count === 0)
  })

  test('failNext rolls back; savePersist does not persist', async ({ page }) => {
    const ns = uniq('pwc')
    await go(page, `ui/crud/?ns=${ns}&failNext=1`)
    await page.getByRole('row', { name: /Plan sprint/ }).getByRole('button', { name: 'Edit' }).click()
    await page.getByLabel('Title').fill('Plan sprint 42')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Could not save – changes reverted')).toBeVisible()
    await expectState(page, (s) => s.lastAction === 'rollback' && (s.tasks as { title: string }[]).some((x) => x.title === 'Plan sprint'))

    await go(page, `ui/crud/?ns=${ns}&bugs=savePersist`)
    await page.getByText('Plan sprint').dblclick()
    await page.getByLabel('Edit title').fill('Plan sprint edited')
    await page.keyboard.press('Enter')
    await expectState(page, (s) => s.lastAction === 'inline-edit' && s.pending === false)
    await page.reload()
    await expect(page.getByText('Plan sprint', { exact: true })).toBeVisible()
  })
})

// ---------------- Booking ----------------
test.describe('ui/booking', () => {
  const NOW = 'now=2026-10-06T08:00:00Z'
  test('book a slot; it becomes unavailable and persists', async ({ page }) => {
    const ns = uniq('pwb')
    await go(page, `ui/booking/?${NOW}&ns=${ns}`)
    await expect(page.getByTestId('month-label')).toHaveText('October 2026')
    await expect(page.getByRole('button', { name: 'Friday, October 2, 2026' })).toBeDisabled()
    await page.getByRole('button', { name: 'Wednesday, October 14, 2026' }).click()
    await page.getByRole('button', { name: '10:00', exact: true }).click()
    await page.getByRole('button', { name: 'Book', exact: true }).click()
    await expect(page.getByText('Booked 2026-10-14 at 10:00 (UTC)')).toBeVisible()
    await expectState(page, (s) => (s.booking as { utc: string }).utc === '2026-10-14T10:00:00.000Z')
    await expect(page.getByTestId('slot-10:00')).toBeDisabled()
    await page.reload()
    await page.getByRole('button', { name: 'Wednesday, October 14, 2026' }).click()
    await expect(page.getByTestId('slot-10:00')).toHaveAttribute('data-slot-state', 'booked')
  })

  test('time zone, recurrence validation, week view, month nav', async ({ page }) => {
    await go(page, `ui/booking/?${NOW}&ns=${uniq('pwb')}`)
    await page.getByRole('button', { name: 'Thursday, October 15, 2026' }).click()
    await page.getByLabel('Time zone').selectOption({ label: 'Asia/Kolkata (UTC+05:30)' })
    await page.getByRole('button', { name: '09:30', exact: true }).click()
    await expectState(page, (s) => s.tz === 'Asia/Kolkata' && s.slotUtc === '2026-10-15T04:00:00.000Z')
    await page.getByLabel('Repeat').check()
    await page.getByLabel('End date').fill('2026-10-01')
    await page.getByRole('button', { name: 'Book', exact: true }).click()
    await expect(page.getByText('End date must be after the booking date')).toBeVisible()
    await expectState(page, (s) => s.bookingError === 'End date must be after the booking date' && !s.booking)
    await page.getByRole('button', { name: 'Week view' }).click()
    await page.getByRole('button', { name: 'Next week' }).click()
    await expect(page.getByText('Oct 12 – Oct 18, 2026')).toBeVisible()
    await expectState(page, (s) => s.view === 'week' && s.weekStart === '2026-10-12')
    await page.getByRole('button', { name: 'Month view' }).click()
    await page.getByRole('button', { name: 'Next month' }).click()
    await expectState(page, (s) => s.month === '2026-11')
  })
})

// ---------------- Media ----------------
test.describe('ui/media', () => {
  test('video and audio controls change real state', async ({ page }) => {
    await go(page, 'ui/media/')
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await expectState(page, (s) => (s.video as { time: number }).time >= 1)
    await page.getByRole('button', { name: 'Mute', exact: true }).click()
    await page.getByRole('button', { name: 'Pause', exact: true }).click()
    await expectState(page, (s) => {
      const v = s.video as { playing: boolean; muted: boolean }
      return v.playing === false && v.muted === true
    })
    await page.getByLabel('Video position').fill('20')
    await expectState(page, (s) => (s.video as { time: number }).time === 20)
    await page.getByRole('button', { name: 'Start tone' }).click()
    await expectState(page, (s) => (s.audio as { playing: boolean; time: number }).playing && (s.audio as { time: number }).time >= 1)
    await page.getByRole('button', { name: 'Silence tone' }).click()
    await page.getByRole('button', { name: 'Stop tone' }).click()
    await expectState(page, (s) => {
      const a = s.audio as { playing: boolean; muted: boolean }
      return a.playing === false && a.muted === true
    })
  })

  test('lightbox, broken image, lazy images, pdf', async ({ page }) => {
    await go(page, 'ui/media/')
    await page.getByRole('button', { name: 'Open photo 3' }).click()
    await expect(page.getByTestId('lightbox-caption')).toHaveText('Photo 3 of 6')
    await page.getByRole('button', { name: 'Next photo' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('lightbox')).toHaveCount(0)
    await expectState(page, (s) => s.lightbox === null && (s.lightboxHistory as number[]).join() === '3,4')
    await expectState(page, (s) => s.brokenImage === 'error')
    await page.getByTestId('zoom-box').hover()
    await expectState(page, (s) => s.zoomed === true)
    const before = ((await pageState(page)).lazyLoaded as number) ?? 0
    expect(before).toBeLessThan(20)
    await page.getByTestId('lazy-20').scrollIntoViewIfNeeded()
    await expectState(page, (s) => s.lazyLoaded === 20)
    await expectState(page, (s) => s.pdfStatus === 200)
  })
})

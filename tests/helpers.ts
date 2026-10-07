import { expect, type Page } from '@playwright/test'

/** Parsed `state` object from the Observable state panel. */
export async function pageState(page: Page): Promise<Record<string, unknown>> {
  const raw = await page.getByTestId('tp-state').getAttribute('data-state')
  return JSON.parse(raw ?? '{}') as Record<string, unknown>
}

/** Waits until the state satisfies `check` (polls the panel). */
export async function expectState(page: Page, check: (s: Record<string, unknown>) => boolean | void, message?: string) {
  await expect
    .poll(async () => {
      const s = await pageState(page)
      try {
        const r = check(s)
        return r === undefined ? true : r
      } catch {
        return false
      }
    }, { message: message ?? 'state check' })
    .toBe(true)
}

/** Navigates to a route (no leading base), e.g. go(page, 'steps/click/?seed=1'). */
export async function go(page: Page, route: string) {
  await page.goto(route.replace(/^\//, ''))
}

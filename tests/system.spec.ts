import { expect, test } from '@playwright/test'
import { expectState, go } from './helpers'

test('home lists pages and coverage count', async ({ page }) => {
  await go(page, '')
  await expect(page.getByRole('heading', { name: 'All pages' })).toBeVisible()
  await expect(page.getByTestId('coverage-count')).toContainText('/ 162')
})

test('click baseline records real effects', async ({ page }) => {
  await go(page, 'steps/click/')
  await page.getByRole('button', { name: 'Primary action' }).click()
  await expectState(page, (s) => (s.clicks as Record<string, number>)?.primary === 1)
  await page.getByText('Double-click target').dblclick()
  await expectState(page, (s) => s.lastAction === 'dblclick')
  await page.getByRole('row', { name: /Row B/ }).getByRole('button', { name: 'Edit' }).click()
  await expectState(page, (s) => s.edited === 'Row B')
})

test('same seed gives same DOM with unstable ids', async ({ page }) => {
  await go(page, 'steps/click/?seed=7&unstableIds=true')
  const a = await page.getByTestId('primary-action').getAttribute('id')
  await page.reload()
  const b = await page.getByTestId('primary-action').getAttribute('id')
  expect(a).toBe(b)
  expect(a).not.toBe('primary-action')
})

test('reset reports counts', async ({ page }) => {
  await go(page, 'system/reset/?ns=pwreset')
  await page.getByRole('button', { name: 'Reset namespace pwreset' }).click()
  await expect(page.getByTestId('reset-report')).toContainText('Reset complete')
})

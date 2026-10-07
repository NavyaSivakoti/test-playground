import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.PW_PORT ?? 5199)
// Set PW_BASE_URL (e.g. https://<user>.github.io/test-playground) to test a deployed copy instead of a local server.
export const BASE = (process.env.PW_BASE_URL ?? `http://localhost:${PORT}/test-playground`).replace(/\/$/, '')

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `${BASE}/`,
    trace: 'retain-on-failure',
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chromium'],
        launchOptions: {
          args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=public/fixtures/front.y4m'],
        },
      },
    },
  ],
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        command: `npx vite --port ${PORT} --strictPort`,
        url: `${BASE}/`,
        reuseExistingServer: true,
        timeout: 60_000,
      },
})

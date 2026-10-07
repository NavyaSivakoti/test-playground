// Page registry. Every file matching src/pages/**/*.page.tsx is a route.
// A page file exports `meta` (see PageMeta) and a default React component.
import type { ComponentType } from 'react'

export type PageGroup = 'Step baselines' | 'Scenarios' | 'General UI' | 'System'

export interface SampleTest {
  /** Short id used in docs, e.g. "U1" */
  id: string
  title: string
  /** Extra query string for the scenario, e.g. "overlay=true&overlayMs=2000" */
  query?: string
  /** Steps written in natural-language step-template wording */
  steps: string[]
  /** Expected app state / outcome (what the test must check, not just "step passed") */
  expected: string
}

export interface PageMeta {
  /** Route path, e.g. "/steps/click". Must start with "/" and have no trailing slash. */
  path: string
  title: string
  group: PageGroup
  /** One or two sentences: what this page is for. */
  summary: string
  /** Step-type ids (see src/coverage/steps.json) this page is a target for. */
  covers?: number[]
  /** Ready-to-paste sample tests with expected outcomes. */
  samples?: SampleTest[]
  /** Mark pages that simulate an integration (OTP, SSO, captcha) so they are never mistaken for the real thing. */
  mock?: boolean
  /** Sort order inside its group (lower first). */
  order?: number
  /** Hide from the navigation (child pages opened by other pages). */
  hidden?: boolean
  /** Render without the app shell (header/footer/state panel) - for iframe content and child windows. */
  bare?: boolean
}

export interface PageModule {
  meta: PageMeta
  default: ComponentType
}

const modules = import.meta.glob<PageModule>('../pages/**/*.page.tsx', { eager: true })

export const pages: PageModule[] = Object.values(modules)
  .filter((m) => m.meta && m.default)
  .sort((a, b) => (a.meta.order ?? 100) - (b.meta.order ?? 100) || a.meta.title.localeCompare(b.meta.title))

export const groups: PageGroup[] = ['Scenarios', 'Step baselines', 'General UI', 'System']

export function pageFor(path: string): PageModule | undefined {
  const clean = path.replace(/\/+$/, '') || '/'
  return pages.find((p) => p.meta.path === clean)
}

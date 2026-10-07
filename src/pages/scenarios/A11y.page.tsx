import { useState } from 'react'
import { Card, publicUrl } from '../../components/ui'
import { usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { useMountMerge } from './advanced/util'

export const meta: PageMeta = {
  path: '/a11y',
  title: 'Accessibility issues (deliberate)',
  group: 'Scenarios',
  summary:
    'A page with deliberate accessibility violations, each listed with its WCAG rule, and a switch that renders the accessible version for before/after checks.',
  order: 25,
  samples: [
    {
      id: 'AX1',
      title: 'Violations are listed',
      steps: ['Navigate to <base>/a11y/', 'Verify that the current page displays text "1.1.1 Non-text Content"', 'Verify that the "Violations present" displays text "7"'],
      expected: 'state.mode = "broken" and state.violations = 7.',
    },
    {
      id: 'AX2',
      title: 'Switch to the fixed version',
      steps: ['Click on "Show fixed version"', 'Verify that the "Violations present" displays text "0"'],
      expected: 'state.mode = "fixed", state.violations = 0; the email field now has the label "Email address" and the icon button is named "Search".',
    },
    {
      id: 'AX3',
      title: 'Unlabelled field cannot be found by label',
      steps: ['Navigate to <base>/a11y/', 'Enter ada@example.com in the "Email address" field'],
      expected: 'Fails in broken mode (placeholder only, no label); passes after "Show fixed version" with state.email = "ada@example.com".',
    },
    {
      id: 'AX4',
      title: 'AI accessibility review',
      steps: ['AI Verification: list the accessibility problems in the "Demo form" section'],
      expected: 'Mentions the missing label, low contrast, missing alt text, the unnamed button, heading order, positive tabindex and missing lang.',
    },
  ],
}

interface Violation {
  key: string
  issue: string
  rule: string
  fix: string
}
const VIOLATIONS: Violation[] = [
  { key: 'label', issue: 'Input without a label (placeholder only)', rule: '1.3.1 Info and Relationships / 3.3.2 Labels or Instructions', fix: 'Visible <label> "Email address"' },
  { key: 'contrast', issue: 'Low-contrast text (#c4c4c4 on white, 1.7:1)', rule: '1.4.3 Contrast (Minimum)', fix: 'Text colour #374151 (10:1)' },
  { key: 'alt', issue: 'Image without alt text', rule: '1.1.1 Non-text Content', fix: 'alt="Profile photo of Ada Lovelace"' },
  { key: 'name', issue: 'Icon-only button with no accessible name', rule: '4.1.2 Name, Role, Value', fix: 'aria-label="Search"' },
  { key: 'headings', issue: 'Heading levels skip from h2 to h5', rule: '1.3.1 Info and Relationships (heading order)', fix: 'h3 under the h2' },
  { key: 'tabindex', issue: 'Positive tabindex changes the focus order', rule: '2.4.3 Focus Order', fix: 'tabindex removed (DOM order)' },
  { key: 'lang', issue: 'French passage without lang attribute', rule: '3.1.2 Language of Parts', fix: 'lang="fr" on the passage' },
]

export default function A11yPage() {
  const t = useTraps('a11y')
  const { merge } = usePageState()
  const [fixed, setFixed] = useState(false)
  const [searches, setSearches] = useState(0)

  useMountMerge(() => ({ mode: 'broken', violations: VIOLATIONS.length }))

  const toggle = () => {
    const f = !fixed
    setFixed(f)
    merge({ mode: f ? 'fixed' : 'broken', violations: f ? 0 : VIOLATIONS.length })
  }
  const rows = t.v(VIOLATIONS, [...VIOLATIONS].reverse())
  const searchIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden={fixed ? true : undefined} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </svg>
  )

  return (
    <>
      <Card title="Mode">
        <label data-ui="inline">
          <input type="checkbox" role="switch" checked={fixed} onChange={toggle} id={t.id('show-fixed')} />
          {t.v('Show fixed version', 'Show accessible version')}
        </label>
        <p>
          Violations present: <strong data-testid="violation-count" aria-label="Violations present">{fixed ? 0 : VIOLATIONS.length}</strong>
        </p>
      </Card>

      <Card title="Violations">
        <div style={{ overflowX: 'auto' }}>
          <table data-testid="violation-table">
            <thead>
              <tr>
                <th>Issue</th>
                <th>WCAG rule</th>
                <th>Fixed version</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.key} data-testid={`violation-${v.key}`}>
                  <td>{v.issue}</td>
                  <td>{v.rule}</td>
                  <td>{v.fix}</td>
                  <td>{fixed ? 'Fixed' : 'Present'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <section data-ui="card" aria-label="Demo form" data-testid="demo" data-mode={fixed ? 'fixed' : 'broken'}>
        <h2 style={{ marginTop: 0 }}>Demo form</h2>
        {fixed ? <h3>Contact details</h3> : <h5>Contact details</h5>}

        {fixed ? (
          <label data-ui="field">
            <span>Email address</span>
            <input type="email" id={t.id('email-fixed')} onChange={(e) => merge({ email: e.target.value })} />
          </label>
        ) : (
          <div data-ui="field">
            <input type="email" placeholder="Email" id={t.id('email-broken')} onChange={(e) => merge({ email: e.target.value })} />
          </div>
        )}

        <p style={{ color: fixed ? '#374151' : '#c4c4c4', background: '#fff', padding: '0.3rem' }} data-testid="contrast-text">
          Your data is stored for 30 days and then deleted.
        </p>

        {fixed ? (
          <img src={publicUrl('fixtures/avatar.png')} alt="Profile photo of Ada Lovelace" width={64} height={64} />
        ) : (
          <img src={publicUrl('fixtures/avatar.png')} width={64} height={64} />
        )}

        <div data-ui="inline" style={{ marginTop: '0.5rem' }}>
          <button
            type="button"
            tabIndex={fixed ? undefined : 3}
            aria-label={fixed ? 'Search' : undefined}
            data-testid="icon-button"
            onClick={() => {
              setSearches(searches + 1)
              merge({ iconClicks: searches + 1 })
            }}
          >
            {searchIcon}
          </button>
          <button type="button" tabIndex={fixed ? undefined : 1} onClick={() => merge({ lastButton: 'Subscribe' })}>
            Subscribe
          </button>
          <button type="button" onClick={() => merge({ lastButton: 'Unsubscribe' })}>
            Unsubscribe
          </button>
        </div>

        <p {...(fixed ? { lang: 'fr' } : {})} data-testid="french-text">
          Merci de votre visite. Vos données sont protégées.
        </p>
      </section>
    </>
  )
}

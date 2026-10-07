import type { ReactNode } from 'react'
import { Card } from '../../components/ui'
import { usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/steps/verify',
  title: 'Verify elements',
  group: 'Step baselines',
  summary: 'Static targets for verification steps: text, attributes, classes, CSS values, input values, empty and hidden elements, enabled and disabled buttons.',
  covers: [66, 105, 114, 132, 138, 168, 179, 184, 465, 467, 469, 477, 478, 529, 545, 548, 549, 577, 590],
  order: 5,
  samples: [
    {
      id: 'V1',
      title: 'Text checks',
      steps: [
        'Verify that the current page displays text "Verification playground"',
        'Verify that the "Greeting" displays text "Hello, tester"',
        'Verify that the "Status message" text contains "saved"',
        'Verify that the current page does not displays text "Fatal error"',
      ],
      expected: 'All pass. The error text only exists inside a template element and is never rendered.',
    },
    {
      id: 'V2',
      title: 'Input values',
      steps: [
        'Verify that the "Order number" inputbox has value "ORD-1001"',
        'Verify that the "Order number" inputbox has not value "ORD-9999"',
        'Verify that the "Coupon code" has an empty value',
      ],
      expected: 'All pass.',
    },
    {
      id: 'V3',
      title: 'Attributes, class and CSS',
      steps: [
        'Verify that the "Profile link" contains value "/profile" for href',
        'Verify that the "Status badge" has class name "badge--success"',
        'Verify that the "Status badge" displays "rgb(21, 128, 61)" for css property name color',
        'Verify that the "Status badge" has value "success" for data-status',
      ],
      expected: 'All pass (the class check fails on purpose with unstableClasses=true).',
    },
    {
      id: 'V4',
      title: 'Presence and state',
      steps: [
        'Verify that the "Hidden notice" is not present/displayed.',
        'Verify that the "Disabled submit" is disabled or not clickable.',
        'Verify that the "Enabled submit" is enabled or clickable.',
        'Element "Empty box" is empty',
      ],
      expected: 'All pass; clicking the enabled button sets state.enabledSubmitClicks.',
    },
  ],
}

function Labelled({ id, label, children }: { id: string; label: string; children: (labelId: string) => ReactNode }) {
  const labelId = `${id}-label`
  return (
    <div data-ui="field">
      <span id={labelId} data-ui="hint">
        {label}
      </span>
      {children(labelId)}
    </div>
  )
}

export default function VerifyPage() {
  const t = useTraps('verify')
  const { state, merge } = usePageState()

  const status = (
    <Labelled id={t.id('status-message')} label="Status message" key="status">
      {(l) => (
        <p id={t.id('status-message')} className={t.cls('status status--saved')} data-testid="status-message" aria-labelledby={l} role="status" style={{ margin: 0 }}>
          All changes saved at 10:00
        </p>
      )}
    </Labelled>
  )
  const greeting = (
    <Labelled id={t.id('greeting')} label="Greeting" key="greeting">
      {(l) => (
        <p id={t.id('greeting')} className={t.cls('greeting')} data-testid="greeting" aria-labelledby={l} style={{ margin: 0 }}>
          Hello, tester
        </p>
      )}
    </Labelled>
  )

  const submits = [
    <button key="disabled" id={t.id('disabled-submit')} className={t.cls('btn btn--submit')} data-testid="disabled-submit" disabled>
      Disabled submit
    </button>,
    <button
      key="enabled"
      id={t.id('enabled-submit')}
      className={t.cls('btn btn--submit')}
      data-testid="enabled-submit"
      onClick={() => merge({ enabledSubmitClicks: ((state.enabledSubmitClicks as number) ?? 0) + 1 })}
    >
      Enabled submit
    </button>,
  ]

  return (
    <>
      <Card>
        <h2 style={{ marginTop: 0 }} id={t.id('verify-heading')}>
          Verification playground
        </h2>
        {t.v(
          <>
            {status}
            {greeting}
          </>,
          <div data-variant="wrapper">
            {greeting}
            {status}
          </div>,
        )}
        <p>
          <a id={t.id('profile-link')} className={t.cls('link link--profile')} data-testid="profile-link" href="https://example.com/profile/tester" target="_blank" rel="noreferrer">
            Profile link
          </a>
        </p>
      </Card>

      <Card title="Badge">
        <Labelled id={t.id('status-badge')} label="Status badge">
          {(l) => (
            <span
              id={t.id('status-badge')}
              className={t.cls('badge badge--success')}
              data-testid="status-badge"
              data-status="success"
              aria-labelledby={l}
              data-ui="badge"
              style={{ color: 'rgb(21, 128, 61)', borderColor: 'currentColor', alignSelf: 'flex-start' }}
            >
              {t.v('Success', 'Succeeded')}
            </span>
          )}
        </Labelled>
      </Card>

      <Card title="Inputs">
        <label data-ui="field">
          <span>Order number</span>
          <input id={t.id('order-number')} className={t.cls('input input--readonly')} data-testid="order-number" readOnly value="ORD-1001" />
        </label>
        <label data-ui="field">
          <span>Coupon code</span>
          <input id={t.id('coupon-code')} className={t.cls('input')} data-testid="coupon-code" defaultValue="" placeholder="No coupon applied" onChange={(e) => merge({ coupon: e.target.value })} />
        </label>
      </Card>

      <Card title="Empty and hidden">
        <Labelled id={t.id('empty-box')} label="Empty box">
          {(l) => <div id={t.id('empty-box')} className={t.cls('box box--empty')} data-testid="empty-box" aria-labelledby={l} style={{ minHeight: 40, border: '1px dashed currentColor' }}></div>}
        </Labelled>
        <div id={t.id('hidden-notice')} className={t.cls('notice notice--hidden')} data-testid="hidden-notice" aria-label="Hidden notice" style={{ display: 'none' }}>
          Hidden notice: this text is never displayed.
        </div>
        <template data-testid="error-template" dangerouslySetInnerHTML={{ __html: '<p>Fatal error: this template is never rendered.</p>' }} />
        <p data-ui="hint">This card also contains an element hidden with display:none and an unrendered template.</p>
      </Card>

      <Card title="Buttons">
        <div data-ui="inline">{t.v(submits, [...submits].reverse())}</div>
      </Card>
    </>
  )
}

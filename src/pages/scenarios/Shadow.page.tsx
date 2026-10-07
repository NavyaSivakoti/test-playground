import { createElement, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Card } from '../../components/ui'
import { usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { frameSrc, useMountMerge } from './advanced/util'
import { defineShadowElements } from './shadow/elements'

export const meta: PageMeta = {
  path: '/shadow',
  title: 'Web components and shadow DOM',
  group: 'Scenarios',
  summary:
    'Custom elements with open and closed shadow roots, a shadow host nested inside another shadow root, a custom select with slotted options and a shadow root inside a same-origin iframe.',
  order: 22,
  samples: [
    {
      id: 'SD1',
      title: 'Open shadow root',
      steps: ['Navigate to <base>/shadow/', 'Enter Grace in the "Shadow name" field', 'Click on "Save in shadow"', 'Verify that the current page displays text "Saved in shadow: Grace"'],
      expected: 'state.shadowName = "Grace" (received through a composed custom event).',
    },
    {
      id: 'SD2',
      title: 'Closed shadow root',
      steps: ['Navigate to <base>/shadow/', 'Click on "Closed action"', 'Click on "Closed action"'],
      expected: 'state.closedClicks = 2. element.shadowRoot is null for this host, so DOM-path locators cannot reach the button.',
    },
    {
      id: 'SD3',
      title: 'Nested shadow roots',
      steps: ['Enter 42 in the "Nested value" field', 'Click on "Apply nested"', 'Verify that the current page displays text "Applied: 42"'],
      expected: 'state.nestedValue = "42" and state.nestedDepth = 2.',
    },
    {
      id: 'SD4',
      title: 'Custom select with slotted options',
      steps: ['Click on "Choose…"', 'Click on "Green"'],
      expected: 'state.selectValue = "green"; the trigger shows Green.',
    },
    {
      id: 'SD5',
      title: 'Shadow root inside an iframe',
      steps: ['Switch to the frame named "shadow-frame"', 'Enter Alan in the "Frame shadow name" field', 'Click on "Save in frame shadow"'],
      expected: 'Parent state.frameShadowName = "Alan" (posted from the frame).',
    },
    {
      id: 'SD6',
      title: 'Drifted labels',
      query: 'variant=b',
      steps: ['Navigate to <base>/shadow/?variant=b', 'Click on "Save in shadow"'],
      expected: 'Fails: in variant b the button is "Store in shadow" and the closed card comes first.',
    },
  ],
}

const ce = (tag: string, props: Record<string, unknown>, children?: ReactNode) => createElement(tag, props, children)

export default function ShadowPage() {
  const t = useTraps('shadow')
  const { merge } = usePageState()
  const location = useLocation()
  const host = useRef<HTMLDivElement>(null)
  const [defs] = useState(() => defineShadowElements())
  const [last, setLast] = useState<string>('none')

  useMountMerge(() => ({ elementsDefined: defs.defined, redefinitionSkipped: defs.skipped }))

  useEffect(() => {
    const el = host.current
    if (!el) return
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail ?? {}
      setLast(e.type)
      if (e.type === 'tp-shadow-save') merge({ shadowName: d.name })
      if (e.type === 'tp-closed-action') merge({ closedClicks: d.count })
      if (e.type === 'tp-nested-apply') merge({ nestedValue: d.value, nestedDepth: d.depth })
      if (e.type === 'tp-select-change') merge({ selectValue: d.value, selectLabel: d.label })
      merge({ lastEvent: e.type })
    }
    const names = ['tp-shadow-save', 'tp-closed-action', 'tp-nested-apply', 'tp-select-change']
    names.forEach((n) => el.addEventListener(n, on))
    return () => names.forEach((n) => el.removeEventListener(n, on))
  }, [merge])

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== 'tp-shadow-frame') return
      setLast('frame:tp-shadow-save')
      merge({ frameShadowName: e.data.name, lastEvent: 'frame:tp-shadow-save' })
    }
    window.addEventListener('message', on)
    return () => window.removeEventListener('message', on)
  }, [merge])

  const open = (
    <Card title="Open shadow root" key="open">
      {ce('tp-open-card', { id: t.id('open-card'), 'data-testid': 'open-card', 'button-label': t.v('Save in shadow', 'Store in shadow') })}
    </Card>
  )
  const closed = (
    <Card title="Closed shadow root" key="closed">
      <p data-ui="hint">This host uses a closed shadow root: its button is not reachable through element.shadowRoot.</p>
      {ce('tp-closed-card', { id: t.id('closed-card'), 'data-testid': 'closed-card', 'button-label': t.v('Closed action', 'Run closed action') })}
    </Card>
  )

  return (
    <div ref={host} data-testid="shadow-host-area">
      {t.v(
        [open, closed],
        [
          <div className={t.cls('drift-wrapper')} key="w">
            {closed}
          </div>,
          open,
        ],
      )}
      <Card title="Nested shadow roots">
        <p data-ui="hint">A shadow host inside another shadow root (two levels deep).</p>
        {ce('tp-outer-panel', { id: t.id('outer-panel'), 'data-testid': 'outer-panel', 'inner-button-label': t.v('Apply nested', 'Apply nested value') })}
      </Card>
      <Card title="Custom select">
        {ce(
          'tp-select',
          { id: t.id('colour-select'), 'data-testid': 'colour-select', label: 'Favourite colour' },
          t.shuffle(['Red', 'Green', 'Blue'], 'options').map((c) => ce('tp-option', { key: c, value: c.toLowerCase() }, c)),
        )}
      </Card>
      <Card title="Shadow root inside an iframe">
        <iframe
          name="shadow-frame"
          title="Shadow frame"
          src={frameSrc('/embed/shadow-frame', location.search)}
          style={{ width: '100%', maxWidth: 480, height: 170, border: '1px solid var(--border)', borderRadius: 8 }}
        />
      </Card>
      <p data-ui="hint" data-testid="last-event">
        Last event received by the page: {last}
      </p>
    </div>
  )
}

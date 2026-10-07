import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, useToast } from '../../components/ui'
import { usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/steps/click',
  title: 'Click, hover and copy',
  group: 'Step baselines',
  summary: 'Clean targets for click, double click, right click, mouseover, click-if-present, click-and-verify, position-relative clicks and copy to clipboard.',
  covers: [22, 23, 26, 27, 101, 154, 552, 589, 596],
  order: 2,
  samples: [
    {
      id: 'C1',
      title: 'Click and verify the effect',
      steps: ['Navigate to <base>/steps/click/', 'Click on "Primary action"', 'Verify that the current page displays text "Primary clicked"'],
      expected: 'state.clicks.primary = 1 and a toast "Primary clicked".',
    },
    {
      id: 'C2',
      title: 'Double and right click',
      steps: ['Double click on "Double-click target"', 'Right click on the element "Right-click target"', 'Click on "Archive"'],
      expected: 'state.lastAction = "contextmenu:Archive"; state.dblclicks = 1 and state.singleClicksOnDoubleTarget is not counted as a double click.',
    },
    {
      id: 'C3',
      title: 'Click relative to another element',
      steps: ['Click on the "Edit" located to the right of "Row B"'],
      expected: 'state.edited = "Row B" (there are three identical Edit buttons).',
    },
    {
      id: 'C4',
      title: 'Optional banner',
      query: 'banner=1',
      steps: ['Click on "Close banner" if Present', 'Click on "Primary action"'],
      expected: 'Passes with and without ?banner=1; state.bannerClosed = true only when the banner existed.',
    },
    {
      id: 'C5',
      title: 'Click and verify within N seconds',
      steps: ['Click on "Show panel in 2s" and verify that the "Delayed panel" is visible within 5 seconds.'],
      expected: 'Passes; with a 1-second maximum wait it fails (panel appears at 2 s).',
    },
    {
      id: 'C6',
      title: 'Copy to clipboard',
      steps: ['Click on "Copy invite code" and store copied value on inviteCode', 'Enter ${inviteCode} in the "Paste here" field'],
      expected: 'state.pasted = "INV-7Q2K-2026".',
    },
  ],
}

const INVITE = 'INV-7Q2K-2026'

export default function ClickPage() {
  const t = useTraps('click')
  const { state, merge } = usePageState()
  const toast = useToast()
  const [params] = useSearchParams()
  const [banner, setBanner] = useState(params.get('banner') === '1')
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [hover, setHover] = useState(false)
  const [panel, setPanel] = useState<'idle' | 'waiting' | 'shown'>('idle')
  const clicks = (state.clicks as Record<string, number>) ?? {}
  const bump = (k: string) => merge({ clicks: { ...clicks, [k]: (clicks[k] ?? 0) + 1 } })

  return (
    <>
      {banner ? (
        <div data-ui="card" role="region" aria-label="Announcement" data-testid="maybe-banner">
          <div data-ui="inline" style={{ justifyContent: 'space-between' }}>
            <span>Scheduled maintenance on Sunday 02:00–03:00 UTC.</span>
            <button
              onClick={() => {
                setBanner(false)
                merge({ bannerClosed: true })
              }}
            >
              Close banner
            </button>
          </div>
        </div>
      ) : null}

      <Card title="Basic clicks">
        <div data-ui="inline">
          <button
            id={t.id('primary-action')}
            className={t.cls('btn btn--primary')}
            data-variant="primary"
            data-testid="primary-action"
            onClick={() => {
              bump('primary')
              merge({ lastAction: 'click:primary' })
              toast('Primary clicked', { tone: 'success' })
            }}
          >
            Primary action
          </button>
          <button id={t.id('secondary-action')} className={t.cls('btn')} onClick={() => bump('secondary')}>
            Secondary action
          </button>
          <button id={t.id('disabled-action')} className={t.cls('btn')} disabled>
            Disabled action
          </button>
          {t.dup ? (
            <button className={t.cls('btn btn--decoy')} style={{ opacity: 0.6 }} onClick={() => bump('decoy')}>
              Primary action
            </button>
          ) : null}
        </div>
      </Card>

      <Card title="Double click and right click">
        <div data-ui="inline">
          <div
            id={t.id('double-target')}
            data-testid="double-target"
            role="button"
            tabIndex={0}
            data-ui="btn"
            onClick={() => merge({ singleClicksOnDoubleTarget: ((state.singleClicksOnDoubleTarget as number) ?? 0) + 1 })}
            onDoubleClick={() => merge({ lastAction: 'dblclick', dblclicks: ((state.dblclicks as number) ?? 0) + 1 })}
          >
            Double-click target
          </div>
          <div
            id={t.id('right-target')}
            data-testid="right-target"
            data-ui="btn"
            onContextMenu={(e) => {
              e.preventDefault()
              setMenu({ x: e.clientX, y: e.clientY })
              merge({ lastAction: 'contextmenu' })
            }}
          >
            Right-click target
          </div>
        </div>
        {menu ? (
          <div data-ui="popover" role="menu" style={{ position: 'fixed', left: menu.x, top: menu.y }} data-testid="context-menu">
            {['Open', 'Rename', 'Archive'].map((item) => (
              <button
                key={item}
                role="menuitem"
                data-ui="menu-item"
                onClick={() => {
                  merge({ lastAction: `contextmenu:${item}` })
                  setMenu(null)
                }}
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
      </Card>

      <Card title="Hover">
        <span
          style={{ position: 'relative', display: 'inline-block' }}
          onMouseEnter={() => {
            setHover(true)
            merge({ hovered: true })
          }}
          onMouseLeave={() => setHover(false)}
        >
          <span data-ui="btn" id={t.id('hover-target')} data-testid="hover-target">
            Hover to reveal
          </span>
          {hover ? (
            <span data-ui="popover" role="tooltip" style={{ top: '110%', left: 0 }} data-testid="hover-tooltip">
              Revealed by hover
            </span>
          ) : null}
        </span>
      </Card>

      <Card title="Same label, different rows">
        <p data-ui="hint">Three identical “Edit” buttons. Target the one to the right of “Row B”.</p>
        <table style={{ maxWidth: 420 }}>
          <tbody>
            {['Row A', 'Row B', 'Row C'].map((row) => (
              <tr key={row}>
                <td>{row}</td>
                <td>
                  <button className={t.cls('btn btn--edit')} onClick={() => merge({ edited: row })}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Click and wait for a result">
        <button
          id={t.id('show-panel')}
          onClick={() => {
            setPanel('waiting')
            setTimeout(() => {
              setPanel('shown')
              merge({ panelShownAt: '2s' })
            }, 2000)
          }}
        >
          Show panel in 2s
        </button>
        {panel === 'waiting' ? <span data-ui="hint"> Loading…</span> : null}
        {panel === 'shown' ? (
          <div data-ui="card" data-testid="delayed-panel" aria-label="Delayed panel">
            <strong>Delayed panel</strong>
            <div>Content appeared 2 seconds after the click.</div>
          </div>
        ) : null}
      </Card>

      <Card title="Copy to clipboard">
        <div data-ui="inline">
          <code data-testid="invite-code">{INVITE}</code>
          <button
            id={t.id('copy-invite')}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(INVITE)
                merge({ copied: INVITE })
                toast('Invite code copied')
              } catch {
                merge({ copied: null, copyError: 'clipboard permission denied' })
              }
            }}
          >
            Copy invite code
          </button>
        </div>
        <label data-ui="field">
          <span>Paste here</span>
          <input id={t.id('paste-here')} onChange={(e) => merge({ pasted: e.target.value })} />
        </label>
      </Card>
    </>
  )
}

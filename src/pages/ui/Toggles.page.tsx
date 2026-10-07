import { useEffect, useRef, useState } from 'react'
import { Card, Modal, useToast } from '../../components/ui'
import { useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { SwitchTrack } from './uiPart1Helpers'

export const meta: PageMeta = {
  path: '/ui/toggles',
  title: 'Switches and toggles',
  group: 'General UI',
  summary:
    'Switches built four different ways (ARIA switch button, checkbox-backed, plain div, disabled), a switch that asks for confirmation, a theme toggle, a feature-flag panel and expand/collapse-all sections.',
  covers: [26, 30, 450, 549, 590],
  order: 11,
  samples: [
    {
      id: 'T1',
      title: 'Toggle an ARIA switch and a checkbox switch',
      steps: ['Navigate to <base>/ui/toggles/', 'Click on "Wi-Fi"', 'Check the checkbox "Bluetooth"', 'Verify that the "Wi-Fi status" displays text "On"'],
      expected: 'state.switches.wifi = true and state.switches.bluetooth = true (both start off).',
    },
    {
      id: 'T2',
      title: 'Confirm before turning a switch off',
      steps: ['Click on "Notifications"', 'Verify that the current page displays text "Turn off notifications?"', 'Click on "Turn off"'],
      expected: 'state.switches.notifications = false and state.lastConfirm = "confirmed". Clicking "Keep on" leaves it true with lastConfirm = "cancelled".',
    },
    {
      id: 'T3',
      title: 'Theme toggle changes the document',
      steps: ['Click on "Dark theme"', 'Verify that the "Theme status" displays text "dark"'],
      expected: 'state.theme = "dark" and <html data-theme="dark">. The page restores the previous theme when you leave it.',
    },
    {
      id: 'T4',
      title: 'Feature flags',
      steps: ['Check the checkbox "Beta search"', 'Uncheck the checkbox "Inline help"', 'Verify that the "Enabled flags" displays text "3 of 5"'],
      expected: 'state.flags.betaSearch = true, state.flags.inlineHelp = false, state.enabledFlags = 3. With shuffle=true the flag order changes.',
    },
    {
      id: 'T5',
      title: 'Plain div switch and disabled switch',
      steps: ['Click on "Airplane mode"', 'Verify that the "Location" is disabled or not clickable.'],
      expected: 'state.switches.airplane = true (the div has no role, so role-based locators fail); the managed Location switch never changes.',
    },
    {
      id: 'T6',
      title: 'Expand and collapse all',
      steps: ['Click on "Expand all"', 'Verify that the current page displays text "Screen reader hints are on"', 'Click on "Collapse all"'],
      expected: 'state.expanded = [] after collapsing; after expanding it lists all three sections. In variant b the buttons read "Open all" and "Close all".',
    },
  ],
}

const FLAGS = [
  { key: 'newCheckout', label: 'New checkout', on: true },
  { key: 'betaSearch', label: 'Beta search', on: false },
  { key: 'compactTables', label: 'Compact tables', on: true },
  { key: 'inlineHelp', label: 'Inline help', on: true },
  { key: 'usageAnalytics', label: 'Usage analytics', on: false },
] as const
type FlagKey = (typeof FLAGS)[number]['key']

const SECTIONS = [
  { key: 'advanced', title: 'Advanced settings', body: 'Proxy and cache settings live here.' },
  { key: 'privacy', title: 'Privacy', body: 'Data is kept for 30 days.' },
  { key: 'accessibility', title: 'Accessibility', body: 'Screen reader hints are on.' },
]

export default function TogglesPage() {
  const t = useTraps('toggles')
  const config = useConfig()
  const { merge } = usePageState()
  const toast = useToast()
  const [sw, setSw] = useState({ wifi: false, bluetooth: false, airplane: false, location: true, notifications: true })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [flags, setFlags] = useState<Record<FlagKey, boolean>>(() => Object.fromEntries(FLAGS.map((f) => [f.key, f.on])) as Record<FlagKey, boolean>)
  const [expanded, setExpanded] = useState<string[]>([])
  const prevTheme = useRef<string | undefined>(undefined)

  // initial observable state
  useEffect(() => {
    merge({ switches: sw, theme, flags, enabledFlags: Object.values(flags).filter(Boolean).length, expanded: [] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // theme: remember what the document had and restore it on leave
  useEffect(() => {
    prevTheme.current = document.documentElement.dataset.theme
    return () => {
      if (prevTheme.current === undefined) delete document.documentElement.dataset.theme
      else document.documentElement.dataset.theme = prevTheme.current
    }
  }, [])

  const setSwitch = (k: keyof typeof sw, v: boolean) => {
    const next = { ...sw, [k]: v }
    setSw(next)
    merge({ switches: next, lastSwitch: `${k}:${v ? 'on' : 'off'}` })
  }

  const applyTheme = (next: 'light' | 'dark') => {
    setTheme(next)
    document.documentElement.dataset.theme = next
    merge({ theme: next, htmlDataTheme: document.documentElement.dataset.theme })
  }

  const toggleFlag = (k: FlagKey, v: boolean) => {
    const next = { ...flags, [k]: v }
    setFlags(next)
    merge({ flags: next, enabledFlags: Object.values(next).filter(Boolean).length })
  }

  const setExp = (next: string[]) => {
    setExpanded(next)
    merge({ expanded: next })
  }

  const wifiLabel = t.v('Wi-Fi', 'Wireless')

  const ariaSwitch = (
    <div key="wifi" data-ui="inline">
      <button
        type="button"
        role="switch"
        aria-checked={sw.wifi}
        id={t.id(t.v('wifi-switch', 'wireless-toggle'))}
        className={t.cls('switch switch--aria')}
        data-testid={t.v('wifi-switch', 'wireless-toggle')}
        onClick={() => setSwitch('wifi', !sw.wifi)}
        style={{ border: 'none', background: 'none', padding: 0 }}
      >
        <SwitchTrack on={sw.wifi} />
        <span>{wifiLabel}</span>
      </button>
      <span aria-label="Wi-Fi status" data-testid="wifi-status">
        {sw.wifi ? 'On' : 'Off'}
      </span>
      {t.dup ? (
        <button type="button" className={t.cls('switch switch--decoy')} style={{ opacity: 0.6 }} onClick={() => merge({ decoy: 'wifi' })}>
          {wifiLabel}
        </button>
      ) : null}
    </div>
  )

  const checkboxSwitch = (
    <label key="bt" data-ui="inline" htmlFor={t.id('bluetooth')} style={{ cursor: 'pointer' }}>
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <SwitchTrack on={sw.bluetooth} />
        {/* the real checkbox is invisible and stretched over the track */}
        <input
          id={t.id('bluetooth')}
          className={t.cls('switch__input')}
          type="checkbox"
          role="switch"
          checked={sw.bluetooth}
          onChange={(e) => setSwitch('bluetooth', e.target.checked)}
          style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', margin: 0, zIndex: 1, cursor: 'pointer' }}
        />
      </span>
      Bluetooth
    </label>
  )

  const divSwitch = (
    <div key="air" data-ui="inline">
      <div
        id={t.id('airplane')}
        className={t.cls('switch switch--div')}
        data-testid="airplane-switch"
        data-on={sw.airplane}
        onClick={() => setSwitch('airplane', !sw.airplane)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
      >
        <SwitchTrack on={sw.airplane} />
        <span>Airplane mode</span>
      </div>
      <span data-ui="hint">(plain div: no role, not focusable, no keyboard support)</span>
    </div>
  )

  const disabledSwitch = (
    <div key="loc" data-ui="inline">
      <button
        type="button"
        role="switch"
        aria-checked={sw.location}
        disabled
        id={t.id('location')}
        className={t.cls('switch switch--disabled')}
        style={{ border: 'none', background: 'none', padding: 0 }}
        onClick={() => setSwitch('location', !sw.location)}
      >
        <SwitchTrack on={sw.location} disabled />
        <span>Location</span>
      </button>
      <span data-ui="hint">Managed by your administrator</span>
    </div>
  )

  const notifSwitch = (
    <div key="notif" data-ui="inline">
      <button
        type="button"
        role="switch"
        aria-checked={sw.notifications}
        id={t.id('notifications')}
        className={t.cls('switch switch--confirm')}
        style={{ border: 'none', background: 'none', padding: 0 }}
        onClick={() => {
          if (sw.notifications) {
            setConfirmOpen(true)
            merge({ confirmShown: true })
          } else setSwitch('notifications', true)
        }}
      >
        <SwitchTrack on={sw.notifications} />
        <span>Notifications</span>
      </button>
      <span data-ui="hint">Asks before turning off</span>
    </div>
  )

  const switchList = t.v([ariaSwitch, checkboxSwitch, divSwitch, disabledSwitch, notifSwitch], [checkboxSwitch, ariaSwitch, notifSwitch, divSwitch, disabledSwitch])

  const flagList = t.shuffle(FLAGS, 'flags')
  const enabled = Object.values(flags).filter(Boolean).length

  return (
    <>
      <Card title="Switches">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{switchList}</div>
      </Card>

      <Modal
        open={confirmOpen}
        title="Turn off notifications?"
        labelledBy="notif-confirm-title"
        onClose={() => {
          setConfirmOpen(false)
          merge({ lastConfirm: 'cancelled' })
        }}
      >
        <p>You will stop receiving alerts about new activity.</p>
        <div data-ui="inline">
          <button
            data-variant="danger"
            id={t.id('confirm-turn-off')}
            className={t.cls('confirm__ok')}
            onClick={() => {
              setConfirmOpen(false)
              setSwitch('notifications', false)
              merge({ lastConfirm: 'confirmed' })
              toast('Notifications turned off')
            }}
          >
            Turn off
          </button>
          <button
            id={t.id('confirm-keep-on')}
            className={t.cls('confirm__cancel')}
            onClick={() => {
              setConfirmOpen(false)
              merge({ lastConfirm: 'cancelled' })
            }}
          >
            Keep on
          </button>
        </div>
      </Modal>

      <Card title="Appearance">
        <div data-ui="inline">
          <button
            type="button"
            role="switch"
            aria-checked={theme === 'dark'}
            id={t.id('theme-toggle')}
            className={t.cls('switch switch--theme')}
            style={{ border: 'none', background: 'none', padding: 0 }}
            onClick={() => applyTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <SwitchTrack on={theme === 'dark'} />
            <span>Dark theme</span>
          </button>
          <span data-ui="hint">
            Current theme: <code aria-label="Theme status" data-testid="theme-status">{theme}</code>
          </span>
        </div>
      </Card>

      <Card title="Feature flags">
        <p data-ui="hint">
          Enabled flags: <strong aria-label="Enabled flags" data-testid="enabled-flags">{enabled} of 5</strong>
          {config.shuffle ? ' (order shuffled by seed)' : ''}
        </p>
        <div role="group" aria-label="Feature flags" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {flagList.map((f) => (
            <label key={f.key} data-ui="inline" htmlFor={t.id(`flag-${f.key}`)}>
              <input
                id={t.id(`flag-${f.key}`)}
                className={t.cls('flag__input')}
                type="checkbox"
                checked={flags[f.key]}
                onChange={(e) => toggleFlag(f.key, e.target.checked)}
              />
              {f.label}
            </label>
          ))}
        </div>
      </Card>

      <Card title="Sections">
        <div data-ui="inline" style={{ marginBottom: 8 }}>
          <button id={t.id('expand-all')} className={t.cls('sections__expand')} onClick={() => setExp(SECTIONS.map((s) => s.key))}>
            {t.v('Expand all', 'Open all')}
          </button>
          <button id={t.id('collapse-all')} className={t.cls('sections__collapse')} onClick={() => setExp([])}>
            {t.v('Collapse all', 'Close all')}
          </button>
        </div>
        {SECTIONS.map((s) => {
          const open = expanded.includes(s.key)
          const panelId = t.id(`section-${s.key}`)
          return (
            <div key={s.key} style={{ borderTop: '1px solid var(--border)', padding: '6px 0' }}>
              <button
                type="button"
                data-variant="ghost"
                aria-expanded={open}
                aria-controls={panelId}
                className={t.cls('sections__header')}
                onClick={() => setExp(open ? expanded.filter((k) => k !== s.key) : [...expanded, s.key])}
              >
                {open ? '▾' : '▸'} {s.title}
              </button>
              {open ? (
                <div id={panelId} role="region" aria-label={s.title} style={{ padding: '4px 12px' }}>
                  {s.body}
                </div>
              ) : null}
            </div>
          )
        })}
      </Card>
    </>
  )
}

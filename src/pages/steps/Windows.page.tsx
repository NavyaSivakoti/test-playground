import { useCallback, useEffect, useRef, useState } from 'react'
import { Card } from '../../components/ui'
import { useConfig, usePageState, useTraps } from '../../core/playground'
import { useResetListener } from '../../core/reset'
import type { PageMeta } from '../../core/registry'
import { routeUrl, windowsChannel } from './windowsShared'

export const meta: PageMeta = {
  path: '/steps/windows',
  title: 'Windows, tabs and popups',
  group: 'Step baselines',
  summary: 'Open named child windows, a sized popup and new tabs, switch between them by title or index, and close them again. The parent records every window it opened and every close it hears about.',
  covers: [12, 34, 42, 145, 172, 464, 541, 544],
  order: 21,
  samples: [
    {
      id: 'W1',
      title: 'Open a child window and switch to it',
      steps: ['Navigate to <base>/steps/windows/', 'Click on "Open child window" to open in a new window and switch to the new window', 'Verify that the current page displays text "Child window"'],
      expected: 'In the child: state.opened = true and state.hasOpener = true.',
    },
    {
      id: 'W2',
      title: 'Switch by title and close',
      steps: ['Click on "Open child window"', 'Switch to the window titled "Child window"', 'Close the current window', 'Verify that the current page displays text "Child closed"'],
      expected: 'Parent shows "Child closed" and state.childClosed = true.',
    },
    {
      id: 'W3',
      title: 'Popup page',
      steps: ['Click "Open popup" lcoator to open link in popup', 'Verify that the current page displays text "Popup content"'],
      expected: 'A 480x360 popup with "Popup content"; parent state.opened includes "tp-popup".',
    },
    {
      id: 'W4',
      title: 'Link opens a new tab',
      steps: ['Verify that the link "Open docs in new tab" opens in a new window or tab'],
      expected: 'The link has target=_blank and points to /steps/windows/child/.',
    },
    {
      id: 'W5',
      title: 'Close all other windows',
      steps: ['Click on "Open 3 children"', 'Switch into 2th tab', 'Close all windows except the current window'],
      expected: 'Only one window remains; parent (if it remains) shows the closes in "Window log".',
    },
  ],
}

interface Opened {
  name: string
  kind: 'child' | 'popup'
  closed: boolean
}

export default function WindowsPage() {
  const t = useTraps('windows')
  const config = useConfig()
  const { state, merge } = usePageState()
  const refs = useRef<Map<string, Window>>(new Map())
  const [opened, setOpened] = useState<Opened[]>([])
  const [log, setLog] = useState<string[]>([])
  const [childClosed, setChildClosed] = useState(false)
  const childUrl = routeUrl('steps/windows/child', config)
  const popupUrl = routeUrl('steps/windows/popup', config)

  const addLog = useCallback((line: string) => setLog((l) => [...l, line]), [])

  useEffect(() => {
    const id = setTimeout(() => merge({ opened: opened.map((o) => o.name), openCount: opened.filter((o) => !o.closed).length }), 0)
    return () => clearTimeout(id)
  }, [opened, merge])

  useEffect(() => {
    if (childClosed) merge({ childClosed: true })
  }, [childClosed, merge])

  // Child pages announce themselves and their close over a BroadcastChannel (works for noopener tabs too).
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const ch = new BroadcastChannel(windowsChannel(config.ns))
    ch.onmessage = (e: MessageEvent<{ type: string; name?: string }>) => {
      if (e.data?.type === 'child-closed') {
        setChildClosed(true)
        addLog(`closed: ${e.data.name || 'child'}`)
      } else if (e.data?.type === 'child-ready') {
        addLog(`ready: ${e.data.name || 'child'}`)
      }
    }
    return () => ch.close()
  }, [config.ns, addLog])

  // Also poll the window references we hold, in case a window was closed by the browser/driver.
  useEffect(() => {
    const timer = setInterval(() => {
      let changed = false
      setOpened((list) =>
        list.map((o) => {
          const w = refs.current.get(o.name)
          if (!o.closed && w && w.closed) {
            changed = true
            if (o.kind === 'child') setChildClosed(true)
            return { ...o, closed: true }
          }
          return o
        }),
      )
      if (changed) addLog('a window was closed')
    }, 500)
    return () => clearInterval(timer)
  }, [addLog])

  useResetListener(
    config.ns,
    useCallback(() => {
      setOpened([])
      setLog([])
      setChildClosed(false)
    }, []),
  )

  const open = (name: string, kind: Opened['kind'], url: string, features?: string) => {
    const w = window.open(url, name, features)
    if (w) refs.current.set(name, w)
    setOpened((list) => [...list.filter((o) => o.name !== name), { name, kind, closed: !w }])
    addLog(`${w ? 'opened' : 'blocked'}: ${name}`)
    if (kind === 'child') setChildClosed(false)
  }

  const openChild = (
    <button id={t.id('open-child')} className={t.cls('btn btn--child')} data-testid={t.v('open-child', 'open-child-window')} onClick={() => open('tp-child', 'child', childUrl)}>
      Open child window
    </button>
  )
  const openPopup = (
    <button
      id={t.id(t.v('open-popup', 'popup-open'))}
      className={t.cls('btn btn--popup')}
      data-testid="open-popup"
      onClick={() => open('tp-popup', 'popup', popupUrl, 'popup=yes,width=480,height=360,left=80,top=80')}
    >
      Open popup
    </button>
  )

  return (
    <>
      <Card title="Open windows">
        {t.v(
          <div data-ui="inline">
            {openChild}
            {openPopup}
          </div>,
          <div data-ui="inline" data-wrapper="windows-v2">
            <div>{openPopup}</div>
            <div>{openChild}</div>
          </div>,
        )}
        <p>
          <a id={t.id('docs-link')} className={t.cls('link link--docs')} href={childUrl} target="_blank" rel="noopener" data-testid="docs-link" onClick={() => merge({ docsLinkClicked: true })}>
            {t.v('Open docs in new tab', 'Open docs in a new tab')}
          </a>
        </p>
        <div data-ui="inline">
          <button
            id={t.id('open-three')}
            className={t.cls('btn btn--three')}
            onClick={() => {
              for (let i = 1; i <= 3; i++) open(`tp-child-${i}`, 'child', `${childUrl}&n=${i}`)
            }}
          >
            Open 3 children
          </button>
          <button
            id={t.id('message-children')}
            className={t.cls('btn btn--message')}
            onClick={() => {
              let sent = 0
              refs.current.forEach((w, name) => {
                if (!w.closed) {
                  w.postMessage({ type: 'tp-parent-message', text: `Hello ${name}` }, window.location.origin)
                  sent++
                }
              })
              merge({ messagesSent: ((state.messagesSent as number) ?? 0) + sent })
            }}
          >
            Message children
          </button>
          <button
            id={t.id('close-children')}
            className={t.cls('btn btn--close-all')}
            onClick={() => {
              refs.current.forEach((w) => w.close())
              merge({ closedByParent: true })
            }}
          >
            Close all children
          </button>
        </div>
        <p data-ui="hint">
          “Open 3 children” opens three windows from one click; some browsers block all but the first unless popups are allowed for this site.
        </p>
        {childClosed ? (
          <p data-testid="child-closed">
            <strong>Child closed</strong>
          </p>
        ) : null}
      </Card>

      <Card title="Opened windows">
        {opened.length === 0 ? (
          <p data-ui="hint">No windows opened yet. The browser's own “open a new tab” step opens a blank tab, which this page does not track.</p>
        ) : (
          <table style={{ maxWidth: 480 }} data-testid="opened-windows">
            <thead>
              <tr>
                <th>Window name</th>
                <th>Kind</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {opened.map((o) => (
                <tr key={o.name}>
                  <td>{o.name}</td>
                  <td>{o.kind}</td>
                  <td>{o.closed ? 'closed' : 'open'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <h3>Window log</h3>
        <ol data-testid="window-log">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ol>
      </Card>
    </>
  )
}

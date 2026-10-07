import { useEffect, useState } from 'react'
import { StatePanel } from '../../components/PageShell'
import { useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { windowsChannel } from './windowsShared'

export const meta: PageMeta = {
  path: '/steps/windows/child',
  title: 'Child window',
  group: 'Step baselines',
  summary: 'Child window opened by the Windows page.',
  hidden: true,
  bare: true,
}

export default function WindowChildPage() {
  const t = useTraps('window-child')
  const config = useConfig()
  const { merge } = usePageState()
  const [messages, setMessages] = useState<string[]>([])

  useEffect(() => {
    document.title = 'Child window'
    // after the state provider's own mount reset (child effects run before parent effects)
    const init = setTimeout(() => merge({ opened: true, hasOpener: !!window.opener, windowName: window.name || null }), 0)
    const ch = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(windowsChannel(config.ns)) : null
    ch?.postMessage({ type: 'child-ready', name: window.name })
    const onHide = () => ch?.postMessage({ type: 'child-closed', name: window.name })
    window.addEventListener('pagehide', onHide)
    return () => {
      clearTimeout(init)
      window.removeEventListener('pagehide', onHide)
      ch?.close()
    }
  }, [config.ns, merge])

  useEffect(() => {
    const onMsg = (e: MessageEvent<{ type?: string; text?: string }>) => {
      if (e.origin !== window.location.origin || e.data?.type !== 'tp-parent-message') return
      setMessages((m) => {
        const next = [...m, String(e.data.text)]
        merge({ messages: next })
        return next
      })
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [merge])

  return (
    <main data-ui="main">
      <h1>Child window</h1>
      <p>
        Window name: <code data-testid="window-name">{window.name || '(none)'}</code>
      </p>
      <p data-ui="hint">{window.opener ? 'Opened by the Windows page (opener available).' : 'Opened without an opener (new tab).'}</p>
      <h2>Messages from the opener</h2>
      <ul data-testid="opener-messages">
        {messages.length ? messages.map((m, i) => <li key={i}>{m}</li>) : <li>No messages yet</li>}
      </ul>
      <button
        id={t.id('close-window')}
        className={t.cls('btn btn--close')}
        onClick={() => {
          if (typeof BroadcastChannel !== 'undefined') {
            const ch = new BroadcastChannel(windowsChannel(config.ns))
            ch.postMessage({ type: 'child-closed', name: window.name })
            ch.close()
          }
          window.close()
        }}
      >
        Close this window
      </button>
      <StatePanel />
    </main>
  )
}

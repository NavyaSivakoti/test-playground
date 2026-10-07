import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Card } from '../../components/ui'
import { nsKey, useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { tokenFor } from '../../core/rng'
import { embedSrc, type EmbedMessage } from './shared'

export const meta: PageMeta = {
  path: '/frames',
  title: 'Iframe lab',
  group: 'Scenarios',
  summary:
    'Frames that real apps use: a named add-in panel, three levels of nesting, a frame whose name changes on every load, a hover menu inside a frame, an opaque-origin sandboxed widget and a long scrolling frame. Every message from a frame lands in the page state.',
  covers: [491, 23, 186],
  order: 3,
  samples: [
    {
      id: 'F1',
      title: 'Named add-in frame',
      steps: ['Navigate to <base>/frames/', 'Switch to the frame named sidebar-addin', 'Click on "Insert"', 'Switch to the main page', 'Verify that the current page displays text "Hello from the add-in"'],
      expected: 'state.inserts = 1 and the document shows the inserted greeting.',
    },
    {
      id: 'F2',
      title: 'Three nested frames',
      steps: [
        'Switch to the frame named nest-1',
        'Switch to the frame named nest-2',
        'Switch to the frame named nest-3',
        'Enter Turing in the "Deep field" field',
        'Click on "Deep button"',
        'Switch to the main page',
      ],
      expected: 'state.deep = { value: "Turing", clicks: 1 }.',
    },
    {
      id: 'F3',
      title: 'Frame name changes per load',
      query: 'unstableIds=true',
      steps: ['Switch to the frame named dynamic-frame', 'Click on "Confirm"'],
      expected:
        'With unstableIds the frame is named frame-<token> (seeded, different on every reload), so a recorded name fails; select it by title "Dynamic frame" instead. state.dynamicConfirms = 1, state.dynamicFrameName shows the current name.',
    },
    {
      id: 'F4',
      title: 'Hover menu inside a frame',
      steps: ['Switch to the frame named hover-menu', 'Mouseover on "Actions"', 'Click on "Export"', 'Switch to the main page'],
      expected: 'state.menu = "Export". Clicking "Actions" without hovering does not open the menu in a scripted click.',
    },
    {
      id: 'F5',
      title: 'Drifted frame content',
      query: 'variant=b',
      steps: ['Switch to the frame named sidebar-addin', 'Click on "Insert into document"'],
      expected: 'In variant b the embeds rename labels and ids ("Insert" → "Insert into document", "Actions" → "More actions", "Deep field" → "Innermost field"). state.inserts = 1.',
    },
    {
      id: 'F6',
      title: 'Add-in under a sticky toolbar with an overlay',
      query: 'overlay=true&overlayMs=2000',
      steps: ['Switch to the frame named sidebar-addin', 'Click on "Insert"', 'Switch to the main page'],
      expected:
        'During the first 2 s the overlay intercepts clicks (html[data-tp-intercepted-clicks] increases, state.inserts unchanged); a retrying click succeeds afterwards (state.inserts = 1).',
    },
    {
      id: 'F7',
      title: 'Opaque-origin widget and long frame',
      steps: ['Switch to the frame named cross-origin-widget', 'Click on "Send ping"', 'Switch to the main page', 'Switch to the frame named long-frame', 'Scroll (up to/down to) the element "Far button" into view', 'Click on "Far button"'],
      expected: 'state.ping = 1 with state.pingOrigin = "null" (sandbox without allow-same-origin); state.farClicks = 1.',
    },
  ],
}

// Per page load (not per render): a reload gives a new index, SPA navigation keeps it.
let loadIndex: number | null = null
function frameLoadIndex(key: string): number {
  if (loadIndex !== null) return loadIndex
  let n = 0
  try {
    n = Number(sessionStorage.getItem(key) ?? '0') + 1
    sessionStorage.setItem(key, String(n))
  } catch {
    n = 1
  }
  loadIndex = n
  return n
}

const WIDGET_SRCDOC = `<!doctype html><html><body style="font-family:system-ui,sans-serif;margin:10px">
<strong>Cross-origin widget</strong>
<p style="color:#5b6478;font-size:13px;margin:4px 0 8px">Sandboxed without allow-same-origin: the parent cannot read this DOM.</p>
<button id="ping" style="font:inherit;padding:6px 12px">Send ping</button> <span id="out"></span>
<script>
var n=0;document.getElementById('ping').onclick=function(){n++;document.getElementById('out').textContent='Sent '+n;
parent.postMessage({source:'tp-embed',frame:'cross-origin-widget',type:'ping',count:n},'*')};
</script></body></html>`

const LONG_SRCDOC = `<!doctype html><html><body style="font-family:system-ui,sans-serif;margin:10px">
<strong>Long frame</strong><p>The button is far below. Scroll inside this frame.</p>
<div style="height:1600px;background:linear-gradient(#f0f2f7,#d9dee8);border-radius:8px"></div>
<button id="far" style="font:inherit;padding:6px 12px">Far button</button>
<script>document.getElementById('far').onclick=function(){parent.postMessage({source:'tp-embed',frame:'long-frame',type:'far'},'*')};</script>
</body></html>`

export default function FramesPage() {
  const t = useTraps('frames')
  const config = useConfig()
  const location = useLocation()
  const { merge } = usePageState()
  const [inserted, setInserted] = useState<string[]>([])
  const counts = useRef({ inserts: 0, ping: 0, farClicks: 0, dynamicConfirms: 0, deepClicks: 0 })
  const messages = useRef<Record<string, unknown>[]>([])
  const deepValue = useRef('')

  const load = frameLoadIndex(nsKey(config, 'frames_loads'))
  const dynamicName = config.unstableIds ? `frame-${tokenFor(config.seed, `frames:dynamic:${load}`, 6)}` : 'dynamic-frame'

  useEffect(() => {
    merge({ messages: [], dynamicFrameName: dynamicName, frameLoad: load })
    const onMsg = (e: MessageEvent) => {
      const d = e.data as EmbedMessage
      if (!d || d.source !== 'tp-embed') return
      const c = counts.current
      const { source: _s, ...rest } = d
      void _s
      messages.current = [...messages.current, { ...rest, origin: e.origin }].slice(-30)
      const patch: Record<string, unknown> = { messages: messages.current, lastMessage: { ...rest, origin: e.origin } }
      if (d.frame === 'sidebar-addin' && d.type === 'insert') {
        c.inserts++
        patch.inserts = c.inserts
        setInserted((x) => [...x, String(d.text)])
      } else if (d.frame === 'dynamic-frame') {
        c.dynamicConfirms++
        patch.dynamicConfirms = c.dynamicConfirms
      } else if (d.frame === 'nest-3') {
        if (d.type === 'input') deepValue.current = String(d.value)
        if (d.type === 'click') c.deepClicks++
        patch.deep = { value: deepValue.current, clicks: c.deepClicks }
      } else if (d.frame === 'hover-menu') {
        patch.menu = d.item
      } else if (d.frame === 'cross-origin-widget') {
        c.ping++
        patch.ping = c.ping
        patch.pingOrigin = e.origin
      } else if (d.frame === 'long-frame') {
        c.farClicks++
        patch.farClicks = c.farClicks
      }
      merge(patch)
    }
    window.addEventListener('message', onMsg)
    return () => {
      window.removeEventListener('message', onMsg)
    }
  }, [merge, dynamicName, load])

  const frameStyle = { width: '100%', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }

  return (
    <>
      <Card title="Document editor with add-in (F1, F6)" data-testid="f1">
        <p data-ui="hint">The add-in panel is an iframe named “sidebar-addin”. The toolbar is sticky and can cover the top of the panel when the editor scrolls.</p>
        <div data-testid="editor-scroll" style={{ height: 320, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, position: 'relative' }}>
          <div
            data-testid="sticky-toolbar"
            style={{ position: 'sticky', top: 0, zIndex: 2, height: 48, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}
          >
            <strong>Document toolbar</strong>
            <span data-ui="hint">Bold · Italic · Link</span>
          </div>
          <div style={{ display: 'flex', gap: 12, padding: 12, flexDirection: t.v('row', 'row-reverse') as 'row' | 'row-reverse' }}>
            <div style={{ flex: 1, minHeight: 600 }} data-testid="document-body">
              <p>Quarterly planning notes. Use the add-in to insert a greeting.</p>
              {inserted.map((x, i) => (
                <p key={i} data-testid="inserted-text">
                  {x}
                </p>
              ))}
            </div>
            <iframe
              name="sidebar-addin"
              id={t.id(t.v('sidebar-addin', 'addin-panel'))}
              title="Sidebar add-in"
              src={embedSrc('embed/sidebar-addin', location.search)}
              style={{ ...frameStyle, width: 240, height: 200, flex: 'none' }}
            />
          </div>
        </div>
      </Card>

      <div data-ui="grid">
        <Card title="Nested frames (F2)" data-testid="f2">
          <iframe name="nest-1" id={t.id('nest-1')} title="Level 1" src={embedSrc('embed/nest-1', location.search)} style={{ ...frameStyle, height: 520 }} />
        </Card>

        <Card title="Dynamic frame name (F3)" data-testid="f3">
          <p data-ui="hint">
            Current name: <code data-testid="dynamic-frame-name">{dynamicName}</code>. With unstableIds it changes on every load.
          </p>
          <iframe
            key={dynamicName}
            name={dynamicName}
            id={t.id(config.unstableIds ? dynamicName : 'dynamic-frame')}
            title="Dynamic frame"
            src={embedSrc('embed/sidebar-addin', location.search, { as: 'dynamic' })}
            style={{ ...frameStyle, height: 160 }}
          />
        </Card>

        <Card title="Hover menu in a frame (F4)" data-testid="f4">
          <iframe name="hover-menu" id={t.id('hover-menu')} title="Hover menu" src={embedSrc('embed/hover-menu', location.search)} style={{ ...frameStyle, height: 190 }} />
        </Card>

        <Card title="Cross-origin widget" data-testid="f7">
          <iframe
            name="cross-origin-widget"
            id={t.id('cross-origin-widget')}
            title="Cross-origin widget"
            sandbox="allow-scripts allow-forms"
            srcDoc={WIDGET_SRCDOC}
            style={{ ...frameStyle, height: 140 }}
          />
        </Card>

        <Card title="Long frame" data-testid="f8">
          <iframe name="long-frame" id={t.id('long-frame')} title="Long frame" srcDoc={LONG_SRCDOC} style={{ ...frameStyle, height: 180 }} />
        </Card>
      </div>
    </>
  )
}

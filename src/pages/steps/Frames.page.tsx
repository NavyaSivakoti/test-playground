import { useEffect } from 'react'
import { Card } from '../../components/ui'
import { useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { routeUrl } from './windowsShared'

export const meta: PageMeta = {
  path: '/steps/frames',
  title: 'Frames and nested frames',
  group: 'Step baselines',
  summary: 'Named iframes (a simple frame, a three-level nested chain and a srcdoc frame) whose content reports back to this page, so switching into the right frame is visible in the parent state.',
  covers: [491],
  order: 22,
  samples: [
    {
      id: 'F1',
      title: 'Switch to a frame by name',
      steps: ['Navigate to <base>/steps/frames/', 'Switch to the frame named "frame-a"', 'Click on "Insert"', 'Switch to the main page', 'Verify that the current page displays text "Inserted from frame A"'],
      expected: 'Parent state.inserted = true.',
    },
    {
      id: 'F2',
      title: 'Nested frames',
      steps: ['Switch to the frame named "frame-level-1"', 'Switch to the frame named "frame-level-2"', 'Switch to the frame named "frame-level-3"', 'Enter deep-42 in the "Deep value" field'],
      expected: 'Parent state.deepValue = "deep-42".',
    },
    {
      id: 'F3',
      title: 'srcdoc frame',
      steps: ['Switch to the frame named "frame-srcdoc"', 'Click on "Srcdoc button"'],
      expected: 'Parent state.srcdocClicked = true.',
    },
  ],
}

const SRCDOC = `<!doctype html><html><body style="font-family:system-ui;margin:8px">
<p>Inline (srcdoc) frame content.</p>
<button id="srcdoc-button" onclick="parent.postMessage({type:'tp-frame',action:'srcdoc-click'}, '*');this.textContent='Srcdoc button (clicked)'">Srcdoc button</button>
</body></html>`

export default function FramesPage() {
  const t = useTraps('frames')
  const config = useConfig()
  const { state, merge } = usePageState()

  useEffect(() => {
    const onMsg = (e: MessageEvent<{ type?: string; action?: string; value?: string }>) => {
      // srcdoc frames have an opaque "null" origin; everything else must be same-origin.
      if (e.origin !== window.location.origin && e.origin !== 'null') return
      if (e.data?.type !== 'tp-frame') return
      if (e.data.action === 'insert') merge({ inserted: true })
      else if (e.data.action === 'deep-value') merge({ deepValue: e.data.value ?? '' })
      else if (e.data.action === 'srcdoc-click') merge({ srcdocClicked: true })
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [merge])

  const frameA = (
    <Card title="Frame A">
      <iframe
        name="frame-a"
        id={t.id(t.v('frame-a', 'frame-a-v2'))}
        className={t.cls('frame frame--a')}
        title="Frame A"
        src={routeUrl('embed/frame-a', config)}
        style={{ width: '100%', height: 140, border: '1px solid var(--border)' }}
      />
      {state.inserted ? <p data-testid="inserted">Inserted from frame A</p> : null}
    </Card>
  )
  const nested = (
    <Card title="Nested frames (3 levels)">
      <iframe
        name="frame-level-1"
        id={t.id('frame-level-1')}
        className={t.cls('frame frame--level-1')}
        title="Level 1 frame"
        src={routeUrl('embed/level-1', config)}
        style={{ width: '100%', height: 360, border: '1px solid var(--border)' }}
      />
      {state.deepValue !== undefined ? <p data-testid="deep-value">Deep value received: {String(state.deepValue)}</p> : null}
    </Card>
  )

  return (
    <>
      <p data-ui="hint">Frame names: frame-a, frame-level-1 → frame-level-2 → frame-level-3, frame-srcdoc.</p>
      {t.v(
        <>
          {frameA}
          {nested}
        </>,
        <div data-wrapper="frames-v2">
          {nested}
          {frameA}
        </div>,
      )}
      <Card title="srcdoc frame">
        <iframe name="frame-srcdoc" id={t.id('frame-srcdoc')} className={t.cls('frame frame--srcdoc')} title="Srcdoc frame" srcDoc={SRCDOC} style={{ width: '100%', height: 110, border: '1px solid var(--border)' }} />
        {state.srcdocClicked ? <p data-testid="srcdoc-clicked">Srcdoc button clicked</p> : null}
      </Card>
    </>
  )
}

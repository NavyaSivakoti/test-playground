import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge, Card } from '../../components/ui'
import { backend } from '../../core/backend'
import { nowMs, nsKey, useConfig, usePageState, useTraps } from '../../core/playground'
import type { PlaygroundConfig } from '../../core/config'
import { detectFromBlob, detectFromVideo, type Detected } from '../../core/detect'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/steps/camera',
  title: 'Camera capture',
  group: 'Step baselines',
  summary: 'Live camera preview with a capture button that recognises the green front or blue back sample card. Capture progress is kept in every browser store and on the server so a restored session can continue; without a camera the page falls back to an upload.',
  covers: [638],
  order: 27,
  samples: [
    {
      id: 'K1',
      title: 'Capture the front card from a fake camera',
      steps: ['Set camerafile and restore session', 'Navigate to <base>/steps/camera/', 'Click on "Capture"', 'Verify that the current page displays text "Detected: FRONT"'],
      expected: 'With front.y4m as the camera file: state.detected = "FRONT" and state.captures[0].detected = "FRONT".',
    },
    {
      id: 'K2',
      title: 'Back card',
      steps: ['Set camerafile and restore session', 'Navigate to <base>/steps/camera/', 'Select option by text "Back" in the list "Expected side"', 'Click on "Capture"'],
      expected: 'With back.y4m: state.detected = "BACK" and state.match = true.',
    },
    {
      id: 'K3',
      title: 'Progress survives a restored session',
      steps: ['Click on "Capture"', 'Upload Session', 'Restore Session', 'Navigate to <base>/steps/camera/'],
      expected: 'state.restoredFrom names the store that still had the progress (localStorage, sessionStorage, cookie or server) and state.captures keeps the earlier capture.',
    },
    {
      id: 'K4',
      title: 'No camera permission',
      steps: ['Navigate to <base>/steps/camera/', 'Upload the file at "#camera-upload" from URL <base>fixtures/front.png with name front.png'],
      expected: 'When the camera is denied the page shows the upload fallback; state.detected = "FRONT".',
    },
  ],
}

interface Capture {
  side: 'front' | 'back'
  detected: Detected
  avg: [number, number, number]
  source: 'camera' | 'upload'
  at: string
}

const PROGRESS_PAGE = '/steps/camera:progress'

function readCookie(name: string): string | null {
  for (const part of document.cookie.split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim())
  }
  return null
}
function parse(raw: string | null): Capture[] | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as unknown
    return Array.isArray(v) ? (v as Capture[]) : null
  } catch {
    return null
  }
}
function persist(config: PlaygroundConfig, captures: Capture[]) {
  const json = JSON.stringify(captures.slice(-10))
  const key = nsKey(config, 'camera')
  try {
    localStorage.setItem(key, json)
    sessionStorage.setItem(key, json)
  } catch {
    /* storage unavailable */
  }
  document.cookie = `${key}=${encodeURIComponent(json)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
  void backend.saveState(config.ns, PROGRESS_PAGE, { captures: captures.slice(-10) })
}

export default function CameraPage() {
  const t = useTraps('camera')
  const config = useConfig()
  const { state, merge } = usePageState()
  const video = useRef<HTMLVideoElement>(null)
  const [camera, setCamera] = useState<'starting' | 'live' | 'unavailable'>('starting')
  const [side, setSide] = useState<'front' | 'back'>('front')
  const [thumb, setThumb] = useState<string | null>(null)
  const [captures, setCaptures] = useState<Capture[]>([])
  const restored = useRef(false)

  // Restore progress: first store that has it wins.
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    const key = nsKey(config, 'camera')
    void (async () => {
      await new Promise((r) => setTimeout(r, 0))
      let from = 'none'
      let found: Capture[] | null = null
      const tries: [string, () => string | null][] = [
        ['localStorage', () => localStorage.getItem(key)],
        ['sessionStorage', () => sessionStorage.getItem(key)],
        ['cookie', () => readCookie(key)],
      ]
      for (const [name, read] of tries) {
        let raw: string | null = null
        try {
          raw = read()
        } catch {
          raw = null
        }
        found = parse(raw)
        if (found?.length) {
          from = name
          break
        }
      }
      if (!found?.length) {
        const srv = (await backend.getState(config.ns, PROGRESS_PAGE).catch(() => null)) as { captures?: Capture[] } | null
        if (srv?.captures?.length) {
          found = srv.captures
          from = 'server'
        }
      }
      const list = found ?? []
      setCaptures(list)
      const last = list[list.length - 1]
      merge({ restoredFrom: from, captures: list, ...(last ? { detected: last.detected } : {}) })
    })()
  }, [config, merge])

  useEffect(() => {
    let stream: MediaStream | null = null
    let alive = true
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia not supported')
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        if (!alive) {
          stream.getTracks().forEach((tr) => tr.stop())
          return
        }
        if (video.current) {
          video.current.srcObject = stream
          await video.current.play().catch(() => undefined)
        }
        setCamera('live')
        merge({ camera: 'live' })
      } catch (e) {
        if (!alive) return
        setCamera('unavailable')
        merge({ camera: 'unavailable', cameraError: (e as Error).name || String(e) })
      }
    }
    // never block: if permission is neither granted nor denied within 5 s, offer the upload fallback.
    const timer = setTimeout(() => alive && setCamera((c) => (c === 'starting' ? 'unavailable' : c)), 5000)
    void start()
    return () => {
      alive = false
      clearTimeout(timer)
      stream?.getTracks().forEach((tr) => tr.stop())
    }
  }, [merge])

  const add = useCallback(
    (c: Capture) => {
      setCaptures((list) => {
        const next = [...list, c].slice(-10)
        persist(config, next)
        merge({ captures: next, detected: c.detected, match: c.detected === c.side.toUpperCase() })
        return next
      })
    },
    [config, merge],
  )

  const capture = () => {
    const v = video.current
    if (!v || camera !== 'live') return
    const r = detectFromVideo(v)
    setThumb(r.dataUrl)
    add({ side, detected: r.detected, avg: r.avg, source: 'camera', at: new Date(nowMs(config)).toISOString() })
  }

  const last = captures[captures.length - 1]
  const sideSelect = (
    <label data-ui="field">
      <span>Expected side</span>
      <select id={t.id('expected-side')} className={t.cls('select select--side')} value={side} onChange={(e) => setSide(e.target.value as 'front' | 'back')}>
        <option value="front">Front</option>
        <option value="back">Back</option>
      </select>
    </label>
  )

  return (
    <>
      <Card title={t.v('Camera', 'Live camera')}>
        {t.v(sideSelect, null)}
        {camera === 'unavailable' ? (
          <div data-testid="camera-fallback">
            <p>
              <strong>Camera unavailable — upload instead</strong>
            </p>
            <label data-ui="field">
              <span>ID image</span>
              <input
                type="file"
                accept="image/*"
                id={t.id('camera-upload')}
                className={t.cls('file file--camera')}
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  setThumb(URL.createObjectURL(f))
                  const r = await detectFromBlob(f)
                  add({ side, detected: r.detected, avg: r.avg, source: 'upload', at: new Date(nowMs(config)).toISOString() })
                }}
              />
            </label>
          </div>
        ) : null}
        <video
          ref={video}
          muted
          playsInline
          data-testid="camera-preview"
          aria-label="Camera preview"
          style={{ width: 320, maxWidth: '100%', background: '#111', borderRadius: 8, display: camera === 'unavailable' ? 'none' : 'block' }}
        />
        {camera === 'starting' ? <p data-ui="hint">Starting camera…</p> : null}
        <div data-ui="inline" data-wrapper={t.v(undefined, 'camera-v2')} style={{ marginTop: '0.5rem' }}>
          {t.v(null, sideSelect)}
          <button id={t.id(t.v('capture', 'capture-photo'))} className={t.cls('btn btn--capture')} data-variant="primary" disabled={camera !== 'live'} onClick={capture}>
            Capture
          </button>
        </div>
      </Card>

      <Card title="Result">
        {thumb ? <img src={thumb} alt="Captured frame" data-testid="capture-thumb" style={{ width: 160, borderRadius: 6 }} /> : null}
        {last ? (
          <p data-testid="detected">
            Detected: {last.detected}{' '}
            {last.detected === last.side.toUpperCase() ? <Badge tone="success">matches expected side</Badge> : <Badge tone="warning">expected {last.side}</Badge>}
          </p>
        ) : (
          <p data-ui="hint">No capture yet.</p>
        )}
        <p data-testid="restored-from">Progress restored from: {String(state.restoredFrom ?? '…')}</p>
        <p data-ui="hint">Captures so far: {captures.length}. Progress is saved to localStorage, sessionStorage, a cookie and the server.</p>
      </Card>
    </>
  )
}

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Card } from '../../components/ui'
import { backend } from '../../core/backend'
import { nsKey, useConfig, usePageState, useTraps } from '../../core/playground'
import { detectFromBlob, detectFromVideo, type Detected } from '../../core/detect'
import type { PageMeta } from '../../core/registry'
import { useResetListener } from '../../core/reset'
import { readCookie, writeCookie } from './shared'

export const meta: PageMeta = {
  path: '/identity',
  title: 'Identity verification (document capture)',
  group: 'Scenarios',
  summary:
    'A multi-screen document capture flow: choose a document, allow the camera, capture front and back, review and submit. Progress survives reloads and restored sessions, and a hidden file input offers an upload path.',
  covers: [638, 563, 562, 547, 26],
  order: 1,
  samples: [
    {
      id: 'I1',
      title: 'Camera path (fake camera shows the FRONT card)',
      steps: [
        'Navigate to <base>/identity/',
        'Click on "Start"',
        'Click on "ID card"',
        'Click on "I agree to the Terms of Use and Privacy Policy"',
        'Click on "Continue"',
        'Click on "Enable access"',
        'Click on "Continue"',
        'Click on "Take photo"',
        'Wait until the text "Front of document" is present on the current page',
        'Click on "Capture"',
        'Verify that the current page displays text "Detected: FRONT"',
        'Click on "Continue"',
        'Set camerafile and restore session',
        'Click on "Capture"',
        'Verify that the current page displays text "Detected: BACK"',
      ],
      expected:
        'state.captures.front.detected = "FRONT" and source = "camera". The back needs a different camera feed: "Set camerafile and restore session" with fixtures/back.y4m relaunches the browser, the page resumes on "Back of document" (state.restoredFrom set) and the capture gives state.captures.back.detected = "BACK". Without it the back capture also reads FRONT.',
    },
    {
      id: 'I2',
      title: 'Upload path through the hidden input',
      steps: [
        'Navigate to <base>/identity/',
        'Click on "Start"',
        'Click on "Passport"',
        'Click on "I agree to the Terms of Use and Privacy Policy"',
        'Click on "Continue"',
        'Upload the file at "[data-testid=document-detector-capture-button]" from URL <base>fixtures/front.png with name front.png',
        'Upload the file at "[data-testid=document-detector-capture-button]" from URL <base>fixtures/back.png with name back.png',
        'Click on "Continue"',
        'Click on "Continue"',
        'Verify that the current page displays text "Your documents were submitted"',
      ],
      expected:
        'state.captures.front = { detected: "FRONT", source: "upload" }, then state.captures.back = { detected: "BACK", source: "upload" }; state.completed = true after the review.',
    },
    {
      id: 'I3',
      title: 'Camera permission denied: upload is offered, never blocks',
      steps: [
        'Navigate to <base>/identity/',
        'Click on "Start"',
        'Click on "Driver licence"',
        'Click on "I agree to the Terms of Use and Privacy Policy"',
        'Click on "Continue"',
        'Click on "Enable access"',
        'Verify that the current page displays text "Camera unavailable"',
        'Upload the file at "[data-testid=document-detector-capture-button]" from URL <base>fixtures/front.png with name front.png',
      ],
      expected:
        'With the camera blocked: state.cameraStatus = "denied", "Upload instead" is visible and the upload fills state.captures.front.detected = "FRONT".',
    },
    {
      id: 'I4',
      title: 'Resume after reload',
      steps: ['Navigate to <base>/identity/', 'Click on "Start"', 'Reload the current page', 'Verify that the current page displays text "Choose your document"'],
      expected: 'state.screen = "doc" and state.restoredFrom = "localStorage" after the reload.',
    },
    {
      id: 'I5',
      title: 'Drifted labels (variant b)',
      query: 'variant=b',
      steps: ['Click on "Start"', 'Click on "Passport"', 'Click on "I agree to the Terms of Use and Privacy Policy"', 'Click on "Next"'],
      expected: '"Continue" is "Next", document cards are reordered, the capture button sits on top of the video. state.screen = "camera".',
    },
    {
      id: 'I6',
      title: 'Mobile-only flow',
      query: 'device=mobile',
      steps: ['Navigate to <base>/identity/?device=mobile', 'Verify that the current page displays text "Continue on your phone"'],
      expected: 'Desktop browsers see the device gate; a mobile emulation (touch + mobile user agent) sees the flow.',
    },
  ],
}

type Screen = 'intro' | 'doc' | 'camera' | 'prepare' | 'take' | 'front' | 'frontPreview' | 'back' | 'backPreview' | 'review' | 'done'
type Side = 'front' | 'back'
interface Capture {
  detected: Detected
  avg: [number, number, number]
  source: 'camera' | 'upload'
  fileName?: string
}
interface Progress {
  screen: Screen
  docType: string | null
  termsAccepted: boolean
  captures: { front?: Capture; back?: Capture }
  completed: boolean
}
const EMPTY: Progress = { screen: 'intro', docType: null, termsAccepted: false, captures: {}, completed: false }
const SCREENS: Screen[] = ['intro', 'doc', 'camera', 'prepare', 'take', 'front', 'frontPreview', 'back', 'backPreview', 'review', 'done']
const UPLOAD_SCREENS: Screen[] = ['camera', 'prepare', 'take', 'front', 'frontPreview', 'back', 'backPreview', 'review']
const DOCS = ['ID card', 'Driver licence', 'Passport']

function parseProgress(raw: string | null): Progress | null {
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as Progress
    return p && SCREENS.includes(p.screen) ? { ...EMPTY, ...p } : null
  } catch {
    return null
  }
}

export default function IdentityPage() {
  const t = useTraps('identity')
  const config = useConfig()
  const { merge } = usePageState()
  const [progress, setProgress] = useState<Progress>(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [thumbs, setThumbs] = useState<{ front?: string; back?: string }>({})
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const KEY = nsKey(config, 'identity_progress')
  const BACKEND_PAGE = '/identity#progress'

  // ---------- restore ----------
  useEffect(() => {
    let alive = true
    const fromLocal = (() => {
      try {
        return parseProgress(localStorage.getItem(KEY))
      } catch {
        return null
      }
    })()
    const fromSession = (() => {
      try {
        return parseProgress(sessionStorage.getItem(KEY))
      } catch {
        return null
      }
    })()
    const fromCookie = parseProgress(readCookie(KEY))
    const finish = (p: Progress | null, from: string | null) => {
      if (!alive) return
      if (p) setProgress(p)
      setLoaded(true)
      merge({ ...(p ?? EMPTY), restoredFrom: from, cameraStatus: 'idle' })
    }
    if (fromLocal) finish(fromLocal, 'localStorage')
    else if (fromSession) finish(fromSession, 'sessionStorage')
    else if (fromCookie) finish(fromCookie, 'cookie')
    else
      backend
        .getState(config.ns, BACKEND_PAGE)
        .then((s) => {
          const p = s && typeof s === 'object' ? parseProgress(JSON.stringify(s)) : null
          finish(p && p.screen !== 'intro' ? p : null, p && p.screen !== 'intro' ? 'backend' : null)
        })
        .catch(() => finish(null, null))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [KEY])

  // ---------- persist ----------
  useEffect(() => {
    if (!loaded) return
    const raw = JSON.stringify(progress)
    try {
      localStorage.setItem(KEY, raw)
      sessionStorage.setItem(KEY, raw)
    } catch {
      /* storage blocked */
    }
    writeCookie(KEY, raw)
    void backend.saveState(config.ns, BACKEND_PAGE, progress)
    merge({ ...progress })
  }, [progress, loaded, KEY, config.ns, merge])

  const update = useCallback(
    (patch: Partial<Progress>) => {
      setProgress((p) => ({ ...p, ...patch, captures: { ...p.captures, ...(patch.captures ?? {}) } }))
    },
    [],
  )
  const go = useCallback((screen: Screen) => update({ screen }), [update])

  const startOver = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop())
    streamRef.current = null
    try {
      localStorage.removeItem(KEY)
      sessionStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
    writeCookie(KEY, null)
    setThumbs({})
    setCameraStatus('idle')
    setProgress(EMPTY)
    merge({ restoredFrom: null, cameraStatus: 'idle' })
  }, [KEY, merge])
  useResetListener(config.ns, startOver)

  useEffect(() => () => streamRef.current?.getTracks().forEach((tr) => tr.stop()), [])

  // ---------- camera ----------
  const requestCamera = useCallback(async (): Promise<boolean> => {
    if (streamRef.current) return true
    setCameraStatus('requesting')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia not supported')
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false })
      streamRef.current = stream
      setCameraStatus('granted')
      setCameraError(null)
      merge({ cameraStatus: 'granted' })
      return true
    } catch (e) {
      setCameraStatus('denied')
      const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
      setCameraError(msg)
      merge({ cameraStatus: 'denied', cameraError: msg })
      return false
    }
  }, [merge])

  const sideOfScreen = (s: Screen): Side | null => (s === 'front' || s === 'frontPreview' ? 'front' : s === 'back' || s === 'backPreview' ? 'back' : null)

  const onUpload = async (file: File | undefined) => {
    if (!file) return
    const side: Side = !progress.captures.front ? 'front' : !progress.captures.back ? 'back' : (sideOfScreen(progress.screen) ?? 'back')
    try {
      const r = await detectFromBlob(file)
      const cap: Capture = { detected: r.detected, avg: r.avg, source: 'upload', fileName: file.name }
      if (file.size < 1_500_000) {
        const url = URL.createObjectURL(file)
        setThumbs((th) => ({ ...th, [side]: url }))
      }
      update({ captures: { [side]: cap }, screen: side === 'front' ? 'frontPreview' : 'backPreview' })
      merge({ lastUpload: { side, name: file.name, size: file.size, detected: r.detected } })
    } catch (e) {
      merge({ uploadError: e instanceof Error ? e.message : String(e) })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const onCapture = (side: Side, video: HTMLVideoElement | null) => {
    if (!video || !video.videoWidth) {
      merge({ captureError: 'video not ready' })
      return
    }
    const r = detectFromVideo(video)
    setThumbs((th) => ({ ...th, [side]: r.dataUrl }))
    update({ captures: { [side]: { detected: r.detected, avg: r.avg, source: 'camera' } }, screen: side === 'front' ? 'frontPreview' : 'backPreview' })
  }

  const next = t.v('Continue', 'Next')
  const s = progress.screen
  const uploadButton = (
    <button type="button" id={t.id(t.v('upload-instead', 'upload-alt'))} className={t.cls('idv-upload')} onClick={() => fileRef.current?.click()}>
      Upload instead
    </button>
  )

  return (
    <>
      <Card aria-label="Identity verification" data-testid="identity-flow" data-screen={s} style={{ maxWidth: 560 }}>
        <div data-ui="hint" data-testid="identity-step">
          Step {SCREENS.indexOf(s) + 1} of {SCREENS.length}
        </div>

        {s === 'intro' ? (
          <>
            <h2>Verify your identity</h2>
            <p>We need a photo of both sides of an identity document. It takes about two minutes.</p>
            <button data-variant="primary" id={t.id('start')} className={t.cls('idv-start')} onClick={() => go('doc')}>
              Start
            </button>
          </>
        ) : null}

        {s === 'doc' ? (
          <>
            <h2>Choose your document</h2>
            <div role="radiogroup" aria-label="Document type" style={{ display: 'grid', gap: 8 }}>
              {t.v(DOCS, [...DOCS].reverse()).map((d) => (
                <label
                  key={d}
                  data-ui="card"
                  style={{ display: 'flex', gap: 8, alignItems: 'center', margin: 0, padding: '0.6rem 0.8rem', cursor: 'pointer', borderColor: progress.docType === d ? 'var(--accent)' : undefined }}
                >
                  <input
                    type="radio"
                    name={t.v('docType', 'document_kind')}
                    value={d}
                    id={t.id(`doc-${d.replace(/\s+/g, '-').toLowerCase()}`)}
                    checked={progress.docType === d}
                    onChange={() => update({ docType: d })}
                  />
                  {d}
                </label>
              ))}
            </div>
            <label data-ui="inline" style={{ margin: '0.8rem 0' }}>
              <input type="checkbox" id={t.id('terms')} checked={progress.termsAccepted} onChange={(e) => update({ termsAccepted: e.target.checked })} />
              I agree to the Terms of Use and Privacy Policy
            </label>
            <div>
              <button data-variant="primary" id={t.id('doc-continue')} disabled={!progress.docType || !progress.termsAccepted} onClick={() => go('camera')}>
                {next}
              </button>
            </div>
          </>
        ) : null}

        {s === 'camera' ? (
          <>
            <h2>Enable camera access</h2>
            <p>We use your camera to photograph the document. Nothing is uploaded anywhere.</p>
            {cameraStatus === 'denied' ? (
              <div data-ui="card" role="alert" data-testid="camera-unavailable">
                <strong>Camera unavailable</strong>
                <div data-ui="hint">{cameraError}</div>
                <p>You can upload photos of your document instead.</p>
                {uploadButton}
              </div>
            ) : (
              <button
                data-variant="primary"
                id={t.id('enable-access')}
                disabled={cameraStatus === 'requesting'}
                onClick={async () => {
                  if (await requestCamera()) go('prepare')
                }}
              >
                Enable access
              </button>
            )}
          </>
        ) : null}

        {s === 'prepare' ? (
          <>
            <h2>Prepare your document</h2>
            <ul>
              <li>Place the {progress.docType ?? 'document'} on a dark, flat surface.</li>
              <li>Make sure all four corners are visible.</li>
              <li>Avoid glare and shadows.</li>
            </ul>
            <button data-variant="primary" id={t.id('prepare-continue')} onClick={() => go('take')}>
              {next}
            </button>
          </>
        ) : null}

        {s === 'take' ? (
          <>
            <h2>Take photo</h2>
            <p>First the front, then the back. Hold the document inside the frame.</p>
            <button data-variant="primary" id={t.id('take-photo')} onClick={() => go('front')}>
              Take photo
            </button>
          </>
        ) : null}

        {s === 'front' || s === 'back' ? (
          <CaptureScreen
            key={s}
            side={s}
            variantB={config.variant === 'b'}
            idFor={t.id}
            stream={streamRef}
            cameraStatus={cameraStatus}
            requestCamera={requestCamera}
            onCapture={onCapture}
            uploadButton={uploadButton}
          />
        ) : null}

        {s === 'frontPreview' || s === 'backPreview' ? (
          <PreviewScreen
            side={s === 'frontPreview' ? 'front' : 'back'}
            capture={progress.captures[s === 'frontPreview' ? 'front' : 'back']}
            thumb={thumbs[s === 'frontPreview' ? 'front' : 'back']}
            next={next}
            idFor={t.id}
            onRetake={() => go(s === 'frontPreview' ? 'front' : 'back')}
            onContinue={() => go(s === 'frontPreview' ? (progress.captures.back ? 'backPreview' : 'back') : 'review')}
          />
        ) : null}

        {s === 'review' ? (
          <>
            <h2>Review</h2>
            <p>Document: {progress.docType ?? '—'}</p>
            <ul data-testid="review-list">
              {(['front', 'back'] as Side[]).map((side) => (
                <li key={side}>
                  {side === 'front' ? 'Front' : 'Back'}: {progress.captures[side]?.detected ?? 'missing'} ({progress.captures[side]?.source ?? '—'})
                </li>
              ))}
            </ul>
            <button
              data-variant="primary"
              id={t.id('review-continue')}
              disabled={!progress.captures.front || !progress.captures.back}
              onClick={() => update({ screen: 'done', completed: true })}
            >
              {next}
            </button>
          </>
        ) : null}

        {s === 'done' ? (
          <>
            <h2>All set</h2>
            <p data-testid="identity-done">Your documents were submitted</p>
          </>
        ) : null}

        {UPLOAD_SCREENS.includes(s) ? (
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            data-testid="document-detector-capture-button"
            style={{ display: 'none' }}
            onChange={(e) => void onUpload(e.target.files?.[0])}
          />
        ) : null}
      </Card>
      <div data-ui="inline">
        <button data-variant="link" onClick={startOver} id={t.id('start-over')}>
          Reset progress
        </button>
        <span data-ui="hint">Progress is saved in localStorage, sessionStorage, a cookie and the backend (namespace {config.ns}).</span>
      </div>
    </>
  )
}

function CaptureScreen({
  side,
  variantB,
  idFor,
  stream,
  cameraStatus,
  requestCamera,
  onCapture,
  uploadButton,
}: {
  side: Side
  variantB: boolean
  idFor: (s: string) => string
  stream: React.MutableRefObject<MediaStream | null>
  cameraStatus: string
  requestCamera: () => Promise<boolean>
  onCapture: (side: Side, v: HTMLVideoElement | null) => void
  uploadButton: React.ReactNode
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    void (async () => {
      const ok = await requestCamera()
      if (!alive || !ok || !videoRef.current || !stream.current) return
      videoRef.current.srcObject = stream.current
      videoRef.current.play().catch(() => undefined)
    })()
    return () => {
      alive = false
    }
  }, [requestCamera, stream])

  const captureStyle: CSSProperties = variantB
    ? { position: 'absolute', top: 10, right: 10, width: 56, height: 56 }
    : { width: 68, height: 68, margin: '0.8rem auto 0', display: 'flex' }
  const captureBtn = (
    <button
      type="button"
      aria-label="Capture"
      title="Capture"
      data-testid="capture-button"
      id={idFor(variantB ? `shutter-${side}` : `capture-${side}`)}
      onClick={() => onCapture(side, videoRef.current)}
      disabled={cameraStatus !== 'granted'}
      style={{ ...captureStyle, borderRadius: '50%', border: '4px solid #fff', background: 'var(--accent)', boxShadow: '0 0 0 2px var(--accent)', justifyContent: 'center', padding: 0 }}
    />
  )
  return (
    <>
      <h2>{side === 'front' ? 'Front of document' : 'Back of document'}</h2>
      <p data-ui="hint">Hold the {side} of the document inside the frame and press the round button.</p>
      {cameraStatus === 'denied' ? (
        <div data-ui="card" role="alert">
          <strong>Camera unavailable</strong>
          <p>Upload a photo of the {side} instead.</p>
        </div>
      ) : (
        <div style={{ position: 'relative', background: '#000', borderRadius: 8, overflow: 'hidden', maxWidth: 480 }}>
          <video
            ref={videoRef}
            data-testid="camera-preview"
            muted
            playsInline
            autoPlay
            onLoadedData={() => setReady(true)}
            style={{ width: '100%', display: 'block', minHeight: 200 }}
          />
          <div aria-hidden="true" style={{ position: 'absolute', inset: '12% 10%', border: '2px dashed rgba(255,255,255,0.8)', borderRadius: 10, pointerEvents: 'none' }} />
          {variantB ? captureBtn : null}
        </div>
      )}
      {!variantB && cameraStatus !== 'denied' ? captureBtn : null}
      <div data-ui="inline" style={{ marginTop: 8 }}>
        <span data-ui="hint" data-testid="camera-ready">
          {cameraStatus === 'denied' ? 'No camera' : ready ? 'Camera ready' : 'Starting camera…'}
        </span>
        {uploadButton}
      </div>
    </>
  )
}

function PreviewScreen({
  side,
  capture,
  thumb,
  next,
  idFor,
  onRetake,
  onContinue,
}: {
  side: Side
  capture?: Capture
  thumb?: string
  next: string
  idFor: (s: string) => string
  onRetake: () => void
  onContinue: () => void
}) {
  const expected = side === 'front' ? 'FRONT' : 'BACK'
  return (
    <>
      <h2>{side === 'front' ? 'Check the front' : 'Check the back'}</h2>
      {thumb ? <img src={thumb} alt={`Captured ${side}`} style={{ maxWidth: 320, width: '100%', borderRadius: 8, display: 'block' }} /> : null}
      <p data-testid="detected-side">Detected: {capture?.detected ?? 'nothing'}</p>
      {capture && capture.detected !== expected ? (
        <p data-ui="error" data-testid="side-mismatch">
          This does not look like the {side} of the document.
        </p>
      ) : null}
      <div data-ui="inline">
        <button id={idFor(`retake-${side}`)} onClick={onRetake}>
          Retake
        </button>
        <button data-variant="primary" id={idFor(`preview-continue-${side}`)} onClick={onContinue}>
          {next}
        </button>
      </div>
    </>
  )
}

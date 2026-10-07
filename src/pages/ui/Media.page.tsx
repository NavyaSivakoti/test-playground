import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, publicUrl } from '../../components/ui'
import { usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/ui/media',
  title: 'Video, audio, images and PDF',
  group: 'General UI',
  summary:
    'A video player and an audio player with custom controls (media generated in the browser, no external files), 20 lazy-loaded images, a broken image, a gallery with a lightbox, zoom on hover and an embedded PDF.',
  covers: [26, 54, 115, 186, 23, 184],
  order: 17,
  samples: [
    {
      id: 'M1',
      title: 'Play, mute and pause the video',
      steps: ['Navigate to <base>/ui/media/', 'Click on "Play"', 'Wait for 2 seconds', 'Click on "Mute"', 'Click on "Pause"'],
      expected: 'state.video = {playing:false, muted:true, time ≥ 1}. The frame counter drawn on the video keeps moving only while playing.',
    },
    {
      id: 'M2',
      title: 'Seek the video',
      steps: ['Enter 20 in the "Video position" field'],
      expected: 'state.video.time = 20 and the frame shows "00:20".',
    },
    {
      id: 'M3',
      title: 'Audio tone',
      steps: ['Click on "Start tone"', 'Wait for 1 seconds', 'Click on "Silence tone"', 'Click on "Stop tone"'],
      expected: 'state.audio = {playing:false, muted:true, time ≥ 1, frequency:440}.',
    },
    {
      id: 'M4',
      title: 'Lazy images and the broken image',
      steps: ['Scroll to bottom', 'Wait until all images are loaded in the current page'],
      expected: 'state.lazyLoaded = 20 after scrolling (fewer before) and state.brokenImage = "error" (the image at fixtures/missing-photo.png 404s).',
    },
    {
      id: 'M5',
      title: 'Lightbox',
      steps: ['Click on "Open photo 3"', 'Click on "Next photo"', 'Press Esc Key'],
      expected: 'state.lightbox = null after Esc; state.lightboxHistory = [3, 4].',
    },
    {
      id: 'M6',
      title: 'PDF embed',
      steps: ['Scroll (up to/down to) the element "Invoice PDF" into view', 'Verify that the "Invoice PDF" is present (available/displayed/etc.)'],
      expected: 'state.pdfStatus = 200 (and state.pdfLoaded = true once the frame fires load); the iframe shows fixtures/invoice.pdf (INV-2026-0042).',
    },
  ],
}

const VIDEO_LEN = 30
const AUDIO_LEN = 20
const IMAGES = ['avatar.png', 'receipt.png', 'front.png', 'back.png']
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function useTicker(active: boolean, onTick: (dt: number) => void) {
  const cb = useRef(onTick)
  cb.current = onTick
  useEffect(() => {
    if (!active) return
    let last = performance.now()
    const id = setInterval(() => {
      const n = performance.now()
      cb.current((n - last) / 1000)
      last = n
    }, 100)
    return () => clearInterval(id)
  }, [active])
}

function VideoPlayer() {
  const t = useTraps('media-video')
  const { merge } = usePageState()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [time, setTime] = useState(0)
  const timeRef = useRef(0)
  const lastPublished = useRef(-1)

  const draw = useCallback(
    (sec: number) => {
      const c = canvasRef.current
      const ctx = c?.getContext('2d')
      if (!c || !ctx) return
      const hue = Math.floor(t.rand('hue') * 360)
      ctx.fillStyle = `hsl(${(hue + sec * 12) % 360} 55% 35%)`
      ctx.fillRect(0, 0, c.width, c.height)
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      const x = ((sec / VIDEO_LEN) * (c.width - 40)) | 0
      ctx.fillRect(20 + x - 10, c.height / 2 - 10, 20, 20)
      ctx.font = 'bold 28px system-ui, sans-serif'
      ctx.fillText(fmt(sec), 20, 44)
      ctx.font = '14px system-ui, sans-serif'
      ctx.fillText(`Generated frame ${Math.floor(sec * 10)}`, 20, c.height - 18)
    },
    [t],
  )

  useEffect(() => {
    draw(0)
    const c = canvasRef.current
    const v = videoRef.current
    if (c && v && 'captureStream' in c) {
      v.srcObject = (c as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream(15)
    }
    merge({ video: { playing: false, muted: false, time: 0, duration: VIDEO_LEN } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const publish = (patch: Partial<{ playing: boolean; muted: boolean; time: number }>) =>
    merge({ video: { playing, muted, time: Math.floor(timeRef.current), duration: VIDEO_LEN, ...patch } })

  useTicker(playing, (dt) => {
    let n = timeRef.current + dt
    if (n >= VIDEO_LEN) {
      n = VIDEO_LEN
      setPlaying(false)
      videoRef.current?.pause()
      merge({ video: { playing: false, muted, time: VIDEO_LEN, duration: VIDEO_LEN, ended: true } })
    }
    timeRef.current = n
    setTime(n)
    draw(n)
    if (Math.floor(n) !== lastPublished.current) {
      lastPublished.current = Math.floor(n)
      publish({ time: Math.floor(n) })
    }
  })

  const play = () => {
    if (timeRef.current >= VIDEO_LEN) timeRef.current = 0
    void videoRef.current?.play().catch(() => undefined)
    setPlaying(true)
    publish({ playing: true })
  }
  const pause = () => {
    videoRef.current?.pause()
    setPlaying(false)
    publish({ playing: false })
  }
  const seek = (v: number) => {
    const n = Math.max(0, Math.min(VIDEO_LEN, v))
    timeRef.current = n
    setTime(n)
    draw(n)
    publish({ time: Math.floor(n) })
  }

  const playBtn = (
    <button key="play" id={t.id('video-play')} className={t.cls('player__play')} disabled={playing} onClick={play}>
      {t.v('Play', 'Play video')}
    </button>
  )
  const pauseBtn = (
    <button key="pause" id={t.id('video-pause')} className={t.cls('player__pause')} disabled={!playing} onClick={pause}>
      Pause
    </button>
  )
  const muteBtn = (
    <button
      key="mute"
      id={t.id('video-mute')}
      className={t.cls('player__mute')}
      aria-pressed={muted}
      onClick={() => {
        const m = !muted
        setMuted(m)
        if (videoRef.current) videoRef.current.muted = m
        publish({ muted: m })
      }}
    >
      {muted ? 'Unmute' : 'Mute'}
    </button>
  )

  return (
    <section aria-label="Video player">
      <canvas ref={canvasRef} width={480} height={200} style={{ display: 'none' }} />
      <video ref={videoRef} data-testid="video" muted={muted} playsInline width={480} height={200} style={{ maxWidth: '100%', background: '#000', borderRadius: 8, display: 'block' }} />
      <div data-ui="inline" style={{ marginTop: 6 }}>
        {t.v([playBtn, pauseBtn, muteBtn], [muteBtn, playBtn, pauseBtn])}
        <label data-ui="inline" htmlFor={t.id('video-seek')}>
          Video position
          <input
            id={t.id('video-seek')}
            type="range"
            min={0}
            max={VIDEO_LEN}
            step={1}
            value={Math.floor(time)}
            onChange={(e) => seek(Number(e.target.value))}
          />
        </label>
        <span data-testid="video-time">
          {fmt(time)} / {fmt(VIDEO_LEN)}
        </span>
      </div>
    </section>
  )
}

function AudioPlayer() {
  const t = useTraps('media-audio')
  const { merge } = usePageState()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const ctxRef = useRef<{ ctx: AudioContext; osc: OscillatorNode; gain: GainNode } | null>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [time, setTime] = useState(0)
  const timeRef = useRef(0)
  const lastPublished = useRef(-1)
  const FREQ = 440

  useEffect(() => {
    merge({ audio: { playing: false, muted: false, time: 0, duration: AUDIO_LEN, frequency: FREQ } })
    return () => {
      void ctxRef.current?.ctx.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const publish = (patch: Partial<{ playing: boolean; muted: boolean; time: number }>) =>
    merge({ audio: { playing, muted, time: Math.floor(timeRef.current), duration: AUDIO_LEN, frequency: FREQ, ...patch } })

  const ensure = () => {
    if (ctxRef.current) return ctxRef.current
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AC()
    const osc = ctx.createOscillator()
    osc.frequency.value = FREQ
    const gain = ctx.createGain()
    gain.gain.value = 0.05
    const dest = ctx.createMediaStreamDestination()
    osc.connect(gain).connect(dest)
    osc.start()
    if (audioRef.current) audioRef.current.srcObject = dest.stream
    ctxRef.current = { ctx, osc, gain }
    return ctxRef.current
  }

  useTicker(playing, (dt) => {
    let n = timeRef.current + dt
    if (n >= AUDIO_LEN) {
      n = AUDIO_LEN
      stop()
    }
    timeRef.current = n
    setTime(n)
    if (Math.floor(n) !== lastPublished.current) {
      lastPublished.current = Math.floor(n)
      publish({ time: Math.floor(n) })
    }
  })

  const start = () => {
    const a = ensure()
    void a.ctx.resume()
    if (timeRef.current >= AUDIO_LEN) timeRef.current = 0
    void audioRef.current?.play().catch(() => undefined)
    setPlaying(true)
    publish({ playing: true })
  }
  const stop = () => {
    audioRef.current?.pause()
    void ctxRef.current?.ctx.suspend()
    setPlaying(false)
    publish({ playing: false })
  }

  return (
    <section aria-label="Audio player">
      <audio ref={audioRef} data-testid="audio" muted={muted} />
      <p data-ui="hint">A {FREQ} Hz tone generated with the Web Audio API.</p>
      <div data-ui="inline">
        <button id={t.id('audio-start')} className={t.cls('audio__start')} disabled={playing} onClick={start}>
          Start tone
        </button>
        <button id={t.id('audio-stop')} className={t.cls('audio__stop')} disabled={!playing} onClick={stop}>
          Stop tone
        </button>
        <button
          id={t.id('audio-mute')}
          className={t.cls('audio__mute')}
          aria-pressed={muted}
          onClick={() => {
            const m = !muted
            setMuted(m)
            if (audioRef.current) audioRef.current.muted = m
            if (ctxRef.current) ctxRef.current.gain.gain.value = m ? 0 : 0.05
            publish({ muted: m })
          }}
        >
          {muted ? 'Unsilence tone' : 'Silence tone'}
        </button>
        <label data-ui="inline" htmlFor={t.id('audio-seek')}>
          Audio position
          <input
            id={t.id('audio-seek')}
            type="range"
            min={0}
            max={AUDIO_LEN}
            value={Math.floor(time)}
            onChange={(e) => {
              timeRef.current = Number(e.target.value)
              setTime(timeRef.current)
              publish({ time: timeRef.current })
            }}
          />
        </label>
        <span data-testid="audio-time">
          {fmt(time)} / {fmt(AUDIO_LEN)}
        </span>
      </div>
    </section>
  )
}

export default function MediaPage() {
  const t = useTraps('media')
  const { merge } = usePageState()
  const loadedSet = useRef(new Set<number>())
  const [lightbox, setLightbox] = useState<number | null>(null)
  const history = useRef<number[]>([])
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null)

  const openLightbox = (n: number | null) => {
    setLightbox(n)
    if (n !== null) history.current = [...history.current, n]
    merge({ lightbox: n, lightboxHistory: history.current })
  }
  useEffect(() => {
    if (lightbox === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') openLightbox(null)
      if (e.key === 'ArrowRight') openLightbox((lightbox % 6) + 1)
      if (e.key === 'ArrowLeft') openLightbox(((lightbox + 4) % 6) + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox])

  // headless browsers may not fire load for a PDF iframe, so also record the fixture's HTTP status
  useEffect(() => {
    fetch(publicUrl('fixtures/invoice.pdf'), { method: 'HEAD' })
      .then((r) => merge({ pdfStatus: r.status, pdfType: r.headers.get('content-type') }))
      .catch(() => merge({ pdfStatus: 0 }))
  }, [merge])

  const gallery = Array.from({ length: 6 }, (_, i) => ({ n: i + 1, src: publicUrl(`fixtures/${IMAGES[i % IMAGES.length]}?photo=${i + 1}`) }))

  return (
    <>
      <div data-ui="row">
        <Card title="Video" style={{ flex: 1, minWidth: 300 }}>
          <VideoPlayer />
        </Card>
        <Card title="Audio" style={{ flex: 1, minWidth: 300 }}>
          <AudioPlayer />
        </Card>
      </div>

      <Card title="Gallery">
        <div data-ui="inline">
          {gallery.map((g) => (
            <button key={g.n} aria-label={`Open photo ${g.n}`} className={t.cls('gallery__thumb')} style={{ padding: 2 }} onClick={() => openLightbox(g.n)}>
              <img src={g.src} alt="" width={72} height={72} style={{ objectFit: 'cover', borderRadius: 6 }} />
            </button>
          ))}
        </div>
        {lightbox !== null ? (
          <>
            <div data-ui="backdrop" onClick={() => openLightbox(null)} />
            <div data-ui="modal" role="dialog" aria-modal="true" aria-label="Photo viewer" data-testid="lightbox" style={{ width: 'min(560px, calc(100vw - 32px))' }}>
              <img src={gallery[lightbox - 1].src} alt={`Photo ${lightbox}`} style={{ width: '100%', maxHeight: 360, objectFit: 'contain' }} />
              <p data-testid="lightbox-caption">Photo {lightbox} of 6</p>
              <div data-ui="inline">
                <button onClick={() => openLightbox(((lightbox + 4) % 6) + 1)}>{t.v('Previous photo', '‹ Back')}</button>
                <button onClick={() => openLightbox((lightbox % 6) + 1)}>{t.v('Next photo', 'Forward ›')}</button>
                <button onClick={() => openLightbox(null)} aria-label="Close photo viewer">
                  Close
                </button>
              </div>
            </div>
          </>
        ) : null}
      </Card>

      <Card title="Zoom on hover">
        <div
          data-testid="zoom-box"
          aria-label="Zoomable receipt"
          role="img"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            const z = { x: Math.round(((e.clientX - r.left) / r.width) * 100), y: Math.round(((e.clientY - r.top) / r.height) * 100) }
            if (!zoom) merge({ zoomed: true })
            setZoom(z)
          }}
          onMouseLeave={() => {
            setZoom(null)
            merge({ zoomed: false })
          }}
          style={{ width: 260, height: 180, overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 8, cursor: 'zoom-in' }}
        >
          <img
            src={publicUrl('fixtures/receipt.png?zoom=1')}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: zoom ? 'scale(2.5)' : 'none', transformOrigin: zoom ? `${zoom.x}% ${zoom.y}%` : 'center' }}
          />
        </div>
      </Card>

      <Card title="Broken image">
        <img
          src={publicUrl('fixtures/missing-photo.png')}
          alt="Missing photo"
          data-testid="broken-image"
          width={120}
          height={80}
          onError={() => merge({ brokenImage: 'error' })}
          onLoad={() => merge({ brokenImage: 'loaded' })}
        />
      </Card>

      <Card title="Embedded PDF">
        <iframe
          title="Invoice PDF"
          src={publicUrl('fixtures/invoice.pdf')}
          data-testid="pdf-frame"
          style={{ width: '100%', height: 420, border: '1px solid var(--border)', borderRadius: 8 }}
          onLoad={() => merge({ pdfLoaded: true })}
        />
        <p>
          <a href={publicUrl('fixtures/invoice.pdf')} target="_blank" rel="noreferrer">
            Open invoice in a new tab
          </a>
        </p>
      </Card>

      <Card title="Lazy-loaded images">
        <p data-ui="hint">20 images with loading="lazy"; they load as you scroll down.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          {Array.from({ length: 20 }, (_, i) => (
            <figure key={i} style={{ margin: 0, minHeight: 600 }}>
              <img
                loading="lazy"
                src={publicUrl(`fixtures/${IMAGES[i % IMAGES.length]}?lazy=${i + 1}`)}
                alt={`Lazy image ${i + 1}`}
                width={140}
                height={140}
                data-testid={`lazy-${i + 1}`}
                style={{ objectFit: 'cover', borderRadius: 6 }}
                onLoad={() => {
                  loadedSet.current.add(i + 1)
                  merge({ lazyLoaded: loadedSet.current.size })
                }}
              />
              <figcaption data-ui="hint">Image {i + 1}</figcaption>
            </figure>
          ))}
        </div>
      </Card>
    </>
  )
}

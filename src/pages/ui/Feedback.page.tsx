import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Badge, Card, Modal } from '../../components/ui'
import { nowMs, useConfig, useDelayed, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { useSyncedState } from './part2State'

export const meta: PageMeta = {
  path: '/ui/feedback',
  title: 'Feedback and status',
  group: 'General UI',
  summary:
    'Toasts of every severity, a progress bar, skeleton loaders, a notification badge, dismissible banners, inline form states and a session-timeout dialog with a live countdown.',
  order: 10,
  samples: [
    {
      id: 'F1',
      title: 'Success toast appears and auto-dismisses',
      steps: [
        'Navigate to <base>/ui/feedback/',
        'Click on "Show success toast"',
        'Verify that the current page displays text "Saved successfully"',
        'Wait until the text "Saved successfully" is not present on the current page',
      ],
      expected: 'state.toasts.lastShown = {tone:"success", text:"Saved successfully", autoDismiss:true}; the toast is gone after 3 s (or ?toastMs=).',
    },
    {
      id: 'F2',
      title: 'Persistent error toast must be dismissed manually',
      steps: ['Click on "Auto-dismiss toasts"', 'Click on "Show error toast"', 'Click on "Dismiss error toast"'],
      expected: 'state.toasts.dismissed = 1 and state.toasts.visible = 0.',
    },
    {
      id: 'F3',
      title: 'Upload progress reaches 100%',
      steps: ['Click on "Start upload"', 'Wait until the text "Upload complete" is present on the current page'],
      expected: 'state.upload = {progress:100, status:"done"} about 5 s after the click.',
    },
    {
      id: 'F4',
      title: 'Mark all notifications read',
      steps: ['Verify that the current page displays text "Notifications 3"', 'Click on "Mark all read"', 'Verify that the current page displays text "Notifications 0"'],
      expected: 'state.unread = 0 and state.markedAllRead = true.',
    },
    {
      id: 'F5',
      title: 'Session expiry dialog',
      steps: ['Click on "Simulate session timeout"', 'Verify that the current page displays text "Session about to expire"', 'Click on "Stay signed in"'],
      expected: 'state.session.status = "extended" and state.session.secondsLeftAtAction is between 1 and 30.',
    },
    {
      id: 'F6',
      title: 'Wrong toast wording (bug)',
      query: 'bugs=toastText',
      steps: ['Click on "Show success toast"', 'Verify that the current page displays text "Saved successfully"'],
      expected: 'Fails: the toast says "Saved succesfully"; state.toasts.lastShown.text shows the typo.',
    },
  ],
}

type Tone = 'success' | 'info' | 'warning' | 'danger'
interface ToastItem {
  id: number
  tone: Tone
  text: string
  autoDismiss: boolean
  ms: number
}

const TONES: { tone: Tone; name: string }[] = [
  { tone: 'success', name: 'success' },
  { tone: 'info', name: 'info' },
  { tone: 'warning', name: 'warning' },
  { tone: 'danger', name: 'error' },
]

const BANNERS = [
  { key: 'maintenance', tone: 'info' as const, text: 'Scheduled maintenance on Saturday from 01:00 to 02:00 UTC.' },
  { key: 'trial', tone: 'warning' as const, text: 'Your trial ends in 5 days.' },
  { key: 'billing', tone: 'danger' as const, text: 'Your last payment failed. Update your billing details.' },
]

const SESSION_SECONDS = 30

export default function FeedbackPage() {
  const t = useTraps('feedback')
  const config = useConfig()
  const { state, merge } = usePageState()
  const [params] = useSearchParams()
  const defaultMs = Number(params.get('toastMs')) > 0 ? Number(params.get('toastMs')) : 3000

  // ---------- toasts ----------
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [autoDismiss, setAutoDismiss] = useState(true)
  const [duration, setDuration] = useState(defaultMs)
  const nextId = useRef(1)
  const shownCount = useRef(0)
  const dismissedCount = useRef(0)
  const textFor = (tone: Tone) => {
    if (tone === 'success') return config.bugs.includes('toastText') ? 'Saved succesfully' : 'Saved successfully'
    if (tone === 'info') return 'A new version is available'
    if (tone === 'warning') return 'Storage is almost full'
    return 'Could not save your changes'
  }
  const listRef = useRef<ToastItem[]>([])
  const lastShown = useRef<Record<string, unknown> | null>(null)
  const publish = useCallback(
    (list: ToastItem[], lastRemoved?: 'auto' | 'manual') => {
      listRef.current = list
      setToasts(list)
      merge({
        toasts: {
          shown: shownCount.current,
          dismissed: dismissedCount.current,
          visible: list.length,
          lastShown: lastShown.current,
          ...(lastRemoved ? { lastRemoved } : {}),
        },
      })
    },
    [merge],
  )
  const removeToast = useCallback(
    (id: number, how: 'auto' | 'manual') => {
      if (!listRef.current.some((x) => x.id === id)) return
      if (how === 'manual') dismissedCount.current += 1
      publish(
        listRef.current.filter((x) => x.id !== id),
        how,
      )
    },
    [publish],
  )
  const showToast = (tone: Tone) => {
    const item: ToastItem = { id: nextId.current++, tone, text: textFor(tone), autoDismiss, ms: duration }
    shownCount.current += 1
    lastShown.current = { tone: tone === 'danger' ? 'error' : tone, text: item.text, autoDismiss: item.autoDismiss, ms: item.autoDismiss ? item.ms : null }
    publish([...listRef.current, item])
    if (item.autoDismiss) setTimeout(() => removeToast(item.id, 'auto'), item.ms)
  }

  // ---------- upload progress ----------
  const [progress, setProgress] = useState<number | null>(null)
  const uploadTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const startUpload = () => {
    if (uploadTimer.current) clearInterval(uploadTimer.current)
    const started = performance.now()
    setProgress(0)
    merge({ upload: { progress: 0, status: 'uploading' } })
    uploadTimer.current = setInterval(() => {
      const p = Math.min(100, Math.round(((performance.now() - started) / 5000) * 100))
      setProgress(p)
      if (p >= 100) {
        if (uploadTimer.current) clearInterval(uploadTimer.current)
        uploadTimer.current = null
        merge({ upload: { progress: 100, status: 'done' } })
      } else if (p % 20 < 5) merge({ upload: { progress: p, status: 'uploading' } })
    }, 250)
  }
  useEffect(() => () => {
    if (uploadTimer.current) clearInterval(uploadTimer.current)
  }, [])

  // ---------- skeleton ----------
  const skeletonMs = config.renderDelay > 0 ? config.renderDelay : 1500
  const loaded = useDelayed(skeletonMs)
  useSyncedState({ skeleton: { status: loaded ? 'loaded' : 'loading', afterMs: skeletonMs } })

  // ---------- badge ----------
  const unread = (state.unread as number | undefined) ?? 3

  // ---------- banners ----------
  const dismissedBanners = (state.bannersDismissed as string[] | undefined) ?? []

  // ---------- inline form ----------
  const [email, setEmail] = useState('')
  const sub = state.subscribe as { status: 'success' | 'error'; email: string; message: string } | undefined

  // ---------- session dialog ----------
  const [sessionStart, setSessionStart] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(SESSION_SECONDS)
  useEffect(() => {
    if (sessionStart === null) return
    const tick = () => {
      const left = Math.max(0, SESSION_SECONDS - Math.floor((nowMs(config) - sessionStart) / 1000))
      setSecondsLeft(left)
      if (left === 0) {
        setSessionStart(null)
        merge({ session: { status: 'expired', secondsLeftAtAction: 0 } })
      }
    }
    tick()
    const h = setInterval(tick, 250)
    return () => clearInterval(h)
  }, [sessionStart, config, merge])
  const endSession = (status: 'extended' | 'signed-out') => {
    merge({ session: { status, secondsLeftAtAction: secondsLeft } })
    setSessionStart(null)
  }

  const toastButtons = t.v(TONES, [...TONES].reverse())

  return (
    <>
      <Card title="Toasts">
        <p data-ui="hint">Every severity, with or without auto-dismiss. The default duration comes from ?toastMs= (now {defaultMs} ms).</p>
        <div data-ui="inline">
          <label>
            <input
              type="checkbox"
              id={t.id('auto-dismiss')}
              checked={autoDismiss}
              onChange={(e) => {
                setAutoDismiss(e.target.checked)
                merge({ autoDismiss: e.target.checked })
              }}
            />{' '}
            Auto-dismiss toasts
          </label>
          <label data-ui="field" style={{ maxWidth: 180 }}>
            <span>Duration (ms)</span>
            <input
              type="number"
              min={500}
              step={500}
              id={t.id('toast-duration')}
              value={duration}
              onChange={(e) => {
                const ms = Math.max(500, Number(e.target.value) || 500)
                setDuration(ms)
                merge({ toastDuration: ms })
              }}
            />
          </label>
        </div>
        <div data-ui="inline" style={{ marginTop: 8 }}>
          {toastButtons.map(({ tone, name }) => (
            <button
              key={tone}
              id={t.id(t.v(`toast-${name}`, `show-${name}-toast`))}
              className={t.cls(`btn btn--toast-${name}`)}
              data-testid={`toast-${name}-btn`}
              data-variant={tone === 'danger' ? 'danger' : undefined}
              onClick={() => showToast(tone)}
            >
              Show {name} toast
            </button>
          ))}
          {t.dup ? (
            <button className={t.cls('btn btn--decoy')} style={{ opacity: 0.6 }} onClick={() => merge({ decoy: 'Show success toast' })}>
              Show success toast
            </button>
          ) : null}
        </div>
        <div data-ui="toast-stack" aria-live="polite" data-testid="feedback-toasts" style={{ bottom: 80 }}>
          {toasts.map((x) => (
            <div key={x.id} data-ui="toast" data-tone={x.tone} role={x.tone === 'danger' ? 'alert' : 'status'} data-testid={`feedback-toast-${x.tone === 'danger' ? 'error' : x.tone}`}>
              <span>{x.text}</span>
              {!x.autoDismiss ? (
                <button
                  data-variant="ghost"
                  aria-label={`Dismiss ${x.tone === 'danger' ? 'error' : x.tone} toast`}
                  style={{ marginLeft: 8 }}
                  onClick={() => removeToast(x.id, 'manual')}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Progress">
        <button id={t.id('start-upload')} className={t.cls('btn btn--upload')} data-testid="start-upload" onClick={startUpload} disabled={progress !== null && progress < 100}>
          {t.v('Start upload', 'Begin upload')}
        </button>
        <div style={{ marginTop: 8, maxWidth: 420 }}>
          <div
            role="progressbar"
            aria-label="Upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress ?? 0}
            data-testid="upload-progress"
            style={{ height: 14, background: 'rgba(127,127,127,.2)', borderRadius: 7, overflow: 'hidden' }}
          >
            <div style={{ width: `${progress ?? 0}%`, height: '100%', background: '#2e7d32', transition: 'width .2s' }} />
          </div>
          <div data-testid="upload-status">{progress === null ? 'Not started' : progress >= 100 ? 'Upload complete' : `Uploading… ${progress}%`}</div>
        </div>
      </Card>

      <Card title="Skeleton loader">
        <p data-ui="hint">Content arrives after {skeletonMs} ms (renderDelay, default 1500).</p>
        {loaded ? (
          <div data-testid="skeleton-content" id={t.id('profile-summary')}>
            <strong>Grace Hopper</strong>
            <div>Rear admiral · Compiler pioneer</div>
            <div>Joined 1944</div>
          </div>
        ) : (
          <div aria-busy="true" aria-label="Loading profile" data-testid="skeleton">
            {[70, 50, 40].map((w) => (
              <div key={w} style={{ height: 12, width: `${w}%`, margin: '6px 0', background: 'rgba(127,127,127,.25)', borderRadius: 4 }} />
            ))}
          </div>
        )}
      </Card>

      <Card title="Notification badge">
        <div data-ui="inline">
          <button id={t.id('notifications')} className={t.cls('btn btn--notifications')} data-testid="notifications-btn" onClick={() => merge({ notificationsOpened: ((state.notificationsOpened as number) ?? 0) + 1 })}>
            Notifications <Badge tone={unread ? 'danger' : undefined} data-testid="unread-count">{unread}</Badge>
          </button>
          <button
            id={t.id(t.v('mark-all-read', 'mark-read-all'))}
            className={t.cls('btn btn--mark-read')}
            onClick={() => merge({ unread: 0, markedAllRead: true })}
            disabled={unread === 0}
          >
            {t.v('Mark all read', 'Mark all as read')}
          </button>
          <button id={t.id('add-notification')} className={t.cls('btn')} data-variant="ghost" onClick={() => merge({ unread: unread + 1 })}>
            Add notification
          </button>
        </div>
      </Card>

      <Card title="Banner alerts">
        {BANNERS.filter((b) => !dismissedBanners.includes(b.key)).map((b) => (
          <div key={b.key} data-ui="card" data-tone={b.tone} role="alert" data-testid={`banner-${b.key}`} style={{ padding: '8px 12px' }}>
            <div data-ui="inline" style={{ justifyContent: 'space-between' }}>
              <span>{b.text}</span>
              <button
                id={t.id(`dismiss-${b.key}`)}
                className={t.cls('btn btn--dismiss')}
                data-variant="ghost"
                aria-label={`Dismiss ${b.key} banner`}
                onClick={() => merge({ bannersDismissed: [...dismissedBanners, b.key] })}
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
        {dismissedBanners.length === BANNERS.length ? <p data-ui="hint">All banners dismissed.</p> : null}
      </Card>

      <Card title="Inline form states">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
            merge({
              subscribe: ok
                ? { status: 'success', email: email.trim(), message: `Subscribed ${email.trim()}` }
                : { status: 'error', email: email.trim(), message: 'Enter a valid email address' },
            })
          }}
        >
          <div data-ui="inline" style={{ alignItems: 'flex-end' }}>
            <label data-ui="field">
              <span>Newsletter email</span>
              <input
                id={t.id('newsletter-email')}
                type="email"
                value={email}
                aria-invalid={sub?.status === 'error'}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button type="submit" id={t.id('subscribe')} className={t.cls('btn btn--subscribe')} data-variant="primary">
              Subscribe
            </button>
          </div>
          {sub ? (
            <div data-ui={sub.status === 'error' ? 'error' : 'hint'} data-tone={sub.status === 'success' ? 'success' : 'danger'} role={sub.status === 'error' ? 'alert' : 'status'} data-testid="subscribe-result">
              {sub.message}
            </div>
          ) : null}
        </form>
      </Card>

      <Card title="Session timeout">
        <button
          id={t.id('simulate-timeout')}
          className={t.cls('btn btn--session')}
          onClick={() => {
            setSecondsLeft(SESSION_SECONDS)
            setSessionStart(nowMs(config))
            merge({ session: { status: 'warning', secondsLeftAtAction: null } })
          }}
        >
          Simulate session timeout
        </button>
        {state.session ? (
          <p data-testid="session-status">Session: {(state.session as { status: string }).status}</p>
        ) : null}
      </Card>

      <Modal open={sessionStart !== null} title="Session about to expire" labelledBy="session-dialog-title" data-testid="session-dialog">
        <p>
          You will be signed out in <strong data-testid="session-countdown">{secondsLeft}</strong> seconds.
        </p>
        <div data-ui="inline">
          {t.v(
            <>
              <button data-variant="primary" id={t.id('stay-signed-in')} onClick={() => endSession('extended')}>Stay signed in</button>
              <button id={t.id('sign-out')} onClick={() => endSession('signed-out')}>Sign out</button>
            </>,
            <>
              <button id={t.id('sign-out-now')} onClick={() => endSession('signed-out')}>Sign out</button>
              <button data-variant="primary" id={t.id('keep-session')} onClick={() => endSession('extended')}>Stay signed in</button>
            </>,
          )}
        </div>
      </Modal>
    </>
  )
}

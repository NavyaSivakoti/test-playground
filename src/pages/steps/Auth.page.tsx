import { useCallback, useEffect, useState } from 'react'
import { Badge, Card, useToast } from '../../components/ui'
import { API_BASE, backend } from '../../core/backend'
import { useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { verifyTotp } from './totp'

export const meta: PageMeta = {
  path: '/steps/auth',
  title: 'Authentication helpers',
  group: 'Step baselines',
  summary: 'Simulated authentication flows: HTTP Basic, an emailed one-time code with a mock inbox, an SMS code on a mock phone, a real RFC 6238 authenticator code from a published secret, and mock captchas.',
  covers: [532, 539, 543, 546, 550, 551, 598, 634, 648, 671],
  mock: true,
  order: 30,
  samples: [
    {
      id: 'AU1',
      title: 'HTTP Basic authentication',
      steps: ['Authentication with: tester and playground', 'Navigate to {api}/basic', 'Verify that the current page displays text "Authenticated as tester"'],
      expected: 'Passes against the server; needs the backend.',
    },
    {
      id: 'AU2',
      title: 'Email one-time code',
      steps: [
        'Navigate to <base>/steps/auth/',
        'Create email and store into the otpEmail variable name',
        'Enter ${otpEmail} in the "Email address" field',
        'Click on "Send code"',
        'Extract the value from the ${otpEmail} email using the regular expression \\d{6}',
        'Enter the extracted code in the "Verification code" field',
        'Click on "Verify email code"',
      ],
      expected: 'state.emailOtpOk = true. Real delivery only when the server has an email key; otherwise the code is in the mock inbox on this page.',
    },
    {
      id: 'AU3',
      title: 'SMS code (mock)',
      steps: ['Click on "Send SMS code"', 'Get OTP from the phone number', 'Enter the code in the "SMS code" field', 'Click on "Verify SMS code"'],
      expected: 'The mock phone shows the code; state.smsOk = true.',
    },
    {
      id: 'AU4',
      title: 'Authenticator code',
      steps: ['Get TOTP from "Test Playground"', 'Enter ${totp} in the "Authenticator code" field', 'Click on "Verify authenticator code"'],
      expected: 'state.totpOk = true (secret JBSWY3DPEHPK3PXP configured in the platform).',
    },
    {
      id: 'AU5',
      title: 'Checkbox captcha',
      steps: ['Solve the checkbox captcha on the page'],
      expected: 'state.captcha = true.',
    },
  ],
}

const SECRET = 'JBSWY3DPEHPK3PXP'
const ISSUER = 'Test Playground'
const ACCOUNT = 'tester@example.com'
const OTPAUTH = `otpauth://totp/${encodeURIComponent(ISSUER)}:${encodeURIComponent(ACCOUNT)}?secret=${SECRET}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=6&period=30`
const PHONE = '+1 202 555 0100'

type Mail = { to: string; subject: string; body: string; at: string }

export default function AuthPage() {
  const t = useTraps('auth')
  const config = useConfig()
  const toast = useToast()
  const { state, merge } = usePageState()
  const emailCode = config.seed === 1 ? '482913' : String(100000 + Math.floor(t.rand('email-otp') * 900000))
  const smsCode = String(100000 + Math.floor(t.rand('sms-otp') * 900000))
  const tiles = Array.from({ length: 9 }, (_, i) => t.rand(`tile-${i}`) < 0.4 || i === 4)

  const [email, setEmail] = useState('')
  const [emailEntered, setEmailEntered] = useState('')
  const [inbox, setInbox] = useState<Mail[]>([])
  const [inboxOpen, setInboxOpen] = useState(false)
  const [smsSent, setSmsSent] = useState(false)
  const [smsEntered, setSmsEntered] = useState('')
  const [totpEntered, setTotpEntered] = useState('')
  const [picked, setPicked] = useState<boolean[]>(Array(9).fill(false))

  const loadInbox = useCallback(async () => setInbox(await backend.inbox(config.ns).catch(() => [])), [config.ns])
  useEffect(() => {
    void loadInbox()
  }, [loadInbox])

  const sendCode = (
    <button
      id={t.id(t.v('send-code', 'email-send-code'))}
      className={t.cls('btn btn--send-code')}
      disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)}
      onClick={async () => {
        const r = await backend.sendEmail(config.ns, email, 'Your verification code', `Your code is ${emailCode}`)
        merge({ emailSentTo: email, emailDelivery: r.delivered })
        toast(`Code sent to ${email}`)
        await loadInbox()
      }}
    >
      Send code
    </button>
  )

  return (
    <>
      <Card title="HTTP Basic authentication">
        <p>
          Credentials: user <code>tester</code>, password <code>playground</code> (public test values).
        </p>
        {API_BASE ? (
          <p>
            <a id={t.id('basic-link')} className={t.cls('link link--basic')} href={`${API_BASE}/basic`} target="_blank" rel="noopener">
              Open the Basic-auth endpoint
            </a>{' '}
            <span data-ui="hint">Shows “Authenticated as tester” after signing in.</span>
          </p>
        ) : (
          <p data-ui="hint" data-testid="basic-local">
            Backend not configured – the Basic-auth endpoint needs the server. In local mode there is nothing to authenticate against.
          </p>
        )}
      </Card>

      <Card title="Email one-time code">
        <div data-ui="inline" data-wrapper={t.v(undefined, 'auth-email-v2')}>
          <label data-ui="field">
            <span>Email address</span>
            <input type="email" id={t.id('otp-email')} className={t.cls('input input--email')} value={email} onChange={(e) => setEmail(e.target.value.trim())} placeholder="name@example.com" />
          </label>
          {sendCode}
        </div>
        {state.emailSentTo ? <p data-testid="email-sent">Code sent to {String(state.emailSentTo)} ({String(state.emailDelivery)} delivery)</p> : null}
        <label data-ui="field">
          <span>Verification code</span>
          <input id={t.id('email-code')} className={t.cls('input input--code')} inputMode="numeric" value={emailEntered} onChange={(e) => setEmailEntered(e.target.value)} />
        </label>
        <button
          id={t.id('verify-email')}
          className={t.cls('btn btn--verify-email')}
          onClick={() => {
            const ok = !!state.emailSentTo && emailEntered.trim() === emailCode
            merge({ emailOtpOk: ok })
          }}
        >
          Verify email code
        </button>
        {state.emailOtpOk !== undefined ? (
          <p data-testid="email-result">{state.emailOtpOk ? <Badge tone="success">Email verified</Badge> : <Badge tone="danger">Wrong or expired code</Badge>}</p>
        ) : null}
        <details open={inboxOpen} onToggle={(e) => setInboxOpen((e.target as HTMLDetailsElement).open)} data-testid="mock-inbox">
          <summary>View mock inbox ({inbox.length})</summary>
          <button onClick={() => void loadInbox()}>Refresh inbox</button>
          <ul>
            {inbox.map((m, i) => (
              <li key={i}>
                <strong>{m.subject}</strong> to {m.to}: {m.body}
              </li>
            ))}
          </ul>
        </details>
      </Card>

      <Card title="SMS one-time code (mock)">
        <p>
          Phone number: <code>{PHONE}</code>
        </p>
        <button
          id={t.id('send-sms')}
          className={t.cls('btn btn--send-sms')}
          onClick={() => {
            setSmsSent(true)
            merge({ smsSentTo: PHONE })
          }}
        >
          Send SMS code
        </button>
        {smsSent ? <p data-testid="sms-sent">Code sent to {PHONE}</p> : null}
        <div
          aria-label="Mock phone"
          data-testid="mock-phone"
          style={{ width: 200, minHeight: 120, border: '3px solid var(--border)', borderRadius: 18, padding: '0.6rem', margin: '0.5rem 0' }}
        >
          <div data-ui="hint">Messages</div>
          {smsSent ? <div data-testid="sms-message">Test Playground: your code is {smsCode}</div> : <div data-ui="hint">No messages</div>}
        </div>
        <label data-ui="field">
          <span>SMS code</span>
          <input id={t.id('sms-code')} inputMode="numeric" value={smsEntered} onChange={(e) => setSmsEntered(e.target.value)} />
        </label>
        <button id={t.id('verify-sms')} className={t.cls('btn btn--verify-sms')} onClick={() => merge({ smsOk: smsSent && smsEntered.trim() === smsCode })}>
          Verify SMS code
        </button>
        {state.smsOk !== undefined ? <p data-testid="sms-result">{state.smsOk ? 'SMS code accepted' : 'SMS code rejected'}</p> : null}
      </Card>

      <Card title="Authenticator app (TOTP)">
        <dl>
          <dt>Issuer</dt>
          <dd>{ISSUER}</dd>
          <dt>Account</dt>
          <dd>{ACCOUNT}</dd>
          <dt>Secret (base32, public test value)</dt>
          <dd>
            <code data-testid="totp-secret">{SECRET}</code>
          </dd>
          <dt>otpauth URI</dt>
          <dd>
            <code data-testid="otpauth-uri" style={{ wordBreak: 'break-all' }}>
              {OTPAUTH}
            </code>
          </dd>
        </dl>
        <p data-ui="hint">RFC 6238: HMAC-SHA1, 30-second steps, 6 digits. Codes from the current step or one step either side are accepted.</p>
        <label data-ui="field">
          <span>Authenticator code</span>
          <input id={t.id('totp-code')} className={t.cls('input input--totp')} inputMode="numeric" value={totpEntered} onChange={(e) => setTotpEntered(e.target.value)} />
        </label>
        <button
          id={t.id(t.v('verify-totp', 'totp-verify'))}
          className={t.cls('btn btn--verify-totp')}
          onClick={async () => merge({ totpOk: await verifyTotp(SECRET, totpEntered, Date.now()) })}
        >
          Verify authenticator code
        </button>
        {state.totpOk !== undefined ? <p data-testid="totp-result">{state.totpOk ? 'Authenticator code accepted' : 'Authenticator code rejected'}</p> : null}
      </Card>

      <Card title={t.v('Captcha (mock)', 'Are you human? (mock captcha)')}>
        <label data-ui="inline" style={{ border: '1px solid var(--border)', padding: '0.8rem', borderRadius: 6, width: 'fit-content' }}>
          <input type="checkbox" id={t.id('captcha')} checked={!!state.captcha} onChange={(e) => merge({ captcha: e.target.checked })} />
          I'm not a robot
        </label>
        <p style={{ marginBottom: '0.3rem' }}>Select all squares with a mug:</p>
        <div role="group" aria-label="Image captcha" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 56px)', gap: 4 }}>
          {tiles.map((mug, i) => (
            <button
              key={i}
              aria-label={`Tile ${i + 1}`}
              aria-pressed={picked[i]}
              data-mug={mug ? 'true' : 'false'}
              onClick={() => setPicked((p) => p.map((v, j) => (j === i ? !v : v)))}
              style={{ width: 56, height: 56, padding: 0, fontSize: 24, outline: picked[i] ? '3px solid var(--accent)' : undefined }}
            >
              {mug ? '☕' : '🌲'}
            </button>
          ))}
        </div>
        <button
          id={t.id('verify-images')}
          className={t.cls('btn btn--verify-images')}
          style={{ marginTop: '0.5rem' }}
          onClick={() => merge({ imageCaptcha: tiles.every((m, i) => m === picked[i]) })}
        >
          Verify images
        </button>
        {state.imageCaptcha !== undefined ? <p data-testid="image-captcha-result">{state.imageCaptcha ? 'Images verified' : 'Wrong selection'}</p> : null}
      </Card>

      <Card title="Social and Enterprise sign-in">
        <p>
          Signing in with a Social or Enterprise account (with or without an authenticator app) needs a real account and is <strong>not provided by the playground</strong>.
          These steps are listed as unsupported in the coverage table.
        </p>
      </Card>
    </>
  )
}

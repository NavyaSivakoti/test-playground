import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Badge, Card, Field, useToast } from '../../components/ui'
import { backend } from '../../core/backend'
import { nsKey, useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { useResetListener } from '../../core/reset'
import { TEST_PASSWORD, USERS, type Role } from '../../core/users'
import { routeUrl, useAfterMount } from './business/util'

export const meta: PageMeta = {
  path: '/auth',
  title: 'Sign in and roles',
  group: 'Scenarios',
  summary:
    'A mock sign-in flow with seeded accounts, remember-me cookie, an admin verification code delivered to a mock inbox, mock single sign-on in a popup, forgotten-password email, forced session expiry and a role-based menu.',
  mock: true,
  covers: [70, 26, 30, 138, 467, 550, 544, 34, 12, 145, 67, 68, 588],
  order: 10,
  samples: [
    {
      id: 'A1',
      title: 'Viewer signs in and sees only reports',
      steps: [
        'Navigate to <base>/auth/',
        'Enter viewer@example.com in the "Email" field',
        'Enter Playground!1 in the "Password" field',
        'Click on "Sign in"',
        'Verify that the current page displays text "Signed in as Alan Viewer"',
        'Verify that the current page does not displays text "Billing"',
      ],
      expected: 'state.user = "viewer@example.com", state.role = "viewer", state.menu = ["Reports"].',
    },
    {
      id: 'A2',
      title: 'Wrong password',
      steps: ['Enter approver@example.com in the "Email" field', 'Enter wrong-password in the "Password" field', 'Click on "Sign in"', 'Verify that the current page displays text "Invalid email or password"'],
      expected: 'state.loginError = "Invalid email or password"; state.user stays null.',
    },
    {
      id: 'A3',
      title: 'Admin with a verification code from the inbox',
      steps: [
        'Enter admin@example.com in the "Email" field',
        'Enter Playground!1 in the "Password" field',
        'Click on "Sign in"',
        'Wait until the text "Enter the code we sent" is present on the current page',
        'Store the text of "Latest email" in a variable name mailBody',
        'Extract the value from the ${mailBody} email using the regular expression \\d{6}',
        'Enter ${code} in the "Verification code" field',
        'Click on "Verify"',
      ],
      expected: 'state.mfaPassed = true, state.role = "admin", state.menu = ["Users","Billing","Settings"].',
    },
    {
      id: 'A4',
      title: 'Single sign-on popup',
      steps: [
        'Click on "Continue with SSO" and switch to the new window',
        'Switch to the window titled "Single sign-on"',
        'Click on "Approve"',
        'Switch to the window titled "Sign in and roles | Test Playground"',
        'Verify that the current page displays text "Signed in as Grace Approver"',
      ],
      expected: 'state.ssoUsed = true, state.role = "approver", state.menu = ["Approvals"]. The popup closes itself after Approve.',
    },
    {
      id: 'A5',
      title: 'Session expiry',
      query: 'expireAfter=5000',
      steps: ['Enter viewer@example.com in the "Email" field', 'Enter Playground!1 in the "Password" field', 'Click on "Sign in"', 'Wait until the text "Your session has expired" is present on the current page'],
      expected: 'After 5 s: state.expired = true, state.user = null and the sign-in form is back.',
    },
    {
      id: 'A6',
      title: 'Remember me and forgotten password',
      steps: [
        'Check the checkbox "Remember me"',
        'Enter viewer@example.com in the "Email" field',
        'Enter Playground!1 in the "Password" field',
        'Click on "Sign in"',
        'Store cookie named default_remember in variable @{remember}',
        'Click on "Sign out"',
        'Click on "Forgot password?"',
        'Enter viewer@example.com in the "Reset email" field',
        'Click on "Send reset link"',
      ],
      expected: 'Cookie default_remember = viewer@example.com; state.signedOut = true; state.resetSentTo = "viewer@example.com" and the mock inbox shows "Reset your password".',
    },
  ],
}

const MENUS: Record<Role, string[]> = {
  admin: ['Users', 'Billing', 'Settings'],
  approver: ['Approvals'],
  viewer: ['Reports'],
}
const SECTION_TEXT: Record<string, string> = {
  Users: '3 users: Ada Admin, Grace Approver, Alan Viewer.',
  Billing: 'Plan: Team. Next invoice: $510.50.',
  Settings: 'Workspace name: Playground. Two-step verification: required for admins.',
  Approvals: '2 purchase requests waiting for approval.',
  Reports: 'Monthly activity report: 128 sessions, 14 exports.',
}

interface Session {
  email: string
  role: Role
  name: string
  via: 'password' | 'sso'
  mfaPassed: boolean
}
interface Mail {
  to: string
  subject: string
  body: string
  at: string
}

export default function AuthPage() {
  const t = useTraps('auth')
  const config = useConfig()
  const { merge } = usePageState()
  const toast = useToast()
  const [params] = useSearchParams()
  const expireAfter = Number(params.get('expireAfter') ?? 0)
  const sessionKey = nsKey(config, 'session')
  const cookieName = nsKey(config, 'remember')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingMfa, setPendingMfa] = useState<Session | null>(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [expired, setExpired] = useState(false)
  const [section, setSection] = useState<string | null>(null)
  const [forgot, setForgot] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState<string | null>(null)
  const [inbox, setInbox] = useState<Mail[]>([])
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mfaCode = String(100000 + Math.floor(t.rand('mfa-code') * 900000))

  const refreshInbox = useCallback(() => {
    backend
      .inbox(config.ns)
      .then((rows) => setInbox(rows))
      .catch(() => setInbox([]))
  }, [config.ns])

  const publish = useCallback(
    (s: Session | null, extra: Record<string, unknown> = {}) => {
      merge({
        user: s?.email ?? null,
        role: s?.role ?? null,
        menu: s ? MENUS[s.role] : [],
        mfaPassed: s?.mfaPassed ?? false,
        ssoUsed: s?.via === 'sso',
        ...extra,
      })
    },
    [merge],
  )

  const startExpiry = useCallback(() => {
    if (expiryTimer.current) clearTimeout(expiryTimer.current)
    if (!expireAfter) return
    expiryTimer.current = setTimeout(() => {
      try {
        localStorage.removeItem(sessionKey)
      } catch {
        /* ignore */
      }
      setSession(null)
      setSection(null)
      setExpired(true)
      merge({ user: null, role: null, menu: [], mfaPassed: false, ssoUsed: false, expired: true, expiredAfterMs: expireAfter })
    }, expireAfter)
  }, [expireAfter, sessionKey, merge])

  useEffect(() => () => {
    if (expiryTimer.current) clearTimeout(expiryTimer.current)
  }, [])

  const complete = useCallback(
    (s: Session) => {
      try {
        localStorage.setItem(sessionKey, JSON.stringify(s))
      } catch {
        /* ignore */
      }
      setSession(s)
      setPendingMfa(null)
      setExpired(false)
      setError(null)
      publish(s, { expired: false, loginError: null, signedOut: false, sessionKey })
      startExpiry()
    },
    [publish, sessionKey, startExpiry],
  )

  // Restore a stored session and the remember-me cookie.
  useAfterMount(() => {
    refreshInbox()
    let restored: Session | null = null
    try {
      const raw = localStorage.getItem(sessionKey)
      restored = raw ? (JSON.parse(raw) as Session) : null
    } catch {
      restored = null
    }
    const cookie = document.cookie
      .split(';')
      .map((p) => p.trim())
      .find((p) => p.startsWith(`${cookieName}=`))
    const remembered = cookie ? decodeURIComponent(cookie.slice(cookieName.length + 1)) : null
    if (remembered) {
      setEmail(remembered)
      setRemember(true)
    }
    if (restored) {
      setSession(restored)
      publish(restored, { restored: true, expired: false, rememberCookie: remembered })
      startExpiry()
    } else publish(null, { expired: false, rememberCookie: remembered })
  })

  // Single sign-on: the popup posts back (window.opener) or broadcasts when it was opened as a tab.
  useEffect(() => {
    const accept = (data: unknown) => {
      const d = data as { type?: string; ns?: string; email?: string } | null
      if (!d || d.type !== 'tp-sso' || d.ns !== config.ns) return
      const u = USERS.find((x) => x.email === d.email)
      if (!u) return
      complete({ email: u.email, role: u.role, name: u.name, via: 'sso', mfaPassed: false })
      toast(`Signed in with SSO as ${u.name}`, { tone: 'success' })
    }
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin) accept(e.data)
    }
    window.addEventListener('message', onMessage)
    let ch: BroadcastChannel | null = null
    if (typeof BroadcastChannel !== 'undefined') {
      ch = new BroadcastChannel('tp-sso')
      ch.onmessage = (e) => accept(e.data)
    }
    return () => {
      window.removeEventListener('message', onMessage)
      ch?.close()
    }
  }, [config.ns, complete, toast])

  useResetListener(
    config.ns,
    useCallback(() => {
      setSession(null)
      setPendingMfa(null)
      setInbox([])
      merge({ user: null, role: null, menu: [], reset: true })
    }, [merge]),
  )

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault()
    const u = USERS.find((x) => x.email === email.trim().toLowerCase())
    if (!u || password !== TEST_PASSWORD) {
      setError('Invalid email or password')
      merge({ loginError: 'Invalid email or password', user: null, attemptedEmail: email.trim() })
      return
    }
    if (remember) document.cookie = `${cookieName}=${encodeURIComponent(u.email)}; path=/; max-age=2592000; SameSite=Lax`
    else document.cookie = `${cookieName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
    merge({ rememberCookie: remember ? u.email : null, rememberCookieName: cookieName })
    const s: Session = { email: u.email, role: u.role, name: u.name, via: 'password', mfaPassed: false }
    if (u.role === 'admin') {
      setPendingMfa(s)
      setCode('')
      setCodeError(null)
      setError(null)
      await backend.sendEmail(config.ns, u.email, 'Your sign-in code', `Your verification code is ${mfaCode}. It expires in 10 minutes.`)
      refreshInbox()
      merge({ mfaRequired: true, mfaSentTo: u.email, loginError: null })
      return
    }
    complete(s)
  }

  const verify = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pendingMfa) return
    if (code.trim() !== mfaCode) {
      setCodeError('That code is not valid')
      merge({ mfaError: 'That code is not valid', mfaPassed: false })
      return
    }
    complete({ ...pendingMfa, mfaPassed: true })
  }

  const signOut = () => {
    try {
      localStorage.removeItem(sessionKey)
    } catch {
      /* ignore */
    }
    if (expiryTimer.current) clearTimeout(expiryTimer.current)
    setSession(null)
    setSection(null)
    setPassword('')
    publish(null, { signedOut: true })
  }

  const openSso = () => {
    const w = window.open(routeUrl(config, 'auth/sso'), 'tp-sso', 'width=480,height=620')
    merge({ ssoPopupOpened: true, ssoPopupBlocked: !w })
  }

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault()
    const to = resetEmail.trim().toLowerCase()
    if (!to) return
    await backend.sendEmail(config.ns, to, 'Reset your password', `Hi, use this link to reset your password: ${routeUrl(config, 'auth', { reset: 'token-' + mfaCode })}`)
    setResetSent(to)
    refreshInbox()
    merge({ resetSentTo: to })
  }

  const ssoButton = (
    <button type="button" id={t.id(t.v('sso-button', 'sso-continue'))} className={t.cls('auth__sso')} data-testid="sso-button" onClick={openSso}>
      {t.v('Continue with SSO', 'Continue with single sign-on')}
    </button>
  )

  const loginForm = (
    <Card title={t.v('Sign in', 'Welcome back')}>
      {expired ? (
        <p role="alert" data-ui="error" data-testid="session-expired">
          Your session has expired
        </p>
      ) : null}
      {t.v(null, <div data-testid="sso-top">{ssoButton}</div>)}
      <form onSubmit={signIn} noValidate id={t.id('login-form')} className={t.cls('auth__form')}>
        <Field label={t.v('Email', 'Email address')}>
          <input id={t.id('login-email')} name="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input id={t.id('login-password')} name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <label data-ui="inline">
          <input id={t.id('remember-me')} type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me
        </label>
        {error ? (
          <p role="alert" data-ui="error" data-testid="login-error">
            {error}
          </p>
        ) : null}
        <div data-ui="inline" style={{ marginTop: '0.6rem' }}>
          <button type="submit" data-variant="primary" id={t.id(t.v('sign-in', 'log-in'))} className={t.cls('auth__submit')} data-testid="sign-in">
            {t.v('Sign in', 'Log in')}
          </button>
          {t.dup ? (
            <button type="button" className={t.cls('auth__decoy')} style={{ opacity: 0.6 }} onClick={() => merge({ decoy: 'sign-in' })}>
              {t.v('Sign in', 'Log in')}
            </button>
          ) : null}
          <button type="button" data-variant="link" id={t.id('forgot-link')} onClick={() => setForgot((f) => !f)}>
            Forgot password?
          </button>
        </div>
      </form>
      {t.v(<div style={{ marginTop: '0.8rem' }}>{ssoButton}</div>, null)}
      <p data-ui="hint">Seeded accounts: admin@example.com, approver@example.com, viewer@example.com, password Playground!1. Admins get a 6-digit code by (mock) email.</p>
      {forgot ? (
        <form onSubmit={sendReset} data-testid="forgot-form" style={{ marginTop: '0.8rem' }}>
          <h3 style={{ margin: 0 }}>Reset password</h3>
          <Field label="Reset email">
            <input id={t.id('reset-email')} type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
          </Field>
          <button type="submit" id={t.id('send-reset')}>
            Send reset link
          </button>
          {resetSent ? (
            <p data-testid="reset-sent" role="status">
              Check your inbox: we sent a reset link to {resetSent}
            </p>
          ) : null}
        </form>
      ) : null}
    </Card>
  )

  const mfaForm = pendingMfa ? (
    <Card title="Enter the code we sent" data-testid="mfa-step">
      <p>We emailed a 6-digit verification code to {pendingMfa.email}. It is shown in the mock inbox below.</p>
      <form onSubmit={verify}>
        <Field label="Verification code" error={codeError}>
          <input id={t.id('mfa-code')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <div data-ui="inline">
          <button type="submit" data-variant="primary" id={t.id('mfa-verify')}>
            {t.v('Verify', 'Verify code')}
          </button>
          <button type="button" onClick={() => setPendingMfa(null)}>
            Back to sign in
          </button>
        </div>
      </form>
    </Card>
  ) : null

  const dashboard = session ? (
    <Card title="Dashboard" data-testid="dashboard">
      <div data-ui="inline" style={{ justifyContent: 'space-between' }}>
        <span data-testid="signed-in-as">
          Signed in as {session.name} <Badge tone="info">{session.role}</Badge>
          {session.via === 'sso' ? <Badge tone="success">SSO</Badge> : null}
          {session.mfaPassed ? <Badge tone="success">2-step verified</Badge> : null}
        </span>
        <button id={t.id('sign-out')} className={t.cls('auth__signout')} onClick={signOut}>
          Sign out
        </button>
      </div>
      <nav aria-label="Role menu" data-testid="role-menu" style={{ marginTop: '0.8rem' }}>
        <div data-ui="inline">
          {MENUS[session.role].map((item) => (
            <button
              key={item}
              id={t.id(`menu-${item.toLowerCase()}`)}
              data-variant={section === item ? 'primary' : undefined}
              aria-current={section === item ? 'page' : undefined}
              onClick={() => {
                setSection(item)
                merge({ section: item })
              }}
            >
              {item}
            </button>
          ))}
        </div>
      </nav>
      {section ? (
        <section aria-label={`${section} section`} data-testid="menu-section" style={{ marginTop: '0.8rem' }}>
          <h3 style={{ margin: 0 }}>{section}</h3>
          <p>{SECTION_TEXT[section]}</p>
        </section>
      ) : (
        <p data-ui="hint">Choose a menu item. The menu depends on the role.</p>
      )}
    </Card>
  ) : null

  return (
    <>
      {session ? dashboard : pendingMfa ? mfaForm : loginForm}
      <Card title="Mock inbox" data-testid="inbox">
        <p data-ui="hint">
          Emails for namespace <code>{config.ns}</code>. Nothing is sent to a real mailbox unless the backend has an email key.
        </p>
        <button id={t.id('refresh-inbox')} onClick={refreshInbox}>
          Refresh inbox
        </button>
        {inbox.length === 0 ? (
          <p data-testid="inbox-empty">No emails yet.</p>
        ) : (
          <ul style={{ paddingLeft: '1.1rem' }}>
            {inbox.slice(0, 5).map((m, i) => (
              <li key={`${m.at}-${i}`} data-testid="inbox-item">
                <strong>{m.subject}</strong> to {m.to}
                <div aria-label={i === 0 ? 'Latest email' : undefined} data-testid={i === 0 ? 'latest-email' : undefined}>
                  {m.body}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

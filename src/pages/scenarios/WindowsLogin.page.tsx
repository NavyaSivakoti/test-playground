import { useEffect, useState } from 'react'
import { Card, Field } from '../../components/ui'
import { useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { TEST_PASSWORD, USERS } from '../../core/users'

export const meta: PageMeta = {
  path: '/windows/login',
  title: 'Popup sign-in',
  group: 'Scenarios',
  summary: 'Popup login window opened by the windows scenario.',
  mock: true,
  hidden: true,
  bare: true,
}

export default function WindowsLoginPage() {
  const t = useTraps('windows-login')
  const config = useConfig()
  const { merge } = usePageState()
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Popup sign-in'
  }, [])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const u = USERS.find((x) => x.email === user.trim().toLowerCase())
    if (!u || pass !== TEST_PASSWORD) {
      setError('Invalid email or password')
      merge({ error: 'Invalid email or password' })
      return
    }
    const msg = { type: 'popup-login', ns: config.ns, email: u.email }
    if (window.opener && !window.opener.closed) window.opener.postMessage(msg, window.location.origin)
    else if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel('tp-windows')
      ch.postMessage(msg)
      ch.close()
    }
    merge({ signedIn: u.email })
    setTimeout(() => window.close(), 300)
  }

  return (
    <main data-ui="main" style={{ maxWidth: 420 }}>
      <Card title="Popup sign-in">
        <form onSubmit={submit} noValidate>
          <Field label="Username">
            <input id={t.id('popup-user')} autoComplete="username" value={user} onChange={(e) => setUser(e.target.value)} />
          </Field>
          <Field label="Password" error={error}>
            <input id={t.id('popup-pass')} type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} />
          </Field>
          <button type="submit" data-variant="primary" id={t.id('popup-submit')}>
            {t.v('Sign in', 'Continue')}
          </button>
        </form>
        <p data-ui="hint">Use a seeded account, e.g. viewer@example.com / Playground!1.</p>
      </Card>
    </main>
  )
}

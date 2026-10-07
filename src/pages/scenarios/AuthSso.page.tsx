import { useEffect, useState } from 'react'
import { Card, Field } from '../../components/ui'
import { useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { USERS } from '../../core/users'

export const meta: PageMeta = {
  path: '/auth/sso',
  title: 'Single sign-on',
  group: 'Scenarios',
  summary: 'Mock identity-provider popup opened by the sign-in page.',
  mock: true,
  hidden: true,
  bare: true,
}

export default function AuthSsoPage() {
  const t = useTraps('auth-sso')
  const config = useConfig()
  const { merge } = usePageState()
  const [account, setAccount] = useState('approver@example.com')
  const [done, setDone] = useState(false)

  useEffect(() => {
    document.title = 'Single sign-on'
  }, [])

  const approve = () => {
    const msg = { type: 'tp-sso', ns: config.ns, email: account }
    let via = 'broadcast'
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(msg, window.location.origin)
      via = 'opener'
    }
    // Opened as a plain tab (no opener): tell the sign-in page through a broadcast channel instead.
    if (via === 'broadcast' && typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel('tp-sso')
      ch.postMessage(msg)
      ch.close()
    }
    setDone(true)
    merge({ approved: account, via })
    setTimeout(() => window.close(), 400)
  }

  return (
    <main data-ui="main" style={{ maxWidth: 440 }}>
      <Card title="Single sign-on">
        <p>
          <span data-ui="mock-label">MOCK</span> Playground identity provider. Choose the account to sign in with.
        </p>
        <Field label="Account">
          <select id={t.id('sso-account')} value={account} onChange={(e) => setAccount(e.target.value)}>
            {USERS.map((u) => (
              <option key={u.email} value={u.email}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
        </Field>
        <div data-ui="inline">
          <button data-variant="primary" id={t.id('sso-approve')} className={t.cls('sso__approve')} onClick={approve} disabled={done}>
            {t.v('Approve', 'Allow access')}
          </button>
          <button
            id={t.id('sso-deny')}
            onClick={() => {
              merge({ denied: true })
              window.close()
            }}
          >
            Deny
          </button>
        </div>
        {done ? (
          <p role="status" data-testid="sso-done">
            Approved. You can close this window.
          </p>
        ) : null}
      </Card>
    </main>
  )
}

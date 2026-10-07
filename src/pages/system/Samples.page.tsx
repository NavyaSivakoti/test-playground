import { Link, useSearchParams } from 'react-router-dom'
import { useConfig } from '../../core/playground'
import { pageFor, type PageMeta } from '../../core/registry'
import steps from '../../coverage/steps.json'

export const meta: PageMeta = {
  path: '/samples',
  title: 'Sample tests',
  group: 'System',
  summary: 'Ready-to-paste test steps and the expected outcome for a page. Kept on a separate page so the quoted labels never duplicate the real ones.',
  hidden: true,
}

export default function Samples() {
  const [params] = useSearchParams()
  const config = useConfig()
  const target = pageFor(params.get('for') ?? '')
  if (!target) return <p>Unknown page.</p>
  const q = config.ns !== 'default' ? `?ns=${config.ns}` : ''
  const base = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}`
  return (
    <div>
      <p>
        Page: <Link to={`${target.meta.path}${q}`}>{target.meta.title}</Link> — URL <code>{`${base}${target.meta.path}/`}</code>
      </p>
      {target.meta.covers?.length ? (
        <p data-ui="hint">
          Step types covered:{' '}
          {target.meta.covers.map((id) => {
            const s = steps.find((x) => x.id === id)
            return (
              <span key={id} data-ui="badge" title={s?.text} style={{ marginRight: 4 }}>
                {id}
              </span>
            )
          })}
        </p>
      ) : null}
      {(target.meta.samples ?? []).map((s) => (
        <section key={s.id} data-ui="card">
          <h2 style={{ marginTop: 0 }}>
            {s.id}. {s.title}
          </h2>
          {s.query ? (
            <p>
              Open with: <code>{`${base}${target.meta.path}/?${s.query}`}</code>
            </p>
          ) : null}
          <ol>
            {s.steps.map((step, i) => (
              <li key={i}>{step.replaceAll('<base>', base)}</li>
            ))}
          </ol>
          <p>
            <strong>Expected:</strong> {s.expected}
          </p>
        </section>
      ))}
    </div>
  )
}

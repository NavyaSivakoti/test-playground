import { Link } from 'react-router-dom'
import { useConfig } from '../../core/playground'
import { groups, pages, type PageMeta } from '../../core/registry'
import steps from '../../coverage/steps.json'

export const meta: PageMeta = {
  path: '/',
  title: 'All pages',
  group: 'System',
  summary:
    'A reproducible playground for browser test automation. Every page writes what really happened to the Observable state panel, and every trap is a URL parameter.',
  order: 0,
  hidden: true,
}

export default function Home() {
  const config = useConfig()
  const q = config.ns !== 'default' ? `?ns=${config.ns}` : ''
  const covered = new Set(pages.flatMap((p) => p.meta.covers ?? []))
  return (
    <div>
      <div data-ui="row" style={{ alignItems: 'stretch' }}>
        <div data-ui="card" style={{ flex: '1 1 280px' }}>
          <strong>Step coverage</strong>
          <div style={{ fontSize: '1.8rem', fontWeight: 700 }} data-testid="coverage-count">
            {steps.filter((s) => covered.has(s.id)).length} / {steps.length}
          </div>
          <div data-ui="hint">Web step types with a target page.</div>
          <Link to={`/coverage${q}`}>Open the coverage matrix</Link>
        </div>
        <div data-ui="card" style={{ flex: '2 1 380px' }}>
          <strong>How to use</strong>
          <ol style={{ margin: '0.3rem 0 0 1.1rem', padding: 0 }}>
            <li>
              Pick a page. Use <code>?ns=&lt;run id&gt;</code> so parallel runs never share data.
            </li>
            <li>Turn traps on one at a time with the Settings drawer or URL parameters.</li>
            <li>Verify the Observable state panel, not just that a step passed.</li>
            <li>When a run fails, copy the Repro URL from the footer — it reproduces the exact page.</li>
          </ol>
        </div>
      </div>
      {groups.map((g) => {
        const list = pages.filter((p) => p.meta.group === g && !p.meta.hidden)
        if (!list.length) return null
        return (
          <section key={g}>
            <h2>{g}</h2>
            <div data-ui="grid">
              {list.map((p) => (
                <Link key={p.meta.path} to={`${p.meta.path}${q}`} data-ui="card" style={{ textDecoration: 'none', color: 'inherit', margin: 0 }}>
                  <strong>{p.meta.title}</strong>
                  {p.meta.mock ? <span data-ui="mock-label">MOCK</span> : null}
                  <div data-ui="hint">{p.meta.summary}</div>
                  <div data-ui="hint" style={{ marginTop: 4 }}>
                    <code>{p.meta.path}</code>
                    {p.meta.covers?.length ? ` · ${p.meta.covers.length} step types` : ''}
                    {p.meta.samples?.length ? ` · ${p.meta.samples.length} sample tests` : ''}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

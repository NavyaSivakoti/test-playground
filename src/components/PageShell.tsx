// Wraps every page: breadcrumb, title, summary, sample tests, content and the observable state panel.
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useConfig, usePageState } from '../core/playground'
import type { PageMeta } from '../core/registry'

function useViewport() {
  const read = () => ({
    width: window.innerWidth,
    height: window.innerHeight,
    breakpoint: window.innerWidth <= 390 ? 'mobile' : window.innerWidth <= 768 ? 'tablet' : 'desktop',
    touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
  })
  const [vp, setVp] = useState(read)
  useEffect(() => {
    const on = () => setVp(read())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return vp
}

export function StatePanel() {
  const config = useConfig()
  const { page, state } = usePageState()
  const viewport = useViewport()
  const json = JSON.stringify({ page, ns: config.ns, seed: config.seed, variant: config.variant, viewport, state }, null, 2)
  return (
    <section data-ui="state-panel" aria-label="Observable state">
      <h2>Observable state</h2>
      <p data-ui="hint">
        What actually happened on this page. Verify these values (the data-state attribute of #tp-state), not only that a step reported success.
      </p>
      {/* The JSON is drawn with CSS (::before content) so it is visible in screenshots but never matches
          text locators such as "Verify that the current page displays text …". Read it from data-state. */}
      <pre id="tp-state" data-testid="tp-state" data-state={JSON.stringify(state)} data-json={json} />
    </section>
  )
}

function SamplesLink({ meta }: { meta: PageMeta }) {
  const config = useConfig()
  if (!meta.samples?.length) return null
  // Samples live on their own page so their quoted labels never duplicate the real targets on this page.
  const q = new URLSearchParams({ for: meta.path })
  if (config.ns !== 'default') q.set('ns', config.ns)
  return (
    <p>
      <Link to={`/samples?${q.toString()}`} data-testid="samples-link">
        Sample tests for this page ({meta.samples.length})
      </Link>
    </p>
  )
}

export function PageShell({ meta, children }: { meta: PageMeta; children: ReactNode }) {
  const config = useConfig()
  useEffect(() => {
    document.title = `${meta.title} | Test Playground`
  }, [meta.title])
  const query = config.ns !== 'default' ? `?ns=${config.ns}` : ''
  return (
    <>
      <div data-ui="crumbs">
        <Link to={`/${query}`}>Home</Link> / {meta.group} / <span>{meta.title}</span>
      </div>
      <h1>
        {meta.title}
        {meta.mock ? (
          <span data-ui="mock-label" title="This page simulates an integration; it is not the real service">
            MOCK
          </span>
        ) : null}
      </h1>
      <p data-ui="hint" style={{ marginTop: 0 }}>
        {meta.summary}
      </p>
      <SamplesLink meta={meta} />
      {children}
      <StatePanel />
    </>
  )
}

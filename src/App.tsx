import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { PageShell } from './components/PageShell'
import { ToastProvider } from './components/ui'
import { PlaygroundProvider, PageStateProvider, useConfig } from './core/playground'
import { pages, type PageModule } from './core/registry'
import NotFound from './system/NotFound'

function DeviceGate({ children }: { children: React.ReactNode }) {
  const config = useConfig()
  const isMobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) && navigator.maxTouchPoints > 0
  if (config.device === 'mobile' && !isMobile)
    return (
      <div data-ui="card" data-testid="device-gate" style={{ maxWidth: 520, margin: '2rem auto', textAlign: 'center' }}>
        <h1>Continue on your phone</h1>
        <p>This flow is only available on a mobile device with a touch screen.</p>
        <p data-ui="hint">Detected: {navigator.userAgent.slice(0, 80)}… touch points: {navigator.maxTouchPoints}</p>
      </div>
    )
  return <>{children}</>
}

function routeElement(m: PageModule) {
  const Comp = m.default
  const body = (
    <PageStateProvider key={m.meta.path} page={m.meta.path}>
      {m.meta.bare ? (
        // Embedded frames and child windows skip the device gate: the parent page already applies it.
        <Comp />
      ) : (
        <DeviceGate>
          <PageShell meta={m.meta}>
            <Comp />
          </PageShell>
        </DeviceGate>
      )}
    </PageStateProvider>
  )
  return m.meta.bare ? body : <Layout>{body}</Layout>
}

export default function App() {
  return (
    <PlaygroundProvider>
      <ToastProvider>
        <Routes>
          {pages.map((m) => (
            <Route key={m.meta.path} path={m.meta.path} element={routeElement(m)} />
          ))}
          <Route
            path="*"
            element={
              <Layout>
                <NotFound />
              </Layout>
            }
          />
        </Routes>
      </ToastProvider>
    </PlaygroundProvider>
  )
}

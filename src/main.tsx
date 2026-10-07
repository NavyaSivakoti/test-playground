import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Exposed for "Custom step" tests (e.g. read window.testPlayground.version).
;(window as unknown as { testPlayground: unknown }).testPlayground = { version: '1.0.0', base: import.meta.env.BASE_URL }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

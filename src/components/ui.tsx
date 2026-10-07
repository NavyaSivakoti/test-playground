/* eslint-disable react-refresh/only-export-components */
// Small shared UI pieces for pages: Field, Card, Badge, Modal, toasts.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Field({ label, hint, error, children }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode }) {
  return (
    <label data-ui="field">
      <span>{label}</span>
      {children}
      {hint ? <span data-ui="hint">{hint}</span> : null}
      {error ? <span data-ui="error" role="alert">{error}</span> : null}
    </label>
  )
}

export function Card({ title, children, ...rest }: { title?: ReactNode; children: ReactNode } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section data-ui="card" {...rest}>
      {title ? <h2 style={{ marginTop: 0 }}>{title}</h2> : null}
      {children}
    </section>
  )
}

export function Badge({ tone, children, ...rest }: { tone?: 'success' | 'warning' | 'danger' | 'info'; children: ReactNode } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span data-ui="badge" data-tone={tone} {...rest}>
      {children}
    </span>
  )
}

export function Modal({ open, title, onClose, children, labelledBy = 'modal-title', ...rest }: {
  open: boolean
  title: ReactNode
  onClose?: () => void
  children: ReactNode
  labelledBy?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  // Keep the latest onClose in a ref so the Esc listener is not re-registered on every render.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  if (!open) return null
  return createPortal(
    <>
      <div data-ui="backdrop" onClick={onClose} />
      <div data-ui="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy} {...rest}>
        <h2 id={labelledBy} style={{ marginTop: 0 }}>{title}</h2>
        {children}
      </div>
    </>,
    document.body,
  )
}

// ---------------- toasts ----------------
interface Toast {
  id: number
  text: string
  tone?: 'success' | 'danger' | 'warning'
}
interface ToastCtx {
  toast: (text: string, opts?: { tone?: Toast['tone']; ms?: number; delayMs?: number }) => void
}
const ToastContext = createContext<ToastCtx | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const next = useRef(1)
  const toast = useCallback<ToastCtx['toast']>((text, opts) => {
    const show = () => {
      const id = next.current++
      setItems((s) => [...s, { id, text, tone: opts?.tone }])
      const ms = opts?.ms ?? 3000
      if (ms > 0) setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), ms)
    }
    if (opts?.delayMs) setTimeout(show, opts.delayMs)
    else show()
  }, [])
  const value = useMemo(() => ({ toast }), [toast])
  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div data-ui="toast-stack" aria-live="polite">
          {items.map((t) => (
            <div key={t.id} data-ui="toast" data-tone={t.tone} role="status" data-testid="toast">
              {t.text}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const c = useContext(ToastContext)
  if (!c) throw new Error('useToast outside ToastProvider')
  return c.toast
}

/** SHA-256 hex of a File/Blob (computed in the browser; files are never uploaded anywhere). */
export async function sha256(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Metadata recorded for every received file. */
export async function fileInfo(file: File) {
  return { name: file.name, size: file.size, type: file.type || 'unknown', sha256: await sha256(file) }
}

/** Absolute URL of a file in /public (respects the static hosting base path). */
export function publicUrl(path: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
}

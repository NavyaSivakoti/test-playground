import { createElement, useEffect, useRef, useState } from 'react'
import { useTraps } from '../../../core/playground'
import type { PageMeta } from '../../../core/registry'
import { toParent } from '../advanced/util'
import { defineShadowElements } from '../shadow/elements'

export const meta: PageMeta = {
  path: '/embed/shadow-frame',
  title: 'Shadow frame (embedded)',
  group: 'Scenarios',
  summary: 'Same-origin iframe content with a web component that uses an open shadow root.',
  hidden: true,
  bare: true,
}

export default function ShadowFrame() {
  const t = useTraps('shadow-frame')
  const ref = useRef<HTMLDivElement>(null)
  useState(() => defineShadowElements())
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const on = (e: Event) => toParent({ type: 'tp-shadow-frame', name: (e as CustomEvent).detail?.name })
    el.addEventListener('tp-frame-shadow-save', on)
    return () => el.removeEventListener('tp-frame-shadow-save', on)
  }, [])
  return (
    <div ref={ref} style={{ padding: 8, background: 'var(--surface)' }}>
      {createElement('tp-open-card', {
        id: t.id('frame-card'),
        'field-label': 'Frame shadow name',
        'button-label': t.v('Save in frame shadow', 'Store in frame shadow'),
        event: 'tp-frame-shadow-save',
      })}
    </div>
  )
}

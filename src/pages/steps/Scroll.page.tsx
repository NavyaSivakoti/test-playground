import { useEffect, useRef } from 'react'
import { Card } from '../../components/ui'
import { usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/steps/scroll',
  title: 'Scrolling',
  group: 'Step baselines',
  summary: 'A very long page of tall numbered blocks, a horizontal timeline and an inner scroll container for scroll-into-view, scroll-to-bottom, screen-by-screen and gesture scroll steps.',
  covers: [186, 523, 556, 584, 585, 593, 642],
  order: 9,
  samples: [
    {
      id: 'SC1',
      title: 'Scroll an element into view',
      steps: ['Scroll down to the element "Target 50" into view'],
      expected: 'state.visibleTarget = "Target 50" (the targets are further apart than one screen, so only one is visible at a time).',
    },
    {
      id: 'SC2',
      title: 'Scroll to bottom',
      steps: ['Scroll to bottom'],
      expected: 'state.atBottom = true.',
    },
    {
      id: 'SC3',
      title: 'One screen down and up',
      steps: ['Scroll one screen bottom', 'Scroll one screen up'],
      expected: 'state.scrollY grows by one viewport height, then shrinks by the same amount.',
    },
    {
      id: 'SC4',
      title: 'Horizontal and gesture scroll',
      steps: ['scroll horizontally', 'Scroll using gesture on "Swipe list"'],
      expected: 'state.scrollLeft > 0 and state.visibleColumnMax grows; state.swipeScrolled = true.',
    },
    {
      id: 'SC5',
      title: 'Align an element',
      steps: ['Scroll "Target 30" at the top at the screen.'],
      expected: 'state.visibleTarget = "Target 30" and state.visibleTargetTop is close to 0.',
    },
  ],
}

const TARGETS = 60
const COLUMNS = 60
const COL_WIDTH = 140

export default function ScrollPage() {
  const t = useTraps('scroll')
  const { merge } = usePageState()
  const labels = useRef<(HTMLElement | null)[]>([])
  const bottom = useRef<HTMLDivElement | null>(null)
  const frame = useRef<number | null>(null)

  // Visible target: labels are more than one screen apart, so at most one is visible at a time.
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const name = (e.target as HTMLElement).dataset.target
          merge({ visibleTarget: name, visibleTargetTop: Math.round(e.boundingClientRect.top) })
        }
      }
    })
    labels.current.forEach((el) => el && io.observe(el))
    const bio = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) merge({ atBottom: true })
    })
    if (bottom.current) bio.observe(bottom.current)
    return () => {
      io.disconnect()
      bio.disconnect()
    }
  }, [merge])

  // Window scroll position (rAF-throttled)
  useEffect(() => {
    const onScroll = () => {
      if (frame.current !== null) return
      frame.current = requestAnimationFrame(() => {
        frame.current = null
        const visible = labels.current.find((el) => {
          if (!el) return false
          const r = el.getBoundingClientRect()
          return r.bottom > 0 && r.top < window.innerHeight
        })
        merge({
          scrollY: Math.round(window.scrollY),
          viewportHeight: window.innerHeight,
          ...(visible ? { visibleTargetTop: Math.round(visible.getBoundingClientRect().top) } : {}),
        })
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [merge])

  return (
    <>
      <Card title={t.v('Horizontal and inner scrolling', 'Inner and horizontal scrolling')}>
        <div data-ui="field">
          <span id={t.id('timeline-label')}>Wide timeline</span>
          <div
            id={t.id('wide-timeline')}
            className={t.cls('timeline')}
            data-testid="wide-timeline"
            role="region"
            aria-labelledby={t.id('timeline-label')}
            tabIndex={0}
            style={{ overflowX: 'auto', whiteSpace: 'nowrap', border: '1px solid currentColor', maxWidth: '100%' }}
            onScroll={(e) => {
              const el = e.currentTarget
              merge({ scrollLeft: Math.round(el.scrollLeft), visibleColumnMax: Math.min(COLUMNS, Math.floor((el.scrollLeft + el.clientWidth) / COL_WIDTH)) })
            }}
          >
            {Array.from({ length: COLUMNS }, (_, i) => (
              <div key={i} data-testid={`column-${i + 1}`} style={{ display: 'inline-block', width: COL_WIDTH, boxSizing: 'border-box', padding: '1rem', borderRight: '1px solid #ccc' }}>
                Column {i + 1}
              </div>
            ))}
          </div>
        </div>
        <div data-ui="field">
          <span id={t.id('swipe-label')}>Swipe list</span>
          <ul
            id={t.id(t.v('swipe-list', 'swipe-list-b'))}
            className={t.cls('swipe-list')}
            data-testid="swipe-list"
            aria-labelledby={t.id('swipe-label')}
            tabIndex={0}
            style={{ height: 180, overflowY: 'auto', border: '1px solid currentColor', margin: 0, padding: '0 1.5rem' }}
            onScroll={(e) => merge({ swipeScrolled: true, swipeScrollTop: Math.round(e.currentTarget.scrollTop) })}
          >
            {Array.from({ length: 30 }, (_, i) => (
              <li key={i} style={{ padding: '0.5rem 0' }}>
                Message {i + 1}
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {t.v(null, <p data-ui="hint">Numbered blocks follow; each block is taller than the screen.</p>)}
      <div data-testid="targets">
        {Array.from({ length: TARGETS }, (_, i) => (
          <section key={i} data-ui="card" style={{ minHeight: '115vh', boxSizing: 'border-box' }}>
            <h3
              ref={(el) => {
                labels.current[i] = el
              }}
              id={t.id(`target-${i + 1}`)}
              className={t.cls('target')}
              data-testid={`target-${i + 1}`}
              data-target={`Target ${i + 1}`}
              style={{ margin: 0 }}
            >
              Target {i + 1}
            </h3>
          </section>
        ))}
      </div>
      <div ref={bottom} id={t.id('bottom-marker')} className={t.cls('bottom-marker')} data-testid="bottom-marker" style={{ padding: '2rem 0', textAlign: 'center' }}>
        Bottom marker
      </div>
    </>
  )
}

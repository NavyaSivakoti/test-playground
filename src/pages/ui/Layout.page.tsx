import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card } from '../../components/ui'
import { usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/ui/layout',
  title: 'Tabs, accordion, stepper and carousel',
  group: 'General UI',
  summary:
    'Layout widgets: horizontal and vertical tabs with lazily rendered panels, an accordion with single-open and multi-open modes, a four-step wizard with validation, a carousel with optional autoplay, a collapsible sidebar and breadcrumbs.',
  covers: [26, 138, 184, 548],
  order: 12,
  samples: [
    {
      id: 'L1',
      title: 'Switch tabs (lazy panels)',
      steps: ['Navigate to <base>/ui/layout/', 'Click on "Specs"', 'Verify that the current page displays text "Weight: 1.2 kg"'],
      expected: 'state.activeTab = "specs" and state.renderedPanels = ["overview","specs"] (Reviews is not in the DOM until opened).',
    },
    {
      id: 'L2',
      title: 'Accordion modes',
      steps: ['Click on "Shipping"', 'Click on "Returns"', 'Check the checkbox "Allow multiple open"', 'Click on "Warranty"'],
      expected: 'In single mode opening Returns closes Shipping; after enabling multi mode state.openSections = ["returns","warranty"].',
    },
    {
      id: 'L3',
      title: 'Stepper with validation on step 2',
      steps: ['Click on "Next"', 'Click on "Next"', 'Verify that the current page displays text "Enter a postcode"', 'Enter SW1A 1AA in the "Postcode" field', 'Click on "Next"'],
      expected: 'state.step = 3 only after the postcode is entered; state.stepErrors = 1 for the blocked attempt.',
    },
    {
      id: 'L4',
      title: 'Carousel',
      steps: ['Click on "Next slide"', 'Click on "Next slide"', 'Click on "Go to slide 5"', 'Verify that the "Slide caption" displays text "Slide 5 of 5"'],
      expected: 'state.slide = 5. Autoplay is off by default; ?autoplayMs=1000 sets the interval used by the Autoplay toggle.',
    },
    {
      id: 'L5',
      title: 'Sidebar and breadcrumbs',
      steps: ['Click on "Collapse sidebar"', 'Click on "Laptops"'],
      expected: 'state.sidebarCollapsed = true and state.crumb = "Laptops". In variant b the sidebar button reads "Hide sidebar".',
    },
  ],
}

const TABS = [
  { key: 'overview', label: 'Overview', body: 'A light 14-inch ultrabook with all-day battery.' },
  { key: 'specs', label: 'Specs', body: 'Weight: 1.2 kg · Battery: 18 h · Ports: 2 × USB-C' },
  { key: 'reviews', label: 'Reviews', body: '4.6 out of 5 from 128 reviews.' },
]
const VTABS = [
  { key: 'account', label: 'Account', body: 'Display name and avatar.' },
  { key: 'security', label: 'Security', body: 'Two-step sign-in is enabled.' },
  { key: 'billing', label: 'Billing', body: 'Next invoice on the 1st.' },
]
const ACC = [
  { key: 'shipping', title: 'Shipping', body: 'Ships within 2 business days.' },
  { key: 'returns', title: 'Returns', body: 'Return within 30 days for a full refund.' },
  { key: 'warranty', title: 'Warranty', body: 'Two-year limited warranty.' },
]
const STEPS = ['Details', 'Address', 'Payment', 'Review']
const SLIDES = ['Sunrise over hills', 'City at night', 'Forest trail', 'Desert dunes', 'Harbor boats']
const SLIDE_COLORS = ['#f59e0b', '#1e3a8a', '#15803d', '#d97706', '#0e7490']

export default function LayoutPage() {
  const t = useTraps('layout')
  const { merge } = usePageState()
  const [params] = useSearchParams()
  const autoplayMs = Math.max(300, Number(params.get('autoplayMs')) || 3000)

  const [activeTab, setActiveTab] = useState('overview')
  const [rendered, setRendered] = useState<string[]>(['overview'])
  const [vTab, setVTab] = useState('account')
  const [multi, setMulti] = useState(false)
  const [open, setOpen] = useState<string[]>([])
  const [step, setStep] = useState(1)
  const [postcode, setPostcode] = useState('')
  const [stepError, setStepError] = useState('')
  const stepErrors = useRef(0)
  const [slide, setSlide] = useState(1)
  const [autoplay, setAutoplay] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [crumb, setCrumb] = useState<string | null>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    merge({ activeTab: 'overview', renderedPanels: ['overview'], verticalTab: 'account', openSections: [], accordionMode: 'single', step: 1, slide: 1, autoplay: false, sidebarCollapsed: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectTab = (key: string) => {
    setActiveTab(key)
    const next = rendered.includes(key) ? rendered : [...rendered, key]
    setRendered(next)
    merge({ activeTab: key, renderedPanels: next })
  }

  const toggleSection = (key: string) => {
    const isOpen = open.includes(key)
    const next = isOpen ? open.filter((k) => k !== key) : multi ? [...open, key] : [key]
    setOpen(next)
    merge({ openSections: next })
  }

  const goStep = (target: number) => {
    if (target > 2 && step <= 2 && !postcode.trim()) {
      // can't pass the address step without a postcode
      if (step < 2) {
        setStep(2)
        merge({ step: 2 })
      }
      stepErrors.current += 1
      setStepError('Enter a postcode')
      merge({ stepErrors: stepErrors.current })
      return
    }
    setStepError('')
    setStep(target)
    merge({ step: target, stepName: STEPS[target - 1] })
  }

  const goSlide = (n: number, via: string) => {
    const s = ((n - 1 + SLIDES.length) % SLIDES.length) + 1
    setSlide(s)
    merge({ slide: s, slideVia: via })
  }
  const slideRef = useRef(slide)
  slideRef.current = slide
  useEffect(() => {
    if (!autoplay) return
    const id = setInterval(() => goSlide(slideRef.current + 1, 'autoplay'), autoplayMs)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, autoplayMs])

  const crumbs = ['Home', 'Catalog', 'Laptops', 'Ultrabook 14']

  const sidebar = (
    <aside
      key="sidebar"
      aria-label="Sidebar"
      data-testid="sidebar"
      data-collapsed={collapsed}
      style={{ width: collapsed ? 56 : 200, transition: 'width 150ms', borderRight: '1px solid var(--border)', paddingRight: 8, overflow: 'hidden', flex: 'none' }}
    >
      <button
        id={t.id('sidebar-toggle')}
        className={t.cls('sidebar__toggle')}
        aria-expanded={!collapsed}
        onClick={() => {
          setCollapsed(!collapsed)
          merge({ sidebarCollapsed: !collapsed })
        }}
      >
        {collapsed ? (t.v('Expand sidebar', 'Show sidebar')) : t.v('Collapse sidebar', 'Hide sidebar')}
      </button>
      {!collapsed ? (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li>Dashboard</li>
          <li>Orders</li>
          <li>Settings</li>
        </ul>
      ) : null}
    </aside>
  )

  const content = (
    <div key="content" style={{ flex: 1, minWidth: 0 }}>
      <nav aria-label="Breadcrumb">
        <ol style={{ listStyle: 'none', display: 'flex', gap: 6, padding: 0, flexWrap: 'wrap' }}>
          {crumbs.map((c, i) => (
            <li key={c}>
              {i < crumbs.length - 1 ? (
                <>
                  <a
                    href="#"
                    className={t.cls('crumbs__link')}
                    onClick={(e) => {
                      e.preventDefault()
                      setCrumb(c)
                      merge({ crumb: c })
                    }}
                  >
                    {c}
                  </a>{' '}
                  /
                </>
              ) : (
                <span aria-current="page">{c}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      {crumb ? <p data-ui="hint">Breadcrumb clicked: {crumb}</p> : null}
      <p>Main content area. Collapse the sidebar to give it more room.</p>
    </div>
  )

  return (
    <>
      <Card title="Horizontal tabs">
        <div role="tablist" aria-label="Product" data-ui="inline">
          {TABS.map((tab, i) => (
            <button
              key={tab.key}
              ref={(el) => {
                tabRefs.current[i] = el
              }}
              role="tab"
              id={t.id(`tab-${tab.key}`)}
              className={t.cls('tabs__tab')}
              aria-selected={activeTab === tab.key}
              aria-controls={`panel-${tab.key}`}
              tabIndex={activeTab === tab.key ? 0 : -1}
              data-variant={activeTab === tab.key ? 'primary' : undefined}
              onClick={() => selectTab(tab.key)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
                const n = (i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length
                selectTab(TABS[n].key)
                tabRefs.current[n]?.focus()
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {TABS.filter((tab) => rendered.includes(tab.key)).map((tab) => (
          <div key={tab.key} role="tabpanel" id={`panel-${tab.key}`} aria-label={`${tab.label} panel`} hidden={activeTab !== tab.key} style={{ padding: '8px 0' }}>
            {tab.body}
          </div>
        ))}
      </Card>

      <Card title="Vertical tabs">
        <div style={{ display: 'flex', gap: 16 }}>
          <div role="tablist" aria-orientation="vertical" aria-label="Settings sections" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {VTABS.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                id={t.id(`vtab-${tab.key}`)}
                className={t.cls('vtabs__tab')}
                aria-selected={vTab === tab.key}
                data-variant={vTab === tab.key ? 'primary' : undefined}
                onClick={() => {
                  setVTab(tab.key)
                  merge({ verticalTab: tab.key })
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" aria-label="Settings panel">
            {VTABS.find((x) => x.key === vTab)?.body}
          </div>
        </div>
      </Card>

      <Card title="Accordion">
        <label data-ui="inline" htmlFor={t.id('acc-multi')}>
          <input
            id={t.id('acc-multi')}
            type="checkbox"
            checked={multi}
            onChange={(e) => {
              setMulti(e.target.checked)
              merge({ accordionMode: e.target.checked ? 'multi' : 'single' })
            }}
          />
          Allow multiple open
        </label>
        {t.v(ACC, [ACC[1], ACC[0], ACC[2]]).map((s) => {
          const isOpen = open.includes(s.key)
          return (
            <div key={s.key} style={{ borderTop: '1px solid var(--border)', padding: '6px 0' }}>
              <h3 style={{ margin: 0 }}>
                <button
                  type="button"
                  data-variant="ghost"
                  id={t.id(`acc-${s.key}`)}
                  className={t.cls('accordion__header')}
                  aria-expanded={isOpen}
                  onClick={() => toggleSection(s.key)}
                >
                  {isOpen ? '▾' : '▸'} {s.title}
                </button>
              </h3>
              {isOpen ? (
                <div role="region" aria-label={`${s.title} details`} style={{ padding: '4px 12px' }}>
                  {s.body}
                </div>
              ) : null}
            </div>
          )
        })}
      </Card>

      <Card title="Checkout wizard">
        <ol aria-label="Steps" style={{ display: 'flex', gap: 8, listStyle: 'none', padding: 0, flexWrap: 'wrap' }}>
          {STEPS.map((name, i) => (
            <li key={name}>
              <button
                type="button"
                id={t.id(`step-jump-${i + 1}`)}
                className={t.cls('stepper__jump')}
                aria-current={step === i + 1 ? 'step' : undefined}
                data-variant={step === i + 1 ? 'primary' : undefined}
                onClick={() => goStep(i + 1)}
              >
                {i + 1}. {name}
              </button>
            </li>
          ))}
        </ol>
        <div data-testid="step-body" style={{ minHeight: 60 }}>
          <strong>
            Step {step} of 4: {STEPS[step - 1]}
          </strong>
          {step === 1 ? <p>Your name and email are taken from your account.</p> : null}
          {step === 2 ? (
            <div data-ui="field">
              <label htmlFor={t.id('postcode')} style={{ fontWeight: 600 }}>
                Postcode
              </label>
              <input
                id={t.id('postcode')}
                className={t.cls('stepper__postcode')}
                value={postcode}
                onChange={(e) => {
                  setPostcode(e.target.value)
                  setStepError('')
                  merge({ postcode: e.target.value })
                }}
              />
              {stepError ? (
                <span data-ui="error" role="alert">
                  {stepError}
                </span>
              ) : null}
            </div>
          ) : null}
          {step === 3 ? <p>Payment on delivery.</p> : null}
          {step === 4 ? <p>Review your order and finish.</p> : null}
        </div>
        <div data-ui="inline">
          <button id={t.id('step-back')} className={t.cls('stepper__back')} disabled={step === 1} onClick={() => goStep(step - 1)}>
            {t.v('Back', 'Previous')}
          </button>
          {step < 4 ? (
            <button id={t.id('step-next')} className={t.cls('stepper__next')} data-variant="primary" onClick={() => goStep(step + 1)}>
              {t.v('Next', 'Continue')}
            </button>
          ) : (
            <button
              id={t.id('step-finish')}
              data-variant="primary"
              onClick={() => merge({ stepperDone: true })}
            >
              Finish
            </button>
          )}
        </div>
      </Card>

      <Card title="Carousel">
        <div role="region" aria-roledescription="carousel" aria-label="Photo carousel">
          <div
            aria-live={autoplay ? 'off' : 'polite'}
            data-testid="slide"
            style={{ height: 140, borderRadius: 8, background: SLIDE_COLORS[slide - 1], color: '#fff', display: 'grid', placeItems: 'center', fontSize: '1.2rem', fontWeight: 700 }}
          >
            {SLIDES[slide - 1]}
          </div>
          <p aria-label="Slide caption" data-testid="slide-caption">
            Slide {slide} of {SLIDES.length}
          </p>
          <div data-ui="inline">
            <button id={t.id('slide-prev')} className={t.cls('carousel__prev')} aria-label="Previous slide" onClick={() => goSlide(slide - 1, 'arrow')}>
              ‹
            </button>
            {SLIDES.map((_, i) => (
              <button
                key={i}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={slide === i + 1}
                className={t.cls('carousel__dot')}
                onClick={() => goSlide(i + 1, 'dot')}
                style={{ width: 14, height: 14, padding: 0, borderRadius: '50%', background: slide === i + 1 ? 'var(--accent)' : 'var(--surface-2)' }}
              />
            ))}
            <button id={t.id('slide-next')} className={t.cls('carousel__next')} aria-label="Next slide" onClick={() => goSlide(slide + 1, 'arrow')}>
              ›
            </button>
            <label data-ui="inline" htmlFor={t.id('autoplay')}>
              <input
                id={t.id('autoplay')}
                type="checkbox"
                checked={autoplay}
                onChange={(e) => {
                  setAutoplay(e.target.checked)
                  merge({ autoplay: e.target.checked, autoplayMs })
                }}
              />
              Autoplay
            </label>
            <span data-ui="hint">every {autoplayMs} ms</span>
          </div>
        </div>
      </Card>

      <Card title="Sidebar and breadcrumbs">
        <div style={{ display: 'flex', gap: 16 }}>{t.v([sidebar, content], [content, sidebar])}</div>
      </Card>
    </>
  )
}

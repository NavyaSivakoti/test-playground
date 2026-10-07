import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Card } from '../../components/ui'
import { useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { useMedia, useNsLink } from './uiPart1Helpers'

export const meta: PageMeta = {
  path: '/ui/navigation',
  title: 'Menus and in-page navigation',
  group: 'General UI',
  summary:
    'A site menu with nested click and hover dropdowns, a three-column mega-menu, a hamburger menu on narrow screens, a sticky header, a scroll-spy table of contents, a link to a missing page, a redirect chain and a deep link that pre-fills a search form.',
  covers: [23, 26, 33, 131, 186, 192, 425],
  order: 13,
  samples: [
    {
      id: 'N1',
      title: 'Nested dropdown (click)',
      steps: ['Navigate to <base>/ui/navigation/', 'Click on "Products"', 'Mouseover on "Laptops"', 'Click on "Ultrabooks"'],
      expected: 'state.lastMenu = "Products > Laptops > Ultrabooks".',
    },
    {
      id: 'N2',
      title: 'Mega-menu on hover',
      steps: ['Mouseover on "Solutions"', 'Click on "Data pipelines"'],
      expected: 'state.lastMenu = "Solutions > Engineering > Data pipelines"; the menu only exists while hovered.',
    },
    {
      id: 'N3',
      title: 'Scroll-spy table of contents',
      steps: ['Click on "Configuration"', 'Verify that the URL of current page is <base>/ui/navigation/#configuration'],
      expected: 'state.activeSection = "configuration" after the scroll settles. Scrolling with "Scroll (up to/down to) the element "FAQ" into view" sets it to "faq".',
    },
    {
      id: 'N4',
      title: 'Deep link pre-fills the search form',
      steps: ['Navigate to <base>/ui/navigation/?q=laptop&sort=price', 'Verify that the "Search products" inputbox has value "laptop"', 'Click on "Search"'],
      expected: 'state.prefilled = {"q":"laptop","sort":"price"} and state.search = {"q":"laptop","sort":"price"}.',
    },
    {
      id: 'N5',
      title: 'Redirect chain and a missing page',
      steps: ['Click on "Start redirect chain"', 'Wait until the current page has url containing from=b', 'Click on "Broken page link"', 'Verify that the current page displays text "Page not found"'],
      expected: 'state.redirects = ["a","b"] before leaving; history has one entry for ?from=a replaced by ?from=b, so Back returns to the page before the chain.',
    },
    {
      id: 'N6',
      title: 'Hamburger menu on a narrow screen',
      steps: ['Click on "Open site menu"', 'Click on "Support"'],
      expected: 'At ≤768 px wide: state.hamburgerOpen = true then state.lastMenu = "Support". With bugs=brokenLink the Support item leads to a 404.',
    },
  ],
}

interface MenuNode {
  label: string
  children?: MenuNode[]
}
const PRODUCTS: MenuNode[] = [
  { label: 'Laptops', children: [{ label: 'Ultrabooks' }, { label: 'Gaming laptops' }, { label: 'Workstations' }] },
  { label: 'Monitors', children: [{ label: '4K monitors' }, { label: 'Portable monitors' }] },
  { label: 'Accessories' },
]
const RESOURCES: MenuNode[] = [{ label: 'Documentation' }, { label: 'Blog' }, { label: 'Webinars' }]
const MEGA: { title: string; items: string[] }[] = [
  { title: 'Engineering', items: ['Data pipelines', 'Build automation', 'Observability'] },
  { title: 'Operations', items: ['Inventory', 'Scheduling', 'Field service'] },
  { title: 'Finance', items: ['Invoicing', 'Expense review', 'Forecasting'] },
]
const SECTIONS = [
  { key: 'introduction', title: 'Introduction' },
  { key: 'installation', title: 'Installation' },
  { key: 'configuration', title: 'Configuration' },
  { key: 'usage', title: 'Usage' },
  { key: 'faq', title: 'FAQ' },
]

export default function NavigationPage() {
  const t = useTraps('navigation')
  const config = useConfig()
  const { merge } = usePageState()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const link = useNsLink()
  const narrow = useMedia('(max-width: 768px)')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [openSub, setOpenSub] = useState<string | null>(null)
  const [hamburger, setHamburger] = useState(false)
  const [active, setActive] = useState('introduction')
  const redirects = useRef<string[]>([])
  const navRef = useRef<HTMLElement | null>(null)

  const q0 = params.get('q') ?? ''
  const sort0 = params.get('sort') ?? 'relevance'
  const [q, setQ] = useState(q0)
  const [sort, setSort] = useState(sort0)
  const [searched, setSearched] = useState<{ q: string; sort: string } | null>(null)

  // deep-link prefill
  useEffect(() => {
    if (params.has('q') || params.has('sort')) {
      setQ(q0)
      setSort(sort0)
      merge({ prefilled: { q: q0, sort: sort0 } })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q0, sort0])

  // redirect chain: ?from=a is replaced by ?from=b
  const from = params.get('from')
  useEffect(() => {
    if (!from) return
    redirects.current = [...redirects.current, from]
    merge({ redirects: redirects.current, from })
    if (from === 'a') {
      const id = setTimeout(() => navigate(link('/ui/navigation', { from: 'b' }), { replace: true }), 400)
      return () => clearTimeout(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from])

  // close menus on outside click / Esc
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
        setOpenSub(null)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null)
        setOpenSub(null)
      }
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  // scroll spy: the active section is the last one whose top has passed the sticky headers
  const activeRef = useRef(active)
  useEffect(() => {
    const onScroll = () => {
      let current = SECTIONS[0].key
      for (const s of SECTIONS) {
        const el = document.getElementById(s.key)
        if (el && el.getBoundingClientRect().top <= 160) current = s.key
      }
      if (current !== activeRef.current) {
        activeRef.current = current
        setActive(current)
        merge({ activeSection: current })
      }
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [merge])

  const choose = (path: string) => {
    setOpenMenu(null)
    setOpenSub(null)
    setHamburger(false)
    merge({ lastMenu: path, hamburgerOpen: false })
  }

  const btnStyle = { border: 'none', background: 'none' }

  const productsMenu = (
    <li key="products" style={{ position: 'relative' }}>
      <button
        id={t.id('menu-products')}
        className={t.cls('site-nav__trigger')}
        aria-haspopup="menu"
        aria-expanded={openMenu === 'products'}
        style={btnStyle}
        onClick={() => {
          setOpenMenu(openMenu === 'products' ? null : 'products')
          merge({ openedMenu: 'Products', openedBy: 'click' })
        }}
      >
        Products ▾
      </button>
      {openMenu === 'products' ? (
        <div data-ui="popover" role="menu" aria-label="Products" style={narrow ? { position: 'static' } : { top: '100%', left: 0 }}>
          {PRODUCTS.map((p) => (
            <div key={p.label} style={{ position: 'relative' }} onMouseEnter={() => p.children && setOpenSub(p.label)} onMouseLeave={() => setOpenSub(null)}>
              <button
                role="menuitem"
                data-ui="menu-item"
                aria-haspopup={p.children ? 'menu' : undefined}
                aria-expanded={p.children ? openSub === p.label : undefined}
                onClick={() => (p.children ? setOpenSub(openSub === p.label ? null : p.label) : choose(`Products > ${p.label}`))}
              >
                {p.label} {p.children ? '›' : ''}
              </button>
              {p.children && openSub === p.label ? (
                <div data-ui="popover" role="menu" aria-label={p.label} style={narrow ? { position: 'static', marginLeft: 12 } : { top: 0, left: '100%' }}>
                  {p.children.map((c) => (
                    <button key={c.label} role="menuitem" data-ui="menu-item" onClick={() => choose(`Products > ${p.label} > ${c.label}`)}>
                      {c.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </li>
  )

  const solutionsMenu = (
    <li key="solutions" style={{ position: narrow ? 'relative' : 'static' }} onMouseEnter={() => setOpenMenu('solutions')} onMouseLeave={() => setOpenMenu((m) => (m === 'solutions' ? null : m))}>
      <button
        id={t.id('menu-solutions')}
        className={t.cls('site-nav__trigger site-nav__trigger--mega')}
        aria-haspopup="true"
        aria-expanded={openMenu === 'solutions'}
        style={btnStyle}
        onFocus={() => setOpenMenu('solutions')}
        onMouseEnter={() => merge({ openedMenu: 'Solutions', openedBy: 'hover' })}
      >
        Solutions ▾
      </button>
      {openMenu === 'solutions' ? (
        <div
          data-ui="popover"
          data-testid="mega-menu"
          aria-label="Solutions"
          style={narrow ? { position: 'static' } : { top: '100%', left: 0, right: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: 12 }}
        >
          {MEGA.map((col) => (
            <div key={col.title}>
              <strong>{col.title}</strong>
              {col.items.map((item) => (
                <a
                  key={item}
                  href="#"
                  data-ui="menu-item"
                  onClick={(e) => {
                    e.preventDefault()
                    choose(`Solutions > ${col.title} > ${item}`)
                  }}
                >
                  {item}
                </a>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </li>
  )

  const resourcesMenu = (
    <li key="resources" style={{ position: 'relative' }} onMouseEnter={() => setOpenMenu('resources')} onMouseLeave={() => setOpenMenu((m) => (m === 'resources' ? null : m))}>
      <button id={t.id('menu-resources')} className={t.cls('site-nav__trigger')} aria-haspopup="menu" aria-expanded={openMenu === 'resources'} style={btnStyle}>
        {t.v('Resources', 'Learn')} ▾
      </button>
      {openMenu === 'resources' ? (
        <div data-ui="popover" role="menu" aria-label="Resources" style={narrow ? { position: 'static' } : { top: '100%', left: 0 }}>
          {RESOURCES.map((r) => (
            <button key={r.label} role="menuitem" data-ui="menu-item" onClick={() => choose(`Resources > ${r.label}`)}>
              {r.label}
            </button>
          ))}
        </div>
      ) : null}
    </li>
  )

  const supportItem = (
    <li key="support">
      {config.bugs.includes('brokenLink') ? (
        <Link to={link('/ui/support-missing')} onClick={() => choose('Support')}>
          Support
        </Link>
      ) : (
        <a
          href="#faq"
          onClick={() => {
            choose('Support')
          }}
        >
          Support
        </a>
      )}
    </li>
  )

  const items = t.v([productsMenu, solutionsMenu, resourcesMenu, supportItem], [solutionsMenu, productsMenu, supportItem, resourcesMenu])

  return (
    <>
      <header
        ref={navRef}
        data-testid="site-header"
        style={{ position: 'sticky', top: 52, zIndex: 40, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 12px', marginBottom: 12 }}
      >
        <div data-ui="inline" style={{ justifyContent: 'space-between' }}>
          <strong>Gadget Store (demo)</strong>
          {narrow ? (
            <button
              id={t.id('hamburger')}
              className={t.cls('site-nav__hamburger')}
              aria-expanded={hamburger}
              aria-controls="site-menu"
              onClick={() => {
                setHamburger(!hamburger)
                merge({ hamburgerOpen: !hamburger })
              }}
            >
              {hamburger ? 'Close site menu' : 'Open site menu'}
            </button>
          ) : null}
        </div>
        {!narrow || hamburger ? (
          <nav aria-label="Site menu" id="site-menu" className={t.cls('site-nav')}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: narrow ? 'column' : 'row', gap: 8, position: 'relative' }}>{items}</ul>
          </nav>
        ) : null}
      </header>

      <Card title="Links">
        <div data-ui="inline">
          <Link id={t.id('broken-link')} className={t.cls('links__broken')} to={link('/ui/does-not-exist')}>
            Broken page link
          </Link>
          <Link id={t.id('redirect-link')} className={t.cls('links__redirect')} to={link('/ui/navigation', { from: 'a' })} onClick={() => (redirects.current = [])}>
            Start redirect chain
          </Link>
          <Link id={t.id('deep-link')} className={t.cls('links__deep')} to={link('/ui/navigation', { q: 'laptop', sort: 'price' })}>
            {t.v('Open deep link', 'Open pre-filled search')}
          </Link>
        </div>
        {from ? (
          <p data-ui="hint" data-testid="redirect-status">
            Arrived via redirect step “{from}”.
          </p>
        ) : null}
      </Card>

      <Card title="Search">
        <form
          role="search"
          aria-label="Product search"
          onSubmit={(e) => {
            e.preventDefault()
            setSearched({ q, sort })
            merge({ search: { q, sort } })
          }}
        >
          <div data-ui="row">
            <div data-ui="field">
              <label htmlFor={t.id('search-q')} style={{ fontWeight: 600 }}>
                Search products
              </label>
              <input id={t.id('search-q')} className={t.cls('search__q')} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div data-ui="field">
              <label htmlFor={t.id('search-sort')} style={{ fontWeight: 600 }}>
                Sort by
              </label>
              <select id={t.id('search-sort')} className={t.cls('search__sort')} value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="relevance">Relevance</option>
                <option value="price">Price</option>
                <option value="rating">Rating</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          </div>
          <button type="submit" id={t.id('search-submit')} data-variant="primary">
            Search
          </button>
        </form>
        {searched ? (
          <p role="status" data-testid="search-status">
            Showing results for “{searched.q}” sorted by {searched.sort}
          </p>
        ) : null}
      </Card>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <nav aria-label="On this page" style={{ position: 'sticky', top: 130, flex: 'none', width: 170 }}>
          <strong>On this page</strong>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {SECTIONS.map((s) => (
              <li key={s.key}>
                <a
                  href={`#${s.key}`}
                  aria-current={active === s.key ? 'location' : undefined}
                  style={{ fontWeight: active === s.key ? 700 : 400 }}
                  onClick={(e) => {
                    e.preventDefault()
                    document.getElementById(s.key)?.scrollIntoView({ behavior: 'auto', block: 'start' })
                    window.history.pushState(window.history.state, '', `${window.location.pathname}${window.location.search}#${s.key}`)
                    merge({ tocClicked: s.key })
                  }}
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div style={{ flex: 1, minWidth: 0 }}>
          {SECTIONS.map((s, i) => (
            <section key={s.key} id={s.key} aria-labelledby={`${s.key}-h`} style={{ minHeight: '70vh', scrollMarginTop: 130, borderTop: '1px solid var(--border)' }}>
              <h2 id={`${s.key}-h`}>{s.title}</h2>
              <p>
                Section {i + 1} of {SECTIONS.length}. Scroll or use the table of contents; the highlighted entry follows the section at the top of the
                viewport.
              </p>
            </section>
          ))}
        </div>
      </div>
    </>
  )
}

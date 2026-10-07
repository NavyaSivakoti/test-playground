import { useState } from 'react'
import { useTraps } from '../../../core/playground'
import type { PageMeta } from '../../../core/registry'
import { postToParent } from '../shared'

export const meta: PageMeta = {
  path: '/embed/hover-menu',
  title: 'Hover menu (embedded)',
  group: 'Scenarios',
  summary: 'A hover-only menu inside an iframe on the iframe lab.',
  hidden: true,
  bare: true,
}

export default function HoverMenuPage() {
  const t = useTraps('hover-menu')
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const items = t.v(['Export', 'Archive'], ['Archive', 'Export'])
  return (
    <div style={{ padding: 12, minHeight: 170 }}>
      <div style={{ position: 'relative', display: 'inline-block' }} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
        <span data-ui="btn" id={t.id(t.v('actions', 'actions-menu'))} data-testid="hover-actions">
          {t.v('Actions', 'More actions')}
        </span>
        {open ? (
          <div data-ui="popover" role="menu" style={{ top: '100%', left: 0 }} data-testid="hover-menu">
            {items.map((item) => (
              <button
                key={item}
                role="menuitem"
                data-ui="menu-item"
                id={t.id(`menu-${item.toLowerCase()}`)}
                onClick={() => {
                  setPicked(item)
                  setOpen(false)
                  postToParent({ frame: 'hover-menu', type: 'menu', item })
                }}
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <p data-ui="hint">Hover to open: the menu has no click handler on its trigger.</p>
      {picked ? <div data-testid="hover-picked">Picked {picked}</div> : null}
    </div>
  )
}

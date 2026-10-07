import { useEffect, useRef, useState } from 'react'
import { Card, Modal } from '../../components/ui'
import { usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/steps/input',
  title: 'Typing, clearing and keys',
  group: 'Step baselines',
  summary: 'Text inputs, a textarea, a number field, chips and a key logger for enter, clear, fill, tab order and key-press steps.',
  covers: [13, 14, 35, 54, 55, 70, 161, 456, 572, 673, 674, 675],
  order: 3,
  samples: [
    {
      id: 'I1',
      title: 'Enter and fill',
      steps: ['Enter Ada Lovelace in the "Full name" field', 'Fill ada@example.com in the "Email" field'],
      expected: 'state.fullName = "Ada Lovelace"; state.email = "ada@example.com" (fill replaces the prefilled text).',
    },
    {
      id: 'I2',
      title: 'Clear prefilled fields',
      steps: ['Clear the value displayed in the "Prefilled name" field', 'Clear the text displayed in the "Prefilled notes" field'],
      expected: 'state.prefilled = "" and state.notes = "".',
    },
    {
      id: 'I3',
      title: 'Search with Enter',
      steps: ['Enter keyboard in the "Search box" field', 'Press Enter/Return Key'],
      expected: 'state.searchSubmitted = "keyboard".',
    },
    {
      id: 'I4',
      title: 'Keys and modifiers',
      steps: ['Click on "Key log"', 'Press Shift+Delete Keys', 'Press ArrowDown Key'],
      expected: 'state.keys ends with "Shift+Delete", "ArrowDown"; state.lastKey = "ArrowDown".',
    },
    {
      id: 'I5',
      title: 'Repeat keys in a field',
      steps: ['Press the ArrowUp key 3 time(s) in the "Quantity" field', 'Press Backspace 4 time(s) in the "Code" field'],
      expected: 'state.quantity = 4 and state.code = "ABCD".',
    },
    {
      id: 'I6',
      title: 'Esc and chips',
      steps: ['Click on "Open modal"', 'Press Esc Key', 'Clear all selected values (chips/tags) from the "Tags" field'],
      expected: 'The dialog is closed, state.lastKey = "Escape", state.modalOpen = false and state.tags = [].',
    },
  ],
}

const MODIFIERS = ['Shift', 'Control', 'Alt', 'Meta']
function keyName(e: KeyboardEvent): string {
  if (MODIFIERS.includes(e.key)) return e.key
  const mods: string[] = []
  if (e.ctrlKey) mods.push('Control')
  if (e.altKey) mods.push('Alt')
  if (e.metaKey) mods.push('Meta')
  if (e.shiftKey && e.key.length !== 1) mods.push('Shift')
  return [...mods, e.key].join('+')
}

export default function InputPage() {
  const t = useTraps('input')
  const { state, merge } = usePageState()
  const [modal, setModal] = useState(false)
  const [tags, setTags] = useState<string[]>(['alpha', 'beta', 'gamma'])
  const [tagDraft, setTagDraft] = useState('')
  const [keys, setKeys] = useState<string[]>([])
  const keysRef = useRef<string[]>([])

  // Global key logger: every keydown on the page is recorded.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keyName(e)
      const next = [...keysRef.current, k].slice(-12)
      keysRef.current = next
      // Deferred so that a re-render does not detach other window key listeners (the dialog's Esc handler)
      // while this keydown is still being dispatched.
      setTimeout(() => {
        setKeys(next)
        merge({ lastKey: k, keys: next })
      }, 0)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [merge])

  const updateTags = (next: string[]) => {
    setTags(next)
    merge({ tags: next })
  }
  const focusTo = (name: string) => () => merge({ focused: name })

  const nameField = (
    <label data-ui="field" key="name">
      <span>Full name</span>
      <input
        id={t.id(t.v('full-name', 'fullName'))}
        className={t.cls('input input--name')}
        name="fullName"
        data-testid="full-name"
        onFocus={focusTo('fullName')}
        onChange={(e) => merge({ fullName: e.target.value })}
      />
    </label>
  )
  const emailField = (
    <label data-ui="field" key="email">
      <span>Email</span>
      <input
        id={t.id(t.v('email', 'email-address'))}
        className={t.cls('input input--email')}
        type="email"
        name="email"
        data-testid="email"
        defaultValue="old@example.com"
        onFocus={focusTo('email')}
        onChange={(e) => merge({ email: e.target.value })}
      />
    </label>
  )

  return (
    <>
      <Card title="Typing and tab order">
        <p data-ui="hint">Tab moves from the name field to the email field. The email field starts with old text that a fill replaces.</p>
        {t.v(
          <div data-ui="stack">
            {nameField}
            {emailField}
          </div>,
          <div data-ui="stack">
            <div data-variant="wrapper">{nameField}</div>
            <div data-variant="wrapper">{emailField}</div>
          </div>,
        )}
      </Card>

      <Card title="Clearing prefilled values">
        <label data-ui="field">
          <span>Prefilled name</span>
          <input
            id={t.id('prefilled-name')}
            className={t.cls('input input--prefilled')}
            data-testid="prefilled-name"
            defaultValue="Grace Hopper"
            onFocus={focusTo('prefilled')}
            onChange={(e) => merge({ prefilled: e.target.value })}
          />
        </label>
        <label data-ui="field">
          <span>Prefilled notes</span>
          <textarea
            id={t.id('prefilled-notes')}
            className={t.cls('textarea')}
            data-testid="prefilled-notes"
            rows={3}
            defaultValue={'Line one of the notes.\nLine two of the notes.'}
            onFocus={focusTo('notes')}
            onChange={(e) => merge({ notes: e.target.value })}
          />
        </label>
      </Card>

      <Card title="Enter and Esc">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            const q = String(new FormData(e.currentTarget).get('q') ?? '')
            merge({ searchSubmitted: q })
          }}
        >
          <label data-ui="field">
            <span>{t.v('Search box', 'Search')}</span>
            <input id={t.id(t.v('search-box', 'search'))} className={t.cls('input input--search')} name="q" type="search" data-testid="search-box" onFocus={focusTo('search')} />
          </label>
        </form>
        {state.searchSubmitted !== undefined ? <p data-testid="search-result">Searched for: {String(state.searchSubmitted)}</p> : null}
        <button
          id={t.id('open-modal')}
          className={t.cls('btn btn--modal')}
          data-testid="open-modal"
          onClick={() => {
            setModal(true)
            merge({ modalOpen: true })
          }}
        >
          {t.v('Open modal', 'Open dialog')}
        </button>
        <Modal
          open={modal}
          title="Example dialog"
          labelledBy={t.id('input-modal-title')}
          data-testid="input-modal"
          onClose={() => {
            setModal(false)
            merge({ modalOpen: false })
          }}
        >
          <p>Press Esc to close this dialog.</p>
        </Modal>
      </Card>

      <Card title="Keys">
        <label data-ui="field">
          <span>Key log</span>
          <input
            id={t.id('key-log')}
            className={t.cls('input input--keylog')}
            data-testid="key-log"
            readOnly
            value={keys.join(' ')}
            onFocus={focusTo('keyLog')}
            placeholder="Focus here and press keys"
          />
        </label>
        <p data-testid="last-key">Last key: {String(state.lastKey ?? '—')}</p>
        <label data-ui="field">
          <span>Quantity</span>
          <input
            id={t.id('quantity')}
            className={t.cls('input input--qty')}
            data-testid="quantity"
            type="number"
            min={0}
            max={99}
            defaultValue={1}
            onFocus={focusTo('quantity')}
            onChange={(e) => merge({ quantity: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </label>
        <label data-ui="field">
          <span>Code</span>
          <input
            id={t.id('code')}
            className={t.cls('input input--code')}
            data-testid="code"
            defaultValue="ABCDEFGH"
            onFocus={focusTo('code')}
            onChange={(e) => merge({ code: e.target.value })}
          />
        </label>
      </Card>

      <Card title="Chips">
        <div data-ui="field">
          <label htmlFor={t.id('tags-input')}>Tags</label>
          <div data-ui="inline" data-testid="tags" role="group" aria-label="Selected tags">
            {tags.map((tag) => (
              <span key={tag} data-ui="badge" data-testid="tag-chip" className={t.cls('chip')}>
                {tag}{' '}
                <button aria-label={`Remove ${tag}`} className={t.cls('chip__remove')} onClick={() => updateTags(tags.filter((x) => x !== tag))}>
                  ×
                </button>
              </span>
            ))}
            <input
              id={t.id('tags-input')}
              className={t.cls('input input--tags')}
              data-testid="tags-input"
              value={tagDraft}
              placeholder="Add a tag and press Enter"
              onFocus={focusTo('tags')}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && tagDraft.trim()) {
                  e.preventDefault()
                  if (!tags.includes(tagDraft.trim())) updateTags([...tags, tagDraft.trim()])
                  setTagDraft('')
                } else if (e.key === 'Backspace' && tagDraft === '' && tags.length) {
                  updateTags(tags.slice(0, -1))
                }
              }}
            />
            <button aria-label="Clear all tags" data-testid="tags-clear" className={t.cls('chip__clear')} onClick={() => updateTags([])}>
              Clear all
            </button>
          </div>
        </div>
      </Card>
    </>
  )
}

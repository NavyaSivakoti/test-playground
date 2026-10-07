import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card } from '../../components/ui'
import { usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/steps/loops',
  title: 'Loops and conditions',
  group: 'Step baselines',
  summary:
    'Controls with a known number of iterations for while-loops (enabled, visible, not visible, text present, input value) and query-driven conditions for IF and AI verification steps.',
  covers: [190, 191, 553, 554, 564, 569, 570, 582, 586, 594],
  order: 7,
  samples: [
    {
      id: 'L1',
      title: 'While enabled',
      steps: ['While element "Load more" is enabled', 'Click on "Load more"'],
      expected: 'Stops after 5 iterations; state.loaded = 25 and state.loadMoreClicks = 5.',
    },
    {
      id: 'L2',
      title: 'While visible',
      steps: ['While element "Next page" is visible on the page', 'Click on "Next page"'],
      expected: 'Stops on page 4 (the button is removed); state.pageNumber = 4.',
    },
    {
      id: 'L3',
      title: 'While text is visible',
      steps: ['While text "Pending" is visible on the page', 'Click on "Approve next"'],
      expected: 'Four iterations; state.approved = 4.',
    },
    {
      id: 'L4',
      title: 'While inputbox does not contain',
      steps: ['While inputbox "Counter" doesn\'t contain 5 value', 'Click on "+1"'],
      expected: 'state.counter = 5.',
    },
    {
      id: 'L5',
      title: 'Condition on a query flag',
      query: 'promo=1',
      steps: ['Check the text "Promo available" is present on the current page', 'Click on "Claim promo"'],
      expected: 'With ?promo=1: state.claimed = true. Without it the condition is false and nothing is clicked.',
    },
    {
      id: 'L6',
      title: 'AI verification of a count',
      query: 'empty=1',
      steps: ['AI Verification: Is the venue result count zero?'],
      expected: 'True with ?empty=1 ("Venues (0)"), false by default ("Venues (7)"). With ?staleHeader=1 the header still says 7 while the list is empty (deliberate inconsistency).',
    },
  ],
}

const VENUES = ['Harbour Hall', 'North Pavilion', 'Riverside Loft', 'Old Mill Studio', 'Garden Terrace', 'Skyline Room', 'Lantern House']

export default function LoopsPage() {
  const t = useTraps('loops')
  const { merge } = usePageState()
  const [params] = useSearchParams()
  const [loaded, setLoaded] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [processed, setProcessed] = useState(0)
  const [approved, setApproved] = useState(0)
  const [counter, setCounter] = useState(0)
  const [mode, setMode] = useState('draft')
  const [unlocks, setUnlocks] = useState(0)
  const [claimed, setClaimed] = useState(false)
  const promo = params.get('promo') === '1'
  const empty = params.get('empty') === '1'
  const stale = params.get('staleHeader') === '1'
  const venues = empty || stale ? [] : VENUES
  const headerCount = stale ? VENUES.length : venues.length
  const MODES = ['draft', 'draft-reviewed', 'published']

  useEffect(() => {
    merge({ venueCount: venues.length, venueHeaderCount: headerCount, promoShown: promo })
  }, [venues.length, headerCount, promo, merge])

  return (
    <>
      <Card title="Load more">
        <ul data-testid="loaded-items" style={{ columns: 3 }}>
          {Array.from({ length: loaded }, (_, i) => (
            <li key={i}>Item {i + 1}</li>
          ))}
        </ul>
        <button
          id={t.id(t.v('load-more', 'load-more-b'))}
          className={t.cls('btn btn--load')}
          data-testid="load-more"
          disabled={loaded >= 25}
          onClick={() => {
            const next = loaded + 5
            setLoaded(next)
            merge({ loaded: next, loadMoreClicks: next / 5 })
          }}
        >
          Load more
        </button>{' '}
        <span data-testid="loaded-count">{loaded} of 25 loaded</span>
      </Card>

      <Card title="Paging">
        <p data-testid="page-number">Page {pageNumber} of 4</p>
        {pageNumber < 4 ? (
          <button
            id={t.id('next-page')}
            className={t.cls('btn btn--next')}
            data-testid="next-page"
            onClick={() => {
              setPageNumber(pageNumber + 1)
              merge({ pageNumber: pageNumber + 1 })
            }}
          >
            Next page
          </button>
        ) : null}
      </Card>

      <Card title="Processing queue">
        <p data-testid="processed">Processed {processed} of 3</p>
        {processed >= 3 ? (
          <p data-testid="all-done">
            <strong>All done</strong>
          </p>
        ) : null}
        <button
          id={t.id('process-one')}
          className={t.cls('btn btn--process')}
          data-testid="process-one"
          disabled={processed >= 3}
          onClick={() => {
            setProcessed(processed + 1)
            merge({ processed: processed + 1, allDone: processed + 1 >= 3 })
          }}
        >
          Process one
        </button>
      </Card>

      <Card title={t.v('Approvals', 'Approval queue')}>
        <ul data-testid="approval-list">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i}>
              Request {i + 1}: {i < approved ? 'Approved' : 'Pending'}
            </li>
          ))}
        </ul>
        <button
          id={t.id('approve-next')}
          className={t.cls('btn btn--approve')}
          data-testid="approve-next"
          disabled={approved >= 4}
          onClick={() => {
            setApproved(approved + 1)
            merge({ approved: approved + 1 })
          }}
        >
          Approve next
        </button>
      </Card>

      <Card title="Input values">
        <div data-ui="inline">
          <label data-ui="field">
            <span>Counter</span>
            <input id={t.id('counter')} className={t.cls('input input--counter')} data-testid="counter" readOnly value={String(counter)} />
          </label>
          <button
            id={t.id('plus-one')}
            className={t.cls('btn btn--plus')}
            data-testid="plus-one"
            onClick={() => {
              setCounter(counter + 1)
              merge({ counter: counter + 1 })
            }}
          >
            +1
          </button>
        </div>
        <div data-ui="inline">
          <label data-ui="field">
            <span>Mode</span>
            <input id={t.id('mode')} className={t.cls('input input--mode')} data-testid="mode" readOnly value={mode} />
          </label>
          <button
            id={t.id('advance')}
            className={t.cls('btn btn--advance')}
            data-testid="advance"
            disabled={mode === 'published'}
            onClick={() => {
              const next = MODES[Math.min(MODES.indexOf(mode) + 1, MODES.length - 1)]
              setMode(next)
              merge({ mode: next, advances: MODES.indexOf(next) })
            }}
          >
            Advance
          </button>
        </div>
      </Card>

      <Card title="Locked action">
        <div data-ui="inline">
          {t.v(null, <span data-ui="hint">Unlock progress: {unlocks}/3</span>)}
          <button
            id={t.id(t.v('unlock-step', 'unlock-step-b'))}
            className={t.cls('btn btn--unlock')}
            data-testid="unlock-step"
            disabled={unlocks >= 3}
            onClick={() => {
              setUnlocks(unlocks + 1)
              merge({ unlocks: unlocks + 1 })
            }}
          >
            Unlock step
          </button>
          <button
            id={t.id('locked-action')}
            className={t.cls('btn btn--locked')}
            data-testid="locked-action"
            disabled={unlocks < 3}
            onClick={() => merge({ lockedActionClicked: true })}
          >
            Locked action
          </button>
        </div>
      </Card>

      {promo ? (
        <Card title="Offer" data-testid="promo-card">
          <p>Promo available</p>
          <button
            id={t.id('claim-promo')}
            className={t.cls('btn btn--promo')}
            data-testid="claim-promo"
            disabled={claimed}
            onClick={() => {
              setClaimed(true)
              merge({ claimed: true })
            }}
          >
            Claim promo
          </button>
        </Card>
      ) : null}

      <Card>
        <h2 style={{ marginTop: 0 }} data-testid="venues-header" id={t.id('venues-header')}>
          Venues ({headerCount})
        </h2>
        {venues.length ? (
          <ul data-testid="venue-list">
            {venues.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        ) : (
          <p data-testid="venue-list-empty">No venues match.</p>
        )}
        <p data-ui="hint">
          Query flags: <code>empty=1</code> empties the list, <code>staleHeader=1</code> empties the list but keeps the old count in the header.
        </p>
        <span hidden data-testid="venue-count" data-count={venues.length} />
      </Card>
    </>
  )
}

import { useCallback, useRef, useState } from 'react'
import { Card, useToast } from '../../components/ui'
import { backend, backendMode } from '../../core/backend'
import { useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { useResetListener } from '../../core/reset'
import { useAfterMount } from './business/util'

export const meta: PageMeta = {
  path: '/parallel',
  title: 'Parallel runs and namespaces',
  group: 'Scenarios',
  summary:
    'A counter shared by everyone in the same namespace. Runs that do not set a namespace share the default one and change each other’s data; a unique namespace per run keeps them apart.',
  covers: [26, 138, 5, 561, 592],
  order: 16,
  samples: [
    {
      id: 'N1',
      title: 'Isolated counter',
      query: 'ns=run-${RUN_ID}',
      steps: ['Click on "Reset counter"', 'Click on "Increment"', 'Click on "Increment"', 'Click on "Read"', 'Verify that the "Counter value" displays text "2"'],
      expected: 'state.counter = 2, state.ns = the run namespace and state.jumped = false.',
    },
    {
      id: 'N2',
      title: 'Collision in the default namespace',
      steps: ['Click on "Read"', 'Click on "Increment"', 'Click on "Read"'],
      expected: 'Alone: the value goes up by 1. With a second tab or run on the same namespace incrementing in between, state.jumped = true and state.expected ≠ state.counter.',
    },
  ],
}

const KIND = 'counter'

export default function ParallelPage() {
  const t = useTraps('parallel')
  const config = useConfig()
  const { merge } = usePageState()
  const toast = useToast()
  const [value, setValue] = useState<number | null>(null)
  const [jump, setJump] = useState<{ expected: number; got: number } | null>(null)
  const expected = useRef<number | null>(null)

  const read = useCallback(async (): Promise<{ id: string | null; value: number }> => {
    const rows = await backend.list(config.ns, KIND)
    const row = rows[0]
    return { id: row?.id ?? null, value: Number(row?.data.value ?? 0) }
  }, [config.ns])

  const show = useCallback(
    (v: number, op: string) => {
      setValue(v)
      const exp = expected.current
      const jumped = exp !== null && exp !== v
      setJump(jumped ? { expected: exp as number, got: v } : null)
      merge({ counter: v, ns: config.ns, lastOp: op, jumped, expected: exp })
      expected.current = v
    },
    [config.ns, merge],
  )

  useAfterMount(() => {
    merge({ ns: config.ns, backend: backendMode })
    void read().then((r) => show(r.value, 'load'))
  })
  useResetListener(
    config.ns,
    useCallback(() => {
      expected.current = null
      setValue(0)
      merge({ counter: 0, lastOp: 'reset-broadcast' })
    }, [merge]),
  )

  const increment = async () => {
    // Read-modify-write on purpose: two runs incrementing at once can lose an update.
    const cur = await read()
    if (expected.current !== null && cur.value !== expected.current) {
      setJump({ expected: expected.current, got: cur.value })
      merge({ jumped: true, expected: expected.current, observedBeforeIncrement: cur.value })
    }
    const next = cur.value + 1
    if (cur.id) await backend.update(config.ns, KIND, cur.id, { value: next })
    else await backend.create(config.ns, KIND, { value: next })
    expected.current = next
    setValue(next)
    merge({ counter: next, lastOp: 'increment' })
  }

  return (
    <>
      <Card title="Shared counter">
        <p>
          Namespace: <code data-testid="ns">{config.ns}</code>{' '}
          {config.ns === 'default' ? <strong>(shared with every run that does not set ?ns=)</strong> : null}
        </p>
        <p>
          Counter value: <strong aria-label="Counter value" data-testid="counter-value">{value ?? '…'}</strong>
        </p>
        {jump ? (
          <p role="alert" data-ui="error" data-testid="jump-warning">
            The value changed outside this tab: expected {jump.expected}, found {jump.got}. Another run is using namespace “{config.ns}”.
          </p>
        ) : null}
        <div data-ui="inline">
          <button data-variant="primary" id={t.id(t.v('increment', 'counter-plus'))} className={t.cls('par__inc')} onClick={increment}>
            {t.v('Increment', 'Add one')}
          </button>
          <button id={t.id('read')} onClick={async () => show((await read()).value, 'read')}>
            {t.v('Read', 'Refresh value')}
          </button>
          <button
            id={t.id('reset-counter')}
            onClick={async () => {
              for (const r of await backend.list(config.ns, KIND)) await backend.remove(config.ns, KIND, r.id)
              expected.current = 0
              setValue(0)
              setJump(null)
              merge({ counter: 0, lastOp: 'reset', jumped: false })
              toast('Counter reset')
            }}
          >
            Reset counter
          </button>
        </div>
      </Card>
      <Card title="Why namespaces">
        <ul>
          <li>Every record, inbox message and saved page state is stored per namespace (the <code>ns</code> URL parameter).</li>
          <li>
            Runs without <code>?ns=</code> all use <code>default</code>. Two parallel runs then read and write the same counter, so values jump and assertions fail at random.
          </li>
          <li>
            Give each run its own namespace, e.g. <code>?ns=run-42</code>, and reset it at the start of the run from the Reset page.
          </li>
          <li>Try it: open this page in two tabs with the same namespace, increment in one, then read in the other.</li>
        </ul>
        <p data-ui="hint">Storage: {backendMode === 'remote' ? 'server records (shared across machines)' : 'local mode – shared between tabs of this browser only'}.</p>
      </Card>
    </>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card } from '../../components/ui'
import { backend } from '../../core/backend'
import { nowMs, useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/ui/survey',
  title: 'Customer survey',
  group: 'General UI',
  summary:
    'A survey with single and multiple choice, an accessible star rating, a 0–10 recommendation scale, an agreement matrix, conditional follow-up questions and a countdown. Submitting shows a computed score. Data-driven target for testdata/survey.csv.',
  order: 13,
  samples: [
    {
      id: 'SV1',
      title: 'Happy path',
      steps: [
        'Navigate to <base>/ui/survey/',
        'Click on "5 stars"',
        'Click on "9"',
        'Click on "Yes"',
        'Enter Great product in the "What do you like most?" field',
        'Click on "Submit"',
        'Verify that the "Score" displays text "96"',
      ],
      expected: 'state.score = 96, state.npsCategory = "Promoter", state.answers.stars = 5, state.answers.nps = 9.',
    },
    {
      id: 'SV2',
      title: 'Branching on No',
      steps: ['Click on "No"', 'Verify that the current page displays text "What should we improve?"', 'Enter Too slow in the "What should we improve?" field'],
      expected: 'state.answers.recommend = "No" and state.answers.improve = "Too slow"; the "What do you like most?" field is not shown.',
    },
    {
      id: 'SV3',
      title: 'Data-driven run from survey.csv',
      steps: [
        'Click on "${stars} stars"',
        'Click on "${nps}"',
        'Click on "${recommend}"',
        'Click on "Submit"',
      ],
      expected: 'Rows happy/neutral/unhappy give scores 96 / 60 / 20 (score = stars × 12 + nps × 4). For 1 star the label is "1 star".',
    },
    {
      id: 'SV4',
      title: 'Required answers',
      steps: ['Click on "Submit"', 'Verify that the current page displays text "Please answer all required questions"'],
      expected: 'state.submitted = false and state.missing lists stars, nps and recommend.',
    },
    {
      id: 'SV5',
      title: 'Timer runs out',
      query: 'timerSec=3',
      steps: ['Wait until the text "Time is up" is present on the current page'],
      expected: 'state.timedOut = true and Submit is disabled.',
    },
  ],
}

const SOURCES = ['Search engine', 'A friend', 'Social media', 'Advertisement']
const FEATURES = ['Dashboards', 'Reports', 'Alerts', 'Integrations', 'Mobile app']
const STATEMENTS = ['The product is easy to use', 'The product is reliable', 'Support answers quickly', 'Pricing is fair', 'I would buy it again']
const LIKERT = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree']

interface Answers {
  source?: string
  features: string[]
  stars?: number
  nps?: number
  likert: Record<string, string>
  recommend?: 'Yes' | 'No'
  improve?: string
  likeMost?: string
}

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

export default function SurveyPage() {
  const t = useTraps('survey')
  const config = useConfig()
  const { state, merge } = usePageState()
  const [params] = useSearchParams()
  const total = Number(params.get('timerSec')) > 0 ? Number(params.get('timerSec')) : 300
  const [answers, setAnswers] = useState<Answers>({ features: [], likert: {} })
  const [missing, setMissing] = useState<string[]>([])
  const [result, setResult] = useState<{ score: number; category: string } | null>(null)
  const startRef = useRef(nowMs(config))
  const [left, setLeft] = useState(total)
  const starRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (result) return
    const h = setInterval(() => {
      const l = Math.max(0, total - Math.floor((nowMs(config) - startRef.current) / 1000))
      setLeft(l)
      if (l === 0) {
        clearInterval(h)
        merge({ timedOut: true })
      }
    }, 250)
    return () => clearInterval(h)
  }, [config, total, result, merge])

  const update = (patch: Partial<Answers>) => {
    const next = { ...answers, ...patch }
    if (next.recommend === 'Yes') delete next.improve
    if (next.recommend === 'No') delete next.likeMost
    setAnswers(next)
    merge({ answers: next })
  }

  const timedOut = left === 0
  const submit = async () => {
    const miss = [answers.stars ? null : 'stars', answers.nps === undefined ? 'nps' : null, answers.recommend ? null : 'recommend'].filter(Boolean) as string[]
    setMissing(miss)
    if (miss.length) {
      merge({ submitted: false, missing: miss })
      return
    }
    const score = (answers.stars ?? 0) * 12 + (answers.nps ?? 0) * 4
    const category = (answers.nps ?? 0) >= 9 ? 'Promoter' : (answers.nps ?? 0) >= 7 ? 'Passive' : 'Detractor'
    setResult({ score, category })
    merge({ submitted: true, missing: [], score, npsCategory: category, answers, secondsLeft: left })
    await backend.create(config.ns, 'survey', { ...answers, score, category })
  }

  const starLabel = (n: number) => (n === 1 ? '1 star' : `${n} stars`)
  const onStarKey = (e: React.KeyboardEvent, n: number) => {
    let next = n
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(5, n + 1)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(1, n - 1)
    else if (e.key === 'Home') next = 1
    else if (e.key === 'End') next = 5
    else if (e.key === ' ' || e.key === 'Enter') next = n
    else return
    e.preventDefault()
    update({ stars: next })
    starRefs.current[next - 1]?.focus()
  }

  if (result)
    return (
      <Card title="Results" data-testid="survey-results">
        <p>Thank you for your feedback.</p>
        <p>
          Score: <output aria-label="Score" data-testid="survey-score">{result.score}</output> / 100
        </p>
        <p data-testid="survey-category">Category: {result.category}</p>
        <button
          id={t.id('start-over')}
          className={t.cls('btn btn--restart')}
          onClick={() => {
            setResult(null)
            setAnswers({ features: [], likert: {} })
            startRef.current = nowMs(config)
            setLeft(total)
            merge({ submitted: false, score: null, answers: { features: [], likert: {} }, restarted: true })
          }}
        >
          Start over
        </button>
      </Card>
    )

  return (
    <>
      <div data-ui="card" role="timer" aria-label="Time left" data-tone={left < 60 ? 'warning' : undefined} data-testid="survey-timer">
        {timedOut ? <strong>Time is up</strong> : <>Time left: {fmt(left)}</>}
      </div>

      <Card title="About you">
        <fieldset>
          <legend>How did you hear about us?</legend>
          {t.v(SOURCES, [...SOURCES].reverse()).map((s) => (
            <label key={s} style={{ display: 'block' }}>
              <input type="radio" name={t.v('source', 'heard-from')} value={s} checked={answers.source === s} onChange={() => update({ source: s })} /> {s}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Which features do you use?</legend>
          {FEATURES.map((f) => (
            <label key={f} style={{ display: 'block' }}>
              <input
                type="checkbox"
                id={t.id(`feature-${f.replace(/\s+/g, '-').toLowerCase()}`)}
                checked={answers.features.includes(f)}
                onChange={(e) => update({ features: e.target.checked ? [...answers.features, f] : answers.features.filter((x) => x !== f) })}
              />{' '}
              {f}
            </label>
          ))}
        </fieldset>
      </Card>

      <Card title="Rating">
        <div id="stars-label">Rate your experience *</div>
        <div role="radiogroup" aria-labelledby="stars-label" data-testid="star-rating" style={{ display: 'flex', gap: 4, fontSize: 28 }}>
          {[1, 2, 3, 4, 5].map((n) => {
            const checked = answers.stars === n
            const focusable = answers.stars ? checked : n === 1
            return (
              <div
                key={n}
                ref={(el) => {
                  starRefs.current[n - 1] = el
                }}
                role="radio"
                aria-checked={checked}
                aria-label={starLabel(n)}
                title={starLabel(n)}
                tabIndex={focusable ? 0 : -1}
                id={t.id(`star-${n}`)}
                className={t.cls('star')}
                style={{ cursor: 'pointer', color: (answers.stars ?? 0) >= n ? '#f5a623' : 'rgba(127,127,127,.5)' }}
                onClick={() => update({ stars: n })}
                onKeyDown={(e) => onStarKey(e, n)}
              >
                <span aria-hidden="true">★</span>
                <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{starLabel(n)}</span>
              </div>
            )
          })}
        </div>
        {missing.includes('stars') ? <span data-ui="error">Choose a rating</span> : null}

        <fieldset style={{ marginTop: 12 }}>
          <legend>How likely are you to recommend us to a friend? (0–10) *</legend>
          <div data-ui="inline" data-testid="nps-scale">
            {Array.from({ length: 11 }, (_, i) => (
              <label key={i} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                <input type="radio" name="nps" id={t.id(`nps-${i}`)} value={i} checked={answers.nps === i} onChange={() => update({ nps: i })} />
                {i}
              </label>
            ))}
          </div>
          {missing.includes('nps') ? <span data-ui="error">Choose a score</span> : null}
        </fieldset>
      </Card>

      <Card title="Agreement">
        <table data-testid="likert-matrix">
          <thead>
            <tr>
              <th scope="col">Statement</th>
              {LIKERT.map((o) => (
                <th scope="col" key={o}>
                  {o}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STATEMENTS.map((s, si) => (
              <tr key={s}>
                <th scope="row" style={{ textAlign: 'left' }}>
                  {s}
                </th>
                {LIKERT.map((o) => (
                  <td key={o} style={{ textAlign: 'center' }}>
                    <input
                      type="radio"
                      name={`likert-${si}`}
                      aria-label={`${s}: ${o}`}
                      checked={answers.likert[s] === o}
                      onChange={() => update({ likert: { ...answers.likert, [s]: o } })}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Follow-up">
        <fieldset>
          <legend>Would you recommend us? *</legend>
          {(['Yes', 'No'] as const).map((v) => (
            <label key={v} style={{ marginRight: 16 }}>
              <input type="radio" name="recommend" id={t.id(`recommend-${v.toLowerCase()}`)} checked={answers.recommend === v} onChange={() => update({ recommend: v })} /> {v}
            </label>
          ))}
          {missing.includes('recommend') ? <span data-ui="error"> Choose Yes or No</span> : null}
        </fieldset>
        {answers.recommend === 'No' ? (
          <label data-ui="field">
            <span>{t.v('What should we improve?', 'What could we do better?')}</span>
            <textarea id={t.id('improve')} rows={3} value={answers.improve ?? ''} onChange={(e) => update({ improve: e.target.value })} />
          </label>
        ) : null}
        {answers.recommend === 'Yes' ? (
          <label data-ui="field">
            <span>What do you like most?</span>
            <textarea id={t.id('like-most')} rows={3} value={answers.likeMost ?? ''} onChange={(e) => update({ likeMost: e.target.value })} />
          </label>
        ) : null}
      </Card>

      {missing.length ? (
        <div data-ui="error" role="alert" data-testid="survey-missing">
          Please answer all required questions
        </div>
      ) : null}
      <button
        id={t.id(t.v('submit-survey', 'send-survey'))}
        className={t.cls('btn btn--submit')}
        data-variant="primary"
        data-testid="submit-survey"
        disabled={timedOut}
        onClick={() => void submit()}
      >
        {t.v('Submit', 'Submit survey')}
      </button>
      {t.dup ? (
        <button className={t.cls('btn btn--decoy')} style={{ opacity: 0.6, marginLeft: 8 }} onClick={() => merge({ decoy: 'Submit' })}>
          {t.v('Submit', 'Submit survey')}
        </button>
      ) : null}
      {state.timedOut ? <p data-ui="hint">The survey closed because the timer ran out.</p> : null}
    </>
  )
}

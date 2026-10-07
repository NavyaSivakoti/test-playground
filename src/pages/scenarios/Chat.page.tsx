import { useEffect, useRef, useState } from 'react'
import { Card } from '../../components/ui'
import { useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { randFor } from '../../core/rng'
import { useMountMerge } from './advanced/util'

export const meta: PageMeta = {
  path: '/chat',
  title: 'Chat assistant',
  group: 'Scenarios',
  summary:
    'A chat assistant whose replies stream word by word and vary in wording by seed and message count, while always containing the same verifiable facts. The assistant can end the conversation.',
  order: 23,
  samples: [
    {
      id: 'CH1',
      title: 'Order status fact',
      steps: [
        'Navigate to <base>/chat/',
        'Enter What is my order status? in the "Type a message" field',
        'Click on "Send"',
        'Wait until the text "15 December 2026" is present on the current page',
        'Verify that the current page displays text "Shipped"',
      ],
      expected: 'state.messages[1].role = "assistant" and contains "Shipped" and "15 December 2026"; wording differs per seed.',
    },
    {
      id: 'CH2',
      title: 'Refund fact',
      steps: ['Enter How do refunds work? in the "Type a message" field', 'Press Enter/Return Key', 'Wait until the text "5 business days" is present on the current page'],
      expected: 'The last assistant message contains "5 business days" (exact wording varies).',
    },
    {
      id: 'CH3',
      title: 'Mode chips',
      steps: ['Click on "Detailed"', 'Enter order status in the "Type a message" field', 'Click on "Send"'],
      expected: 'state.mode = "detailed"; the reply has an extra sentence about the tracking number TRK-5521.',
    },
    {
      id: 'CH4',
      title: 'Conversation ends',
      steps: ['Enter bye in the "Type a message" field', 'Click on "Send"', 'Wait until the text "This conversation has ended" is present on the current page', 'Verify that the "Type a message" is disabled or not clickable.'],
      expected: 'state.ended = true, state.endedReason = "user said bye"; "New chat" re-enables the input.',
    },
    {
      id: 'CH5',
      title: 'AI verification of a varying reply',
      query: 'seed=5',
      steps: ['Enter order status in the "Type a message" field', 'Click on "Send"', 'AI Verification: the assistant says the order has shipped and gives an arrival date'],
      expected: 'Passes for every seed even though the wording changes.',
    },
  ],
}

type Mode = 'concise' | 'detailed' | 'friendly'
interface Msg {
  role: 'user' | 'assistant' | 'system'
  text: string
}
const MAX_USER_MESSAGES = 8

const PHRASES: Record<string, string[]> = {
  order: [
    'Your order has Shipped and should arrive on 15 December 2026.',
    'Good news: the order status is Shipped. Expected delivery is 15 December 2026.',
    'I checked it: Shipped, arriving 15 December 2026.',
    'The parcel left our warehouse (status: Shipped) and is due on 15 December 2026.',
  ],
  refund: [
    'Refunds are paid back to the original payment method within 5 business days.',
    'Once we receive the item, you get your money back in 5 business days.',
    'A refund takes 5 business days to appear after approval.',
  ],
  hours: ['Support is open Monday to Friday, 9:00 to 17:00.', 'You can reach us 9:00 to 17:00 on weekdays.'],
  hello: ['Hello! How can I help you today?', 'Hi there, what can I do for you?', 'Hello, I am the store assistant. Ask me anything.'],
  bye: ['Thanks for chatting. Goodbye!', 'Glad I could help. Bye for now!'],
  fallback: [
    'I can help with order status, refunds and opening hours.',
    'Sorry, I did not catch that. Try asking about your order status, a refund or our opening hours.',
  ],
}
const DETAIL: Record<string, string> = {
  order: ' Your tracking number is TRK-5521.',
  refund: ' You will receive a confirmation email when it is issued.',
  hours: ' Messages sent outside these hours are answered the next working day.',
}

function intentOf(text: string): string {
  const s = text.toLowerCase()
  if (/\b(bye|goodbye)\b/.test(s)) return 'bye'
  if (/order|status|track|deliver/.test(s)) return 'order'
  if (/refund|money back|return/.test(s)) return 'refund'
  if (/hour|open/.test(s)) return 'hours'
  if (/^(hi|hello|hey)\b/.test(s)) return 'hello'
  return 'fallback'
}

function replyFor(seed: number, userCount: number, text: string, mode: Mode): { intent: string; reply: string } {
  const intent = intentOf(text)
  const list = PHRASES[intent]
  let reply = list[Math.floor(randFor(seed, `chat:${userCount}:${intent}`) * list.length)]
  if (mode === 'detailed' && DETAIL[intent]) reply += DETAIL[intent]
  if (mode === 'friendly') reply = `Happy to help! ${reply}`
  if (mode === 'concise') reply = reply.replace(/^Good news: /, '')
  return { intent, reply }
}

export default function ChatPage() {
  const t = useTraps('chat')
  const config = useConfig()
  const { merge } = usePageState()
  const [messages, setMessages] = useState<Msg[]>([])
  const [mode, setMode] = useState<Mode>('concise')
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [streaming, setStreaming] = useState<string | null>(null)
  const [ended, setEnded] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const logRef = useRef<HTMLDivElement>(null)

  useMountMerge(() => ({ messages: [], mode: 'concise', ended: false }))
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEffect(() => {
    logRef.current?.scrollTo?.({ top: logRef.current.scrollHeight })
  }, [messages, streaming])

  const busy = typing || streaming !== null
  const userCount = messages.filter((m) => m.role === 'user').length

  const send = () => {
    const text = input.trim()
    if (!text || ended || busy) return
    const withUser: Msg[] = [...messages, { role: 'user', text }]
    setMessages(withUser)
    setInput('')
    setTyping(true)
    merge({ messages: withUser, streaming: true })
    const { intent, reply } = replyFor(config.seed, userCount + 1, text, mode)
    const words = reply.split(/(?<= )/)
    const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms))
    later(600, () => {
      setTyping(false)
      setStreaming('')
      words.forEach((_, i) => later(i * 45, () => setStreaming(words.slice(0, i + 1).join(''))))
      later(words.length * 45 + 20, () => {
        setStreaming(null)
        const done: Msg[] = [...withUser, { role: 'assistant', text: reply }]
        const end = intent === 'bye' ? 'user said bye' : userCount + 1 >= MAX_USER_MESSAGES ? 'message limit reached' : null
        setMessages(done)
        if (end) setEnded(true)
        merge({ messages: done, streaming: false, lastIntent: intent, ended: !!end, endedReason: end })
      })
    })
  }

  const reset = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setMessages([])
    setTyping(false)
    setStreaming(null)
    setEnded(false)
    setInput('')
    merge({ messages: [], ended: false, endedReason: null, streaming: false, newChats: 1 })
  }

  const chips: [Mode, string][] = t.v(
    [
      ['concise', 'Concise'],
      ['detailed', 'Detailed'],
      ['friendly', 'Friendly'],
    ],
    [
      ['friendly', 'Friendly'],
      ['detailed', 'Detailed'],
      ['concise', 'Concise'],
    ],
  )

  return (
    <Card title="Store assistant" style={{ maxWidth: 720 }}>
      <div data-ui="inline" style={{ justifyContent: 'space-between' }}>
        <div role="group" aria-label="Reply style" data-ui="inline" style={{ gap: '0.3rem' }}>
          {chips.map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              data-variant={mode === m ? 'primary' : undefined}
              style={{ borderRadius: 999, padding: '0.2rem 0.8rem' }}
              onClick={() => {
                setMode(m)
                merge({ mode: m })
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" id={t.id('new-chat')} onClick={reset}>
          {t.v('New chat', 'Start new chat')}
        </button>
      </div>
      <div
        ref={logRef}
        role="log"
        aria-label="Conversation"
        aria-live="polite"
        data-testid="chat-log"
        style={{ height: 340, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem', margin: '0.6rem 0', background: 'var(--surface-2)' }}
      >
        {messages.length === 0 && !busy ? <p data-ui="hint">Ask about your order status, refunds or opening hours.</p> : null}
        {messages.map((m, i) => (
          <div
            key={i}
            data-testid={`msg-${i}`}
            data-role={m.role}
            style={{
              margin: '0.35rem 0',
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <span
              style={{
                background: m.role === 'user' ? 'var(--accent)' : 'var(--surface)',
                color: m.role === 'user' ? 'var(--accent-text)' : 'var(--text)',
                padding: '0.4rem 0.7rem',
                borderRadius: 12,
                maxWidth: '80%',
              }}
            >
              {m.text}
            </span>
          </div>
        ))}
        {streaming !== null ? (
          <div data-testid="streaming" style={{ margin: '0.35rem 0' }}>
            <span style={{ background: 'var(--surface)', padding: '0.4rem 0.7rem', borderRadius: 12 }}>{streaming}▍</span>
          </div>
        ) : null}
        {typing ? (
          <div data-testid="typing-indicator" data-ui="hint" aria-label="Assistant is typing">
            Assistant is typing…
          </div>
        ) : null}
        {ended ? (
          <p data-testid="chat-ended" style={{ textAlign: 'center', fontWeight: 600 }}>
            This conversation has ended
          </p>
        ) : null}
      </div>
      <form
        data-ui="inline"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <input
          id={t.id('chat-input')}
          aria-label={t.v('Type a message', 'Your message')}
          placeholder={t.v('Type a message', 'Ask me anything')}
          style={{ flex: 1, minWidth: 200 }}
          value={input}
          disabled={ended}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" data-variant="primary" id={t.id('send')} disabled={ended || busy}>
          {t.v('Send', 'Send message')}
        </button>
      </form>
      <p data-ui="hint">
        Messages sent: {userCount} of {MAX_USER_MESSAGES}. Replies are generated locally; their wording depends on the seed.
      </p>
    </Card>
  )
}

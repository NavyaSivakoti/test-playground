# Chat assistant (/chat)

Purpose: a conversational UI whose replies stream in word by word and change wording by seed and message count, while always containing a verifiable fact. Good for AI verification steps and waits.

## User stories
- As a customer I ask about my order status, refunds or opening hours and get an answer.
- As a customer I pick a reply style (Concise, Detailed, Friendly).
- As a customer I end the conversation by saying bye, and start a new chat.

## Acceptance criteria
- Given I send "order status", then a typing indicator appears, the reply streams in, and it contains "Shipped" and "15 December 2026" (state.messages[1]).
- Given I send a refund question, then the reply contains "5 business days".
- Given "Detailed" is selected, then order replies also mention tracking number TRK-5521 (state.mode = "detailed").
- The same seed and message count always produce the same wording; different seeds may produce different wording.
- When I send "bye", or after 8 user messages, then "This conversation has ended" is shown, the input and "Send" are disabled, state.ended = true and state.endedReason explains why.
- "New chat" clears messages and re-enables the input.

## Trap params
seed (wording), variant=b ("Send message", "Start new chat", "Your message" / "Ask me anything", reversed chips), unstableIds, unstableClasses.

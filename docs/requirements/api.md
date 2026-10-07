# REST API explorer (`/api`)

**Purpose:** documents the playground API and lets testers call it from the browser; the OpenAPI spec feeds API test generation.

## User stories
- As a tester I see every endpoint with its purpose and the API base URL.
- As a tester I build a request (method, path, Authorization, JSON body), send it and see status, time and body.
- As a tester I copy the request as a cURL command.

## Acceptance criteria
- The page shows the API base, or "Backend not configured – showing local simulation" in local mode.
- "Try <METHOD> <path>" fills the builder for that endpoint.
- "Send request" calls the backend when configured, otherwise an in-browser simulation of the same endpoints; the response shows status, time and body (state.lastRequest, state.lastResponse, state.requests).
- POST /auth/login with a seeded account returns a token; GET /me with "Bearer <token>" returns that user; GET /status/500 returns 500; GET /basic needs Basic tester/playground.
- "Copy as cURL" copies and records the command (state.curl).
- `<base>openapi.json` is a valid OpenAPI 3 document describing all endpoints with schemas and examples.

## Trap params
`variant=b` ("Send", new ids), `unstableIds`, `unstableClasses`, `ns` (presets use it).

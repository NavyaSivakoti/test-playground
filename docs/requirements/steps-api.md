# REST API and database checks

Route: `/steps/api/`

## Purpose
Baseline for REST API steps, API value extraction and database verification against the playground server and Postgres.

## User stories
- As a tester I want to call the records API and store the first id.
- As a tester I want to verify a known database row.

## Acceptance criteria
- Given records exist for the namespace, when GET {api}/records?ns=<ns>&kind=demo, then 200 with a JSON array; state.firstId is the first id.
- Given the page is open, when I choose "GET customers/1" and click "Send request", then state.lastResponse.body.name = "Ada Lovelace".
- Given a DB connection is configured, when SELECT name FROM public.customers WHERE id=1, then returns "Ada Lovelace".
- Given bugs=api500, when I click "Send request", then "Status 500" and state.lastResponse.status = 500.

## Trap parameters
Local mode: "Backend not configured – showing local simulation". variant=b (send id, card title, wrapper), unstableIds, unstableClasses, bugs=api500.

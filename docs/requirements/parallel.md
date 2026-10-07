# Parallel runs and namespaces (`/parallel`)

**Purpose:** demonstrates why parallel runs need their own namespace.

## User stories
- As a tester running suites in parallel I see that runs without `?ns=` share data and collide.
- As a tester I isolate my run with a unique namespace.

## Acceptance criteria
- The counter is stored as a backend record per namespace (state.ns, state.counter).
- "Increment" reads, adds one and writes (read-modify-write); "Read" shows the stored value; "Reset counter" sets it to 0.
- Given two tabs/runs on the same namespace, when one increments and the other reads, then the other shows a warning and state.jumped = true with state.expected ≠ state.counter.
- Given different namespaces, counters are independent.

## Trap params
`ns` (the subject of the page), `variant=b` ("Add one", "Refresh value"), `unstableIds`, `unstableClasses`.

// Public test accounts for the playground (not secrets). Mirrored in the backend seed.
export const TEST_PASSWORD = 'Playground!1'
export const USERS = [
  { email: 'admin@example.com', name: 'Ada Admin', role: 'admin' },
  { email: 'approver@example.com', name: 'Grace Approver', role: 'approver' },
  { email: 'viewer@example.com', name: 'Alan Viewer', role: 'viewer' },
] as const
export type Role = (typeof USERS)[number]['role']

export const CUSTOMERS = [
  { id: 1, name: 'Ada Lovelace', email: 'ada@example.com', plan: 'enterprise', country: 'uk' },
  { id: 2, name: 'Grace Hopper', email: 'grace@example.com', plan: 'professional', country: 'us' },
  { id: 3, name: 'Alan Turing', email: 'alan@example.com', plan: 'starter', country: 'uk' },
  { id: 4, name: 'Katherine Johnson', email: 'katherine@example.com', plan: 'professional', country: 'us' },
  { id: 5, name: 'Margaret Hamilton', email: 'margaret@example.com', plan: 'enterprise', country: 'us' },
]

// Deterministic randomness. Everything "random" in the playground goes through here so that
// the same seed always produces the same DOM, timings and data.

export function hashString(input: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A stable random number in [0,1) for a given seed + key. */
export function randFor(seed: number, key: string): number {
  return mulberry32(hashString(`${seed}:${key}`))()
}

/** A stable short token (base36) for a given seed + key. */
export function tokenFor(seed: number, key: string, length = 6): string {
  const r = mulberry32(hashString(`${seed}:${key}`))
  let out = ''
  while (out.length < length) out += Math.floor(r() * 36).toString(36)
  return out
}

/** A stable UUID-looking string for a given seed + key. */
export function uuidFor(seed: number, key: string): string {
  const t = tokenFor(seed, key, 32).replace(/[g-z]/g, (c) => ((c.charCodeAt(0) - 103) % 16).toString(16))
  return `${t.slice(0, 8)}-${t.slice(8, 12)}-4${t.slice(13, 16)}-a${t.slice(17, 20)}-${t.slice(20, 32)}`
}

/** Seeded Fisher–Yates shuffle (returns a new array). */
export function shuffled<T>(items: readonly T[], seed: number, key: string): T[] {
  const r = mulberry32(hashString(`${seed}:shuffle:${key}`))
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

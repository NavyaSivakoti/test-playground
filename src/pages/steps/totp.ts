// RFC 6238 TOTP (HMAC-SHA1, 30 s step, 6 digits) using WebCrypto.
export function base32Decode(input: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch)
    if (idx < 0) throw new Error(`invalid base32 character ${ch}`)
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

export async function hotp(secret: Uint8Array, counter: number, digits = 6): Promise<string> {
  const msg = new Uint8Array(8)
  let c = counter
  for (let i = 7; i >= 0; i--) {
    msg[i] = c & 0xff
    c = Math.floor(c / 256)
  }
  const key = await crypto.subtle.importKey('raw', secret as BufferSource, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg))
  const off = mac[mac.length - 1] & 0x0f
  const bin = ((mac[off] & 0x7f) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3]
  return String(bin % 10 ** digits).padStart(digits, '0')
}

export async function totp(secretB32: string, timeMs: number, step = 30, digits = 6): Promise<string> {
  return hotp(base32Decode(secretB32), Math.floor(timeMs / 1000 / step), digits)
}

/** true when `code` matches the current step or one step either side. */
export async function verifyTotp(secretB32: string, code: string, timeMs: number, window = 1): Promise<boolean> {
  const key = base32Decode(secretB32)
  const counter = Math.floor(timeMs / 1000 / 30)
  for (let d = -window; d <= window; d++) if ((await hotp(key, counter + d)) === code.trim()) return true
  return false
}

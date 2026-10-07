// Minimal XLSX reader: a tiny ZIP reader (stored + deflate entries via DecompressionStream('deflate-raw'))
// plus a first-sheet parser that understands shared strings, inline strings and numbers.

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Reads the named entries of a ZIP archive. Missing entries are absent from the result. */
export async function readZipEntries(buf: ArrayBuffer, wanted: string[]): Promise<Record<string, string>> {
  const bytes = new Uint8Array(buf)
  const dv = new DataView(buf)
  // End of central directory record: scan backwards for 0x06054b50.
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('Not a ZIP file (no end of central directory)')
  const count = dv.getUint16(eocd + 10, true)
  let p = dv.getUint32(eocd + 16, true)
  const out: Record<string, string> = {}
  const dec = new TextDecoder()
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Corrupt central directory')
    const method = dv.getUint16(p + 10, true)
    const compSize = dv.getUint32(p + 20, true)
    const nameLen = dv.getUint16(p + 28, true)
    const extraLen = dv.getUint16(p + 30, true)
    const commentLen = dv.getUint16(p + 32, true)
    const localOffset = dv.getUint32(p + 42, true)
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen))
    p += 46 + nameLen + extraLen + commentLen
    if (!wanted.includes(name)) continue
    const lNameLen = dv.getUint16(localOffset + 26, true)
    const lExtraLen = dv.getUint16(localOffset + 28, true)
    const start = localOffset + 30 + lNameLen + lExtraLen
    const raw = bytes.subarray(start, start + compSize)
    if (method === 0) out[name] = dec.decode(raw)
    else if (method === 8) out[name] = dec.decode(await inflateRaw(raw))
    else throw new Error(`Unsupported ZIP method ${method} for ${name}`)
  }
  return out
}

const colIndex = (ref: string) => {
  const letters = ref.replace(/\d+/g, '')
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

/** Returns the first worksheet as rows of cell values (strings or numbers). */
export async function readFirstSheet(buf: ArrayBuffer): Promise<(string | number)[][]> {
  const files = await readZipEntries(buf, ['xl/sharedStrings.xml', 'xl/worksheets/sheet1.xml'])
  const sheetXml = files['xl/worksheets/sheet1.xml']
  if (!sheetXml) throw new Error('No worksheet found (xl/worksheets/sheet1.xml)')
  const parser = new DOMParser()
  const shared: string[] = []
  if (files['xl/sharedStrings.xml']) {
    const sdoc = parser.parseFromString(files['xl/sharedStrings.xml'], 'application/xml')
    for (const si of Array.from(sdoc.getElementsByTagName('si'))) {
      shared.push(Array.from(si.getElementsByTagName('t')).map((t) => t.textContent ?? '').join(''))
    }
  }
  const doc = parser.parseFromString(sheetXml, 'application/xml')
  const rows: (string | number)[][] = []
  for (const row of Array.from(doc.getElementsByTagName('row'))) {
    const cells: (string | number)[] = []
    for (const c of Array.from(row.getElementsByTagName('c'))) {
      const idx = colIndex(c.getAttribute('r') ?? 'A1')
      const type = c.getAttribute('t')
      const v = c.getElementsByTagName('v')[0]?.textContent ?? ''
      let value: string | number
      if (type === 'inlineStr') value = Array.from(c.getElementsByTagName('t')).map((t) => t.textContent ?? '').join('')
      else if (type === 's') value = shared[Number(v)] ?? ''
      else if (type === 'str' || type === 'b') value = v
      else value = v === '' ? '' : Number(v)
      cells[idx] = value
    }
    rows.push(Array.from(cells, (x) => x ?? ''))
  }
  return rows
}

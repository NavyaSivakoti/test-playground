// Cross-tab / cross-frame reset. Pages (and same-origin frames) that keep in-memory state call
// useResetListener; the reset page broadcasts and counts acknowledgements.
import { useEffect } from 'react'

const CHANNEL = 'tp-reset'

export function useResetListener(ns: string, onReset: () => void) {
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const ch = new BroadcastChannel(CHANNEL)
    ch.onmessage = (e: MessageEvent<{ type: string; ns: string }>) => {
      if (e.data?.type === 'reset' && (e.data.ns === ns || e.data.ns === '*')) {
        onReset()
        ch.postMessage({ type: 'ack', ns })
      }
    }
    return () => ch.close()
  }, [ns, onReset])
}

/** Broadcasts a reset and resolves with the number of frames/tabs that acknowledged within `waitMs`. */
export function broadcastReset(ns: string, waitMs = 600): Promise<number> {
  if (typeof BroadcastChannel === 'undefined') return Promise.resolve(0)
  return new Promise((resolve) => {
    const ch = new BroadcastChannel(CHANNEL)
    let acks = 0
    ch.onmessage = (e: MessageEvent<{ type: string }>) => {
      if (e.data?.type === 'ack') acks++
    }
    ch.postMessage({ type: 'reset', ns })
    setTimeout(() => {
      ch.close()
      resolve(acks)
    }, waitMs)
  })
}

/** Removes cookies, localStorage, sessionStorage and IndexedDB entries that belong to a namespace. */
export async function clearBrowserStorage(ns: string): Promise<number> {
  let keys = 0
  const prefixes = [`${ns}_`, `tp:${ns}:`, `tp:srv:${ns}:`]
  const match = (k: string) => prefixes.some((p) => k.startsWith(p))
  for (const store of [localStorage, sessionStorage]) {
    for (const k of Object.keys(store)) {
      if (match(k)) {
        store.removeItem(k)
        keys++
      }
    }
  }
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim()
    if (name && match(name)) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${import.meta.env.BASE_URL}`
      keys++
    }
  }
  const idb = indexedDB as IDBFactory & { databases?: () => Promise<{ name?: string }[]> }
  if (idb.databases) {
    for (const db of await idb.databases()) {
      if (db.name && match(db.name)) {
        indexedDB.deleteDatabase(db.name)
        keys++
      }
    }
  }
  return keys
}

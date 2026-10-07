// Helpers for the General UI part-2 pages (Feedback, Browser, Settings, Survey, Dashboard, Checkout, Misc).
import { useEffect } from 'react'
import { usePageState } from '../../core/playground'

/**
 * Mirrors derived values into the observable state whenever they change (including on mount).
 */
export function useSyncedState(patch: Record<string, unknown>) {
  const { merge } = usePageState()
  const json = JSON.stringify(patch)
  useEffect(() => {
    merge(JSON.parse(json) as Record<string, unknown>)
  }, [json, merge])
}

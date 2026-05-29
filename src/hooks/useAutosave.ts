import { useCallback, useEffect, useRef, useState } from 'react'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'locked'

type Pending = { home: number; away: number; timer: ReturnType<typeof setTimeout> }

export function useAutosave(
  quinielaId: string,
  onSave?: (matchId: string, home: number, away: number) => void,
) {
  const [statusMap, setStatusMap] = useState<Record<string, SaveStatus>>({})
  const pending = useRef<Record<string, Pending>>({})

  // Centralised "actually fire the request". Used by both the debounced save
  // and by flushAll on unmount / navigation. sendBeacon is used for the
  // navigation case so the browser doesn't cancel the request mid-flight.
  const fire = useCallback(
    async (matchId: string, home: number, away: number, useBeacon: boolean) => {
      const url = `/api/quinielas/${quinielaId}/predictions/upsert`
      const body = JSON.stringify({
        matchId,
        predictedHomeGoals: home,
        predictedAwayGoals: away,
      })

      if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        // Beacon is fire-and-forget but guarantees the request goes out even
        // mid-navigation. Server reads it like any other POST.
        const blob = new Blob([body], { type: 'application/json' })
        navigator.sendBeacon(url, blob)
        return
      }

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true, // also helps if the tab is closing
        })
        const data = await res.json()
        if (!res.ok) {
          if (data.error === 'El partido ya está bloqueado.') {
            setStatusMap((prev) => ({ ...prev, [matchId]: 'locked' }))
          } else {
            setStatusMap((prev) => ({ ...prev, [matchId]: 'error' }))
          }
          return
        }
        setStatusMap((prev) => ({ ...prev, [matchId]: 'saved' }))
        onSave?.(matchId, home, away)
      } catch {
        setStatusMap((prev) => ({ ...prev, [matchId]: 'error' }))
      }
    },
    [quinielaId, onSave],
  )

  const save = useCallback(
    (matchId: string, homeGoals: number, awayGoals: number) => {
      const existing = pending.current[matchId]
      if (existing) clearTimeout(existing.timer)

      setStatusMap((prev) => ({ ...prev, [matchId]: 'saving' }))

      const timer = setTimeout(() => {
        delete pending.current[matchId]
        fire(matchId, homeGoals, awayGoals, false)
      }, 600)

      pending.current[matchId] = { home: homeGoals, away: awayGoals, timer }
    },
    [fire],
  )

  // Force any pending writes to flush right now (used by parent on blur).
  const flush = useCallback(
    (matchId: string) => {
      const p = pending.current[matchId]
      if (!p) return
      clearTimeout(p.timer)
      delete pending.current[matchId]
      fire(matchId, p.home, p.away, false)
    },
    [fire],
  )

  // On unmount or page hide, flush every pending write via sendBeacon so
  // navigating to another tab doesn't drop in-flight predictions.
  useEffect(() => {
    const flushAll = (useBeacon: boolean) => {
      const entries = Object.entries(pending.current)
      pending.current = {}
      for (const [matchId, p] of entries) {
        clearTimeout(p.timer)
        fire(matchId, p.home, p.away, useBeacon)
      }
    }
    const onPageHide = () => flushAll(true)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onPageHide)
      flushAll(true) // unmount (e.g. client-side navigation to another route)
    }
  }, [fire])

  return { save, flush, statusMap }
}

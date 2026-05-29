import { useCallback, useEffect, useRef, useState } from 'react'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'locked'

type Pending = { home: number; away: number; timer: ReturnType<typeof setTimeout> }

export function useAutosave(
  quinielaId: string,
  onSave?: (matchId: string, home: number, away: number) => void,
) {
  const [statusMap, setStatusMap] = useState<Record<string, SaveStatus>>({})
  const [inFlight, setInFlight] = useState(0)
  const pending = useRef<Record<string, Pending>>({})

  // Stable refs — let us read the latest props inside callbacks WITHOUT
  // listing them as deps (which would re-create useCallback every render
  // when the parent passes an inline onSave).
  const quinielaIdRef = useRef(quinielaId)
  const onSaveRef = useRef(onSave)
  useEffect(() => { quinielaIdRef.current = quinielaId }, [quinielaId])
  useEffect(() => { onSaveRef.current = onSave }, [onSave])

  const fire = useCallback(
    async (matchId: string, home: number, away: number, useBeacon: boolean) => {
      const url = `/api/quinielas/${quinielaIdRef.current}/predictions/upsert`
      const body = JSON.stringify({
        matchId,
        predictedHomeGoals: home,
        predictedAwayGoals: away,
      })

      if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' })
        navigator.sendBeacon(url, blob)
        // Beacon is fire-and-forget — we'll never know if it succeeded, so
        // optimistically clear the saving status; otherwise the spinner
        // would stay pinned forever after a tab switch.
        setStatusMap((prev) => ({ ...prev, [matchId]: 'saved' }))
        return
      }

      setInFlight((n) => n + 1)
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (data?.error === 'El partido ya está bloqueado.') {
            setStatusMap((prev) => ({ ...prev, [matchId]: 'locked' }))
          } else {
            setStatusMap((prev) => ({ ...prev, [matchId]: 'error' }))
          }
          return
        }
        setStatusMap((prev) => ({ ...prev, [matchId]: 'saved' }))
        onSaveRef.current?.(matchId, home, away)
      } catch {
        setStatusMap((prev) => ({ ...prev, [matchId]: 'error' }))
      } finally {
        setInFlight((n) => Math.max(0, n - 1))
      }
    },
    [], // fire never changes — uses refs for the moving parts.
  )

  const save = useCallback(
    (matchId: string, homeGoals: number, awayGoals: number) => {
      const existing = pending.current[matchId]
      if (existing) clearTimeout(existing.timer)

      setStatusMap((prev) => ({ ...prev, [matchId]: 'saving' }))

      const timer = setTimeout(() => {
        delete pending.current[matchId]
        fire(matchId, homeGoals, awayGoals, false)
      }, 350)

      pending.current[matchId] = { home: homeGoals, away: awayGoals, timer }
    },
    [fire],
  )

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

  // pagehide / beforeunload listeners are armed exactly once. The cleanup
  // never runs flushAll on intermediate re-renders — that used to leak
  // beacons and pin the spinner.
  useEffect(() => {
    const flushAllBeacon = () => {
      const entries = Object.entries(pending.current)
      pending.current = {}
      for (const [matchId, p] of entries) {
        clearTimeout(p.timer)
        fire(matchId, p.home, p.away, true)
      }
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasPending = Object.keys(pending.current).length > 0
      flushAllBeacon()
      if (hasPending) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('pagehide', flushAllBeacon)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('pagehide', flushAllBeacon)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [fire])

  return { save, flush, statusMap, inFlight }
}

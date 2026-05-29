import { useCallback, useEffect, useRef, useState } from 'react'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'locked'

type Pending = { home: number; away: number; timer: ReturnType<typeof setTimeout> }

export function useAutosave(
  quinielaId: string,
  onSave?: (matchId: string, home: number, away: number) => void,
) {
  const [statusMap, setStatusMap] = useState<Record<string, SaveStatus>>({})
  // Number of fetches currently in flight (debounced + sent but not yet
  // resolved). When > 0 the parent shows a spinner overlay AND prevents
  // closing the tab via beforeunload.
  const [inFlight, setInFlight] = useState(0)
  const pending = useRef<Record<string, Pending>>({})

  const fire = useCallback(
    async (matchId: string, home: number, away: number, useBeacon: boolean) => {
      const url = `/api/quinielas/${quinielaId}/predictions/upsert`
      const body = JSON.stringify({
        matchId,
        predictedHomeGoals: home,
        predictedAwayGoals: away,
      })

      if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' })
        navigator.sendBeacon(url, blob)
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
      } finally {
        setInFlight((n) => Math.max(0, n - 1))
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

  // beforeunload prompt is the last line of defence — beacon already covers
  // the data side, but the prompt also lets the user notice they were about
  // to navigate away mid-save.
  useEffect(() => {
    const hasPending = () =>
      Object.keys(pending.current).length > 0 || inFlight > 0

    const flushAll = (useBeacon: boolean) => {
      const entries = Object.entries(pending.current)
      pending.current = {}
      for (const [matchId, p] of entries) {
        clearTimeout(p.timer)
        fire(matchId, p.home, p.away, useBeacon)
      }
    }
    const onPageHide = () => flushAll(true)
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      flushAll(true)
      if (hasPending()) {
        // Most browsers ignore the message string but show a generic prompt.
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onBeforeUnload)
      flushAll(true)
    }
  }, [fire, inFlight])

  return { save, flush, statusMap, inFlight }
}

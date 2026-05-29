/**
 * useLivePredictions — Hybrid real-time data hook (Option C).
 *
 * Strategy:
 *  1. Tries to open an SSE (EventSource) connection to /api/quinielas/:id/live/stream
 *     for instant push updates when admins update live scores.
 *  2. Falls back to polling /api/quinielas/:id/live every 5s if SSE fails
 *     (some networks/proxies block long-lived connections).
 *  3. When document is hidden (tab in background) it pauses to save resources;
 *     resumes on visibility change.
 *
 * Returns the same shape as the polling endpoint so consumers don't care
 * which transport delivered the data.
 */

import { useEffect, useRef, useState, useCallback } from 'react'

export type LiveProfile = {
  userId: string
  userName: string
  isSelf: boolean
  hasPrediction: boolean
  predictedHome: number | null
  predictedAway: number | null
  generatedByBot: boolean
  livePoints: number | null
  liveReason: string | null
  isProvisional: boolean
}

export type LiveMatch = {
  id: string
  status: string
  phase: string
  isStar: boolean
  kickoffAtUtc: string
  homeTeam?: { name: string; fifaCode?: string | null; flagUrl?: string | null } | null
  awayTeam?: { name: string; fifaCode?: string | null; flagUrl?: string | null } | null
  placeholderHomeName?: string | null
  placeholderAwayName?: string | null
  stadium?: { name: string; city?: string | null } | null
  matchday?: { name: string; phase: string } | null
  liveHomeGoals: number | null
  liveAwayGoals: number | null
  officialHomeGoals: number | null
  officialAwayGoals: number | null
  liveUpdatedAt: string | null
  liveSource?: 'NONE' | 'API_AUTO' | 'ADMIN_MANUAL'
  manualOverride?: boolean
  profiles: LiveProfile[]
}

type LiveData = { matches: LiveMatch[] }

type Status = 'connecting' | 'live' | 'polling' | 'paused' | 'error'

export function useLivePredictions(quinielaId: string | null | undefined) {
  const [data, setData] = useState<LiveData | null>(null)
  const [status, setStatus] = useState<Status>('connecting')
  const [updatedAt, setUpdatedAt] = useState<number>(0)
  const esRef = useRef<EventSource | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cleanupSse = useCallback(() => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
  }, [])

  const cleanupPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const fetchOnce = useCallback(async () => {
    if (!quinielaId) return
    try {
      const res = await fetch(`/api/quinielas/${quinielaId}/live`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as LiveData
      setData(json)
      setUpdatedAt(Date.now())
    } catch {
      // ignore transient errors
    }
  }, [quinielaId])

  const startPolling = useCallback(() => {
    cleanupPoll()
    setStatus('polling')
    void fetchOnce()
    // 5s while there are live matches, 30s when only finished/none
    pollRef.current = setInterval(() => {
      if (document.hidden) return
      void fetchOnce()
    }, 5000)
  }, [cleanupPoll, fetchOnce])

  const startSse = useCallback(() => {
    if (!quinielaId) return
    cleanupSse()
    setStatus('connecting')

    let receivedAny = false
    const fallbackTimer = setTimeout(() => {
      if (!receivedAny) {
        // SSE never delivered — fall back to polling
        cleanupSse()
        startPolling()
      }
    }, 4000)

    try {
      const es = new EventSource(`/api/quinielas/${quinielaId}/live/stream`)
      esRef.current = es

      const onPayload = (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data) as LiveData
          receivedAny = true
          setData(parsed)
          setUpdatedAt(Date.now())
          setStatus('live')
        } catch {
          // ignore
        }
      }

      es.addEventListener('snapshot', onPayload as EventListener)
      es.addEventListener('update', onPayload as EventListener)
      es.addEventListener('reconnect', () => {
        cleanupSse()
        // Reconnect silently
        setTimeout(() => startSse(), 500)
      })

      es.onerror = () => {
        clearTimeout(fallbackTimer)
        cleanupSse()
        // Browser will normally retry EventSource itself, but we prefer
        // polling as a deterministic fallback.
        startPolling()
      }
    } catch {
      clearTimeout(fallbackTimer)
      startPolling()
    }
  }, [quinielaId, cleanupSse, startPolling])

  useEffect(() => {
    if (!quinielaId) return
    startSse()

    const onVisibility = () => {
      if (document.hidden) {
        cleanupSse()
        cleanupPoll()
        setStatus('paused')
      } else {
        startSse()
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      cleanupSse()
      cleanupPoll()
    }
  }, [quinielaId, startSse, cleanupSse, cleanupPoll])

  return { data, status, updatedAt, refresh: fetchOnce }
}

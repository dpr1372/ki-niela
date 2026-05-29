import { useCallback, useRef, useState } from 'react'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'locked'

export function useAutosave(
  quinielaId: string,
  onSave?: (matchId: string, home: number, away: number) => void,
) {
  const [statusMap, setStatusMap] = useState<Record<string, SaveStatus>>({})
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const save = useCallback(
    (matchId: string, homeGoals: number, awayGoals: number) => {
      if (timers.current[matchId]) clearTimeout(timers.current[matchId])

      setStatusMap((prev) => ({ ...prev, [matchId]: 'saving' }))

      timers.current[matchId] = setTimeout(async () => {
        try {
          const res = await fetch(`/api/quinielas/${quinielaId}/predictions/upsert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              matchId,
              predictedHomeGoals: homeGoals,
              predictedAwayGoals: awayGoals,
            }),
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
          onSave?.(matchId, homeGoals, awayGoals)
        } catch {
          setStatusMap((prev) => ({ ...prev, [matchId]: 'error' }))
        }
      }, 600)
    },
    [quinielaId, onSave],
  )

  return { save, statusMap }
}

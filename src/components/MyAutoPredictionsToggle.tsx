'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Bot } from 'lucide-react'

type Props = {
  quinielaId: string
  initialEnabled: boolean
  randomPredictionsEnabled: boolean
  randomMinGoals: number
  randomMaxGoals: number
}

export function MyAutoPredictionsToggle({
  quinielaId,
  initialEnabled,
  randomPredictionsEnabled,
  randomMinGoals,
  randomMaxGoals,
}: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [pending, startTransition] = useTransition()

  const onToggle = (next: boolean) => {
    const prev = enabled
    setEnabled(next)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/quinielas/${quinielaId}/me/auto-predictions`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: next }),
        })
        const data = await res.json()
        if (!res.ok) {
          setEnabled(prev)
          toast.error(data.error ?? 'No se pudo actualizar.')
          return
        }
        toast.success(data.message)
      } catch {
        setEnabled(prev)
        toast.error('Error de red.')
      }
    })
  }

  return (
    <div className="card-pitch rounded-xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-blue-50 p-2 mt-0.5">
            <Bot size={20} className="text-blue-700" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">Mis predicciones automáticas</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Si llegas tarde a un partido, el bot pondrá un marcador aleatorio por ti
              (entre {randomMinGoals} y {randomMaxGoals} goles por equipo).
            </p>
            {!randomPredictionsEnabled && (
              <p className="text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1 mt-2 inline-block">
                El admin tiene desactivado el bot a nivel quiniela: aunque actives esto,
                no se generarán predicciones.
              </p>
            )}
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          disabled={pending}
          aria-label="Habilitar mis predicciones automáticas"
        />
      </div>
    </div>
  )
}

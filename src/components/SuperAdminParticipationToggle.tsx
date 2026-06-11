'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Trophy } from 'lucide-react'

type Props = {
  quinielaId: string
  initialParticipating: boolean
}

/**
 * Toggle para que un SUPER_ADMIN decida si compite en el puntaje de la quiniela.
 * Solo se renderiza para super admins (el padre decide). Al cambiar, refresca la
 * página para que posición/puntaje del dashboard reflejen el nuevo estado.
 */
export function SuperAdminParticipationToggle({ quinielaId, initialParticipating }: Props) {
  const [participating, setParticipating] = useState(initialParticipating)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const onToggle = (next: boolean) => {
    const prev = participating
    setParticipating(next)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/quinielas/${quinielaId}/me/participation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participate: next }),
        })
        const data = await res.json()
        if (!res.ok) {
          setParticipating(prev)
          toast.error(data.error ?? 'No se pudo actualizar.')
          return
        }
        toast.success(data.message)
        router.refresh()
      } catch {
        setParticipating(prev)
        toast.error('Error de red.')
      }
    })
  }

  return (
    <div className="card-pitch rounded-xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-amber-50 p-2 mt-0.5">
            <Trophy size={20} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">Participar en el puntaje</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Como administrador no competís por defecto. Activá esto si querés
              registrar pronósticos y aparecer en las posiciones de esta quiniela.
            </p>
          </div>
        </div>
        <Switch
          checked={participating}
          onCheckedChange={onToggle}
          disabled={pending}
          aria-label="Participar en el puntaje de esta quiniela"
        />
      </div>
    </div>
  )
}

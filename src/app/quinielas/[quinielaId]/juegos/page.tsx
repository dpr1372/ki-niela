'use client'

import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import AppShell from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MatchCard, type MatchCardData } from '@/components/quiniela/MatchCard'
import { BallLoader } from '@/components/ui/BallLoader'

type Match = MatchCardData & {
  matchdayId?: string
  wentToExtraTime?: boolean
  kickoffAtUtc: string
}

const liveSchema = z.object({
  liveHomeGoals: z.number().int().min(0),
  liveAwayGoals: z.number().int().min(0),
  status: z.enum(['EN_JUEGO', 'MEDIO_TIEMPO', 'TIEMPO_EXTRA', 'PENALES', 'FINALIZADO']),
})
type LiveForm = z.infer<typeof liveSchema>

const PHASE_TABS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'GROUPS', label: 'Grupos' },
  { key: 'ROUND_OF_32', label: 'Ronda 32' },
  { key: 'ROUND_OF_16', label: 'Octavos' },
  { key: 'QUARTER_FINAL', label: 'Cuartos' },
  { key: 'SEMI_FINAL', label: 'Semis' },
  { key: 'THIRD_PLACE', label: '3° Lugar' },
  { key: 'FINAL', label: 'Final' },
]

function LiveScoreForm({ match, onClose }: { match: Match; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<LiveForm>({
    resolver: zodResolver(liveSchema),
    defaultValues: {
      liveHomeGoals: match.liveHomeGoals ?? 0,
      liveAwayGoals: match.liveAwayGoals ?? 0,
      status: (['EN_JUEGO', 'MEDIO_TIEMPO', 'TIEMPO_EXTRA', 'PENALES', 'FINALIZADO'].includes(match.status)
        ? match.status
        : 'EN_JUEGO') as LiveForm['status'],
    },
  })

  const submit = useMutation({
    mutationFn: async (data: LiveForm) => {
      const res = await fetch(`/api/matches/${match.id}/live`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Error guardando marcador')
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(data?.message ?? 'Marcador actualizado.')
      qc.invalidateQueries({ queryKey: ['quiniela-matches'] })
      onClose()
    },
    onError: () => toast.error('Error al actualizar marcador.'),
  })

  return (
    <form
      onSubmit={handleSubmit((v) => submit.mutate(v))}
      className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 space-y-3"
    >
      <p className="text-xs font-semibold text-red-900 uppercase tracking-wide">Marcador en vivo</p>
      <div className="flex items-center gap-3">
        <div>
          <Label className="text-xs">Local</Label>
          <Input type="number" min={0} {...register('liveHomeGoals', { valueAsNumber: true })} className="w-16 mt-1" />
        </div>
        <span className="mt-5 text-gray-400 font-bold">-</span>
        <div>
          <Label className="text-xs">Visita</Label>
          <Input type="number" min={0} {...register('liveAwayGoals', { valueAsNumber: true })} className="w-16 mt-1" />
        </div>
        <div className="flex-1">
          <Label className="text-xs">Estado</Label>
          <select className="w-full mt-1 border rounded h-9 px-2 text-sm" {...register('status')}>
            <option value="EN_JUEGO">En juego</option>
            <option value="MEDIO_TIEMPO">Medio tiempo</option>
            <option value="TIEMPO_EXTRA">Tiempo extra</option>
            <option value="PENALES">Penales</option>
            <option value="FINALIZADO">Finalizado</option>
          </select>
        </div>
      </div>
      <p className="text-[11px] text-gray-500 italic">
        Al marcar &quot;Finalizado&quot; el marcador en vivo se guarda como resultado oficial y los puntos se calculan automáticamente.
        Eliminatorias: solo cuenta el marcador a 90&apos; o 120&apos;; los penales NO se consideran para puntuación.
      </p>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isSubmitting}>Guardar</Button>
        <Button type="button" size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
      </div>
    </form>
  )
}

export default function JuegosPage() {
  const params = useParams<{ quinielaId: string }>()
  const quinielaId = params.quinielaId
  const [liveMatchId, setLiveMatchId] = useState<string | null>(null)
  const [activePhase, setActivePhase] = useState<string>('all')

  const { data: quinielaData } = useQuery({
    queryKey: ['quiniela', quinielaId],
    queryFn: async () => {
      const res = await fetch(`/api/quinielas/${quinielaId}`)
      return res.json()
    },
  })

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ['quiniela-matches', quinielaId],
    queryFn: async (): Promise<Match[]> => {
      const res = await fetch(`/api/quinielas/${quinielaId}/matches`)
      return res.json()
    },
    refetchInterval: 30_000,
  })

  const { data: stars = [] } = useQuery({
    queryKey: ['star-matches', quinielaId],
    queryFn: async () => {
      const res = await fetch(`/api/quinielas/${quinielaId}/star-matches`)
      return res.json()
    },
  })

  const starSet = new Set(stars.filter((s: { matchId: string; isStar: boolean }) => s.isStar).map((s: { matchId: string }) => s.matchId))
  const isSuperAdmin = quinielaData?.globalRole === 'SUPER_ADMIN'

  const filtered = useMemo(() => {
    if (activePhase === 'all') return matches
    return matches.filter((m) => m.phase === activePhase)
  }, [matches, activePhase])

  const phaseCounts = useMemo(() => {
    const counts: Record<string, number> = { all: matches.length }
    for (const m of matches) counts[m.phase] = (counts[m.phase] ?? 0) + 1
    return counts
  }, [matches])

  return (
    <AppShell quinielaId={quinielaId}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-pitch-dark">⚽ Partidos</h1>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1">
          {PHASE_TABS.map((tab) => {
            const count = phaseCounts[tab.key] ?? 0
            const isActive = activePhase === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActivePhase(tab.key)}
                className={`shrink-0 px-3 h-8 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap transition ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-900 to-emerald-700 text-white shadow-md'
                    : 'bg-white border border-emerald-100 text-gray-700 hover:bg-emerald-50'
                }`}
              >
                {tab.label} {count > 0 && <span className="opacity-70">({count})</span>}
              </button>
            )
          })}
        </div>

        {isLoading && <BallLoader label="Cargando partidos…" />}
        {!isLoading && filtered.length === 0 && (
          <p className="text-sm text-gray-500 bg-white border rounded-lg p-6 text-center">
            No hay partidos para esta fase aún.
          </p>
        )}

        <div className="space-y-3">
          {filtered.map((match) => {
            const isStar = starSet.has(match.id)
            const isEditingLive = liveMatchId === match.id
            const isLive = ['EN_JUEGO', 'MEDIO_TIEMPO', 'TIEMPO_EXTRA', 'PENALES'].includes(match.status)
            const isFinal = match.status === 'FINALIZADO'
            const canScore = !!match.homeTeam && !!match.awayTeam
            const hasStarted = new Date(match.kickoffAtUtc).getTime() <= Date.now()

            return (
              <MatchCard key={match.id} match={match} isStar={isStar} highlight={isLive}>
                {isSuperAdmin && canScore && !isFinal && hasStarted && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 text-red-700 border-red-200 hover:bg-red-50"
                      onClick={() => setLiveMatchId(isEditingLive ? null : match.id)}
                    >
                      {isLive ? 'Editar marcador en vivo' : 'Iniciar marcador en vivo'}
                    </Button>
                  </div>
                )}
                {isEditingLive && <LiveScoreForm match={match} onClose={() => setLiveMatchId(null)} />}
              </MatchCard>
            )
          })}
        </div>
      </div>
    </AppShell>
  )
}

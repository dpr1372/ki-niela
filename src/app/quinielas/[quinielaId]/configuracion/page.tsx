'use client'

import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useState, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Star } from 'lucide-react'
import { BallLoader } from '@/components/ui/BallLoader'

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

const PHASE_LABEL: Record<string, string> = {
  GROUPS: 'Fase de grupos',
  ROUND_OF_32: 'Ronda 32',
  ROUND_OF_16: 'Octavos',
  QUARTER_FINAL: 'Cuartos',
  SEMI_FINAL: 'Semifinales',
  THIRD_PLACE: '3° Lugar',
  FINAL: 'Final',
}

const configSchema = z.object({
  name: z.string().min(1),
  lockMinutesBeforeMatch: z.number().int().min(0).max(120),
  randomPredictionsEnabled: z.boolean(),
  randomMinGoals: z.number().int().min(0).max(20),
  randomMaxGoals: z.number().int().min(0).max(20),
})
type ConfigForm = z.infer<typeof configSchema>

type StarMatch = { matchId: string; isStar: boolean }
type Match = {
  id: string
  phase: string
  groupCode?: string | null
  homeTeam?: { name: string; flagUrl?: string | null } | null
  awayTeam?: { name: string; flagUrl?: string | null } | null
  placeholderHomeName?: string | null
  placeholderAwayName?: string | null
  kickoffAtUtc?: string
  kickoffAtCostaRica: string
  matchday?: { name: string } | null
}

async function fetchQuiniela(id: string) {
  const res = await fetch(`/api/quinielas/${id}`)
  if (!res.ok) throw new Error('Error cargando quiniela')
  return res.json()
}

async function fetchMatches(id: string): Promise<Match[]> {
  const res = await fetch(`/api/quinielas/${id}/matches`)
  if (!res.ok) throw new Error('Error cargando partidos')
  return res.json()
}

async function fetchStars(id: string): Promise<StarMatch[]> {
  const res = await fetch(`/api/quinielas/${id}/star-matches`)
  if (!res.ok) throw new Error('Error cargando estrellas')
  return res.json()
}

export default function ConfiguracionPage() {
  const params = useParams<{ quinielaId: string }>()
  const quinielaId = params.quinielaId
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['quiniela', quinielaId],
    queryFn: () => fetchQuiniela(quinielaId),
  })

  const { data: matches = [] } = useQuery({
    queryKey: ['quiniela-matches', quinielaId],
    queryFn: () => fetchMatches(quinielaId),
    enabled: !!data,
  })

  const { data: stars = [] } = useQuery({
    queryKey: ['star-matches', quinielaId],
    queryFn: () => fetchStars(quinielaId),
    enabled: !!data,
  })

  const starSet = new Set(stars.filter((s) => s.isStar).map((s) => s.matchId))
  const [activePhase, setActivePhase] = useState<string>('all')

  const filteredMatches = useMemo(() => {
    if (activePhase === 'all') return matches
    return matches.filter((m) => m.phase === activePhase)
  }, [matches, activePhase])

  const phaseCounts = useMemo(() => {
    const counts: Record<string, number> = { all: matches.length }
    for (const m of matches) counts[m.phase] = (counts[m.phase] ?? 0) + 1
    return counts
  }, [matches])

  const totalStars = starSet.size

  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm<ConfigForm>({
    resolver: zodResolver(configSchema),
    values: data ? {
      name: data.quiniela?.name ?? '',
      lockMinutesBeforeMatch: data.quiniela?.lockMinutesBeforeMatch ?? 10,
      randomPredictionsEnabled: data.quiniela?.randomPredictionsEnabled ?? true,
      randomMinGoals: data.quiniela?.randomMinGoals ?? 0,
      randomMaxGoals: data.quiniela?.randomMaxGoals ?? 7,
    } : undefined,
  })

  const randomEnabled = watch('randomPredictionsEnabled')

  const saveConfig = useMutation({
    mutationFn: async (values: ConfigForm) => {
      const res = await fetch(`/api/quinielas/${quinielaId}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error('Error guardando')
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(data.message ?? 'Configuración guardada.')
      qc.invalidateQueries({ queryKey: ['quiniela', quinielaId] })
    },
    onError: () => toast.error('Error al guardar configuración.'),
  })

  const toggleStar = useMutation({
    mutationFn: async ({ matchId, isStar }: { matchId: string; isStar: boolean }) => {
      const res = await fetch(`/api/quinielas/${quinielaId}/star-matches`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, isStar }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Error')
      }
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['star-matches', quinielaId] }),
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) {
    return (
      <AppShell quinielaId={quinielaId}>
        <BallLoader label="Cargando configuración…" />
      </AppShell>
    )
  }

  const member = data?.member
  const isAdmin = member?.role === 'QUINIELA_ADMIN' && member?.status === 'ACTIVE'

  if (!isAdmin) {
    return (
      <AppShell quinielaId={quinielaId}>
        <p className="text-sm text-red-600">No tienes permiso para ver esta página.</p>
      </AppShell>
    )
  }

  return (
    <AppShell quinielaId={quinielaId}>
      <div className="space-y-8 max-w-3xl">
        <h1 className="text-3xl font-black text-pitch-dark">⚙️ Configuración</h1>

        <form onSubmit={handleSubmit((v: ConfigForm) => saveConfig.mutate(v))} className="space-y-6">
          <div className="card-pitch rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-gray-700">General</h2>
            <div>
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" {...register('name')} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="lock">Minutos de bloqueo antes del partido</Label>
              <Input id="lock" type="number" min={0} max={120} {...register('lockMinutesBeforeMatch', { valueAsNumber: true })} className="mt-1 w-28" />
            </div>
          </div>

          <div className="card-pitch rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-gray-700">Pronósticos aleatorios</h2>
            <div className="flex items-center gap-3">
              <Switch
                id="random"
                checked={randomEnabled}
                onCheckedChange={(v) => setValue('randomPredictionsEnabled', v)}
              />
              <Label htmlFor="random">Habilitar pronósticos aleatorios</Label>
            </div>
            {randomEnabled && (
              <div className="flex items-center gap-4">
                <div>
                  <Label htmlFor="minGoals">Mín. goles</Label>
                  <Input id="minGoals" type="number" min={0} max={20} {...register('randomMinGoals', { valueAsNumber: true })} className="mt-1 w-20" />
                </div>
                <div>
                  <Label htmlFor="maxGoals">Máx. goles</Label>
                  <Input id="maxGoals" type="number" min={0} max={20} {...register('randomMaxGoals', { valueAsNumber: true })} className="mt-1 w-20" />
                </div>
              </div>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            Guardar cambios
          </Button>
        </form>

        <div className="card-pitch rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                <Star size={18} className="text-amber-500 fill-yellow-400" />
                Partidos estrella
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Los partidos estrella otorgan puntuación especial (5 / 3 / 3 / 0). La final siempre es estrella y no puede desmarcarse.
              </p>
            </div>
            <span className="text-xs px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-bold whitespace-nowrap">
              ⭐ {totalStars} marcado{totalStars === 1 ? '' : 's'}
            </span>
          </div>

          <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1">
            {PHASE_TABS.map((tab) => {
              const count = phaseCounts[tab.key] ?? 0
              if (tab.key !== 'all' && count === 0) return null
              const isActive = activePhase === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
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

          <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
            {filteredMatches.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-6">No hay partidos en esta fase.</p>
            )}
            {filteredMatches.map((match) => {
              const isStar = starSet.has(match.id)
              const isFinal = match.phase === 'FINAL'
              const homeName = match.homeTeam?.name ?? match.placeholderHomeName ?? '?'
              const awayName = match.awayTeam?.name ?? match.placeholderAwayName ?? '?'
              const date = new Date(match.kickoffAtUtc ?? match.kickoffAtCostaRica)
              const dateStr = date.toLocaleDateString('es-CR', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'America/Costa_Rica' })
              const timeStr = date.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Costa_Rica' })
              return (
                <div
                  key={match.id}
                  className={`flex items-center justify-between gap-3 rounded-lg border p-3 transition ${
                    isStar
                      ? 'bg-gradient-to-r from-yellow-50 via-amber-50 to-yellow-50 border-yellow-300 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-emerald-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                      isStar
                        ? 'bg-gradient-to-br from-yellow-400 to-amber-500 shadow-md'
                        : 'bg-gray-100'
                    }`}>
                      <Star size={18} className={isStar ? 'text-white fill-white drop-shadow' : 'text-gray-300'} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {homeName} <span className="text-gray-400 font-normal">vs</span> {awayName}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        <span className="capitalize">{dateStr}</span> · {timeStr} CR · {PHASE_LABEL[match.phase] ?? match.phase}
                        {match.groupCode && <> · Grupo {match.groupCode}</>}
                        {isFinal && <span className="ml-1 text-amber-700 font-bold">· Obligatoria</span>}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={isStar}
                    disabled={isFinal || toggleStar.isPending}
                    onCheckedChange={(v) => toggleStar.mutate({ matchId: match.id, isStar: v })}
                    className="shrink-0"
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

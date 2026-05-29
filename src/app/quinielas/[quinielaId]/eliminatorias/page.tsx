'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import AppShell from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MatchCard, type MatchCardData } from '@/components/quiniela/MatchCard'
import { Trash2 } from 'lucide-react'
import { BallLoader } from '@/components/ui/BallLoader'

type Team = { id: string; name: string; fifaCode: string | null; flagUrl: string | null; groupCode: string | null }
type Stadium = { id: string; name: string; city: string | null; country: string | null }
type Matchday = { id: string; name: string; number: number; phase: string }

type Match = MatchCardData & { matchdayId: string }

const PHASES: Array<{ key: string; label: string; matchdayId: string; defaultCount: number }> = [
  { key: 'ROUND_OF_32', label: 'Dieciseisavos (Ronda de 32)', matchdayId: 'md-octavos', defaultCount: 16 },
  { key: 'ROUND_OF_16', label: 'Octavos de Final', matchdayId: 'md-dieciseis', defaultCount: 8 },
  { key: 'QUARTER_FINAL', label: 'Cuartos de Final', matchdayId: 'md-cuartos', defaultCount: 4 },
  { key: 'SEMI_FINAL', label: 'Semifinales', matchdayId: 'md-semis', defaultCount: 2 },
  { key: 'THIRD_PLACE', label: 'Tercer Lugar', matchdayId: 'md-3er', defaultCount: 1 },
  { key: 'FINAL', label: 'Final', matchdayId: 'md-final', defaultCount: 1 },
]

const createSchema = z.object({
  phase: z.string(),
  matchdayId: z.string(),
  stadiumId: z.string().min(1, 'Seleccione estadio'),
  homeTeamId: z.string().optional(),
  awayTeamId: z.string().optional(),
  placeholderHomeName: z.string().optional(),
  placeholderAwayName: z.string().optional(),
  kickoffLocal: z.string().min(1, 'Indique fecha y hora'),
})
type CreateForm = z.infer<typeof createSchema>

function CreateMatchForm({
  phase,
  matchdayId,
  eventId,
  catalogs,
  onCreated,
}: {
  phase: string
  matchdayId: string
  eventId: string
  catalogs: { teams: Team[]; stadiums: Stadium[]; matchdays: Matchday[] }
  onCreated: () => void
}) {
  const qc = useQueryClient()
  const { register, handleSubmit, watch, formState: { errors, isSubmitting }, reset } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { phase, matchdayId },
  })

  const homeTeamId = watch('homeTeamId')
  const awayTeamId = watch('awayTeamId')

  const submit = useMutation({
    mutationFn: async (data: CreateForm) => {
      // Convert local CR datetime → UTC ISO
      // Costa Rica = UTC-6, no DST. local input "YYYY-MM-DDTHH:mm" = CR time
      const local = new Date(data.kickoffLocal + ':00-06:00')
      const payload = {
        phase: data.phase,
        matchdayId: data.matchdayId,
        stadiumId: data.stadiumId,
        homeTeamId: data.homeTeamId || undefined,
        awayTeamId: data.awayTeamId || undefined,
        placeholderHomeName: data.homeTeamId ? undefined : data.placeholderHomeName,
        placeholderAwayName: data.awayTeamId ? undefined : data.placeholderAwayName,
        kickoffAtUtc: local.toISOString(),
      }
      const res = await fetch(`/api/events/${eventId}/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.formErrors?.[0] ?? json.error ?? 'Error creando partido')
      return json
    },
    onSuccess: (json) => {
      toast.success(json.message ?? 'Partido creado.')
      qc.invalidateQueries({ queryKey: ['admin-matches'] })
      reset({ phase, matchdayId })
      onCreated()
    },
    onError: (e: Error) => toast.error(e.message ?? 'Error creando partido'),
  })

  return (
    <form
      onSubmit={handleSubmit((v) => submit.mutate(v))}
      className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3"
    >
      <input type="hidden" {...register('phase')} />
      <input type="hidden" {...register('matchdayId')} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Equipo local</Label>
          <select
            className="w-full mt-1 border rounded h-9 px-2 text-sm bg-white"
            {...register('homeTeamId')}
          >
            <option value="">— Sin equipo (usar placeholder) —</option>
            {catalogs.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fifaCode ? `${t.fifaCode} · ` : ''}{t.name}
              </option>
            ))}
          </select>
          {!homeTeamId && (
            <Input
              placeholder='ej. "Ganador Octavos 1"'
              className="mt-2 text-sm"
              {...register('placeholderHomeName')}
            />
          )}
        </div>

        <div>
          <Label className="text-xs">Equipo visita</Label>
          <select
            className="w-full mt-1 border rounded h-9 px-2 text-sm bg-white"
            {...register('awayTeamId')}
          >
            <option value="">— Sin equipo (usar placeholder) —</option>
            {catalogs.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fifaCode ? `${t.fifaCode} · ` : ''}{t.name}
              </option>
            ))}
          </select>
          {!awayTeamId && (
            <Input
              placeholder='ej. "Ganador Octavos 2"'
              className="mt-2 text-sm"
              {...register('placeholderAwayName')}
            />
          )}
        </div>

        <div>
          <Label className="text-xs">Estadio</Label>
          <select
            className="w-full mt-1 border rounded h-9 px-2 text-sm bg-white"
            {...register('stadiumId')}
          >
            <option value="">— Seleccione —</option>
            {catalogs.stadiums.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.city ? ` (${s.city})` : ''}
              </option>
            ))}
          </select>
          {errors.stadiumId && <p className="text-xs text-red-600 mt-1">{errors.stadiumId.message}</p>}
        </div>

        <div>
          <Label className="text-xs">Fecha y hora (Costa Rica)</Label>
          <Input type="datetime-local" className="mt-1" {...register('kickoffLocal')} />
          {errors.kickoffLocal && <p className="text-xs text-red-600 mt-1">{errors.kickoffLocal.message}</p>}
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? 'Creando…' : 'Crear partido'}
        </Button>
      </div>
    </form>
  )
}

export default function EliminatoriasAdminPage() {
  const params = useParams<{ quinielaId: string }>()
  const quinielaId = params.quinielaId
  const router = useRouter()
  const qc = useQueryClient()
  const [openPhase, setOpenPhase] = useState<string | null>(null)
  const [creatingPhase, setCreatingPhase] = useState<string | null>(null)

  const { data: quinielaData } = useQuery({
    queryKey: ['quiniela', quinielaId],
    queryFn: async () => {
      const res = await fetch(`/api/quinielas/${quinielaId}`)
      return res.json()
    },
  })

  const eventId: string | undefined = quinielaData?.quiniela?.eventId

  useEffect(() => {
    if (quinielaData && quinielaData.globalRole !== 'SUPER_ADMIN') {
      toast.error('Solo el super admin puede gestionar eliminatorias.')
      router.replace(`/quinielas/${quinielaId}/dashboard`)
    }
  }, [quinielaData, quinielaId, router])

  const { data: catalogs } = useQuery({
    queryKey: ['event-catalogs', eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/catalogs`)
      return res.json()
    },
    enabled: !!eventId,
  })

  const { data: matches = [] } = useQuery({
    queryKey: ['admin-matches', quinielaId],
    queryFn: async (): Promise<Match[]> => {
      const res = await fetch(`/api/quinielas/${quinielaId}/matches`)
      return res.json()
    },
    refetchInterval: 60_000,
  })

  const grouped = useMemo(() => {
    const map: Record<string, Match[]> = {}
    for (const p of PHASES) map[p.key] = []
    for (const m of matches) {
      if (map[m.phase]) map[m.phase].push(m)
    }
    return map
  }, [matches])

  const deleteMatch = useMutation({
    mutationFn: async (matchId: string) => {
      const res = await fetch(`/api/matches/${matchId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error eliminando partido')
      return json
    },
    onSuccess: () => {
      toast.success('Partido eliminado.')
      qc.invalidateQueries({ queryKey: ['admin-matches'] })
    },
    onError: (e: Error) => toast.error(e.message ?? 'Error eliminando partido'),
  })

  const cancelMatch = useMutation({
    mutationFn: async ({ matchId, status }: { matchId: string; status: string }) => {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error actualizando partido')
      return json
    },
    onSuccess: () => {
      toast.success('Estado actualizado.')
      qc.invalidateQueries({ queryKey: ['admin-matches'] })
    },
    onError: (e: Error) => toast.error(e.message ?? 'Error actualizando partido'),
  })

  if (!quinielaData) {
    return (
      <AppShell quinielaId={quinielaId}>
        <BallLoader label="Cargando…" />
      </AppShell>
    )
  }

  return (
    <AppShell quinielaId={quinielaId}>
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-black text-pitch-dark">⚔️ Eliminatorias</h1>
          <p className="text-sm text-gray-600">
            Gestiona partidos de Dieciseisavos, Octavos, Cuartos, Semifinales, Tercer Lugar y Final.
            Activar (crear) o desactivar (cancelar/eliminar) partidos por fase.
          </p>
        </div>

        {PHASES.map((phase) => {
          const list = grouped[phase.key] ?? []
          const isOpen = openPhase === phase.key
          const isCreating = creatingPhase === phase.key
          return (
            <section key={phase.key} className="bg-white border rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                onClick={() => setOpenPhase(isOpen ? null : phase.key)}
              >
                <div className="text-left">
                  <p className="font-semibold text-gray-900">{phase.label}</p>
                  <p className="text-xs text-gray-500">
                    {list.length} de {phase.defaultCount} partidos creados
                  </p>
                </div>
                <span className="text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div className="border-t p-4 space-y-3 bg-gray-50">
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => setCreatingPhase(isCreating ? null : phase.key)}
                    >
                      {isCreating ? 'Cerrar formulario' : '+ Crear partido'}
                    </Button>
                  </div>

                  {isCreating && eventId && catalogs && (
                    <CreateMatchForm
                      phase={phase.key}
                      matchdayId={phase.matchdayId}
                      eventId={eventId}
                      catalogs={catalogs}
                      onCreated={() => setCreatingPhase(null)}
                    />
                  )}

                  {list.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Aún no hay partidos en esta fase.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {list.map((m) => (
                        <MatchCard key={m.id} match={m}>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {m.status !== 'CANCELADO' && m.status !== 'POSTERGADO' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7"
                                onClick={() => cancelMatch.mutate({ matchId: m.id, status: 'POSTERGADO' })}
                              >
                                Postergar
                              </Button>
                            )}
                            {m.status !== 'CANCELADO' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 text-orange-700 border-orange-200 hover:bg-orange-50"
                                onClick={() => cancelMatch.mutate({ matchId: m.id, status: 'CANCELADO' })}
                              >
                                Cancelar
                              </Button>
                            )}
                            {(m.status === 'CANCELADO' || m.status === 'POSTERGADO') && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                onClick={() => cancelMatch.mutate({ matchId: m.id, status: 'PROGRAMADO' })}
                              >
                                Reactivar
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 text-red-700 border-red-200 hover:bg-red-50"
                              onClick={() => {
                                if (confirm('¿Eliminar este partido? Solo posible si no tiene predicciones.')) {
                                  deleteMatch.mutate(m.id)
                                }
                              }}
                            >
                              <Trash2 size={12} className="mr-1" /> Eliminar
                            </Button>
                          </div>
                        </MatchCard>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </AppShell>
  )
}

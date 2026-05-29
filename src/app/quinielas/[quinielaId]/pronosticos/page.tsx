'use client'

import { useState, useMemo, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import AppShell from '@/components/layout/AppShell'
import { PredictionInput } from '@/components/quiniela/PredictionInput'
import { AutosaveStatus } from '@/components/quiniela/AutosaveStatus'
import { useAutosave } from '@/hooks/useAutosave'
import { Star, Lock, BarChart2, Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { BallLoader } from '@/components/ui/BallLoader'
import { isMatchLocked } from '@/lib/timezone'
import { flagUrl } from '@/lib/flags'

type Match = {
  id: string
  phase: string
  groupCode?: string
  kickoffAtUtc: string
  kickoffAtCostaRica: string
  status: string
  homeTeam?: { name: string; fifaCode?: string }
  awayTeam?: { name: string; fifaCode?: string }
  placeholderHomeName?: string
  placeholderAwayName?: string
  matchday?: { id: string; name: string; number: number; phase: string }
  stadium?: { name: string; city?: string | null; country?: string | null }
  liveHomeGoals?: number | null
  liveAwayGoals?: number | null
  officialHomeGoals?: number | null
  officialAwayGoals?: number | null
}

type Prediction = {
  matchId: string
  predictedHomeGoals: number
  predictedAwayGoals: number
  generatedByBot: boolean
}

type StarMatch = { matchId: string; isStar: boolean }

async function fetchData(quinielaId: string) {
  const [matchesRes, predictionsRes, starsRes, configRes] = await Promise.all([
    fetch(`/api/quinielas/${quinielaId}/matches`),
    fetch(`/api/quinielas/${quinielaId}/predictions`),
    fetch(`/api/quinielas/${quinielaId}/star-matches`),
    fetch(`/api/quinielas/${quinielaId}`),
  ])
  const [matches, predictions, stars, config] = await Promise.all([
    matchesRes.json(),
    predictionsRes.json(),
    starsRes.json(),
    configRes.json(),
  ])
  return {
    matches: matches as Match[],
    predictions: predictions as Prediction[],
    stars: stars as StarMatch[],
    lockMinutes: config?.quiniela?.lockMinutesBeforeMatch ?? 10,
  }
}

const MONTH_ABBR_ES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
const WEEKDAY_FULL_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTH_FULL_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function crParts(iso: string) {
  // Get day/month/year/weekday in Costa Rica TZ
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Costa_Rica',
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  })
  const parts = fmt.formatToParts(new Date(iso))
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  const y = Number(get('year'))
  const mo = Number(get('month'))
  const d = Number(get('day'))
  const date = new Date(Date.UTC(y, mo - 1, d))
  return { y, mo, d, weekday: date.getUTCDay(), key: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` }
}

function crTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CR', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Costa_Rica',
  })
}

function TeamSide({ name, fifaCode, placeholder, side }: { name?: string; fifaCode?: string; placeholder?: string; side: 'home' | 'away' }) {
  const url = flagUrl(fifaCode)
  const label = name ?? placeholder ?? '?'
  const code = fifaCode ?? (label.length <= 3 ? label : label.slice(0, 3).toUpperCase())
  return (
    <div className={`flex flex-col flex-1 min-w-0 ${side === 'home' ? 'items-end' : 'items-start'}`}>
      <div className={`flex items-center gap-2 min-w-0 max-w-full ${side === 'home' ? 'flex-row' : 'flex-row-reverse'}`}>
        {url ? (
          <Image src={url} alt={label} width={28} height={20} className="rounded-sm border border-gray-200 shadow-sm shrink-0" unoptimized />
        ) : (
          <div className="w-7 h-5 rounded-sm bg-gray-200 shrink-0" />
        )}
        <span className={`font-bold text-sm text-blue-950 truncate ${side === 'home' ? 'text-right' : 'text-left'}`}>{label}</span>
      </div>
      <span className={`text-[10px] font-bold text-gray-500 tracking-wider mt-0.5 ${side === 'home' ? 'pr-9' : 'pl-9'}`}>
        {code}
      </span>
    </div>
  )
}

const PHASE_LABELS: Record<string, string> = {
  GROUPS: 'Fase de Grupos',
  ROUND_OF_32: 'Ronda de 32',
  ROUND_OF_16: 'Octavos',
  QUARTER_FINAL: 'Cuartos',
  SEMI_FINAL: 'Semifinales',
  THIRD_PLACE: 'Tercer Lugar',
  FINAL: 'Final',
}

export default function PronosticosPage() {
  const params = useParams<{ quinielaId: string }>()
  const quinielaId = params.quinielaId
  const { save, statusMap } = useAutosave(quinielaId)
  const stripRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['pronosticos', quinielaId],
    queryFn: () => fetchData(quinielaId),
    refetchInterval: 30_000,
  })

  const predMap = new Map(data?.predictions.map((p) => [p.matchId, p]))
  const starSet = new Set(data?.stars.filter((s) => s.isStar).map((s) => s.matchId))
  const lockMinutes = data?.lockMinutes ?? 10

  // Group matches by Costa Rica calendar day
  const { dayKeys, byDay } = useMemo(() => {
    const map = new Map<string, Match[]>()
    for (const m of data?.matches ?? []) {
      const k = crParts(m.kickoffAtUtc).key
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(m)
    }
    const keys = Array.from(map.keys()).sort()
    for (const k of keys) {
      map.get(k)!.sort((a, b) => new Date(a.kickoffAtUtc).getTime() - new Date(b.kickoffAtUtc).getTime())
    }
    return { dayKeys: keys, byDay: map }
  }, [data])

  // Pick initial selected day = first day with an upcoming match, fallback to first
  const initialDay = useMemo(() => {
    const now = Date.now()
    for (const k of dayKeys) {
      const ms = byDay.get(k)!
      if (ms.some((m) => new Date(m.kickoffAtUtc).getTime() >= now)) return k
    }
    return dayKeys[0]
  }, [dayKeys, byDay])

  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const activeDay = selectedDay ?? initialDay

  function scrollStrip(dir: -1 | 1) {
    stripRef.current?.scrollBy({ left: dir * 240, behavior: 'smooth' })
  }

  if (isLoading) {
    return (
      <AppShell quinielaId={quinielaId}>
        <BallLoader label="Cargando pronósticos…" />
      </AppShell>
    )
  }

  const matchesOfDay = activeDay ? byDay.get(activeDay) ?? [] : []
  const dayHeaderLabel = (() => {
    if (!activeDay) return ''
    const [y, m, d] = activeDay.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    return `${WEEKDAY_FULL_ES[dt.getUTCDay()]}, ${d} de ${MONTH_FULL_ES[m - 1]}`
  })()

  return (
    <AppShell quinielaId={quinielaId}>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="text-blue-700" size={26} />
          <h1 className="text-3xl font-black text-pitch-dark">Pronósticos</h1>
        </div>

        {dayKeys.length === 0 && (
          <p className="text-gray-500 text-sm">No hay partidos disponibles.</p>
        )}

        {dayKeys.length > 0 && (
          <>
            {/* Date strip */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-2 flex items-center gap-1">
              <button
                onClick={() => scrollStrip(-1)}
                className="shrink-0 w-9 h-12 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"
                aria-label="Anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <div ref={stripRef} className="flex-1 overflow-x-auto scroll-smooth no-scrollbar">
                <div className="flex gap-1 min-w-max px-1">
                  {dayKeys.map((k) => {
                    const [y, m, d] = k.split('-').map(Number)
                    const dt = new Date(Date.UTC(y, m - 1, d))
                    const isActive = k === activeDay
                    return (
                      <button
                        key={k}
                        onClick={() => { setSelectedDay(k); setCollapsed(false) }}
                        className={`shrink-0 w-14 h-12 rounded-lg flex flex-col items-center justify-center transition ${
                          isActive
                            ? 'bg-orange-500 text-white shadow'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                        aria-pressed={isActive}
                      >
                        <span className="text-base font-bold leading-none">{d}</span>
                        <span className={`text-[10px] font-semibold leading-none mt-0.5 ${isActive ? 'text-white/90' : 'text-gray-500'}`}>
                          {MONTH_ABBR_ES[dt.getUTCMonth()]}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <button
                onClick={() => scrollStrip(1)}
                className="shrink-0 w-9 h-12 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"
                aria-label="Siguiente"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Day card */}
            {activeDay && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => setCollapsed((c) => !c)}
                  className="w-full bg-orange-500 text-white px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2">
                    <Calendar size={18} />
                    <span className="font-bold capitalize">{dayHeaderLabel}</span>
                  </div>
                  <ChevronDown
                    size={20}
                    className={`transition-transform ${collapsed ? '' : 'rotate-180'}`}
                  />
                </button>

                {!collapsed && (
                  <div className="divide-y divide-gray-100">
                    {matchesOfDay.map((match) => {
                      const locked = isMatchLocked(new Date(match.kickoffAtUtc), lockMinutes) || match.status !== 'PROGRAMADO'
                      const pred = predMap.get(match.id)
                      const isStar = starSet.has(match.id)
                      const saveStatus = statusMap[match.id] ?? 'idle'
                      const hasTeams = match.homeTeam || match.awayTeam
                      const hasOfficial = match.officialHomeGoals != null && match.officialAwayGoals != null
                      const hasLive = match.liveHomeGoals != null && match.liveAwayGoals != null
                      const phaseLabel = PHASE_LABELS[match.phase] ?? match.phase

                      return (
                        <div key={match.id} className={`px-4 py-4 ${isStar ? 'bg-gradient-to-b from-yellow-50/60 to-transparent' : ''}`}>
                          {/* Top: time + phase chip */}
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <span className="text-sm font-bold text-gray-700">{crTime(match.kickoffAtUtc)}</span>
                            <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">
                              · {phaseLabel}{match.groupCode ? ` ${match.groupCode}` : ''}
                            </span>
                          </div>

                          {/* Star banner — prominent indicator above the score */}
                          {isStar && (
                            <div className="flex justify-center mb-2">
                              <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-white text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg shadow-amber-200 border-2 border-white">
                                <Star size={16} className="fill-white drop-shadow" />
                                Partido estrella
                                <Star size={16} className="fill-white drop-shadow" />
                              </div>
                            </div>
                          )}

                          {/* Teams + score input — flags & names flank a centered score box */}
                          <div className="flex items-center gap-2 sm:gap-3">
                            <TeamSide
                              name={match.homeTeam?.name}
                              fifaCode={match.homeTeam?.fifaCode}
                              placeholder={match.placeholderHomeName}
                              side="home"
                            />

                            <div className="shrink-0 flex flex-col items-center gap-1">
                              {locked ? (
                                <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-gray-200 bg-gray-50 text-base font-black text-gray-700 min-w-[88px] justify-center shadow-inner">
                                  <Lock size={12} className="text-gray-500" />
                                  {pred ? `${pred.predictedHomeGoals} - ${pred.predictedAwayGoals}` : '—'}
                                </div>
                              ) : hasTeams ? (
                                <div className="rounded-lg ring-1 ring-blue-100 bg-blue-50/40 p-1">
                                  <PredictionInput
                                    matchId={match.id}
                                    initialHome={pred?.predictedHomeGoals}
                                    initialAway={pred?.predictedAwayGoals}
                                    locked={false}
                                    onSave={save}
                                  />
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 italic px-2">Por definir</span>
                              )}
                              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">vs</span>
                            </div>

                            <TeamSide
                              name={match.awayTeam?.name}
                              fifaCode={match.awayTeam?.fifaCode}
                              placeholder={match.placeholderAwayName}
                              side="away"
                            />
                          </div>

                          {/* Stadium */}
                          {match.stadium && (
                            <div className="text-center mt-2">
                              <p className="text-xs text-gray-500">{match.stadium.name}</p>
                              {match.stadium.city && (
                                <p className="text-[11px] text-gray-400">{match.stadium.city}</p>
                              )}
                            </div>
                          )}

                          {/* Footer: status / live / autosave */}
                          <div className="flex items-center justify-center gap-2 mt-2">
                            {(hasOfficial || hasLive) && (
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${hasOfficial ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800 animate-pulse'}`}>
                                {hasOfficial ? 'Final' : 'En vivo'}: {hasOfficial ? match.officialHomeGoals : match.liveHomeGoals} - {hasOfficial ? match.officialAwayGoals : match.liveAwayGoals}
                              </span>
                            )}
                            {pred?.generatedByBot && (
                              <span className="text-[10px] text-purple-600 font-medium">Bot</span>
                            )}
                            {!locked && hasTeams && <AutosaveStatus status={saveStatus} />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}

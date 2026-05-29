'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Trophy, ChevronLeft, ChevronRight, Crown, CalendarDays, Layers, Flag, ListOrdered } from 'lucide-react'
import { Medal } from '@/components/ui/Medal'
import { BallLoader } from '@/components/ui/BallLoader'

type LeaderboardRow = {
  position: number
  userId: string
  name: string
  points: number
  isMe: boolean
}

type Matchday = { id: string; name: string; number: number; phase: string }

type Match = {
  id: string
  kickoffAtUtc: string
  matchday?: Matchday
  phase: string
}

const PHASE_LABELS: Record<string, string> = {
  GROUPS: 'Grupos',
  ROUND_OF_32: 'Ronda 32',
  ROUND_OF_16: 'Octavos',
  QUARTER_FINAL: 'Cuartos',
  SEMI_FINAL: 'Semifinales',
  THIRD_PLACE: '3er Lugar',
  FINAL: 'Final',
}

const MONTH_ABBR_ES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
const WEEKDAY_FULL_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTH_FULL_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function crDayKey(iso: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const parts = fmt.formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

async function fetchLeaderboard(quinielaId: string, scope: string, params: Record<string, string> = {}): Promise<LeaderboardRow[]> {
  const qs = new URLSearchParams({ scope, ...params })
  const res = await fetch(`/api/quinielas/${quinielaId}/leaderboard?${qs.toString()}`)
  if (!res.ok) throw new Error('Error cargando posiciones')
  return res.json()
}

async function fetchMatches(quinielaId: string): Promise<Match[]> {
  const res = await fetch(`/api/quinielas/${quinielaId}/matches`)
  if (!res.ok) return []
  return res.json()
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const a = parts[0]?.[0] ?? '?'
  const b = parts[1]?.[0] ?? ''
  return (a + b).toUpperCase()
}

function LeaderboardTable({ data }: { data: LeaderboardRow[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
        <Trophy size={40} className="mx-auto mb-3 opacity-30" />
        <p>Aún no hay puntos registrados.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {data.map((row) => {
        const isFirst = row.position === 1
        const isSecond = row.position === 2
        const isThird = row.position === 3
        const podium = isFirst || isSecond || isThird

        const rankBg = isFirst
          ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white'
          : isSecond
          ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white'
          : isThird
          ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white'
          : 'bg-gray-100 text-gray-600'

        const cardCls = row.isMe
          ? 'bg-gradient-to-r from-yellow-50 to-amber-50 ring-2 ring-yellow-300 shadow-md'
          : podium
          ? 'bg-white shadow-sm hover:shadow-md'
          : 'bg-white hover:bg-gray-50'

        return (
          <div
            key={row.userId}
            className={`flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 transition-all ${cardCls}`}
          >
            {podium ? (
              <div className="shrink-0 w-12 h-12 flex items-center justify-center">
                <Medal kind={isFirst ? 'gold' : isSecond ? 'silver' : 'bronze'} size={46} />
              </div>
            ) : (
              <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${rankBg} shadow-sm`}>
                {row.position}
              </div>
            )}

            <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-900 to-emerald-700 text-yellow-300 flex items-center justify-center font-black text-sm shadow-inner">
              {initials(row.name)}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-bold text-blue-950 truncate text-sm leading-tight">
                {row.name}
                {row.isMe && (
                  <span className="ml-2 text-[9px] uppercase tracking-wider text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full font-bold align-middle">
                    tú
                  </span>
                )}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {podium ? (isFirst ? '🏆 Líder' : isSecond ? '🥈 2do lugar' : '🥉 3er lugar') : `Posición #${row.position}`}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-2xl font-black text-blue-950 tabular-nums leading-none">{row.points}</p>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mt-0.5">pts</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ScopedLeaderboard({ quinielaId, scope, scopeParams }: { quinielaId: string; scope: string; scopeParams?: Record<string, string> }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['leaderboard', quinielaId, scope, scopeParams],
    queryFn: () => fetchLeaderboard(quinielaId, scope, scopeParams ?? {}),
    refetchInterval: 60_000,
  })
  if (isLoading) return <BallLoader label="Cargando tabla…" />
  if (error) return <p className="text-sm text-red-600 py-4">Error al cargar posiciones.</p>
  return <LeaderboardTable data={data ?? []} />
}

function DailyLeaderboard({ quinielaId, matches }: { quinielaId: string; matches: Match[] }) {
  const stripRef = useRef<HTMLDivElement>(null)

  const dayKeys = useMemo(() => {
    const set = new Set<string>()
    for (const m of matches) set.add(crDayKey(m.kickoffAtUtc))
    return Array.from(set).sort()
  }, [matches])

  const initialDay = useMemo(() => {
    const today = crDayKey(new Date().toISOString())
    if (dayKeys.includes(today)) return today
    // First past day with matches, else first day
    const past = [...dayKeys].reverse().find((k) => k <= today)
    return past ?? dayKeys[0]
  }, [dayKeys])

  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const activeDay = selectedDay ?? initialDay

  function scrollStrip(dir: -1 | 1) {
    stripRef.current?.scrollBy({ left: dir * 240, behavior: 'smooth' })
  }

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard-day', quinielaId, activeDay],
    queryFn: () => activeDay ? fetchLeaderboard(quinielaId, 'day', { date: activeDay }) : Promise.resolve([]),
    enabled: !!activeDay,
    refetchInterval: 60_000,
  })

  const dayLabel = (() => {
    if (!activeDay) return ''
    const [y, m, d] = activeDay.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    return `${WEEKDAY_FULL_ES[dt.getUTCDay()]}, ${d} de ${MONTH_FULL_ES[m - 1]}`
  })()

  const leader = (data ?? []).find((r) => r.position === 1 && r.points > 0)

  if (dayKeys.length === 0) {
    return <p className="text-sm text-gray-500 py-4">No hay partidos disponibles.</p>
  }

  return (
    <div className="space-y-4">
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
                  onClick={() => setSelectedDay(k)}
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

      {leader && (
        <div className="bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 rounded-xl px-4 py-3 flex items-center gap-3 shadow-md">
          <Crown size={28} className="text-white drop-shadow shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-white/90 font-bold">Líder del día · <span className="capitalize">{dayLabel}</span></p>
            <p className="text-lg font-black text-white truncate">{leader.name} {leader.isMe && <span className="text-xs ml-1 opacity-90">(tú)</span>}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-white tabular-nums leading-none">{leader.points}</p>
            <p className="text-[10px] uppercase tracking-wider text-white/90 font-bold">pts</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <BallLoader label="Cargando tabla…" />
      ) : (
        <LeaderboardTable data={data ?? []} />
      )}
    </div>
  )
}

type Scope = 'general' | 'day' | 'matchday' | 'phase'

const SCOPE_OPTIONS: { value: Scope; label: string; icon: typeof Trophy }[] = [
  { value: 'general', label: 'General', icon: ListOrdered },
  { value: 'day', label: 'Por día', icon: CalendarDays },
  { value: 'matchday', label: 'Por jornada', icon: Layers },
  { value: 'phase', label: 'Por fase', icon: Flag },
]

export default function PosicionesPage() {
  const params = useParams<{ quinielaId: string }>()
  const quinielaId = params.quinielaId
  const [scope, setScope] = useState<Scope>('general')
  const [selectedMatchday, setSelectedMatchday] = useState<string | null>(null)
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null)

  const { data: matches = [] } = useQuery({
    queryKey: ['matches-for-positions', quinielaId],
    queryFn: () => fetchMatches(quinielaId),
  })

  const matchdays = useMemo(() => {
    const seen = new Map<string, Matchday>()
    for (const m of matches) {
      if (m.matchday && !seen.has(m.matchday.id)) seen.set(m.matchday.id, m.matchday)
    }
    return Array.from(seen.values()).sort((a, b) => a.number - b.number)
  }, [matches])

  const phases = useMemo(() => Array.from(new Set(matchdays.map((m) => m.phase))), [matchdays])

  const activeMatchday = selectedMatchday ?? matchdays[0]?.id ?? null
  const activePhase = selectedPhase ?? phases[0] ?? null

  return (
    <AppShell quinielaId={quinielaId}>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="text-yellow-500" size={26} />
          <h1 className="text-3xl font-black text-pitch-dark">Posiciones</h1>
        </div>

        {/* Primary scope selector — segmented control */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-1.5 grid grid-cols-2 sm:grid-cols-4 gap-1">
          {SCOPE_OPTIONS.map(({ value, label, icon: Icon }) => {
            const isActive = scope === value
            return (
              <button
                key={value}
                onClick={() => setScope(value)}
                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition ${
                  isActive
                    ? 'bg-gradient-to-br from-blue-900 to-emerald-700 text-white shadow'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                aria-pressed={isActive}
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            )
          })}
        </div>

        {/* Contextual secondary selector */}
        {scope === 'matchday' && matchdays.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-2 overflow-x-auto no-scrollbar">
            <div className="flex gap-1 min-w-max">
              {matchdays.map((md) => {
                const isActive = md.id === activeMatchday
                return (
                  <button
                    key={md.id}
                    onClick={() => setSelectedMatchday(md.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      isActive ? 'bg-orange-500 text-white shadow' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    aria-pressed={isActive}
                  >
                    {md.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {scope === 'phase' && phases.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-2 overflow-x-auto no-scrollbar">
            <div className="flex gap-1 min-w-max">
              {phases.map((p) => {
                const isActive = p === activePhase
                return (
                  <button
                    key={p}
                    onClick={() => setSelectedPhase(p)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      isActive ? 'bg-emerald-600 text-white shadow' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    aria-pressed={isActive}
                  >
                    {PHASE_LABELS[p] ?? p}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Content */}
        <div>
          {scope === 'general' && <ScopedLeaderboard quinielaId={quinielaId} scope="general" />}
          {scope === 'day' && <DailyLeaderboard quinielaId={quinielaId} matches={matches} />}
          {scope === 'matchday' && activeMatchday && (
            <ScopedLeaderboard
              quinielaId={quinielaId}
              scope="matchday"
              scopeParams={{ matchdayId: activeMatchday }}
            />
          )}
          {scope === 'matchday' && !activeMatchday && (
            <p className="text-sm text-gray-500 py-4">No hay jornadas disponibles.</p>
          )}
          {scope === 'phase' && activePhase && (
            <ScopedLeaderboard
              quinielaId={quinielaId}
              scope="phase"
              scopeParams={{ phase: activePhase }}
            />
          )}
          {scope === 'phase' && !activePhase && (
            <p className="text-sm text-gray-500 py-4">No hay fases disponibles.</p>
          )}
        </div>
      </div>
    </AppShell>
  )
}

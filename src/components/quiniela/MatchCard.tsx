import Image from 'next/image'
import { Star, MapPin, Calendar } from 'lucide-react'
import { MatchStatusBadge } from './MatchStatusBadge'
import { flagUrl } from '@/lib/flags'

export type MatchCardData = {
  id: string
  phase: string
  groupCode?: string | null
  kickoffAtUtc?: string
  kickoffAtCostaRica: string
  status: string
  homeTeam?: { name: string; fifaCode?: string | null; flagUrl?: string | null } | null
  awayTeam?: { name: string; fifaCode?: string | null; flagUrl?: string | null } | null
  placeholderHomeName?: string | null
  placeholderAwayName?: string | null
  officialHomeGoals?: number | null
  officialAwayGoals?: number | null
  liveHomeGoals?: number | null
  liveAwayGoals?: number | null
  penaltyHomeGoals?: number | null
  penaltyAwayGoals?: number | null
  wentToPenalties?: boolean | null
  matchday?: { name: string } | null
  stadium?: { name: string; city?: string | null; country?: string | null } | null
}

const PHASE_LABEL: Record<string, string> = {
  GROUPS: 'Fase de grupos',
  ROUND_OF_32: 'Ronda de 32',
  ROUND_OF_16: 'Octavos',
  QUARTER_FINAL: 'Cuartos',
  SEMI_FINAL: 'Semifinal',
  THIRD_PLACE: '3er lugar',
  FINAL: 'Final',
}

function TeamBlock({ team, placeholder, side }: {
  team?: MatchCardData['homeTeam']
  placeholder?: string | null
  side: 'home' | 'away'
}) {
  const url = team?.flagUrl ?? flagUrl(team?.fifaCode)
  const name = team?.name ?? placeholder ?? '?'
  return (
    <div className={`flex items-center gap-2 ${side === 'away' ? 'flex-row-reverse text-right' : ''} flex-1 min-w-0`}>
      {url ? (
        <Image src={url} alt={name} width={28} height={20} className="rounded-sm shrink-0 border" unoptimized />
      ) : (
        <div className="w-7 h-5 rounded-sm bg-gray-200 shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate leading-tight">{name}</p>
        {team?.fifaCode && <p className="text-[10px] text-gray-500 leading-tight">{team.fifaCode}</p>}
      </div>
    </div>
  )
}

export function MatchCard({
  match,
  isStar,
  children,
  highlight,
}: {
  match: MatchCardData
  isStar?: boolean
  children?: React.ReactNode
  highlight?: boolean
}) {
  const hasOfficial = match.officialHomeGoals !== null && match.officialHomeGoals !== undefined
  const isLive = ['EN_JUEGO', 'MEDIO_TIEMPO', 'TIEMPO_EXTRA', 'PENALES'].includes(match.status)
  const showLive = isLive && match.liveHomeGoals !== null && match.liveHomeGoals !== undefined
  // Source of truth: kickoffAtUtc (real instant). kickoffAtCostaRica is double-shifted in DB,
  // so we always format from UTC and let toLocale* apply the Costa Rica offset once.
  const date = new Date(match.kickoffAtUtc ?? match.kickoffAtCostaRica)
  const dateStr = date.toLocaleDateString('es-CR', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'America/Costa_Rica' })
  const timeStr = date.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Costa_Rica' })
  const phaseLabel = PHASE_LABEL[match.phase] ?? match.phase
  const venueName = match.stadium?.name
  const venueCity = [match.stadium?.city, match.stadium?.country].filter(Boolean).join(', ')

  return (
    <div className={`bg-white rounded-xl border relative ${
      isStar
        ? 'border-yellow-400 ring-2 ring-yellow-300 shadow-md shadow-yellow-100'
        : highlight
          ? 'border-emerald-400 ring-1 ring-emerald-200'
          : 'border-gray-200'
    } overflow-hidden`}>
      <div className={`px-4 py-2 border-b text-[11px] text-gray-700 flex items-center justify-between gap-2 flex-wrap ${
        isStar
          ? 'bg-gradient-to-r from-yellow-100 via-amber-50 to-yellow-100'
          : 'bg-gradient-to-r from-emerald-50 to-blue-50'
      }`}>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{phaseLabel}</span>
          {match.groupCode && <span className="text-gray-500">· Grupo {match.groupCode}</span>}
          {match.matchday?.name && <span className="text-gray-500">· {match.matchday.name}</span>}
        </div>
        <MatchStatusBadge status={match.status} />
      </div>

      {isStar && (
        <div className="flex justify-center -mt-1 pt-3 pb-1">
          <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-white text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg shadow-amber-200 border-2 border-white">
            <Star size={16} className="fill-white drop-shadow" />
            Partido estrella
            <Star size={16} className="fill-white drop-shadow" />
          </div>
        </div>
      )}

      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          <TeamBlock team={match.homeTeam} placeholder={match.placeholderHomeName} side="home" />
          <div className="text-center shrink-0 px-2">
            {hasOfficial ? (
              <p className="text-xl font-bold text-blue-700 leading-none">
                {match.officialHomeGoals} <span className="text-gray-400">-</span> {match.officialAwayGoals}
              </p>
            ) : showLive ? (
              <p className="text-xl font-bold text-red-600 leading-none animate-pulse">
                {match.liveHomeGoals} <span className="text-gray-400">-</span> {match.liveAwayGoals}
              </p>
            ) : (
              <p className="text-base font-semibold text-gray-400 leading-none">vs</p>
            )}
            {match.wentToPenalties && match.penaltyHomeGoals !== null && match.penaltyHomeGoals !== undefined && (
              <p className="text-[10px] text-gray-500 mt-1">pen {match.penaltyHomeGoals}-{match.penaltyAwayGoals}</p>
            )}
          </div>
          <TeamBlock team={match.awayTeam} placeholder={match.placeholderAwayName} side="away" />
        </div>

        <div className="mt-3 pt-2 border-t border-dashed border-gray-200 flex flex-col gap-1 text-[11px] text-gray-600">
          <div className="flex items-center gap-1.5">
            <Calendar size={12} className="text-gray-400 shrink-0" />
            <span className="capitalize">{dateStr}</span>
            <span>·</span>
            <span className="font-semibold">{timeStr} CR</span>
          </div>
          {venueName && (
            <div className="flex items-center gap-1.5">
              <MapPin size={12} className="text-gray-400 shrink-0" />
              <span className="truncate">{venueName}{venueCity ? ` — ${venueCity}` : ''}</span>
            </div>
          )}
        </div>

        {children}
      </div>
    </div>
  )
}

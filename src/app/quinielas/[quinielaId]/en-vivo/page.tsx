'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import Image from 'next/image'
import AppShell from '@/components/layout/AppShell'
import { MatchStatusBadge } from '@/components/quiniela/MatchStatusBadge'
import { flagUrl } from '@/lib/flags'
import { Star, Bot, User, Trophy, Radio, Wifi, WifiOff } from 'lucide-react'
import { BallLoader } from '@/components/ui/BallLoader'
import { useLivePredictions, type LiveMatch, type LiveProfile as Profile } from '@/hooks/useLivePredictions'

type LiveFilter = 'all' | 'live' | 'finished'

const PHASE_LABEL: Record<string, string> = {
  GROUPS: 'Grupos',
  ROUND_OF_32: 'Ronda 32',
  ROUND_OF_16: 'Octavos',
  QUARTER_FINAL: 'Cuartos',
  SEMI_FINAL: 'Semifinal',
  THIRD_PLACE: '3er lugar',
  FINAL: 'Final',
}

function FlagImg({ team, placeholder }: { team?: LiveMatch['homeTeam']; placeholder?: string | null }) {
  const url = team?.flagUrl ?? flagUrl(team?.fifaCode)
  const name = team?.name ?? placeholder ?? '?'
  return (
    <div className="flex items-center gap-2 min-w-0">
      {url ? (
        <Image src={url} alt={name} width={28} height={20} className="rounded-sm border shrink-0" unoptimized />
      ) : (
        <div className="w-7 h-5 rounded-sm bg-gray-200 shrink-0" />
      )}
      <span className="font-semibold text-sm truncate">{team?.fifaCode ?? name}</span>
    </div>
  )
}

function ProfileRow({ profile, refHome, refAway }: { profile: Profile; refHome: number | null; refAway: number | null }) {
  const hasRef = refHome !== null && refAway !== null
  const exact =
    hasRef &&
    profile.predictedHome === refHome &&
    profile.predictedAway === refAway

  const bgClass =
    profile.livePoints === null
      ? 'bg-gray-50'
      : profile.livePoints === 0
      ? 'bg-red-50'
      : exact
      ? 'bg-emerald-100'
      : 'bg-yellow-50'

  return (
    <div
      className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border ${bgClass} ${
        profile.isSelf ? 'ring-2 ring-blue-400' : ''
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {profile.generatedByBot ? (
          <Bot size={14} className="text-purple-500 shrink-0" />
        ) : (
          <User size={14} className="text-gray-500 shrink-0" />
        )}
        <span className="text-sm font-medium truncate">
          {profile.userName}
          {profile.isSelf && <span className="text-blue-600 ml-1">(tú)</span>}
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {profile.hasPrediction ? (
          profile.predictedHome !== null ? (
            <span className="text-sm font-bold tabular-nums">
              {profile.predictedHome} - {profile.predictedAway}
            </span>
          ) : (
            <span className="text-xs text-gray-400 italic">oculto</span>
          )
        ) : (
          <span className="text-xs text-gray-400 italic">sin pred.</span>
        )}

        {profile.livePoints !== null && (
          <div className="flex items-center gap-1">
            <span
              className={`text-sm font-bold tabular-nums ${
                profile.livePoints === 0 ? 'text-gray-500' : 'text-emerald-700'
              }`}
            >
              {profile.livePoints} pts
            </span>
            {profile.isProvisional && profile.livePoints > 0 && (
              <span className="text-[9px] text-orange-600 font-semibold">PROV</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function LiveMatchCard({ match }: { match: LiveMatch }) {
  const isFinal = match.status === 'FINALIZADO'
  const refHome = isFinal ? match.officialHomeGoals : match.liveHomeGoals
  const refAway = isFinal ? match.officialAwayGoals : match.liveAwayGoals
  const hasRef = refHome !== null && refAway !== null

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden shadow-sm">
      <div className="px-4 py-2 bg-gradient-to-r from-blue-900 to-emerald-700 text-white text-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          {match.isStar && <Star size={12} className="text-yellow-300 fill-yellow-300" />}
          <span className="font-bold">{PHASE_LABEL[match.phase] ?? match.phase}</span>
          {match.matchday?.name && <span className="text-blue-100">· {match.matchday.name}</span>}
        </div>
        <MatchStatusBadge status={match.status} />
      </div>

      <div className="px-4 py-4 bg-gradient-to-b from-gray-50 to-white">
        <div className="flex items-center justify-between gap-2">
          <FlagImg team={match.homeTeam} placeholder={match.placeholderHomeName} />
          <div className="text-center px-3 shrink-0">
            {hasRef ? (
              <div className="flex items-center gap-2">
                <p
                  className={`text-3xl font-black tabular-nums leading-none ${
                    isFinal ? 'text-blue-900' : 'text-red-600'
                  }`}
                >
                  {refHome} <span className="text-gray-400">-</span> {refAway}
                </p>
                {!isFinal && <Radio size={14} className="text-red-500 animate-pulse" />}
              </div>
            ) : (
              <p className="text-base text-gray-400 font-semibold">vs</p>
            )}
            <p className={`text-[10px] mt-1 font-bold ${isFinal ? 'text-blue-700' : 'text-red-600'}`}>
              {isFinal ? 'FINAL' : hasRef ? 'EN VIVO' : 'POR INICIAR'}
            </p>
          </div>
          <div className="flex-row-reverse flex">
            <FlagImg team={match.awayTeam} placeholder={match.placeholderAwayName} />
          </div>
        </div>

        {match.stadium?.name && (
          <p className="text-[10px] text-gray-500 text-center mt-2">
            {match.stadium.name}
            {match.stadium.city ? ` · ${match.stadium.city}` : ''}
          </p>
        )}
      </div>

      <div className="px-3 py-3 border-t bg-white">
        <div className="flex items-center gap-1.5 mb-2 text-[11px] text-gray-600 font-semibold uppercase tracking-wide">
          <Trophy size={11} />
          Pronósticos por perfil ({match.profiles.length})
        </div>
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {match.profiles.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No hay participantes activos.</p>
          ) : (
            match.profiles.map((p) => (
              <ProfileRow key={p.userId} profile={p} refHome={refHome} refAway={refAway} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default function EnVivoPage() {
  const params = useParams<{ quinielaId: string }>()
  const quinielaId = params.quinielaId

  const { data, status, updatedAt } = useLivePredictions(quinielaId)
  const isLoading = !data
  const dataUpdatedAt = updatedAt

  const [filter, setFilter] = useState<LiveFilter>('all')

  const matches = data?.matches ?? []
  const live = matches.filter((m) => m.status !== 'FINALIZADO')
  const finished = matches.filter((m) => m.status === 'FINALIZADO')

  const showLive = filter === 'all' || filter === 'live'
  const showFinished = filter === 'all' || filter === 'finished'

  const filterButtonCls = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
      active
        ? 'bg-blue-900 text-white shadow-sm'
        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
    }`

  return (
    <AppShell quinielaId={quinielaId}>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Radio className="text-red-500 animate-pulse" size={22} />
              En Vivo
            </h1>
            <p className="text-sm text-gray-600">
              Marcador en tiempo real vs predicción de cada perfil.
              {status === 'live' && (
                <span className="ml-1 text-emerald-700 font-semibold">
                  Conectado en vivo · push instantáneo.
                </span>
              )}
              {status === 'polling' && (
                <span className="ml-1 text-blue-700 font-semibold">
                  Actualiza cada 5s.
                </span>
              )}
              {status === 'paused' && (
                <span className="ml-1 text-gray-500">Pausado (pestaña inactiva).</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            {status === 'live' ? (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <Wifi size={12} className="animate-pulse" /> EN VIVO
              </span>
            ) : status === 'polling' ? (
              <span className="inline-flex items-center gap-1 text-blue-700">
                <Wifi size={12} /> Sondeo
              </span>
            ) : status === 'paused' ? (
              <span className="inline-flex items-center gap-1 text-gray-400">
                <WifiOff size={12} /> Pausado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-600">
                <Wifi size={12} className="animate-pulse" /> Conectando…
              </span>
            )}
            {dataUpdatedAt > 0 && (
              <span>· {new Date(dataUpdatedAt).toLocaleTimeString('es-CR')}</span>
            )}
          </div>
        </div>

        {!isLoading && matches.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Filtrar:
            </span>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={filterButtonCls(filter === 'all')}
            >
              Todos ({matches.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('live')}
              className={filterButtonCls(filter === 'live')}
            >
              <span className="inline-flex items-center gap-1.5">
                <Radio size={11} className={filter === 'live' ? '' : 'text-red-500'} />
                En curso ({live.length})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFilter('finished')}
              className={filterButtonCls(filter === 'finished')}
            >
              <span className="inline-flex items-center gap-1.5">
                <Trophy size={11} className={filter === 'finished' ? '' : 'text-blue-700'} />
                Finalizados ({finished.length})
              </span>
            </button>
          </div>
        )}

        {isLoading ? (
          <BallLoader label="Cargando…" />
        ) : matches.length === 0 ? (
          <div className="bg-white border rounded-xl p-8 text-center">
            <Radio size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              No hay partidos en juego ni recientemente finalizados.
            </p>
          </div>
        ) : (
          <>
            {showLive && live.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-red-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Radio size={14} className="animate-pulse" />
                  En curso ({live.length})
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {live.map((m) => (
                    <LiveMatchCard key={m.id} match={m} />
                  ))}
                </div>
              </section>
            )}

            {showFinished && finished.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Trophy size={14} />
                  Finalizados recientemente ({finished.length})
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {finished.map((m) => (
                    <LiveMatchCard key={m.id} match={m} />
                  ))}
                </div>
              </section>
            )}

            {showLive && !showFinished && live.length === 0 && (
              <div className="bg-white border rounded-xl p-8 text-center">
                <Radio size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No hay partidos en curso.</p>
              </div>
            )}

            {showFinished && !showLive && finished.length === 0 && (
              <div className="bg-white border rounded-xl p-8 text-center">
                <Trophy size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No hay partidos finalizados recientemente.</p>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}

'use client'

import Image from 'next/image'
import { Star } from 'lucide-react'
import { flagUrl } from '@/lib/flags'
import { Medal } from '@/components/ui/Medal'
import { BotBadge } from '@/components/quiniela/BotBadge'

type MatchHeader = {
  id: string
  homeTeam: string
  awayTeam: string
  homeFifa?: string | null
  awayFifa?: string | null
  homeFlag?: string | null
  awayFlag?: string | null
  officialHome?: number | null
  officialAway?: number | null
  status: string
  isStar: boolean
}

type Cell = {
  matchId: string
  prediction: { home: number; away: number; isBot: boolean } | null
  points: number | null
  reason: string | null
}

type Row = {
  userId: string
  name: string
  isMe: boolean
  cells: Cell[]
}

type Props = {
  matches: MatchHeader[]
  rows: Row[]
}

const REASON_CLS: Record<string, string> = {
  'Marcador exacto': 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300',
  'Ganador correcto': 'bg-sky-100 text-sky-900 ring-1 ring-sky-300',
  'Empate correcto': 'bg-sky-100 text-sky-900 ring-1 ring-sky-300',
  'Sin acierto': 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

function FlagBadge({ code, flag, name }: { code?: string | null; flag?: string | null; name: string }) {
  const url = flag ?? flagUrl(code ?? undefined)
  if (url) {
    return <Image src={url} alt={name} width={22} height={16} className="rounded-sm border border-gray-200 inline-block" unoptimized />
  }
  return <span className="text-[10px] font-bold text-gray-500">{(code ?? name).slice(0, 3).toUpperCase()}</span>
}

export function PredictionMatrix({ matches, rows }: Props) {
  if (matches.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
        <p className="text-sm">No hay partidos bloqueados o finalizados aún.</p>
      </div>
    )
  }

  const totals = rows.map((r) => ({
    userId: r.userId,
    total: r.cells.reduce((acc, c) => acc + (c.points ?? 0), 0),
  }))
  const totalsMap = new Map(totals.map((t) => [t.userId, t.total]))
  const sortedRows = [...rows].sort((a, b) => (totalsMap.get(b.userId) ?? 0) - (totalsMap.get(a.userId) ?? 0))

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="text-xs min-w-max border-separate border-spacing-0">
        <thead>
          <tr className="bg-gradient-to-r from-blue-950 to-emerald-800 text-white">
            <th className="sticky left-0 z-20 bg-blue-950 px-3 py-3 text-left font-black uppercase tracking-wider text-[10px] min-w-[180px] border-r border-blue-800">
              Participante
            </th>
            {matches.map((m) => {
              const hasOfficial = m.officialHome != null && m.officialAway != null
              return (
                <th key={m.id} className="px-2 py-2 text-center font-medium min-w-[96px] border-l border-blue-800">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    {m.isStar && <Star size={11} className="text-yellow-400 fill-yellow-300" />}
                    <FlagBadge code={m.homeFifa} flag={m.homeFlag} name={m.homeTeam} />
                    <span className="text-[10px] font-bold opacity-75">vs</span>
                    <FlagBadge code={m.awayFifa} flag={m.awayFlag} name={m.awayTeam} />
                  </div>
                  {hasOfficial ? (
                    <div className="font-black text-yellow-300 text-sm tabular-nums">
                      {m.officialHome}-{m.officialAway}
                    </div>
                  ) : (
                    <div className="font-bold text-blue-200 text-[10px] uppercase tracking-wide">Pendiente</div>
                  )}
                </th>
              )
            })}
            <th className="sticky right-0 z-20 bg-yellow-400 text-blue-950 px-3 py-3 text-center font-black uppercase tracking-wider text-[10px] min-w-[72px] border-l border-yellow-500">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, idx) => {
            const total = totalsMap.get(row.userId) ?? 0
            const rowBg = row.isMe
              ? 'bg-yellow-50'
              : idx % 2 === 0
              ? 'bg-white'
              : 'bg-gray-50/60'
            return (
              <tr key={row.userId} className={`${rowBg} hover:bg-emerald-50/40 transition-colors`}>
                <td className={`sticky left-0 z-10 px-3 py-2 font-bold text-blue-950 border-r border-gray-200 ${rowBg}`}>
                  <div className="flex items-center gap-2">
                    {idx < 3 ? (
                      <Medal
                        kind={idx === 0 ? 'gold' : idx === 1 ? 'silver' : 'bronze'}
                        size={28}
                      />
                    ) : (
                      <span className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-blue-900 to-emerald-700 text-yellow-300 flex items-center justify-center font-black text-[10px]">
                        {initials(row.name)}
                      </span>
                    )}
                    <span className="truncate max-w-[120px]">{row.name}</span>
                    {row.isMe && (
                      <span className="text-[9px] uppercase tracking-wider text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full font-bold shrink-0">
                        tú
                      </span>
                    )}
                  </div>
                </td>
                {row.cells.map((cell) => {
                  const cls = cell.reason ? REASON_CLS[cell.reason] ?? '' : ''
                  return (
                    <td key={cell.matchId} className="px-1.5 py-1.5 text-center border-l border-gray-100 align-middle">
                      {cell.prediction ? (
                        <div className={`rounded-md px-1.5 py-1 ${cls || 'bg-gray-50 text-gray-600'}`}>
                          <div className="font-mono font-black text-sm tabular-nums leading-none">
                            {cell.prediction.home}-{cell.prediction.away}
                          </div>
                          <div className="flex items-center justify-center gap-1 mt-1">
                            {cell.prediction.isBot && <BotBadge variant="icon" size={11} />}
                            {cell.points !== null && (
                              <span className="text-[10px] font-bold tabular-nums">{cell.points}pt</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  )
                })}
                <td className={`sticky right-0 z-10 px-3 py-2 text-center border-l border-gray-200 ${rowBg}`}>
                  <span className="inline-flex items-center justify-center min-w-[40px] h-8 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 text-blue-950 font-black text-sm tabular-nums shadow-sm">
                    {total}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

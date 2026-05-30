'use client'

import { useEffect, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import AppShell from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { BallLoader } from '@/components/ui/BallLoader'
import { Search, Link2, Unlink, Zap, UserCog, RefreshCw, CheckCircle2, Trash2, Pencil } from 'lucide-react'
import { teamsMatch } from '@/lib/team-matching'

type Match = {
  id: string
  eventId: string
  eventName: string
  kickoffAtUtc: string
  matchdayName: string | null
  phase: string
  status: string
  homeName: string
  awayName: string
  homeFifa: string | null
  awayFifa: string | null
  externalId: string | null
  externalProvider: string | null
  manualOverride: boolean
  liveSource: 'NONE' | 'API_AUTO' | 'ADMIN_MANUAL'
  liveHomeGoals: number | null
  liveAwayGoals: number | null
  officialHomeGoals: number | null
  officialAwayGoals: number | null
  lastSyncAt: string | null
}

type Fixture = {
  id: string
  date: string
  statusShort: string
  statusLong: string
  leagueName: string | null
  season: number | null
  homeName: string
  awayName: string
  homeGoals: number | null
  awayGoals: number | null
}

function crDate(iso: string) {
  return new Date(iso).toLocaleString('es-CR', {
    timeZone: 'America/Costa_Rica',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Team-name matching moved to src/lib/team-matching.ts (shared with the
// live-score sync job so home/away orientation can be reconciled server-side).

export default function AdminPartidosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [eventFilter, setEventFilter] = useState<string>('all')
  const [searchDate, setSearchDate] = useState<string>('')
  const [searchTournament, setSearchTournament] = useState<string>('')
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [fixturesProvider, setFixturesProvider] = useState<string>('espn')
  const [searching, setSearching] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')
  const [syncing, setSyncing] = useState(false)
  const [scoreEditId, setScoreEditId] = useState<string | null>(null)
  const [scoreHome, setScoreHome] = useState<string>('')
  const [scoreAway, setScoreAway] = useState<string>('')
  const [scoreStatus, setScoreStatus] = useState<'EN_JUEGO' | 'MEDIO_TIEMPO' | 'TIEMPO_EXTRA' | 'PENALES' | 'FINALIZADO'>('EN_JUEGO')
  const [scoreSaving, setScoreSaving] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    if (session.user.globalRole !== 'SUPER_ADMIN') {
      router.push('/quinielas')
      return
    }
    void loadMatches()
  }, [session, status, router])

  async function loadMatches() {
    try {
      const res = await fetch('/api/admin/matches')
      if (!res.ok) {
        const info = await res.json().catch(() => null)
        toast.error(info?.error ?? `Error ${res.status} cargando partidos.`)
        if (info?.hint) console.warn('[admin/partidos]', info.hint, info.detail)
        setMatches([]) // unblock the UI from "Cargando…"
        return
      }
      setMatches(await res.json())
    } catch (e) {
      toast.error(`No se pudo cargar la lista de partidos: ${(e as Error).message}`)
      setMatches([])
    }
  }

  async function searchFixtures() {
    if (!searchDate) {
      toast.error('Selecciona una fecha primero.')
      return
    }
    setSearching(true)
    try {
      const params = new URLSearchParams({ date: searchDate })
      if (searchTournament) params.set('tournament', searchTournament)
      const res = await fetch(`/api/admin/external-fixtures?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Error consultando proveedor')
      setFixtures(json.fixtures ?? [])
      setFixturesProvider(json.provider ?? 'espn')
      toast.success(`${json.count} fixtures encontrados (provider: ${json.provider}).`)
    } catch (e) {
      toast.error((e as Error).message)
      setFixtures([])
    } finally {
      setSearching(false)
    }
  }

  async function linkMatch(matchId: string, externalId: string | null) {
    const res = await fetch(`/api/admin/matches/${matchId}/external`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      // Solo mandamos externalProvider cuando vinculamos. El endpoint lo
      // pone null automaticamente cuando externalId === null (Zod rechaza
      // externalProvider: null porque el schema lo declara solo como string).
      body: JSON.stringify(
        externalId
          ? { externalId, externalProvider: fixturesProvider }
          : { externalId: null },
      ),
    })
    if (!res.ok) {
      const info = await res.json().catch(() => null)
      toast.error(info?.error ?? 'Error al vincular.')
      return
    }
    toast.success(externalId ? 'Vinculado.' : 'Desvinculado.')
    setEditingId(null)
    setEditingValue('')
    await loadMatches()
  }

  function startScoreEdit(m: Match) {
    setScoreEditId(m.id)
    setScoreHome(m.liveHomeGoals?.toString() ?? '0')
    setScoreAway(m.liveAwayGoals?.toString() ?? '0')
    // Default a status that makes sense for live entry. If the match was
    // PROGRAMADO/BLOQUEADO, jump to EN_JUEGO so the admin can start scoring.
    const cur = m.status as string
    if (cur === 'EN_JUEGO' || cur === 'MEDIO_TIEMPO' || cur === 'TIEMPO_EXTRA' || cur === 'PENALES' || cur === 'FINALIZADO') {
      setScoreStatus(cur)
    } else {
      setScoreStatus('EN_JUEGO')
    }
  }

  function cancelScoreEdit() {
    setScoreEditId(null)
    setScoreHome('')
    setScoreAway('')
  }

  async function saveScore(matchId: string) {
    const home = parseInt(scoreHome, 10)
    const away = parseInt(scoreAway, 10)
    if (Number.isNaN(home) || Number.isNaN(away) || home < 0 || away < 0) {
      toast.error('Marcador inválido.')
      return
    }
    setScoreSaving(true)
    try {
      const res = await fetch(`/api/matches/${matchId}/live`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveHomeGoals: home, liveAwayGoals: away, status: scoreStatus }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error ?? 'No se pudo guardar el marcador.')
        return
      }
      toast.success(data?.message ?? 'Marcador guardado.')
      cancelScoreEdit()
      await loadMatches()
    } finally {
      setScoreSaving(false)
    }
  }

  async function toggleOverride(matchId: string, manualOverride: boolean) {
    const res = await fetch(`/api/admin/matches/${matchId}/external`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manualOverride }),
    })
    if (!res.ok) {
      toast.error('Error al cambiar modo.')
      return
    }
    toast.success(manualOverride ? 'Modo manual activado.' : 'Modo automático restaurado.')
    await loadMatches()
  }

  async function autoMatchVisible() {
    if (fixtures.length === 0) {
      toast.error('Busca fixtures primero.')
      return
    }
    const visible = filteredMatches.filter((m) => !m.externalId && m.homeName !== '—' && m.awayName !== '—')
    if (visible.length === 0) {
      toast.info('No hay partidos sin vincular en la vista actual.')
      return
    }

    let matched = 0
    for (const match of visible) {
      const fixture = fixtures.find(
        (f) =>
          (teamsMatch(f.homeName, match.homeName) && teamsMatch(f.awayName, match.awayName)) ||
          (teamsMatch(f.homeName, match.awayName) && teamsMatch(f.awayName, match.homeName)),
      )
      if (!fixture) continue
      const res = await fetch(`/api/admin/matches/${match.id}/external`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ externalId: fixture.id, externalProvider: fixturesProvider }),
      })
      if (res.ok) matched++
    }

    toast.success(`${matched} de ${visible.length} partidos vinculados.`)
    await loadMatches()
  }

  async function forceStatus(matchId: string, status: 'PROGRAMADO' | 'BLOQUEADO' | 'EN_JUEGO' | 'FINALIZADO') {
    const res = await fetch(`/api/admin/matches/${matchId}/force-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      toast.error('Error al cambiar estado.')
      return
    }
    toast.success(`Estado forzado: ${status}.`)
    await loadMatches()
  }

  async function clearAllLinks() {
    if (!confirm('¿Borrar TODOS los external IDs vinculados? Útil si cambiaste de proveedor (ej. Sofascore → ESPN). Tendrás que re-vincular cada partido.')) {
      return
    }
    const res = await fetch('/api/admin/matches/clear-external', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (!res.ok) {
      toast.error('Error al limpiar enlaces.')
      return
    }
    const json = await res.json()
    toast.success(`${json.cleared} enlaces borrados.`)
    await loadMatches()
  }

  async function runSync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/admin/sync-now', { method: 'POST' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(json?.error ?? `Error ${res.status} en sync.`)
        return
      }
      const msg =
        json?.candidates === 0
          ? json?.message ?? 'No hay partidos activos vinculados aún.'
          : `Sincronizados: ${json?.synced ?? 0} (${json?.finalized ?? 0} finalizados) · provider: ${json?.provider}`
      toast.success(msg)
      await loadMatches()
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`)
    } finally {
      setSyncing(false)
    }
  }

  const events = useMemo(() => {
    if (!matches) return []
    const map = new Map<string, string>()
    for (const m of matches) map.set(m.eventId, m.eventName)
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [matches])

  const filteredMatches = useMemo(() => {
    if (!matches) return []
    if (eventFilter === 'all') return matches
    return matches.filter((m) => m.eventId === eventFilter)
  }, [matches, eventFilter])

  const linkedCount = filteredMatches.filter((m) => m.externalId).length

  if (!session || session.user.globalRole !== 'SUPER_ADMIN') return null

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black text-pitch-dark flex items-center gap-2">
            <Link2 className="text-emerald-700" size={28} />
            Vinculación de Partidos (ESPN)
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Asigna a cada partido su <strong>event id</strong> de ESPN para que los
            marcadores se sincronicen automáticamente cada minuto durante el juego.
          </p>
        </div>

        {/* ── Buscador de fixtures ──────────────────────────────────────── */}
        <div className="card-pitch rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Search size={18} /> Buscar fixtures (ESPN — gratis, sin API key)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Fecha</label>
              <Input type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">
                Filtro torneo (opcional)
              </label>
              <Input
                placeholder='ej. "Friendly" o "World Cup"'
                value={searchTournament}
                onChange={(e) => setSearchTournament(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={searchFixtures} disabled={searching} className="w-full">
                {searching ? 'Buscando…' : 'Buscar'}
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-gray-500 -mt-1">
            Tip: deja el filtro vacío para ver TODOS los partidos del día (puede ser largo) o pon{' '}
            <em>"Friendly"</em> para amistosos, <em>"World Cup"</em> para Mundial 2026.
          </p>

          {fixtures.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-2 pt-2">
                <p className="text-xs text-gray-600">
                  {fixtures.length} fixtures encontrados.
                </p>
                <Button size="sm" onClick={autoMatchVisible} variant="outline">
                  <CheckCircle2 size={14} /> Auto-vincular partidos visibles por nombre
                </Button>
              </div>
              <div className="max-h-72 overflow-y-auto border rounded-lg bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-semibold">ID</th>
                      <th className="px-3 py-2 font-semibold">Fecha</th>
                      <th className="px-3 py-2 font-semibold">Liga</th>
                      <th className="px-3 py-2 font-semibold">Local</th>
                      <th className="px-3 py-2 font-semibold">Visitante</th>
                      <th className="px-3 py-2 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fixtures.map((f) => (
                      <tr key={f.id} className="border-t hover:bg-emerald-50/40">
                        <td className="px-3 py-1.5 font-mono text-blue-700">{f.id}</td>
                        <td className="px-3 py-1.5">{crDate(f.date)}</td>
                        <td className="px-3 py-1.5 text-gray-600">{f.leagueName}</td>
                        <td className="px-3 py-1.5">{f.homeName}</td>
                        <td className="px-3 py-1.5">{f.awayName}</td>
                        <td className="px-3 py-1.5 text-gray-500">{f.statusShort}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* ── Lista de partidos ─────────────────────────────────────────── */}
        <div className="card-pitch rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold">Partidos en Ki-Niela</h2>
              <p className="text-xs text-gray-600">
                Vinculados: <span className="font-bold text-emerald-700">{linkedCount}</span> /{' '}
                {filteredMatches.length}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="text-sm rounded-md border-gray-300"
              >
                <option value="all">Todos los eventos</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
              <Button size="sm" variant="outline" onClick={loadMatches}>
                <RefreshCw size={14} /> Refrescar
              </Button>
              <Button size="sm" variant="outline" onClick={runSync} disabled={syncing}>
                <Zap size={14} /> {syncing ? 'Sync…' : 'Test sync'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={clearAllLinks}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                title="Borra TODOS los external IDs (útil al cambiar de proveedor)"
              >
                <Trash2 size={14} /> Limpiar IDs
              </Button>
            </div>
          </div>

          {!matches ? (
            <BallLoader label="Cargando partidos…" />
          ) : filteredMatches.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No hay partidos.</p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-xs">
                <thead className="bg-gradient-to-r from-blue-950 to-emerald-800 text-white text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-2">Fecha</th>
                    <th className="text-left px-3 py-2">Evento</th>
                    <th className="text-left px-3 py-2">Partido</th>
                    <th className="text-left px-3 py-2">Estado</th>
                    <th className="text-left px-3 py-2">Marcador</th>
                    <th className="text-left px-3 py-2 min-w-[220px]">External ID</th>
                    <th className="text-left px-3 py-2">Modo</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMatches.map((m) => {
                    const linked = !!m.externalId
                    const live = m.liveHomeGoals !== null && m.liveAwayGoals !== null
                    return (
                      <tr key={m.id} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap">{crDate(m.kickoffAtUtc)}</td>
                        <td className="px-3 py-2 text-gray-600">{m.eventName}</td>
                        <td className="px-3 py-2 font-semibold whitespace-nowrap">
                          {m.homeName} <span className="text-gray-400">vs</span> {m.awayName}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={m.status}
                            onChange={(e) => forceStatus(m.id, e.target.value as 'PROGRAMADO' | 'BLOQUEADO' | 'EN_JUEGO' | 'FINALIZADO')}
                            className="text-[10px] font-bold uppercase border border-gray-300 rounded px-1 py-0.5 bg-white"
                            title="Forzar estado (test)"
                          >
                            <option value="PROGRAMADO">PROGRAMADO</option>
                            <option value="BLOQUEADO">BLOQUEADO</option>
                            <option value="EN_JUEGO">EN_JUEGO</option>
                            <option value="FINALIZADO">FINALIZADO</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {scoreEditId === m.id ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  className="w-12 h-7 text-center border border-gray-300 rounded text-sm"
                                  value={scoreHome}
                                  onChange={(e) => setScoreHome(e.target.value)}
                                  autoFocus
                                />
                                <span className="text-gray-400">-</span>
                                <input
                                  type="number"
                                  min={0}
                                  className="w-12 h-7 text-center border border-gray-300 rounded text-sm"
                                  value={scoreAway}
                                  onChange={(e) => setScoreAway(e.target.value)}
                                />
                              </div>
                              <select
                                value={scoreStatus}
                                onChange={(e) => setScoreStatus(e.target.value as typeof scoreStatus)}
                                className="text-[10px] font-bold uppercase border border-gray-300 rounded px-1 py-0.5 bg-white"
                              >
                                <option value="EN_JUEGO">EN_JUEGO</option>
                                <option value="MEDIO_TIEMPO">MEDIO_TIEMPO</option>
                                <option value="TIEMPO_EXTRA">TIEMPO_EXTRA</option>
                                <option value="PENALES">PENALES</option>
                                <option value="FINALIZADO">FINALIZADO</option>
                              </select>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  className="h-6 text-xs px-2"
                                  onClick={() => saveScore(m.id)}
                                  disabled={scoreSaving}
                                >
                                  {scoreSaving ? '...' : '✓ Guardar'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-xs px-2"
                                  onClick={cancelScoreEdit}
                                >
                                  ✕
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => startScoreEdit(m)}
                              className="inline-flex items-center gap-2 hover:bg-gray-100 rounded px-2 py-1 transition"
                              title="Editar marcador manualmente"
                            >
                              {live ? (
                                <span className="text-emerald-700 font-semibold">{m.liveHomeGoals} - {m.liveAwayGoals}</span>
                              ) : (
                                <span className="text-gray-300">— —</span>
                              )}
                              <Pencil size={12} className="text-gray-400" />
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2 min-w-[220px] whitespace-nowrap">
                          {editingId === m.id ? (
                            <div className="flex gap-1">
                              <Input
                                className="h-7 text-xs w-24"
                                placeholder="fixture id"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                autoFocus
                              />
                              <Button
                                size="sm"
                                onClick={() => linkMatch(m.id, editingValue.trim() || null)}
                                className="h-7"
                              >
                                ✓
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setEditingId(null); setEditingValue('') }}
                                className="h-7"
                              >
                                ✕
                              </Button>
                            </div>
                          ) : linked ? (
                            <div className="flex items-center gap-1.5 flex-nowrap">
                              <div className="flex flex-col leading-tight min-w-0 max-w-[120px]">
                                <span
                                  className="font-mono text-[11px] text-blue-700 truncate"
                                  title={m.externalId ?? ''}
                                >
                                  {m.externalId}
                                </span>
                                {m.externalProvider && (
                                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                                    {m.externalProvider}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => { setEditingId(m.id); setEditingValue(m.externalId ?? '') }}
                                className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md text-blue-600 bg-blue-50 hover:text-white hover:bg-blue-600 border border-blue-200 transition shadow-sm"
                                title="Editar external ID"
                                aria-label="Editar"
                              >
                                <Pencil size={15} strokeWidth={2.25} />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`¿Desvincular ${m.homeName} vs ${m.awayName} de ESPN?`)) {
                                    linkMatch(m.id, null)
                                  }
                                }}
                                className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md text-red-600 bg-red-50 hover:text-white hover:bg-red-600 border border-red-200 transition shadow-sm"
                                title="Desvincular de ESPN"
                                aria-label="Desvincular"
                              >
                                <Unlink size={15} strokeWidth={2.25} />
                              </button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px]"
                              onClick={() => { setEditingId(m.id); setEditingValue('') }}
                            >
                              <Link2 size={11} /> Vincular
                            </Button>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <Switch
                              checked={!m.manualOverride}
                              onCheckedChange={(v) => toggleOverride(m.id, !v)}
                              disabled={!linked}
                            />
                            <span className="text-[10px] text-gray-600">
                              {m.manualOverride ? (
                                <span className="inline-flex items-center gap-0.5 text-amber-700">
                                  <UserCog size={10} /> Manual
                                </span>
                              ) : linked ? (
                                <span className="inline-flex items-center gap-0.5 text-emerald-700">
                                  <Zap size={10} /> Auto
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded-lg p-3 leading-relaxed space-y-1">
          <p>
            <strong>Cómo usar:</strong> 1) Selecciona la fecha (p. ej. 2026-05-30) y opcionalmente
            un filtro de torneo (<em>"Friendly"</em>, <em>"World Cup"</em>) y dale Buscar.
            2) Aparecen los fixtures encontrados. 3) Pulsa{' '}
            <em>"Auto-vincular partidos visibles por nombre"</em> y los partidos cuyos
            equipos coincidan se vinculan solos. 4) Para los que no se mapearon, pulsa
            <em> Vincular</em> en cada fila y pega el ID que viste arriba. 5) El switch{' '}
            <em>Auto/Manual</em> decide si el cron toca ese partido o lo dejas para escribir el
            marcador a mano.
          </p>
          <p>
            <strong>Cobertura:</strong> ESPN tiene cobertura COMPLETA del Mundial 2026.
            Para amistosos, depende de cuáles tengan registrados — los que no aparezcan, no
            se sincronizan automáticamente, pero la quiniela funciona igual con marcador manual
            o sin marcador (la predicción del jugador queda guardada de todos modos).
          </p>
        </div>
      </div>
    </AppShell>
  )
}

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
import { Search, Link2, Unlink, Zap, UserCog, RefreshCw, CheckCircle2 } from 'lucide-react'

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

// Fuzzy team name matching (handles USA / United States, IVO/Ivory Coast etc.)
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function teamsMatch(a: string, b: string): boolean {
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) return true
  // Common abbreviations
  const map: Record<string, string[]> = {
    usa: ['unitedstates', 'unitedstatesofamerica'],
    uk: ['unitedkingdom', 'greatbritain'],
    rsa: ['southafrica'],
    ned: ['netherlands', 'holland'],
    ger: ['germany'],
    den: ['denmark'],
    swe: ['sweden'],
    nor: ['norway'],
    civ: ['ivorycoast', 'cotedivoire'],
    crc: ['costarica'],
    mex: ['mexico'],
    can: ['canada'],
    arg: ['argentina'],
    bra: ['brazil'],
    par: ['paraguay'],
    uru: ['uruguay'],
    chi: ['chile'],
    per: ['peru'],
    ecu: ['ecuador'],
    bol: ['bolivia'],
    ven: ['venezuela'],
    col: ['colombia'],
    fra: ['france'],
    esp: ['spain'],
    ita: ['italy'],
    por: ['portugal'],
    eng: ['england'],
    sco: ['scotland'],
    irl: ['ireland'],
    bel: ['belgium'],
    swi: ['switzerland'],
    aut: ['austria'],
    pol: ['poland'],
    cro: ['croatia'],
    ser: ['serbia'],
    rou: ['romania'],
    tur: ['turkey'],
    gre: ['greece'],
    rus: ['russia'],
    ukr: ['ukraine'],
    jpn: ['japan'],
    kor: ['southkorea', 'korearepublic'],
    aus: ['australia'],
    nzl: ['newzealand'],
    sen: ['senegal'],
    nga: ['nigeria'],
    egy: ['egypt'],
    mar: ['morocco'],
    alg: ['algeria'],
    tun: ['tunisia'],
    cmr: ['cameroon'],
    gha: ['ghana'],
    ken: ['kenya'],
    isr: ['israel'],
    irn: ['iran'],
    ksa: ['saudiarabia'],
    qat: ['qatar'],
    uae: ['unitedarabemirates'],
    ind: ['india'],
    chn: ['china', 'chinapr'],
    pak: ['pakistan'],
    sgp: ['singapore'],
    phi: ['philippines'],
    tha: ['thailand'],
    vie: ['vietnam'],
    idn: ['indonesia'],
    mas: ['malaysia'],
  }
  for (const [code, aliases] of Object.entries(map)) {
    if ((na === code && aliases.some((x) => nb.includes(x))) || (nb === code && aliases.some((x) => na.includes(x)))) {
      return true
    }
  }
  return false
}

export default function AdminPartidosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [eventFilter, setEventFilter] = useState<string>('all')
  const [searchDate, setSearchDate] = useState<string>('')
  const [searchTournament, setSearchTournament] = useState<string>('')
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [searching, setSearching] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')
  const [syncing, setSyncing] = useState(false)

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
      if (!res.ok) throw new Error()
      setMatches(await res.json())
    } catch {
      toast.error('No se pudo cargar la lista de partidos.')
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
      body: JSON.stringify({ externalId }),
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
        body: JSON.stringify({ externalId: fixture.id }),
      })
      if (res.ok) matched++
    }

    toast.success(`${matched} de ${visible.length} partidos vinculados.`)
    await loadMatches()
  }

  async function runSync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/jobs/sync-live-scores', {
        method: 'POST',
        // Browser can't set the cron secret header (it's server-side only),
        // but we can hit a safer admin-triggered route. For now we just hint.
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error('La sincronización debe llamarse desde el cron (usa CRON_SECRET).')
      } else {
        toast.success(`Sincronizados: ${json?.synced ?? 0}, finalizados: ${json?.finalized ?? 0}.`)
        await loadMatches()
      }
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
            Vinculación de Partidos (API-Football)
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Asigna a cada partido su <strong>fixture id</strong> de API-Football para que los
            marcadores se sincronicen automáticamente cada minuto durante el juego.
          </p>
        </div>

        {/* ── Buscador de fixtures ──────────────────────────────────────── */}
        <div className="card-pitch rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Search size={18} /> Buscar fixtures (Sofascore — gratis, sin API key)
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
                    <th className="text-left px-3 py-2">External ID</th>
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
                          <Badge variant="outline" className="text-[9px]">{m.status}</Badge>
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {live ? (
                            <span className="text-emerald-700">{m.liveHomeGoals} - {m.liveAwayGoals}</span>
                          ) : (
                            <span className="text-gray-300">— —</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
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
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-blue-700">{m.externalId}</span>
                              <button
                                onClick={() => { setEditingId(m.id); setEditingValue(m.externalId ?? '') }}
                                className="text-[10px] text-gray-500 hover:text-blue-700"
                                title="Editar"
                              >
                                ✎
                              </button>
                              <button
                                onClick={() => linkMatch(m.id, null)}
                                className="text-red-500 hover:text-red-700"
                                title="Desvincular"
                              >
                                <Unlink size={11} />
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
            <strong>Cobertura:</strong> Sofascore tiene cobertura COMPLETA del Mundial 2026.
            Para amistosos, depende de cuáles tengan registrados — los que no aparezcan, no
            se sincronizan automáticamente, pero la quiniela funciona igual con marcador manual
            o sin marcador (la predicción del jugador queda guardada de todos modos).
          </p>
        </div>
      </div>
    </AppShell>
  )
}

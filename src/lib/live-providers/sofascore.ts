/**
 * Sofascore live scores provider.
 *
 * Sofascore exposes the same JSON API that powers their public website and
 * mobile apps. It does NOT require an API key, has wide global coverage
 * (FIFA World Cup 2026 confirmed, international friendlies confirmed) and
 * updates near real-time.
 *
 * This is unofficial — Sofascore can change the URL shape any day. To
 * mitigate, the provider catches errors gracefully and the system always
 * falls back to admin-manual scoring when sync fails.
 *
 * Endpoints used:
 *   GET  /api/v1/event/{id}                       — single event detail
 *   GET  /api/v1/sport/football/events/live       — every live football match worldwide
 *   GET  /api/v1/sport/football/scheduled-events/{YYYY-MM-DD}  — fixtures for a date
 *
 * Status codes (status.type):
 *   notstarted   → PROGRAMADO
 *   inprogress   → EN_JUEGO  (status.code values: 6=1H, 7=2H, etc.)
 *   finished     → FINALIZADO
 *   postponed    → POSTERGADO
 *   canceled     → CANCELADO
 *
 * Status code (status.code) special values for halftime / extra time / penalties:
 *   31 = HT (halftime)
 *   41/42 = ET 1/2 (extra time halves)
 *   50 = AP (penalties / awaiting)
 *   91 = PEN (in penalty shootout)
 */

const SOFASCORE_BASE = process.env.SOFASCORE_BASE_URL ?? 'https://api.sofascore.com/api/v1'

// Browser-like UA reduces the chance of generic-bot blocks. Sofascore does not
// gate the API behind auth, but they sometimes 403 obvious bot UAs.
const HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
}

export type LiveFixture = {
  externalId: string
  status: string
  homeGoals: number | null
  awayGoals: number | null
  penaltyHomeGoals: number | null
  penaltyAwayGoals: number | null
  isLive: boolean
  isFinished: boolean
  homeName?: string
  awayName?: string
  startTimestamp?: number
  tournamentName?: string
}

type SofascoreScore = {
  current?: number
  display?: number
  period1?: number
  period2?: number
  extra1?: number
  extra2?: number
  penalties?: number
  normaltime?: number
}

type SofascoreEvent = {
  id: number
  customId?: string
  startTimestamp?: number
  status: { code: number; description: string; type: string }
  homeTeam?: { name?: string }
  awayTeam?: { name?: string }
  homeScore?: SofascoreScore
  awayScore?: SofascoreScore
  tournament?: { name?: string; uniqueTournament?: { name?: string; id?: number } }
}

const FINISHED_TYPES = new Set(['finished'])
const LIVE_TYPES = new Set(['inprogress'])
const POSTPONED_TYPES = new Set(['postponed'])
const CANCELED_TYPES = new Set(['canceled', 'will continue'])

function parseEvent(e: SofascoreEvent): LiveFixture {
  const isLive = LIVE_TYPES.has(e.status.type)
  const isFinished = FINISHED_TYPES.has(e.status.type)

  return {
    externalId: String(e.id),
    status: e.status.description,
    homeGoals: e.homeScore?.current ?? null,
    awayGoals: e.awayScore?.current ?? null,
    penaltyHomeGoals: e.homeScore?.penalties ?? null,
    penaltyAwayGoals: e.awayScore?.penalties ?? null,
    isLive,
    isFinished,
    homeName: e.homeTeam?.name,
    awayName: e.awayTeam?.name,
    startTimestamp: e.startTimestamp,
    tournamentName: e.tournament?.uniqueTournament?.name ?? e.tournament?.name,
  }
}

async function sofaFetch<T>(path: string): Promise<T> {
  const url = `${SOFASCORE_BASE}${path}`
  const res = await fetch(url, { headers: HEADERS, cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Sofascore HTTP ${res.status} for ${path}`)
  }
  return (await res.json()) as T
}

/**
 * Fetch a batch of events by their externalId. Sofascore doesn't expose a
 * bulk endpoint, so we make one request per match in parallel. Worth it
 * because Sofascore is fast and we only call this on the matches that are
 * currently active (typically 1-3 at a time).
 */
export async function fetchFixtures(externalIds: string[]): Promise<LiveFixture[]> {
  if (externalIds.length === 0) return []
  const results = await Promise.allSettled(
    externalIds.map(async (id) => {
      const json = await sofaFetch<{ event: SofascoreEvent }>(`/event/${id}`)
      return parseEvent(json.event)
    }),
  )
  return results
    .filter((r): r is PromiseFulfilledResult<LiveFixture> => r.status === 'fulfilled')
    .map((r) => r.value)
}

/**
 * Fetch all currently-live football events worldwide. Useful for cheap
 * "is anything live?" checks; not used for per-match sync since we already
 * have externalId mappings.
 */
export async function fetchAllLive(): Promise<LiveFixture[]> {
  const json = await sofaFetch<{ events?: SofascoreEvent[] }>(`/sport/football/events/live`)
  return (json.events ?? []).map(parseEvent)
}

/**
 * Fetch scheduled events for a specific date (YYYY-MM-DD). Used by the
 * admin "Search fixtures" UI to pick a fixture id for each Ki-Niela match.
 *
 * Optional filter: tournamentNameContains — case-insensitive substring
 * filter on the tournament name (e.g. "Friendly", "World Cup").
 */
export async function fetchByDate(
  dateIso: string,
  tournamentNameContains?: string,
): Promise<LiveFixture[]> {
  const json = await sofaFetch<{ events?: SofascoreEvent[] }>(
    `/sport/football/scheduled-events/${dateIso}`,
  )
  let events = (json.events ?? []).map(parseEvent)
  if (tournamentNameContains) {
    const needle = tournamentNameContains.toLowerCase()
    events = events.filter((e) => (e.tournamentName ?? '').toLowerCase().includes(needle))
  }
  return events
}

/**
 * Map Sofascore status → our internal MatchStatus enum.
 */
export function mapStatus(
  status: { type?: string; code?: number; description?: string } | string,
):
  | 'EN_JUEGO'
  | 'MEDIO_TIEMPO'
  | 'TIEMPO_EXTRA'
  | 'PENALES'
  | 'FINALIZADO'
  | 'POSTERGADO'
  | 'CANCELADO'
  | null {
  // Accept either a status object or just the description string for ergonomics
  let type: string | undefined
  let code: number | undefined
  let description: string | undefined
  if (typeof status === 'string') {
    description = status
  } else {
    type = status.type
    code = status.code
    description = status.description
  }

  const desc = (description ?? '').toLowerCase()

  if (type === 'finished' || desc.includes('ended') || desc.includes('after penalties') || desc.includes('full time')) {
    return 'FINALIZADO'
  }
  if (POSTPONED_TYPES.has(type ?? '')) return 'POSTERGADO'
  if (CANCELED_TYPES.has(type ?? '')) return 'CANCELADO'

  if (type === 'inprogress') {
    if (code === 31 || desc.includes('halftime')) return 'MEDIO_TIEMPO'
    if (code === 41 || code === 42 || desc.includes('extra')) return 'TIEMPO_EXTRA'
    if (code === 50 || code === 91 || desc.includes('penalt')) return 'PENALES'
    return 'EN_JUEGO'
  }

  return null
}

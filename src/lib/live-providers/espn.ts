/**
 * ESPN live scores provider.
 *
 * ESPN exposes a free, public, server-friendly JSON API at
 * site.api.espn.com — no API key, no anti-bot protection (works from
 * Railway / WSL / any server). Coverage is excellent for international
 * football (FIFA World Cup 2026 + International Friendlies confirmed).
 *
 * Endpoints used:
 *   GET /apis/site/v2/sports/soccer/{league}/scoreboard?dates=YYYYMMDD
 *     → list of all events for a date in that league
 *   GET /apis/site/v2/sports/soccer/{league}/scoreboard?dates=YYYYMMDD&event=ID
 *     → single event lookup (used for live sync)
 *   GET /apis/site/v2/sports/soccer/{league}/summary?event=ID
 *     → richer detail per event (also works without league sometimes)
 *
 * Slugs (league):
 *   fifa.world      → FIFA World Cup
 *   fifa.friendly   → International Friendlies
 *
 * Status mapping (status.type.state):
 *   pre        → PROGRAMADO  (scheduled)
 *   in         → EN_JUEGO    (in progress)
 *   post       → FINALIZADO  (completed)
 *
 * Half-time / extra time / penalties are inferred from displayClock / detail.
 */

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer'

// Server-friendly UA (ESPN doesn't seem to gate by UA, but keep one for politeness/logging)
const HEADERS: Record<string, string> = {
  'User-Agent': 'KiNiela-LiveSync/1.0 (+ki-niela-production.up.railway.app)',
  Accept: 'application/json',
}

// Default leagues we know are relevant. Search hits all of them in parallel.
const DEFAULT_LEAGUES = ['fifa.world', 'fifa.friendly'] as const

export type LiveFixture = {
  externalId: string // We encode "league|eventId" so a later lookup knows which slug to use.
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

type EspnTeam = {
  id: string
  homeAway?: 'home' | 'away'
  score?: string
  team?: { displayName?: string; abbreviation?: string; name?: string }
  shootoutScore?: number
}

type EspnEvent = {
  id: string
  date?: string
  name?: string
  shortName?: string
  status?: {
    clock?: number
    displayClock?: string
    type?: {
      state?: string // pre | in | post
      name?: string
      completed?: boolean
      description?: string
      detail?: string
      shortDetail?: string
    }
  }
  competitions?: Array<{
    id: string
    date?: string
    competitors?: EspnTeam[]
    status?: EspnEvent['status']
  }>
}

type EspnScoreboard = {
  leagues?: Array<{ id: string; name?: string; slug?: string }>
  events?: EspnEvent[]
}

function parseEvent(e: EspnEvent, leagueSlug: string, leagueName?: string): LiveFixture {
  const comp = e.competitions?.[0]
  const competitors = comp?.competitors ?? []
  const home = competitors.find((c) => c.homeAway === 'home') ?? competitors[0]
  const away = competitors.find((c) => c.homeAway === 'away') ?? competitors[1]

  const state = e.status?.type?.state ?? comp?.status?.type?.state
  const detail = e.status?.type?.detail ?? comp?.status?.type?.detail ?? ''

  const isLive = state === 'in'
  const isFinished = state === 'post'

  const homeGoals = home?.score !== undefined ? Number(home.score) : null
  const awayGoals = away?.score !== undefined ? Number(away.score) : null

  return {
    externalId: `${leagueSlug}|${e.id}`,
    status: detail || state || '',
    homeGoals: Number.isFinite(homeGoals) ? homeGoals : null,
    awayGoals: Number.isFinite(awayGoals) ? awayGoals : null,
    penaltyHomeGoals: home?.shootoutScore ?? null,
    penaltyAwayGoals: away?.shootoutScore ?? null,
    isLive,
    isFinished,
    homeName: home?.team?.displayName ?? home?.team?.name,
    awayName: away?.team?.displayName ?? away?.team?.name,
    startTimestamp: e.date ? Math.floor(new Date(e.date).getTime() / 1000) : undefined,
    tournamentName: leagueName,
  }
}

async function espnFetch<T>(path: string): Promise<T> {
  const url = `${ESPN_BASE}${path}`
  const res = await fetch(url, { headers: HEADERS, cache: 'no-store' })
  if (!res.ok) throw new Error(`ESPN HTTP ${res.status} for ${path}`)
  return (await res.json()) as T
}

/**
 * Fetch a batch of fixtures by externalId. Format: "leagueSlug|eventId".
 * One request per match — ESPN is fast and we only call this on active matches.
 */
export async function fetchFixtures(externalIds: string[]): Promise<LiveFixture[]> {
  if (externalIds.length === 0) return []

  const results = await Promise.allSettled(
    externalIds.map(async (compoundId) => {
      const [leagueSlug, eventId] = compoundId.includes('|')
        ? compoundId.split('|', 2)
        : ['fifa.world', compoundId]

      // Use scoreboard with event filter — returns the same JSON shape as a list
      // and includes live status. Date param is required by ESPN; using a window
      // wide enough to always include the event.
      const today = new Date()
      const yyyymmdd = `${today.getUTCFullYear()}${String(today.getUTCMonth() + 1).padStart(2, '0')}${String(today.getUTCDate()).padStart(2, '0')}`
      const json = await espnFetch<EspnScoreboard>(
        `/${leagueSlug}/scoreboard?dates=${yyyymmdd}&event=${eventId}`,
      )
      const ev = (json.events ?? []).find((e) => e.id === eventId)
      if (!ev) {
        // Fallback: use summary which is event-only
        const summary = await espnFetch<{ header?: EspnEvent }>(
          `/${leagueSlug}/summary?event=${eventId}`,
        )
        if (summary.header) {
          return parseEvent(summary.header, leagueSlug, json.leagues?.[0]?.name)
        }
        throw new Error(`Event ${eventId} not found in ${leagueSlug}`)
      }
      return parseEvent(ev, leagueSlug, json.leagues?.[0]?.name)
    }),
  )

  return results
    .filter((r): r is PromiseFulfilledResult<LiveFixture> => r.status === 'fulfilled')
    .map((r) => r.value)
}

/**
 * Fetch all currently-live football events from the relevant leagues.
 * Used as a cheap "is anything live?" check.
 */
export async function fetchAllLive(): Promise<LiveFixture[]> {
  const today = new Date()
  const yyyymmdd = `${today.getUTCFullYear()}${String(today.getUTCMonth() + 1).padStart(2, '0')}${String(today.getUTCDate()).padStart(2, '0')}`

  const allBoards = await Promise.allSettled(
    DEFAULT_LEAGUES.map((slug) =>
      espnFetch<EspnScoreboard>(`/${slug}/scoreboard?dates=${yyyymmdd}`).then((b) => ({ slug, board: b })),
    ),
  )

  const out: LiveFixture[] = []
  for (const r of allBoards) {
    if (r.status !== 'fulfilled') continue
    const { slug, board } = r.value
    const leagueName = board.leagues?.[0]?.name
    for (const ev of board.events ?? []) {
      const fixture = parseEvent(ev, slug, leagueName)
      if (fixture.isLive) out.push(fixture)
    }
  }
  return out
}

/**
 * Fetch all events scheduled for a given YYYY-MM-DD date across the configured
 * leagues. Optional tournamentNameContains filters by case-insensitive
 * substring of the league name (e.g. "World Cup", "Friendly").
 */
export async function fetchByDate(
  dateIso: string,
  tournamentNameContains?: string,
): Promise<LiveFixture[]> {
  const yyyymmdd = dateIso.replace(/-/g, '')

  const boards = await Promise.allSettled(
    DEFAULT_LEAGUES.map((slug) =>
      espnFetch<EspnScoreboard>(`/${slug}/scoreboard?dates=${yyyymmdd}`).then((b) => ({ slug, board: b })),
    ),
  )

  const out: LiveFixture[] = []
  for (const r of boards) {
    if (r.status !== 'fulfilled') continue
    const { slug, board } = r.value
    const leagueName = board.leagues?.[0]?.name ?? ''
    if (tournamentNameContains) {
      const needle = tournamentNameContains.toLowerCase()
      if (!leagueName.toLowerCase().includes(needle) && !slug.toLowerCase().includes(needle)) {
        continue
      }
    }
    for (const ev of board.events ?? []) {
      out.push(parseEvent(ev, slug, leagueName))
    }
  }
  return out
}

/**
 * Map ESPN status (a description string OR a {type:{state,detail}} object)
 * to our internal MatchStatus enum.
 */
export function mapStatus(
  status:
    | { type?: { state?: string; detail?: string; description?: string } }
    | string,
):
  | 'EN_JUEGO'
  | 'MEDIO_TIEMPO'
  | 'TIEMPO_EXTRA'
  | 'PENALES'
  | 'FINALIZADO'
  | 'POSTERGADO'
  | 'CANCELADO'
  | null {
  let state: string | undefined
  let detail: string | undefined

  if (typeof status === 'string') {
    detail = status
  } else {
    state = status.type?.state
    detail = status.type?.detail ?? status.type?.description
  }

  const det = (detail ?? '').toLowerCase()

  if (state === 'post' || det.includes('full time') || det.includes('ft') || det.includes('finished')) {
    return 'FINALIZADO'
  }
  if (det.includes('postpone')) return 'POSTERGADO'
  if (det.includes('cancel')) return 'CANCELADO'

  if (state === 'in') {
    if (det.includes('halftime') || det.includes('half-time') || det.includes('ht')) return 'MEDIO_TIEMPO'
    if (det.includes('extra')) return 'TIEMPO_EXTRA'
    if (det.includes('penalt') || det.includes('shootout')) return 'PENALES'
    return 'EN_JUEGO'
  }

  return null
}

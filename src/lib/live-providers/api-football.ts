/**
 * API-Football provider (RapidAPI / api-football.com).
 *
 * Docs: https://www.api-football.com/documentation-v3
 * Auth header expected: x-rapidapi-key + x-rapidapi-host
 *   OR x-apisports-key (direct subscription).
 *
 * Required env vars:
 *   API_FOOTBALL_KEY  — your API key
 *   API_FOOTBALL_HOST — "api-football-v1.p.rapidapi.com" (RapidAPI)
 *                      or "v3.football.api-sports.io" (direct)
 */

const DEFAULT_HOST = process.env.API_FOOTBALL_HOST ?? 'v3.football.api-sports.io'
const API_KEY = process.env.API_FOOTBALL_KEY ?? ''

export type LiveFixture = {
  externalId: string
  status: 'NS' | '1H' | 'HT' | '2H' | 'ET' | 'BT' | 'P' | 'SUSP' | 'INT' | 'FT' | 'AET' | 'PEN' | 'PST' | 'CANC' | 'ABD' | 'AWD' | 'WO' | 'LIVE'
  homeGoals: number | null
  awayGoals: number | null
  penaltyHomeGoals: number | null
  penaltyAwayGoals: number | null
  isLive: boolean
  isFinished: boolean
}

type ApiFootballFixture = {
  fixture: {
    id: number
    status: { short: string }
  }
  goals: { home: number | null; away: number | null }
  score?: {
    penalty?: { home: number | null; away: number | null }
  }
}

type ApiFootballResponse = {
  response?: ApiFootballFixture[]
  errors?: unknown
}

const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO'])
const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'])

function authHeaders(): Record<string, string> {
  if (!API_KEY) throw new Error('API_FOOTBALL_KEY is not configured')
  // Detect host style. RapidAPI uses x-rapidapi-key; direct subscription uses x-apisports-key.
  if (DEFAULT_HOST.includes('rapidapi')) {
    return {
      'x-rapidapi-key': API_KEY,
      'x-rapidapi-host': DEFAULT_HOST,
    }
  }
  return { 'x-apisports-key': API_KEY }
}

function parseFixture(raw: ApiFootballFixture): LiveFixture {
  const status = raw.fixture.status.short as LiveFixture['status']
  return {
    externalId: String(raw.fixture.id),
    status,
    homeGoals: raw.goals.home,
    awayGoals: raw.goals.away,
    penaltyHomeGoals: raw.score?.penalty?.home ?? null,
    penaltyAwayGoals: raw.score?.penalty?.away ?? null,
    isLive: LIVE_STATUSES.has(status),
    isFinished: FINISHED_STATUSES.has(status),
  }
}

/**
 * Fetch a batch of fixtures by external id (provider id).
 * Returns array of normalized LiveFixture objects.
 */
export async function fetchFixtures(externalIds: string[]): Promise<LiveFixture[]> {
  if (externalIds.length === 0) return []
  if (!API_KEY) {
    console.warn('[api-football] API_FOOTBALL_KEY not set — skipping live sync')
    return []
  }

  // API-Football allows ?ids=1-2-3 to batch up to 20 fixtures.
  const ids = externalIds.slice(0, 20).join('-')
  const url = `https://${DEFAULT_HOST}/fixtures?ids=${ids}`

  const res = await fetch(url, {
    headers: authHeaders(),
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`API-Football HTTP ${res.status}: ${await res.text().catch(() => '')}`)
  }

  const json = (await res.json()) as ApiFootballResponse
  if (!json.response) return []
  return json.response.map(parseFixture)
}

/**
 * Fetch all currently-live fixtures (returns nothing if no match is in progress).
 * Cheaper for "are any matches live right now?" checks.
 */
export async function fetchAllLive(): Promise<LiveFixture[]> {
  if (!API_KEY) return []

  const url = `https://${DEFAULT_HOST}/fixtures?live=all`
  const res = await fetch(url, {
    headers: authHeaders(),
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`API-Football HTTP ${res.status}`)
  }

  const json = (await res.json()) as ApiFootballResponse
  if (!json.response) return []
  return json.response.map(parseFixture)
}

/**
 * Map API-Football status (short codes) to our internal MatchStatus enum.
 */
export function mapStatus(apiStatus: string): 'EN_JUEGO' | 'MEDIO_TIEMPO' | 'TIEMPO_EXTRA' | 'PENALES' | 'FINALIZADO' | 'POSTERGADO' | 'CANCELADO' | null {
  switch (apiStatus) {
    case '1H':
    case '2H':
    case 'LIVE':
      return 'EN_JUEGO'
    case 'HT':
      return 'MEDIO_TIEMPO'
    case 'ET':
    case 'BT':
      return 'TIEMPO_EXTRA'
    case 'P':
      return 'PENALES'
    case 'FT':
    case 'AET':
    case 'PEN':
    case 'AWD':
    case 'WO':
      return 'FINALIZADO'
    case 'PST':
      return 'POSTERGADO'
    case 'CANC':
    case 'ABD':
      return 'CANCELADO'
    default:
      return null
  }
}

/**
 * Admin proxy to search fixtures in the external provider (API-Football).
 *
 * GET /api/admin/external-fixtures?date=YYYY-MM-DD&league=10&season=2026
 *
 * Hides the API key on the server side; returns a slim list ready for the UI.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

const HOST = process.env.API_FOOTBALL_HOST ?? 'v3.football.api-sports.io'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.user.globalRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'API_FOOTBALL_KEY no está configurado en el servidor.' },
      { status: 503 },
    )
  }

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const league = searchParams.get('league')
  const season = searchParams.get('season')
  const ids = searchParams.get('ids')

  const qs = new URLSearchParams()
  if (date) qs.set('date', date)
  if (league) qs.set('league', league)
  if (season) qs.set('season', season)
  if (ids) qs.set('ids', ids)
  if (![...qs.keys()].length) {
    return NextResponse.json({ error: 'Falta parámetro (date, league, season o ids).' }, { status: 422 })
  }

  const isRapid = HOST.includes('rapidapi')
  const headers: Record<string, string> = isRapid
    ? { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': HOST }
    : { 'x-apisports-key': apiKey }

  let upstream: Response
  try {
    upstream = await fetch(`https://${HOST}/fixtures?${qs.toString()}`, {
      headers,
      cache: 'no-store',
    })
  } catch (e) {
    return NextResponse.json({ error: 'No se pudo contactar al proveedor.', detail: String(e) }, { status: 502 })
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '')
    return NextResponse.json(
      { error: `Proveedor respondió ${upstream.status}`, detail: text.slice(0, 400) },
      { status: 502 },
    )
  }

  type FixtureRaw = {
    fixture: { id: number; date: string; status: { short: string; long: string } }
    league?: { id: number; name: string; season: number }
    teams: {
      home: { name: string; id: number }
      away: { name: string; id: number }
    }
    goals: { home: number | null; away: number | null }
  }

  const json = (await upstream.json()) as { response?: FixtureRaw[]; errors?: unknown }
  const fixtures = (json.response ?? []).map((f) => ({
    id: String(f.fixture.id),
    date: f.fixture.date,
    statusShort: f.fixture.status.short,
    statusLong: f.fixture.status.long,
    leagueName: f.league?.name ?? null,
    season: f.league?.season ?? null,
    homeName: f.teams.home.name,
    awayName: f.teams.away.name,
    homeGoals: f.goals.home,
    awayGoals: f.goals.away,
  }))

  return NextResponse.json({ count: fixtures.length, fixtures, errors: json.errors ?? null })
}

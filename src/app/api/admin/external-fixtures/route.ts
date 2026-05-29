/**
 * Admin proxy to search fixtures in the live scores provider.
 *
 * GET /api/admin/external-fixtures?date=YYYY-MM-DD
 * GET /api/admin/external-fixtures?date=YYYY-MM-DD&tournament=Friendly
 *
 * Default provider is Sofascore (free, no API key, wide coverage including
 * Mundial 2026 and international friendlies). Switches to API-Football
 * automatically if LIVE_PROVIDER=api-football and API_FOOTBALL_KEY are set.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { fetchByDate, providerName } from '@/lib/live-providers'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.user.globalRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const tournament = searchParams.get('tournament') ?? undefined

  if (!date) {
    return NextResponse.json({ error: 'Falta parámetro date (YYYY-MM-DD).' }, { status: 422 })
  }

  try {
    const list = await fetchByDate(date, tournament)
    const fixtures = list.map((f) => ({
      id: f.externalId,
      date: f.startTimestamp ? new Date(f.startTimestamp * 1000).toISOString() : null,
      statusShort: f.status,
      statusLong: f.status,
      leagueName: f.tournamentName ?? null,
      season: null,
      homeName: f.homeName ?? '',
      awayName: f.awayName ?? '',
      homeGoals: f.homeGoals,
      awayGoals: f.awayGoals,
    }))
    return NextResponse.json({ count: fixtures.length, fixtures, provider: providerName })
  } catch (e) {
    return NextResponse.json(
      { error: 'No se pudo contactar al proveedor.', detail: String(e) },
      { status: 502 },
    )
  }
}

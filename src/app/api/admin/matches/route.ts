/**
 * Admin endpoint: list all matches across events with their external mapping.
 * Used by /admin/partidos to render the linking UI.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.user.globalRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('eventId')

  const matches = await prisma.match.findMany({
    where: eventId ? { eventId } : {},
    include: {
      event: { select: { id: true, name: true } },
      homeTeam: { select: { name: true, fifaCode: true } },
      awayTeam: { select: { name: true, fifaCode: true } },
      matchday: { select: { name: true } },
    },
    orderBy: { kickoffAtUtc: 'asc' },
  })

  return NextResponse.json(
    matches.map((m) => ({
      id: m.id,
      eventId: m.eventId,
      eventName: m.event.name,
      kickoffAtUtc: m.kickoffAtUtc,
      matchdayName: m.matchday?.name ?? null,
      phase: m.phase,
      status: m.status,
      homeName: m.homeTeam?.name ?? m.placeholderHomeName ?? '—',
      awayName: m.awayTeam?.name ?? m.placeholderAwayName ?? '—',
      homeFifa: m.homeTeam?.fifaCode ?? null,
      awayFifa: m.awayTeam?.fifaCode ?? null,
      externalId: m.externalId,
      externalProvider: m.externalProvider,
      manualOverride: m.manualOverride,
      liveSource: m.liveSource,
      liveHomeGoals: m.liveHomeGoals,
      liveAwayGoals: m.liveAwayGoals,
      officialHomeGoals: m.officialHomeGoals,
      officialAwayGoals: m.officialAwayGoals,
      lastSyncAt: m.lastSyncAt,
    })),
  )
}

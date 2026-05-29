/**
 * Admin endpoint to manually trigger a live-scores sync from the browser.
 *
 * The actual sync logic lives at /api/jobs/sync-live-scores and is gated by
 * the x-cron-secret header (so only the cron platform / GitHub Actions can
 * call it externally). The browser cannot present that header securely, so
 * this companion endpoint authorises by SUPER_ADMIN session cookie instead
 * and re-runs the same logic in-process.
 *
 * Same response shape as /api/jobs/sync-live-scores: { synced, finalized,
 * candidates, provider } or { error, detail }.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { fetchFixtures, mapStatus, providerName } from '@/lib/live-providers'
import { calculateScore } from '@/lib/scoring'

const ACTIVE_STATUSES = ['BLOQUEADO', 'EN_JUEGO', 'MEDIO_TIEMPO', 'TIEMPO_EXTRA', 'PENALES'] as const

export async function POST(_req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.user.globalRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  let candidates: { id: string; externalId: string | null; eventId: string }[]
  try {
    candidates = await prisma.match.findMany({
      where: {
        externalId: { not: null },
        manualOverride: false,
        status: { in: ACTIVE_STATUSES as unknown as never },
      },
      select: { id: true, externalId: true, eventId: true },
    })
  } catch (e) {
    return NextResponse.json(
      { error: 'DB query failed.', detail: String(e) },
      { status: 500 },
    )
  }

  if (candidates.length === 0) {
    return NextResponse.json({
      synced: 0,
      finalized: 0,
      candidates: 0,
      provider: providerName,
      message: 'No hay partidos activos vinculados. Vincula un partido primero o espera a que su hora de inicio esté próxima.',
    })
  }

  const externalIds = candidates.map((m) => m.externalId!).filter(Boolean)
  let fixtures: Awaited<ReturnType<typeof fetchFixtures>> = []
  try {
    fixtures = await fetchFixtures(externalIds)
  } catch (e) {
    return NextResponse.json(
      { error: 'Provider failed', detail: String(e) },
      { status: 502 },
    )
  }

  const fixturesById = new Map(fixtures.map((f) => [f.externalId, f]))
  let synced = 0
  let finalized = 0

  for (const match of candidates) {
    const fixture = fixturesById.get(match.externalId!)
    if (!fixture) continue
    const newStatus = mapStatus(fixture.status)
    if (!newStatus) continue
    if (fixture.homeGoals === null || fixture.awayGoals === null) continue

    const isFinal = newStatus === 'FINALIZADO'
    const updateData: Record<string, unknown> = {
      liveHomeGoals: fixture.homeGoals,
      liveAwayGoals: fixture.awayGoals,
      status: newStatus,
      liveSource: 'API_AUTO',
      liveUpdatedAt: new Date(),
      lastSyncAt: new Date(),
    }
    if (fixture.penaltyHomeGoals !== null && fixture.penaltyAwayGoals !== null) {
      updateData.penaltyHomeGoals = fixture.penaltyHomeGoals
      updateData.penaltyAwayGoals = fixture.penaltyAwayGoals
      updateData.wentToPenalties = true
    }
    if (isFinal) {
      updateData.officialHomeGoals = fixture.homeGoals
      updateData.officialAwayGoals = fixture.awayGoals
      updateData.resultConfirmedAt = new Date()
    }

    await prisma.match.update({ where: { id: match.id }, data: updateData })
    synced++

    if (isFinal) {
      const predictions = await prisma.prediction.findMany({ where: { matchId: match.id } })
      const stars = await prisma.quinielaStarMatch.findMany({
        where: { matchId: match.id, isStar: true },
        select: { quinielaId: true },
      })
      const starQuinielas = new Set(stars.map((s) => s.quinielaId))

      for (const pred of predictions) {
        const isStar = starQuinielas.has(pred.quinielaId)
        const result = calculateScore(
          pred.predictedHomeGoals,
          pred.predictedAwayGoals,
          fixture.homeGoals!,
          fixture.awayGoals!,
          isStar,
        )
        await prisma.score.upsert({
          where: {
            quinielaId_userId_matchId: {
              quinielaId: pred.quinielaId,
              userId: pred.userId,
              matchId: match.id,
            },
          },
          update: {
            points: result.points,
            reason: result.reason,
            isStarMatch: isStar,
            calculatedAt: new Date(),
          },
          create: {
            quinielaId: pred.quinielaId,
            eventId: match.eventId,
            userId: pred.userId,
            matchId: match.id,
            predictionId: pred.id,
            points: result.points,
            reason: result.reason,
            isStarMatch: isStar,
          },
        })
      }
      finalized++
    }
  }

  return NextResponse.json({
    synced,
    finalized,
    candidates: candidates.length,
    provider: providerName,
  })
}

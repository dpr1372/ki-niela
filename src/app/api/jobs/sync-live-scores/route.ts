/**
 * Cron job: sync live scores from external sports API into our DB.
 *
 * Runs every 30s while there are matches in progress.
 *
 * Behavior:
 *  - Picks matches whose externalId is set AND status is in
 *    BLOQUEADO / EN_JUEGO / MEDIO_TIEMPO / TIEMPO_EXTRA / PENALES.
 *  - Skips any match where manualOverride = true (admin took control).
 *  - Calls API-Football, updates liveHomeGoals/liveAwayGoals/status.
 *  - Marks liveSource = API_AUTO and bumps lastSyncAt + liveUpdatedAt.
 *  - When the API reports FINALIZADO, copies live → official and triggers
 *    score recalculation (same logic as the manual matches/[id]/live PATCH).
 *
 * Secured with x-cron-secret header. Trigger from any cron platform
 * (Railway cron, Cloudflare cron, GitHub Actions, etc.).
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchFixtures, mapStatus } from '@/lib/live-providers/api-football'
import { calculateScore } from '@/lib/scoring'

const ACTIVE_STATUSES = ['BLOQUEADO', 'EN_JUEGO', 'MEDIO_TIEMPO', 'TIEMPO_EXTRA', 'PENALES'] as const

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.API_FOOTBALL_KEY) {
    return NextResponse.json(
      { skipped: true, reason: 'API_FOOTBALL_KEY not configured' },
      { status: 200 },
    )
  }

  // Pick active matches with an external mapping that is NOT under manual override.
  const candidates = await prisma.match.findMany({
    where: {
      externalId: { not: null },
      manualOverride: false,
      status: { in: ACTIVE_STATUSES as unknown as never },
    },
    select: { id: true, externalId: true, eventId: true },
  })

  if (candidates.length === 0) {
    return NextResponse.json({ synced: 0, finalized: 0, skipped: 'no_active' })
  }

  const externalIds = candidates.map((m) => m.externalId!).filter(Boolean)

  let fixtures: Awaited<ReturnType<typeof fetchFixtures>> = []
  try {
    fixtures = await fetchFixtures(externalIds)
  } catch (e) {
    console.error('[sync-live-scores] provider error', e)
    return NextResponse.json({ error: 'Provider failed', detail: String(e) }, { status: 502 })
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

    await prisma.match.update({
      where: { id: match.id },
      data: updateData,
    })

    synced++

    // If the match just finalized, recompute scores for every prediction in
    // every quiniela that includes this match. Same logic as PATCH
    // /api/matches/:id/live.
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

  return NextResponse.json({ synced, finalized, candidates: candidates.length })
}

// Allow GET for ad-hoc testing in browser (still needs secret query param)
export async function GET(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get('secret')
  const headerCheck = secret === process.env.CRON_SECRET
  if (!headerCheck) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Reuse POST logic by faking the header
  const fakeReq = new NextRequest(req.url, {
    method: 'POST',
    headers: new Headers({ 'x-cron-secret': process.env.CRON_SECRET ?? '' }),
  })
  return POST(fakeReq)
}

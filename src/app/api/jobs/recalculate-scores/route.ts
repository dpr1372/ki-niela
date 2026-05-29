import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateScore } from '@/lib/scoring'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const matchId: string | undefined = body.matchId

  // Get finished matches with official results
  const matches = await prisma.match.findMany({
    where: {
      status: 'FINALIZADO',
      officialHomeGoals: { not: null },
      officialAwayGoals: { not: null },
      ...(matchId ? { id: matchId } : {}),
    },
    select: {
      id: true,
      eventId: true,
      officialHomeGoals: true,
      officialAwayGoals: true,
    },
  })

  let recalculated = 0

  for (const match of matches) {
    const predictions = await prisma.prediction.findMany({
      where: { matchId: match.id },
      select: { id: true, quinielaId: true, userId: true, predictedHomeGoals: true, predictedAwayGoals: true },
    })

    for (const pred of predictions) {
      const starRecord = await prisma.quinielaStarMatch.findUnique({
        where: { quinielaId_matchId: { quinielaId: pred.quinielaId, matchId: match.id } },
        select: { isStar: true },
      })
      const isStar = starRecord?.isStar ?? false

      const { points, reason } = calculateScore(
        pred.predictedHomeGoals,
        pred.predictedAwayGoals,
        match.officialHomeGoals!,
        match.officialAwayGoals!,
        isStar,
      )

      await prisma.score.upsert({
        where: { quinielaId_userId_matchId: { quinielaId: pred.quinielaId, userId: pred.userId, matchId: match.id } },
        create: {
          quinielaId: pred.quinielaId,
          eventId: match.eventId,
          userId: pred.userId,
          matchId: match.id,
          predictionId: pred.id,
          points,
          reason,
          isStarMatch: isStar,
          calculatedAt: new Date(),
        },
        update: {
          predictionId: pred.id,
          points,
          reason,
          isStarMatch: isStar,
          calculatedAt: new Date(),
        },
      })
      recalculated++
    }
  }

  return NextResponse.json({ recalculated })
}

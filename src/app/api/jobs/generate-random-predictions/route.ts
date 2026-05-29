import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isMatchLocked } from '@/lib/timezone'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find matches that just became locked (BLOQUEADO) and haven't had bot predictions run
  const lockedMatches = await prisma.match.findMany({
    where: { status: 'BLOQUEADO' },
    select: { id: true, eventId: true, kickoffAtUtc: true },
  })

  let generated = 0

  for (const match of lockedMatches) {
    // Double-check lock is valid
    if (!isMatchLocked(new Date(match.kickoffAtUtc), 0)) continue

    // Get all quinielas for this event that have randomPredictionsEnabled
    const quinielas = await prisma.quiniela.findMany({
      where: { eventId: match.eventId, randomPredictionsEnabled: true, status: 'ACTIVE' },
      select: {
        id: true,
        randomMinGoals: true,
        randomMaxGoals: true,
      },
    })

    for (const quiniela of quinielas) {
      // Get active members with autoPredictionsEnabled who have no prediction for this match
      const existingPredictions = await prisma.prediction.findMany({
        where: { quinielaId: quiniela.id, matchId: match.id },
        select: { userId: true },
      })
      const alreadyPredicted = new Set(existingPredictions.map((p) => p.userId))

      const eligibleMembers = await prisma.quinielaMember.findMany({
        where: {
          quinielaId: quiniela.id,
          status: 'ACTIVE',
          role: 'PARTICIPANT',
          autoPredictionsEnabled: true,
          userId: { notIn: Array.from(alreadyPredicted) },
        },
        select: { userId: true },
      })

      const min = quiniela.randomMinGoals
      const max = quiniela.randomMaxGoals

      for (const member of eligibleMembers) {
        const home = randomInt(min, max)
        const away = randomInt(min, max)
        await prisma.prediction.create({
          data: {
            quinielaId: quiniela.id,
            eventId: match.eventId,
            userId: member.userId,
            matchId: match.id,
            predictedHomeGoals: home,
            predictedAwayGoals: away,
            generatedByBot: true,
            lockedAt: new Date(),
          },
        })
        generated++
      }
    }
  }

  return NextResponse.json({ generated })
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

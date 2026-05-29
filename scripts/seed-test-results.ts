import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { config } from 'dotenv'
import { calculateScore } from '../src/lib/scoring'
config({ path: '.env.local' })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const QUINIELA_ID = 'quiniela-mundial-2026'

// Score the first N matches with deterministic results
const RESULTS: Array<[number, number]> = [
  [2, 1],
  [1, 1],
  [3, 0],
  [0, 0],
  [2, 2],
  [1, 0],
]

async function main() {
  const quiniela = await prisma.quiniela.findUnique({
    where: { id: QUINIELA_ID },
    select: { eventId: true },
  })
  if (!quiniela) { console.log('quiniela not found'); return }

  const matches = await prisma.match.findMany({
    where: { eventId: quiniela.eventId, phase: 'GROUPS' },
    orderBy: { kickoffAtUtc: 'asc' },
    take: RESULTS.length,
    include: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  })

  console.log(`Updating ${matches.length} matches with official results...`)
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const [home, away] = RESULTS[i]
    await prisma.match.update({
      where: { id: match.id },
      data: {
        officialHomeGoals: home,
        officialAwayGoals: away,
        status: 'FINALIZADO',
        resultConfirmedAt: new Date(),
      },
    })
    const homeName = match.homeTeam?.name ?? match.placeholderHomeName
    const awayName = match.awayTeam?.name ?? match.placeholderAwayName
    console.log(`  ${homeName} ${home}-${away} ${awayName}`)
  }

  // Recalculate scores
  console.log('\nRecalculating scores...')
  let recalculated = 0
  for (const match of matches) {
    const predictions = await prisma.prediction.findMany({
      where: { matchId: match.id },
      select: { id: true, quinielaId: true, userId: true, predictedHomeGoals: true, predictedAwayGoals: true },
    })
    const idx = matches.indexOf(match)
    const [oh, oa] = RESULTS[idx]
    for (const pred of predictions) {
      const star = await prisma.quinielaStarMatch.findUnique({
        where: { quinielaId_matchId: { quinielaId: pred.quinielaId, matchId: match.id } },
        select: { isStar: true },
      })
      const isStar = star?.isStar ?? false
      const { points, reason } = calculateScore(
        pred.predictedHomeGoals,
        pred.predictedAwayGoals,
        oh,
        oa,
        isStar,
      )
      await prisma.score.upsert({
        where: { quinielaId_userId_matchId: { quinielaId: pred.quinielaId, userId: pred.userId, matchId: match.id } },
        create: {
          quinielaId: pred.quinielaId,
          eventId: quiniela.eventId,
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
  console.log(`Scores recalculated: ${recalculated}`)

  // Leaderboard
  const leaderboard = await prisma.score.groupBy({
    by: ['userId'],
    where: { quinielaId: QUINIELA_ID },
    _sum: { points: true },
    _count: { _all: true },
  })
  const users = await prisma.user.findMany({
    where: { id: { in: leaderboard.map(l => l.userId) } },
    select: { id: true, name: true, email: true },
  })
  const userMap = new Map(users.map(u => [u.id, u]))
  const sorted = leaderboard
    .map(l => ({
      name: userMap.get(l.userId)?.name ?? userMap.get(l.userId)?.email ?? l.userId,
      points: l._sum.points ?? 0,
      count: l._count._all,
    }))
    .sort((a, b) => b.points - a.points)

  console.log('\nLeaderboard:')
  sorted.forEach((s, i) => {
    console.log(`  ${(i + 1).toString().padStart(2)}. ${s.name.padEnd(20)} ${s.points} pts (${s.count} partidos)`)
  })
}
main().catch(console.error).finally(() => prisma.$disconnect())

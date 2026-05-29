import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const QUINIELA_ID = 'quiniela-mundial-2026'

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function main() {
  const quiniela = await prisma.quiniela.findUnique({
    where: { id: QUINIELA_ID },
    select: { id: true, eventId: true, randomMinGoals: true, randomMaxGoals: true },
  })
  if (!quiniela) { console.log('quiniela not found'); return }

  // Active members
  const members = await prisma.quinielaMember.findMany({
    where: { quinielaId: QUINIELA_ID, status: 'ACTIVE' },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
  console.log(`Active members: ${members.length}`)
  members.forEach(m => console.log(`  - ${m.user.name ?? m.user.email}`))

  // First 12 group-stage matches by kickoff
  const matches = await prisma.match.findMany({
    where: { eventId: quiniela.eventId, phase: 'GROUPS' },
    orderBy: { kickoffAtUtc: 'asc' },
    take: 12,
    include: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  })
  console.log(`Matches selected: ${matches.length}`)

  let created = 0
  let updated = 0
  for (const member of members) {
    for (const match of matches) {
      const home = randInt(quiniela.randomMinGoals, Math.min(quiniela.randomMaxGoals, 4))
      const away = randInt(quiniela.randomMinGoals, Math.min(quiniela.randomMaxGoals, 4))
      const result = await prisma.prediction.upsert({
        where: { quinielaId_userId_matchId: { quinielaId: QUINIELA_ID, userId: member.userId, matchId: match.id } },
        update: { predictedHomeGoals: home, predictedAwayGoals: away, generatedByBot: false },
        create: {
          quinielaId: QUINIELA_ID,
          eventId: quiniela.eventId,
          userId: member.userId,
          matchId: match.id,
          predictedHomeGoals: home,
          predictedAwayGoals: away,
          generatedByBot: false,
        },
      })
      if (result.createdAt.getTime() === result.updatedAt.getTime()) created++
      else updated++
    }
  }
  console.log(`Predictions created: ${created}, updated: ${updated}`)

  // Show summary
  const all = await prisma.prediction.findMany({
    where: { quinielaId: QUINIELA_ID },
    include: {
      user: { select: { name: true, email: true } },
      match: { include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } } },
    },
    orderBy: [{ matchId: 'asc' }, { userId: 'asc' }],
    take: 30,
  })
  console.log('\nSample predictions:')
  for (const p of all) {
    const home = p.match.homeTeam?.name ?? p.match.placeholderHomeName
    const away = p.match.awayTeam?.name ?? p.match.placeholderAwayName
    console.log(`  ${p.user.name ?? p.user.email}: ${home} ${p.predictedHomeGoals}-${p.predictedAwayGoals} ${away}`)
  }
}
main().catch(console.error).finally(() => prisma.$disconnect())

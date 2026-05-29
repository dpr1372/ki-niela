import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { config } from 'dotenv'
config({ path: '.env.local' })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const QUINIELA_ID = 'quiniela-mundial-2026'

// Take matches at indexes 6..11 (the next 6 after the 6 already FINALIZADO).
// Set them in different in-flight states with live scores.
const LIVE: Array<{ status: 'BLOQUEADO' | 'EN_JUEGO' | 'MEDIO_TIEMPO' | 'TIEMPO_EXTRA' | 'PENALES'; home: number | null; away: number | null }> = [
  { status: 'EN_JUEGO',     home: 1, away: 0 },
  { status: 'EN_JUEGO',     home: 0, away: 2 },
  { status: 'MEDIO_TIEMPO', home: 1, away: 1 },
  { status: 'EN_JUEGO',     home: 3, away: 2 },
  { status: 'BLOQUEADO',    home: 0, away: 0 },
  { status: 'BLOQUEADO',    home: 0, away: 0 },
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
    take: 12,
    include: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  })

  // Take indices 6..11
  const targets = matches.slice(6, 12)
  console.log(`Setting ${targets.length} matches in-flight...`)
  for (let i = 0; i < targets.length; i++) {
    const m = targets[i]
    const cfg = LIVE[i]
    await prisma.match.update({
      where: { id: m.id },
      data: {
        status: cfg.status,
        liveHomeGoals: cfg.home,
        liveAwayGoals: cfg.away,
        liveUpdatedAt: new Date(),
        // clear any official result on these in-flight matches
        officialHomeGoals: null,
        officialAwayGoals: null,
        resultConfirmedAt: null,
      },
    })
    const h = m.homeTeam?.name ?? m.placeholderHomeName
    const a = m.awayTeam?.name ?? m.placeholderAwayName
    console.log(`  [${cfg.status.padEnd(13)}] ${h} ${cfg.home}-${cfg.away} ${a}`)
  }

  console.log('\nDone. Reload "En Vivo" to see live behavior.')
}
main().catch(console.error).finally(() => prisma.$disconnect())

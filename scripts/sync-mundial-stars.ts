/**
 * Sincroniza partidos estrella del Mundial 2026 a producción para
 * ambas quinielas (Ki-Niela Mundial 2026 y DP-TI COPA MUNDO 2026).
 *
 * Idempotente: hace upsert con isStar=true para los matchIds listados.
 *
 *   DATABASE_URL=<railway-url> npx tsx scripts/sync-mundial-stars.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const STAR_MATCH_IDS = [
  'm-a5',
  'm-d1',
  'm-d4',
  'm-f1',
  'm-f3',
  'm-h6',
  'm-i5',
  'm-k5',
  'm-l1',
  'm-l4',
  'match-final',
  'match-inauguration',
  'match-sf-2',
]

const QUINIELA_IDS = ['quiniela-mundial-2026', 'quiniela-dpti-mundial-2026']

async function main() {
  for (const quinielaId of QUINIELA_IDS) {
    const q = await prisma.quiniela.findUnique({ where: { id: quinielaId } })
    if (!q) {
      console.warn(`  ! Quiniela ${quinielaId} no existe — skip`)
      continue
    }
    console.log(`Quiniela: ${q.name}`)
    let applied = 0
    let missing = 0
    for (const matchId of STAR_MATCH_IDS) {
      const m = await prisma.match.findUnique({ where: { id: matchId } })
      if (!m) {
        console.warn(`  ! Match ${matchId} no existe — skip`)
        missing++
        continue
      }
      await prisma.quinielaStarMatch.upsert({
        where: { quinielaId_matchId: { quinielaId, matchId } },
        update: { isStar: true },
        create: { quinielaId, matchId, isStar: true },
      })
      applied++
    }
    console.log(`  ✓ Estrellas aplicadas: ${applied}${missing ? ` (skipped: ${missing})` : ''}`)
  }
  console.log('OK.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

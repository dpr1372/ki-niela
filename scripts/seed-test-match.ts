/**
 * Test match: South Africa vs Nicaragua, viernes 29 may 2026 10:00 AM CR.
 *
 * Crea el partido en el evento "Amistosos Internacionales" YA vinculado al
 * fixture id 401871131 de ESPN (liga fifa.friendly), con su matchday y los
 * dos equipos. Usa upsert con id 'am-test-rsa-nca' para que sea idempotente.
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/seed-test-match.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { fromZonedTime } from 'date-fns-tz'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })
const TZ = 'America/Costa_Rica'

function crLocalToUtc(yyyyMmDd: string, hhmm: string): Date {
  return fromZonedTime(`${yyyyMmDd}T${hhmm}:00`, TZ)
}

async function main() {
  console.log('Seeding test match: South Africa vs Nicaragua (viernes 29 may, 10:00 AM CR)...')

  const eventId = 'event-amistosos-2026'

  const event = await prisma.event.findUnique({ where: { id: eventId } })
  if (!event) {
    throw new Error(
      `Evento ${eventId} no existe. Corre primero scripts/seed-amistosos.ts.`,
    )
  }

  // ── Equipos ────────────────────────────────────────────────────────────────
  await prisma.team.upsert({
    where: { id: 'am-team-rsa' },
    update: { name: 'Sudáfrica', fifaCode: 'RSA' },
    create: { id: 'am-team-rsa', eventId, name: 'Sudáfrica', fifaCode: 'RSA' },
  })
  await prisma.team.upsert({
    where: { id: 'am-team-nca' },
    update: { name: 'Nicaragua', fifaCode: 'NCA' },
    create: { id: 'am-team-nca', eventId, name: 'Nicaragua', fifaCode: 'NCA' },
  })

  // ── Matchday (Viernes 29) ─────────────────────────────────────────────────
  const matchday = await prisma.matchday.upsert({
    where: { id: 'am-matchday-vie29' },
    update: {
      name: 'Viernes 29 de mayo',
      number: 0,
      phase: 'GROUPS',
      startDate: crLocalToUtc('2026-05-29', '00:00'),
      endDate: crLocalToUtc('2026-05-29', '23:59'),
    },
    create: {
      id: 'am-matchday-vie29',
      eventId,
      name: 'Viernes 29 de mayo',
      number: 0,
      phase: 'GROUPS',
      startDate: crLocalToUtc('2026-05-29', '00:00'),
      endDate: crLocalToUtc('2026-05-29', '23:59'),
    },
  })

  // ── Match ──────────────────────────────────────────────────────────────────
  const kickoffUtc = crLocalToUtc('2026-05-29', '10:00')
  const match = await prisma.match.upsert({
    where: { id: 'am-test-rsa-nca' },
    update: {
      eventId,
      homeTeamId: 'am-team-rsa',
      awayTeamId: 'am-team-nca',
      matchdayId: matchday.id,
      phase: 'GROUPS',
      kickoffAtUtc: kickoffUtc,
      kickoffAtCostaRica: kickoffUtc, // schema requires both, store same UTC
      // Pre-link to ESPN so el cron sincroniza apenas pongas el partido en BLOQUEADO
      externalId: 'fifa.friendly|401871131',
      externalProvider: 'espn',
      manualOverride: false,
    },
    create: {
      id: 'am-test-rsa-nca',
      eventId,
      homeTeamId: 'am-team-rsa',
      awayTeamId: 'am-team-nca',
      matchdayId: matchday.id,
      phase: 'GROUPS',
      kickoffAtUtc: kickoffUtc,
      kickoffAtCostaRica: kickoffUtc,
      status: 'PROGRAMADO',
      externalId: 'fifa.friendly|401871131',
      externalProvider: 'espn',
      manualOverride: false,
    },
  })

  console.log(`✓ Partido test creado: ${match.id}`)
  console.log(`  Sudáfrica vs Nicaragua`)
  console.log(`  Kickoff CR: viernes 29 may, 10:00 AM`)
  console.log(`  External ID: ${match.externalId}`)
  console.log(`  Status: ${match.status}`)
  console.log('')
  console.log('Siguiente paso:')
  console.log('  1. Ve a /admin/partidos')
  console.log('  2. Filtra por evento "Amistosos Internacionales"')
  console.log('  3. Verás "Sudáfrica vs Nicaragua" con External ID ya vinculado')
  console.log('  4. A las 10:00 AM hoy, el cron lock-matches lo pondrá en BLOQUEADO')
  console.log('  5. Cuando ESPN reporte goles, el cron sync-live-scores los traerá')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

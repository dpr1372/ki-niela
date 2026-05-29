/**
 * Seed (idempotente) de la fase eliminatoria del Mundial 2026 con calendario
 * y sedes oficiales FIFA. Crea/actualiza:
 *   - 16 partidos Round of 32 (m-r32-73 .. m-r32-88)
 *   - 8 partidos Round of 16 (m-r16-89 .. m-r16-96)
 *   - 4 cuartos (m-qf-97 .. m-qf-100)
 *   - 2 semis (m-sf-101, m-sf-102)
 *   - Actualiza match-3er-lugar y match-final (sede + horario)
 *
 * Numeración basada en los match numbers oficiales FIFA (73-104) para que
 * los placeholders ("Ganador 73 vs Ganador 75") coincidan con la planilla
 * pública del torneo. Fechas en UTC. Hora local de cada sede entre paréntesis.
 *
 *   DATABASE_URL=<url> npx tsx scripts/seed-mundial-knockouts.ts
 */
import { PrismaClient, MatchPhase, MatchStatus } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { toZonedTime } from 'date-fns-tz'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })
const TZ = 'America/Costa_Rica'

const EVENT_ID = 'event-wc2026'

function utcDate(iso: string) {
  return new Date(iso)
}
function crDate(iso: string) {
  return toZonedTime(new Date(iso), TZ)
}

interface KOMatch {
  id: string
  fifaNumber: number
  matchdayId: string
  phase: MatchPhase
  stadiumId: string
  kickoffUtc: string
  homePh: string
  awayPh: string
}

const matches: KOMatch[] = [
  // ── Round of 32 (28 jun → 3 jul) ────────────────────────────────────────────
  // Times converted to UTC from each venue's local TZ:
  // SoFi/Levi's/Lumen/BC Place = UTC-7 (PDT) | NRG/AT&T/Arrowhead = UTC-5 (CDT)
  // Gillette/MetLife/BMO/Mercedes/Lincoln/Hard Rock = UTC-4 (EDT) | BBVA/Azteca = UTC-6 (CST/MDT)
  { id: 'm-r32-73', fifaNumber: 73, matchdayId: 'md-octavos', phase: MatchPhase.ROUND_OF_32, stadiumId: 'std-sofi',         kickoffUtc: '2026-06-28T19:00:00Z', homePh: '2A', awayPh: '2B' },
  { id: 'm-r32-74', fifaNumber: 74, matchdayId: 'md-octavos', phase: MatchPhase.ROUND_OF_32, stadiumId: 'std-gillette',     kickoffUtc: '2026-06-29T20:30:00Z', homePh: '1E', awayPh: '3º (A/B/C/D/F)' },
  { id: 'm-r32-75', fifaNumber: 75, matchdayId: 'md-octavos', phase: MatchPhase.ROUND_OF_32, stadiumId: 'std-bbva',         kickoffUtc: '2026-06-30T01:00:00Z', homePh: '1F', awayPh: '2C' },
  { id: 'm-r32-76', fifaNumber: 76, matchdayId: 'md-octavos', phase: MatchPhase.ROUND_OF_32, stadiumId: 'std-nrg',          kickoffUtc: '2026-06-29T17:00:00Z', homePh: '1C', awayPh: '2F' },
  { id: 'm-r32-77', fifaNumber: 77, matchdayId: 'md-octavos', phase: MatchPhase.ROUND_OF_32, stadiumId: 'std-metlife',      kickoffUtc: '2026-06-30T21:00:00Z', homePh: '1I', awayPh: '3º (C/D/F/G/H)' },
  { id: 'm-r32-78', fifaNumber: 78, matchdayId: 'md-octavos', phase: MatchPhase.ROUND_OF_32, stadiumId: 'std-cowboys',      kickoffUtc: '2026-06-30T17:00:00Z', homePh: '2E', awayPh: '2I' },
  { id: 'm-r32-79', fifaNumber: 79, matchdayId: 'md-octavos', phase: MatchPhase.ROUND_OF_32, stadiumId: 'std-azteca',       kickoffUtc: '2026-07-01T01:00:00Z', homePh: '1A', awayPh: '3º (C/E/F/H/I)' },
  { id: 'm-r32-80', fifaNumber: 80, matchdayId: 'md-octavos', phase: MatchPhase.ROUND_OF_32, stadiumId: 'std-mercedesbenz', kickoffUtc: '2026-07-01T16:00:00Z', homePh: '1L', awayPh: '3º (E/H/I/J/K)' },
  { id: 'm-r32-81', fifaNumber: 81, matchdayId: 'md-octavos', phase: MatchPhase.ROUND_OF_32, stadiumId: 'std-levis',        kickoffUtc: '2026-07-02T00:00:00Z', homePh: '1D', awayPh: '3º (B/E/F/I/J)' },
  { id: 'm-r32-82', fifaNumber: 82, matchdayId: 'md-octavos', phase: MatchPhase.ROUND_OF_32, stadiumId: 'std-lumen',        kickoffUtc: '2026-07-01T20:00:00Z', homePh: '1G', awayPh: '3º (A/E/H/I/J)' },
  { id: 'm-r32-83', fifaNumber: 83, matchdayId: 'md-octavos', phase: MatchPhase.ROUND_OF_32, stadiumId: 'std-bmo',          kickoffUtc: '2026-07-02T23:00:00Z', homePh: '2K', awayPh: '2L' },
  { id: 'm-r32-84', fifaNumber: 84, matchdayId: 'md-octavos', phase: MatchPhase.ROUND_OF_32, stadiumId: 'std-sofi',         kickoffUtc: '2026-07-02T19:00:00Z', homePh: '1H', awayPh: '2J' },
  { id: 'm-r32-85', fifaNumber: 85, matchdayId: 'md-octavos', phase: MatchPhase.ROUND_OF_32, stadiumId: 'std-bcp',          kickoffUtc: '2026-07-03T03:00:00Z', homePh: '1B', awayPh: '3º (E/F/G/I/J)' },
  { id: 'm-r32-86', fifaNumber: 86, matchdayId: 'md-octavos', phase: MatchPhase.ROUND_OF_32, stadiumId: 'std-hardrock',     kickoffUtc: '2026-07-03T22:00:00Z', homePh: '1J', awayPh: '2H' },
  { id: 'm-r32-87', fifaNumber: 87, matchdayId: 'md-octavos', phase: MatchPhase.ROUND_OF_32, stadiumId: 'std-arrowhead',    kickoffUtc: '2026-07-04T01:30:00Z', homePh: '1K', awayPh: '3º (D/E/I/J/L)' },
  { id: 'm-r32-88', fifaNumber: 88, matchdayId: 'md-octavos', phase: MatchPhase.ROUND_OF_32, stadiumId: 'std-cowboys',      kickoffUtc: '2026-07-03T18:00:00Z', homePh: '2D', awayPh: '2G' },

  // ── Round of 16 / Octavos (4 → 7 jul) ───────────────────────────────────────
  { id: 'm-r16-89',  fifaNumber: 89,  matchdayId: 'md-dieciseis', phase: MatchPhase.ROUND_OF_16, stadiumId: 'std-lincoln',      kickoffUtc: '2026-07-04T21:00:00Z', homePh: 'Ganador 74', awayPh: 'Ganador 77' },
  { id: 'm-r16-90',  fifaNumber: 90,  matchdayId: 'md-dieciseis', phase: MatchPhase.ROUND_OF_16, stadiumId: 'std-nrg',          kickoffUtc: '2026-07-04T17:00:00Z', homePh: 'Ganador 73', awayPh: 'Ganador 75' },
  { id: 'm-r16-91',  fifaNumber: 91,  matchdayId: 'md-dieciseis', phase: MatchPhase.ROUND_OF_16, stadiumId: 'std-metlife',      kickoffUtc: '2026-07-05T20:00:00Z', homePh: 'Ganador 76', awayPh: 'Ganador 78' },
  { id: 'm-r16-92',  fifaNumber: 92,  matchdayId: 'md-dieciseis', phase: MatchPhase.ROUND_OF_16, stadiumId: 'std-azteca',       kickoffUtc: '2026-07-06T00:00:00Z', homePh: 'Ganador 79', awayPh: 'Ganador 80' },
  { id: 'm-r16-93',  fifaNumber: 93,  matchdayId: 'md-dieciseis', phase: MatchPhase.ROUND_OF_16, stadiumId: 'std-cowboys',      kickoffUtc: '2026-07-06T19:00:00Z', homePh: 'Ganador 83', awayPh: 'Ganador 84' },
  { id: 'm-r16-94',  fifaNumber: 94,  matchdayId: 'md-dieciseis', phase: MatchPhase.ROUND_OF_16, stadiumId: 'std-lumen',        kickoffUtc: '2026-07-07T00:00:00Z', homePh: 'Ganador 81', awayPh: 'Ganador 82' },
  { id: 'm-r16-95',  fifaNumber: 95,  matchdayId: 'md-dieciseis', phase: MatchPhase.ROUND_OF_16, stadiumId: 'std-mercedesbenz', kickoffUtc: '2026-07-07T16:00:00Z', homePh: 'Ganador 86', awayPh: 'Ganador 88' },
  { id: 'm-r16-96',  fifaNumber: 96,  matchdayId: 'md-dieciseis', phase: MatchPhase.ROUND_OF_16, stadiumId: 'std-bcp',          kickoffUtc: '2026-07-07T20:00:00Z', homePh: 'Ganador 85', awayPh: 'Ganador 87' },

  // ── Cuartos (9, 10, 11 jul) ────────────────────────────────────────────────
  { id: 'm-qf-97',   fifaNumber: 97,   matchdayId: 'md-cuartos', phase: MatchPhase.QUARTER_FINAL, stadiumId: 'std-gillette',     kickoffUtc: '2026-07-09T20:00:00Z', homePh: 'Ganador 89', awayPh: 'Ganador 90' },
  { id: 'm-qf-98',   fifaNumber: 98,   matchdayId: 'md-cuartos', phase: MatchPhase.QUARTER_FINAL, stadiumId: 'std-sofi',         kickoffUtc: '2026-07-10T19:00:00Z', homePh: 'Ganador 93', awayPh: 'Ganador 94' },
  { id: 'm-qf-99',   fifaNumber: 99,   matchdayId: 'md-cuartos', phase: MatchPhase.QUARTER_FINAL, stadiumId: 'std-hardrock',     kickoffUtc: '2026-07-11T21:00:00Z', homePh: 'Ganador 91', awayPh: 'Ganador 92' },
  { id: 'm-qf-100',  fifaNumber: 100,  matchdayId: 'md-cuartos', phase: MatchPhase.QUARTER_FINAL, stadiumId: 'std-arrowhead',    kickoffUtc: '2026-07-12T01:00:00Z', homePh: 'Ganador 95', awayPh: 'Ganador 96' },

  // ── Semifinales (14, 15 jul) ───────────────────────────────────────────────
  { id: 'm-sf-101',  fifaNumber: 101,  matchdayId: 'md-semis', phase: MatchPhase.SEMI_FINAL, stadiumId: 'std-cowboys',      kickoffUtc: '2026-07-14T19:00:00Z', homePh: 'Ganador 97', awayPh: 'Ganador 98' },
  { id: 'm-sf-102',  fifaNumber: 102,  matchdayId: 'md-semis', phase: MatchPhase.SEMI_FINAL, stadiumId: 'std-mercedesbenz', kickoffUtc: '2026-07-15T19:00:00Z', homePh: 'Ganador 99', awayPh: 'Ganador 100' },
]

async function ensureMatchdays() {
  // Por si la BD aún no tiene los matchdays de eliminatoria
  const matchdays = [
    { id: 'md-octavos',   name: 'Ronda de 32',          number: 4, phase: MatchPhase.ROUND_OF_32 },
    { id: 'md-dieciseis', name: 'Octavos de Final',     number: 5, phase: MatchPhase.ROUND_OF_16 },
    { id: 'md-cuartos',   name: 'Cuartos de Final',     number: 6, phase: MatchPhase.QUARTER_FINAL },
    { id: 'md-semis',     name: 'Semifinales',          number: 7, phase: MatchPhase.SEMI_FINAL },
    { id: 'md-3er',       name: 'Tercer Lugar',         number: 8, phase: MatchPhase.THIRD_PLACE },
    { id: 'md-final',     name: 'Final',                number: 9, phase: MatchPhase.FINAL },
  ]
  for (const md of matchdays) {
    await prisma.matchday.upsert({
      where: { id: md.id },
      update: { name: md.name, number: md.number, phase: md.phase },
      create: { ...md, eventId: EVENT_ID },
    })
  }
}

async function main() {
  console.log(`Seeding knockouts for ${EVENT_ID}...`)

  await ensureMatchdays()

  let created = 0
  let updated = 0
  for (const m of matches) {
    const existing = await prisma.match.findUnique({ where: { id: m.id } })
    await prisma.match.upsert({
      where: { id: m.id },
      update: {
        stadiumId: m.stadiumId,
        matchdayId: m.matchdayId,
        phase: m.phase,
        kickoffAtUtc: utcDate(m.kickoffUtc),
        kickoffAtCostaRica: crDate(m.kickoffUtc),
        placeholderHomeName: m.homePh,
        placeholderAwayName: m.awayPh,
      },
      create: {
        id: m.id,
        eventId: EVENT_ID,
        placeholderHomeName: m.homePh,
        placeholderAwayName: m.awayPh,
        stadiumId: m.stadiumId,
        matchdayId: m.matchdayId,
        phase: m.phase,
        kickoffAtUtc: utcDate(m.kickoffUtc),
        kickoffAtCostaRica: crDate(m.kickoffUtc),
        status: MatchStatus.PROGRAMADO,
      },
    })
    if (existing) updated++; else created++
  }
  console.log(`  R32/R16/QF/SF: created=${created}, updated=${updated}`)

  // Tercer lugar (Hard Rock, 18 jul, 5pm EDT)
  await prisma.match.upsert({
    where: { id: 'match-3er-lugar' },
    update: {
      stadiumId: 'std-hardrock',
      kickoffAtUtc: utcDate('2026-07-18T21:00:00Z'),
      kickoffAtCostaRica: crDate('2026-07-18T21:00:00Z'),
      placeholderHomeName: 'Perdedor 101',
      placeholderAwayName: 'Perdedor 102',
    },
    create: {
      id: 'match-3er-lugar',
      eventId: EVENT_ID,
      placeholderHomeName: 'Perdedor 101',
      placeholderAwayName: 'Perdedor 102',
      stadiumId: 'std-hardrock',
      matchdayId: 'md-3er',
      phase: MatchPhase.THIRD_PLACE,
      kickoffAtUtc: utcDate('2026-07-18T21:00:00Z'),
      kickoffAtCostaRica: crDate('2026-07-18T21:00:00Z'),
      status: MatchStatus.PROGRAMADO,
    },
  })
  console.log('  Tercer lugar: actualizado (Hard Rock, 18 jul 21:00 UTC)')

  // Final (MetLife, 19 jul, 3pm EDT)
  await prisma.match.upsert({
    where: { id: 'match-final' },
    update: {
      stadiumId: 'std-metlife',
      kickoffAtUtc: utcDate('2026-07-19T19:00:00Z'),
      kickoffAtCostaRica: crDate('2026-07-19T19:00:00Z'),
      placeholderHomeName: 'Ganador 101',
      placeholderAwayName: 'Ganador 102',
    },
    create: {
      id: 'match-final',
      eventId: EVENT_ID,
      placeholderHomeName: 'Ganador 101',
      placeholderAwayName: 'Ganador 102',
      stadiumId: 'std-metlife',
      matchdayId: 'md-final',
      phase: MatchPhase.FINAL,
      kickoffAtUtc: utcDate('2026-07-19T19:00:00Z'),
      kickoffAtCostaRica: crDate('2026-07-19T19:00:00Z'),
      status: MatchStatus.PROGRAMADO,
    },
  })
  console.log('  Final: actualizada (MetLife, 19 jul 19:00 UTC)')

  console.log('OK.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

import { PrismaClient, MatchPhase, MatchStatus } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { toZonedTime } from 'date-fns-tz'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })
const TZ = 'America/Costa_Rica'

function utcDate(iso: string) {
  return new Date(iso)
}

function crDate(utcIso: string): Date {
  return toZonedTime(new Date(utcIso), TZ)
}

async function main() {
  console.log('Seeding FIFA World Cup 2026...')

  // ── Event ──────────────────────────────────────────────────────────────────
  const event = await prisma.event.upsert({
    where: { id: 'event-wc2026' },
    update: {
      bannerLabel: 'FIFA World Cup 2026 · MEX · USA · CAN',
      bannerSubtitle: 'Compite, predice y celebra cada gol del mundial.',
    },
    create: {
      id: 'event-wc2026',
      name: 'FIFA World Cup 2026',
      description: 'Copa del Mundo FIFA 2026 — México, EUA y Canadá',
      sport: 'football',
      startDate: new Date('2026-06-11T00:00:00Z'),
      endDate: new Date('2026-07-19T00:00:00Z'),
      timezone: 'America/Costa_Rica',
      status: 'ACTIVE',
      bannerLabel: 'FIFA World Cup 2026 · MEX · USA · CAN',
      bannerSubtitle: 'Compite, predice y celebra cada gol del mundial.',
    },
  })

  // ── Teams ──────────────────────────────────────────────────────────────────
  // FIFA World Cup 2026 — actual draw confirmed
  const teamsData = [
    // Group A (Mexico City / Guadalajara host group)
    { id: 'team-mex',  fifaCode: 'MEX', name: 'México',          groupCode: 'A' },
    { id: 'team-rsa',  fifaCode: 'RSA', name: 'Sudáfrica',        groupCode: 'A' },
    { id: 'team-kor',  fifaCode: 'KOR', name: 'Corea del Sur',    groupCode: 'A' },
    { id: 'team-cze',  fifaCode: 'CZE', name: 'República Checa',  groupCode: 'A' },
    // Group B (Toronto / Vancouver host group)
    { id: 'team-can',  fifaCode: 'CAN', name: 'Canadá',           groupCode: 'B' },
    { id: 'team-bih',  fifaCode: 'BIH', name: 'Bosnia y Herzegovina', groupCode: 'B' },
    { id: 'team-qat',  fifaCode: 'QAT', name: 'Catar',            groupCode: 'B' },
    { id: 'team-sui',  fifaCode: 'SUI', name: 'Suiza',            groupCode: 'B' },
    // Group C
    { id: 'team-bra',  fifaCode: 'BRA', name: 'Brasil',           groupCode: 'C' },
    { id: 'team-mar',  fifaCode: 'MAR', name: 'Marruecos',        groupCode: 'C' },
    { id: 'team-hai',  fifaCode: 'HAI', name: 'Haití',            groupCode: 'C' },
    { id: 'team-sco',  fifaCode: 'SCO', name: 'Escocia',          groupCode: 'C' },
    // Group D (USA group — West Coast)
    { id: 'team-usa',  fifaCode: 'USA', name: 'Estados Unidos',   groupCode: 'D' },
    { id: 'team-par',  fifaCode: 'PAR', name: 'Paraguay',         groupCode: 'D' },
    { id: 'team-aus',  fifaCode: 'AUS', name: 'Australia',        groupCode: 'D' },
    { id: 'team-tur',  fifaCode: 'TUR', name: 'Turquía',          groupCode: 'D' },
    // Group E
    { id: 'team-ger',  fifaCode: 'GER', name: 'Alemania',         groupCode: 'E' },
    { id: 'team-cuw',  fifaCode: 'CUW', name: 'Curazao',          groupCode: 'E' },
    { id: 'team-civ',  fifaCode: 'CIV', name: 'Costa de Marfil',  groupCode: 'E' },
    { id: 'team-ecu',  fifaCode: 'ECU', name: 'Ecuador',          groupCode: 'E' },
    // Group F
    { id: 'team-ned',  fifaCode: 'NED', name: 'Países Bajos',     groupCode: 'F' },
    { id: 'team-jpn',  fifaCode: 'JPN', name: 'Japón',            groupCode: 'F' },
    { id: 'team-swe',  fifaCode: 'SWE', name: 'Suecia',           groupCode: 'F' },
    { id: 'team-tun',  fifaCode: 'TUN', name: 'Túnez',            groupCode: 'F' },
    // Group G
    { id: 'team-bel',  fifaCode: 'BEL', name: 'Bélgica',          groupCode: 'G' },
    { id: 'team-egy',  fifaCode: 'EGY', name: 'Egipto',           groupCode: 'G' },
    { id: 'team-irn',  fifaCode: 'IRN', name: 'Irán',             groupCode: 'G' },
    { id: 'team-nzl',  fifaCode: 'NZL', name: 'Nueva Zelanda',    groupCode: 'G' },
    // Group H
    { id: 'team-esp',  fifaCode: 'ESP', name: 'España',           groupCode: 'H' },
    { id: 'team-cpv',  fifaCode: 'CPV', name: 'Cabo Verde',       groupCode: 'H' },
    { id: 'team-ksa',  fifaCode: 'KSA', name: 'Arabia Saudita',   groupCode: 'H' },
    { id: 'team-uru',  fifaCode: 'URU', name: 'Uruguay',          groupCode: 'H' },
    // Group I
    { id: 'team-fra',  fifaCode: 'FRA', name: 'Francia',          groupCode: 'I' },
    { id: 'team-sen',  fifaCode: 'SEN', name: 'Senegal',          groupCode: 'I' },
    { id: 'team-irq',  fifaCode: 'IRQ', name: 'Irak',             groupCode: 'I' },
    { id: 'team-nor',  fifaCode: 'NOR', name: 'Noruega',          groupCode: 'I' },
    // Group J
    { id: 'team-arg',  fifaCode: 'ARG', name: 'Argentina',        groupCode: 'J' },
    { id: 'team-alg',  fifaCode: 'ALG', name: 'Argelia',          groupCode: 'J' },
    { id: 'team-aut',  fifaCode: 'AUT', name: 'Austria',          groupCode: 'J' },
    { id: 'team-jor',  fifaCode: 'JOR', name: 'Jordania',         groupCode: 'J' },
    // Group K
    { id: 'team-prt',  fifaCode: 'PRT', name: 'Portugal',         groupCode: 'K' },
    { id: 'team-cod',  fifaCode: 'COD', name: 'Rep. D. del Congo', groupCode: 'K' },
    { id: 'team-uzb',  fifaCode: 'UZB', name: 'Uzbekistán',       groupCode: 'K' },
    { id: 'team-col',  fifaCode: 'COL', name: 'Colombia',         groupCode: 'K' },
    // Group L
    { id: 'team-eng',  fifaCode: 'ENG', name: 'Inglaterra',       groupCode: 'L' },
    { id: 'team-cro',  fifaCode: 'CRO', name: 'Croacia',          groupCode: 'L' },
    { id: 'team-gha',  fifaCode: 'GHA', name: 'Ghana',            groupCode: 'L' },
    { id: 'team-pan',  fifaCode: 'PAN', name: 'Panamá',           groupCode: 'L' },
  ]

  for (const t of teamsData) {
    await prisma.team.upsert({
      where: { id: t.id },
      update: { name: t.name, fifaCode: t.fifaCode, groupCode: t.groupCode },
      create: { ...t, eventId: event.id },
    })
  }

  // ── Stadiums ───────────────────────────────────────────────────────────────
  const stadiumsData = [
    // Mexico
    { id: 'std-azteca',   name: 'Estadio Azteca',      city: 'Ciudad de México', country: 'México' },
    { id: 'std-akron',    name: 'Estadio Akron',        city: 'Zapopan',          country: 'México' },
    { id: 'std-bbva',     name: 'Estadio BBVA',         city: 'Guadalupe',        country: 'México' },
    // USA (East)
    { id: 'std-metlife',  name: 'MetLife Stadium',      city: 'East Rutherford, NJ', country: 'EUA' },
    { id: 'std-gillette', name: 'Gillette Stadium',     city: 'Foxborough, MA',   country: 'EUA' },
    { id: 'std-lincoln',  name: 'Lincoln Financial Field', city: 'Philadelphia, PA', country: 'EUA' },
    { id: 'std-hardrock', name: 'Hard Rock Stadium',    city: 'Miami Gardens, FL', country: 'EUA' },
    { id: 'std-mercedesbenz', name: 'Mercedes-Benz Stadium', city: 'Atlanta, GA', country: 'EUA' },
    // USA (Central)
    { id: 'std-cowboys',  name: 'AT&T Stadium',         city: 'Arlington, TX',    country: 'EUA' },
    { id: 'std-nrg',      name: 'NRG Stadium',          city: 'Houston, TX',      country: 'EUA' },
    { id: 'std-arrowhead',name: 'Arrowhead Stadium',    city: 'Kansas City, MO',  country: 'EUA' },
    // USA (West)
    { id: 'std-sofi',     name: 'SoFi Stadium',         city: 'Inglewood, CA',    country: 'EUA' },
    { id: 'std-levis',    name: "Levi's Stadium",       city: 'Santa Clara, CA',  country: 'EUA' },
    { id: 'std-lumen',    name: 'Lumen Field',          city: 'Seattle, WA',      country: 'EUA' },
    // Canada
    { id: 'std-bmo',      name: 'BMO Field',            city: 'Toronto',          country: 'Canadá' },
    { id: 'std-bcp',      name: 'BC Place',             city: 'Vancouver',        country: 'Canadá' },
  ]

  for (const s of stadiumsData) {
    await prisma.stadium.upsert({
      where: { id: s.id },
      update: { name: s.name, city: s.city, country: s.country },
      create: { ...s, eventId: event.id },
    })
  }

  // ── Matchdays ──────────────────────────────────────────────────────────────
  const matchdaysData = [
    { id: 'md-jornada1', name: 'Jornada 1 - Fase de Grupos', number: 1, phase: MatchPhase.GROUPS },
    { id: 'md-jornada2', name: 'Jornada 2 - Fase de Grupos', number: 2, phase: MatchPhase.GROUPS },
    { id: 'md-jornada3', name: 'Jornada 3 - Fase de Grupos', number: 3, phase: MatchPhase.GROUPS },
    { id: 'md-octavos',  name: 'Ronda de 32',                number: 4, phase: MatchPhase.ROUND_OF_32 },
    { id: 'md-dieciseis',name: 'Octavos de Final',           number: 5, phase: MatchPhase.ROUND_OF_16 },
    { id: 'md-cuartos',  name: 'Cuartos de Final',           number: 6, phase: MatchPhase.QUARTER_FINAL },
    { id: 'md-semis',    name: 'Semifinales',                number: 7, phase: MatchPhase.SEMI_FINAL },
    { id: 'md-3er',      name: 'Tercer Lugar',               number: 8, phase: MatchPhase.THIRD_PLACE },
    { id: 'md-final',    name: 'Final',                      number: 9, phase: MatchPhase.FINAL },
  ]

  for (const md of matchdaysData) {
    await prisma.matchday.upsert({
      where: { id: md.id },
      update: { name: md.name, number: md.number, phase: md.phase },
      create: { ...md, eventId: event.id },
    })
  }

  // ── Helper to create group matches ────────────────────────────────────────
  async function upsertMatch(id: string, opts: {
    homeTeamId: string
    awayTeamId: string
    stadiumId: string
    matchdayId: string
    groupCode: string
    kickoffUtc: string
  }) {
    // update con los mismos campos del create: si el match ya existía vacío
    // (p.ej. creado por otro script sin equipos), re-correr el seed lo repara.
    // No tocamos status ni resultados (no figuran aquí) para no pisar lo jugado.
    const matchData = {
      eventId: event.id,
      homeTeamId: opts.homeTeamId,
      awayTeamId: opts.awayTeamId,
      stadiumId: opts.stadiumId,
      matchdayId: opts.matchdayId,
      phase: MatchPhase.GROUPS,
      groupCode: opts.groupCode,
      kickoffAtUtc: utcDate(opts.kickoffUtc),
      kickoffAtCostaRica: crDate(opts.kickoffUtc),
    }
    await prisma.match.upsert({
      where: { id },
      update: matchData,
      create: { id, ...matchData, status: MatchStatus.PROGRAMADO },
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP STAGE MATCHES — FIFA World Cup 2026
  // All times in UTC. Costa Rica = UTC-6 (no DST)
  // Sources: Wikipedia per-group pages (fetched May 2026)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── GROUP A: México, Sudáfrica, Corea del Sur, República Checa ─────────────
  // Jornada 1 — MEX vs RSA is the inauguration match (see below, id=match-inauguration)
  await upsertMatch('m-a2', { homeTeamId:'team-kor', awayTeamId:'team-cze', stadiumId:'std-akron',    matchdayId:'md-jornada1', groupCode:'A', kickoffUtc:'2026-06-12T02:00:00Z' }) // 8pm MDT Jun11
  // Jornada 2
  await upsertMatch('m-a3', { homeTeamId:'team-cze', awayTeamId:'team-rsa', stadiumId:'std-mercedesbenz', matchdayId:'md-jornada2', groupCode:'A', kickoffUtc:'2026-06-18T16:00:00Z' }) // 12pm EDT
  await upsertMatch('m-a4', { homeTeamId:'team-mex', awayTeamId:'team-kor', stadiumId:'std-akron',    matchdayId:'md-jornada2', groupCode:'A', kickoffUtc:'2026-06-19T01:00:00Z' }) // 7pm MDT Jun18
  // Jornada 3
  await upsertMatch('m-a5', { homeTeamId:'team-cze', awayTeamId:'team-mex', stadiumId:'std-azteca',   matchdayId:'md-jornada3', groupCode:'A', kickoffUtc:'2026-06-25T01:00:00Z' }) // 7pm MDT Jun24
  await upsertMatch('m-a6', { homeTeamId:'team-rsa', awayTeamId:'team-kor', stadiumId:'std-bbva',     matchdayId:'md-jornada3', groupCode:'A', kickoffUtc:'2026-06-25T01:00:00Z' }) // 7pm MDT Jun24

  // ── GROUP B: Canadá, Bosnia y Herzegovina, Catar, Suiza ────────────────────
  // Jornada 1
  await upsertMatch('m-b1', { homeTeamId:'team-can', awayTeamId:'team-bih', stadiumId:'std-bmo',      matchdayId:'md-jornada1', groupCode:'B', kickoffUtc:'2026-06-12T19:00:00Z' }) // 3pm EDT
  await upsertMatch('m-b2', { homeTeamId:'team-qat', awayTeamId:'team-sui', stadiumId:'std-levis',    matchdayId:'md-jornada1', groupCode:'B', kickoffUtc:'2026-06-13T19:00:00Z' }) // 12pm PDT
  // Jornada 2
  await upsertMatch('m-b3', { homeTeamId:'team-sui', awayTeamId:'team-bih', stadiumId:'std-sofi',     matchdayId:'md-jornada2', groupCode:'B', kickoffUtc:'2026-06-18T19:00:00Z' }) // 12pm PDT
  await upsertMatch('m-b4', { homeTeamId:'team-can', awayTeamId:'team-qat', stadiumId:'std-bcp',      matchdayId:'md-jornada2', groupCode:'B', kickoffUtc:'2026-06-18T22:00:00Z' }) // 3pm PDT
  // Jornada 3
  await upsertMatch('m-b5', { homeTeamId:'team-sui', awayTeamId:'team-can', stadiumId:'std-bcp',      matchdayId:'md-jornada3', groupCode:'B', kickoffUtc:'2026-06-24T19:00:00Z' }) // 12pm PDT
  await upsertMatch('m-b6', { homeTeamId:'team-bih', awayTeamId:'team-qat', stadiumId:'std-lumen',    matchdayId:'md-jornada3', groupCode:'B', kickoffUtc:'2026-06-24T19:00:00Z' }) // 12pm PDT

  // ── GROUP C: Brasil, Marruecos, Haití, Escocia ─────────────────────────────
  // Jornada 1
  await upsertMatch('m-c1', { homeTeamId:'team-bra', awayTeamId:'team-mar', stadiumId:'std-metlife',  matchdayId:'md-jornada1', groupCode:'C', kickoffUtc:'2026-06-13T22:00:00Z' }) // 6pm EDT
  await upsertMatch('m-c2', { homeTeamId:'team-hai', awayTeamId:'team-sco', stadiumId:'std-gillette', matchdayId:'md-jornada1', groupCode:'C', kickoffUtc:'2026-06-14T01:00:00Z' }) // 9pm EDT Jun13
  // Jornada 2
  await upsertMatch('m-c3', { homeTeamId:'team-sco', awayTeamId:'team-mar', stadiumId:'std-gillette', matchdayId:'md-jornada2', groupCode:'C', kickoffUtc:'2026-06-19T22:00:00Z' }) // 6pm EDT
  await upsertMatch('m-c4', { homeTeamId:'team-bra', awayTeamId:'team-hai', stadiumId:'std-lincoln',  matchdayId:'md-jornada2', groupCode:'C', kickoffUtc:'2026-06-20T00:30:00Z' }) // 8:30pm EDT Jun19
  // Jornada 3
  await upsertMatch('m-c5', { homeTeamId:'team-sco', awayTeamId:'team-bra', stadiumId:'std-hardrock', matchdayId:'md-jornada3', groupCode:'C', kickoffUtc:'2026-06-24T22:00:00Z' }) // 6pm EDT
  await upsertMatch('m-c6', { homeTeamId:'team-mar', awayTeamId:'team-hai', stadiumId:'std-mercedesbenz', matchdayId:'md-jornada3', groupCode:'C', kickoffUtc:'2026-06-24T22:00:00Z' }) // 6pm EDT

  // ── GROUP D: Estados Unidos, Paraguay, Australia, Turquía ──────────────────
  // Jornada 1
  await upsertMatch('m-d1', { homeTeamId:'team-usa', awayTeamId:'team-par', stadiumId:'std-sofi',     matchdayId:'md-jornada1', groupCode:'D', kickoffUtc:'2026-06-12T23:00:00Z' }) // ~4pm PDT Jun12
  await upsertMatch('m-d2', { homeTeamId:'team-aus', awayTeamId:'team-tur', stadiumId:'std-bcp',      matchdayId:'md-jornada1', groupCode:'D', kickoffUtc:'2026-06-13T22:00:00Z' }) // ~3pm PDT Jun13
  // Jornada 2
  await upsertMatch('m-d3', { homeTeamId:'team-usa', awayTeamId:'team-aus', stadiumId:'std-lumen',    matchdayId:'md-jornada2', groupCode:'D', kickoffUtc:'2026-06-19T19:00:00Z' }) // ~12pm PDT
  await upsertMatch('m-d4', { homeTeamId:'team-tur', awayTeamId:'team-par', stadiumId:'std-levis',    matchdayId:'md-jornada2', groupCode:'D', kickoffUtc:'2026-06-19T22:00:00Z' }) // ~3pm PDT
  // Jornada 3
  await upsertMatch('m-d5', { homeTeamId:'team-tur', awayTeamId:'team-usa', stadiumId:'std-sofi',     matchdayId:'md-jornada3', groupCode:'D', kickoffUtc:'2026-06-25T19:00:00Z' }) // ~12pm PDT
  await upsertMatch('m-d6', { homeTeamId:'team-par', awayTeamId:'team-aus', stadiumId:'std-levis',    matchdayId:'md-jornada3', groupCode:'D', kickoffUtc:'2026-06-25T22:00:00Z' }) // ~3pm PDT

  // ── GROUP E: Alemania, Curazao, Costa de Marfil, Ecuador ───────────────────
  // Jornada 1
  await upsertMatch('m-e1', { homeTeamId:'team-ger', awayTeamId:'team-cuw', stadiumId:'std-nrg',      matchdayId:'md-jornada1', groupCode:'E', kickoffUtc:'2026-06-14T17:00:00Z' }) // 12pm CDT
  await upsertMatch('m-e2', { homeTeamId:'team-civ', awayTeamId:'team-ecu', stadiumId:'std-lincoln',  matchdayId:'md-jornada1', groupCode:'E', kickoffUtc:'2026-06-14T23:00:00Z' }) // 7pm EDT
  // Jornada 2
  await upsertMatch('m-e3', { homeTeamId:'team-ger', awayTeamId:'team-civ', stadiumId:'std-bmo',      matchdayId:'md-jornada2', groupCode:'E', kickoffUtc:'2026-06-20T20:00:00Z' }) // 4pm EDT
  await upsertMatch('m-e4', { homeTeamId:'team-ecu', awayTeamId:'team-cuw', stadiumId:'std-arrowhead',matchdayId:'md-jornada2', groupCode:'E', kickoffUtc:'2026-06-21T00:00:00Z' }) // 7pm CDT Jun20
  // Jornada 3
  await upsertMatch('m-e5', { homeTeamId:'team-cuw', awayTeamId:'team-civ', stadiumId:'std-lincoln',  matchdayId:'md-jornada3', groupCode:'E', kickoffUtc:'2026-06-25T20:00:00Z' }) // 4pm EDT
  await upsertMatch('m-e6', { homeTeamId:'team-ecu', awayTeamId:'team-ger', stadiumId:'std-metlife',  matchdayId:'md-jornada3', groupCode:'E', kickoffUtc:'2026-06-25T20:00:00Z' }) // 4pm EDT

  // ── GROUP F: Países Bajos, Japón, Suecia, Túnez ────────────────────────────
  // Jornada 1
  await upsertMatch('m-f1', { homeTeamId:'team-ned', awayTeamId:'team-jpn', stadiumId:'std-cowboys',  matchdayId:'md-jornada1', groupCode:'F', kickoffUtc:'2026-06-14T19:00:00Z' }) // 3pm EDT (AT&T = CDT, 2pm CDT=19UTC)
  await upsertMatch('m-f2', { homeTeamId:'team-swe', awayTeamId:'team-tun', stadiumId:'std-bbva',     matchdayId:'md-jornada1', groupCode:'F', kickoffUtc:'2026-06-15T01:00:00Z' }) // 8pm CDT Jun14
  // Jornada 2
  await upsertMatch('m-f3', { homeTeamId:'team-ned', awayTeamId:'team-swe', stadiumId:'std-nrg',      matchdayId:'md-jornada2', groupCode:'F', kickoffUtc:'2026-06-20T16:00:00Z' }) // 12pm EDT
  await upsertMatch('m-f4', { homeTeamId:'team-tun', awayTeamId:'team-jpn', stadiumId:'std-bbva',     matchdayId:'md-jornada2', groupCode:'F', kickoffUtc:'2026-06-21T03:00:00Z' }) // 10pm CDT Jun20
  // Jornada 3
  await upsertMatch('m-f5', { homeTeamId:'team-jpn', awayTeamId:'team-swe', stadiumId:'std-cowboys',  matchdayId:'md-jornada3', groupCode:'F', kickoffUtc:'2026-06-25T22:00:00Z' }) // 6pm EDT
  await upsertMatch('m-f6', { homeTeamId:'team-tun', awayTeamId:'team-ned', stadiumId:'std-arrowhead',matchdayId:'md-jornada3', groupCode:'F', kickoffUtc:'2026-06-25T22:00:00Z' }) // 6pm EDT

  // ── GROUP G: Bélgica, Egipto, Irán, Nueva Zelanda ──────────────────────────
  // Jornada 1
  await upsertMatch('m-g1', { homeTeamId:'team-bel', awayTeamId:'team-egy', stadiumId:'std-lumen',    matchdayId:'md-jornada1', groupCode:'G', kickoffUtc:'2026-06-15T19:00:00Z' }) // 12pm PDT
  await upsertMatch('m-g2', { homeTeamId:'team-irn', awayTeamId:'team-nzl', stadiumId:'std-sofi',     matchdayId:'md-jornada1', groupCode:'G', kickoffUtc:'2026-06-16T01:00:00Z' }) // 6pm PDT Jun15
  // Jornada 2
  await upsertMatch('m-g3', { homeTeamId:'team-bel', awayTeamId:'team-irn', stadiumId:'std-sofi',     matchdayId:'md-jornada2', groupCode:'G', kickoffUtc:'2026-06-21T19:00:00Z' }) // 12pm PDT
  await upsertMatch('m-g4', { homeTeamId:'team-nzl', awayTeamId:'team-egy', stadiumId:'std-bcp',      matchdayId:'md-jornada2', groupCode:'G', kickoffUtc:'2026-06-22T01:00:00Z' }) // 6pm PDT Jun21
  // Jornada 3
  await upsertMatch('m-g5', { homeTeamId:'team-egy', awayTeamId:'team-irn', stadiumId:'std-lumen',    matchdayId:'md-jornada3', groupCode:'G', kickoffUtc:'2026-06-27T00:00:00Z' }) // 8pm PDT Jun26
  await upsertMatch('m-g6', { homeTeamId:'team-nzl', awayTeamId:'team-bel', stadiumId:'std-bcp',      matchdayId:'md-jornada3', groupCode:'G', kickoffUtc:'2026-06-27T00:00:00Z' }) // 8pm PDT Jun26

  // ── GROUP H: España, Cabo Verde, Arabia Saudita, Uruguay ───────────────────
  // Jornada 1
  await upsertMatch('m-h1', { homeTeamId:'team-esp', awayTeamId:'team-cpv', stadiumId:'std-mercedesbenz', matchdayId:'md-jornada1', groupCode:'H', kickoffUtc:'2026-06-15T22:00:00Z' }) // 6pm EDT
  await upsertMatch('m-h2', { homeTeamId:'team-ksa', awayTeamId:'team-uru', stadiumId:'std-hardrock', matchdayId:'md-jornada1', groupCode:'H', kickoffUtc:'2026-06-16T01:00:00Z' }) // 9pm EDT Jun15
  // Jornada 2
  await upsertMatch('m-h3', { homeTeamId:'team-esp', awayTeamId:'team-ksa', stadiumId:'std-mercedesbenz', matchdayId:'md-jornada2', groupCode:'H', kickoffUtc:'2026-06-21T22:00:00Z' }) // 6pm EDT
  await upsertMatch('m-h4', { homeTeamId:'team-uru', awayTeamId:'team-cpv', stadiumId:'std-hardrock', matchdayId:'md-jornada2', groupCode:'H', kickoffUtc:'2026-06-22T01:00:00Z' }) // 9pm EDT Jun21
  // Jornada 3
  await upsertMatch('m-h5', { homeTeamId:'team-cpv', awayTeamId:'team-ksa', stadiumId:'std-nrg',      matchdayId:'md-jornada3', groupCode:'H', kickoffUtc:'2026-06-26T22:00:00Z' }) // 6pm EDT
  await upsertMatch('m-h6', { homeTeamId:'team-uru', awayTeamId:'team-esp', stadiumId:'std-akron',    matchdayId:'md-jornada3', groupCode:'H', kickoffUtc:'2026-06-27T01:00:00Z' }) // 7pm CDT Jun26

  // ── GROUP I: Francia, Senegal, Irak, Noruega ───────────────────────────────
  // Times reported as UTC-4 (EDT)
  // Jornada 1
  await upsertMatch('m-i1', { homeTeamId:'team-fra', awayTeamId:'team-sen', stadiumId:'std-metlife',  matchdayId:'md-jornada1', groupCode:'I', kickoffUtc:'2026-06-16T19:00:00Z' }) // 3pm EDT
  await upsertMatch('m-i2', { homeTeamId:'team-irq', awayTeamId:'team-nor', stadiumId:'std-gillette', matchdayId:'md-jornada1', groupCode:'I', kickoffUtc:'2026-06-16T22:00:00Z' }) // 6pm EDT
  // Jornada 2
  await upsertMatch('m-i3', { homeTeamId:'team-fra', awayTeamId:'team-irq', stadiumId:'std-lincoln',  matchdayId:'md-jornada2', groupCode:'I', kickoffUtc:'2026-06-22T21:00:00Z' }) // 5pm EDT
  await upsertMatch('m-i4', { homeTeamId:'team-nor', awayTeamId:'team-sen', stadiumId:'std-metlife',  matchdayId:'md-jornada2', groupCode:'I', kickoffUtc:'2026-06-23T00:00:00Z' }) // 8pm EDT Jun22
  // Jornada 3
  await upsertMatch('m-i5', { homeTeamId:'team-nor', awayTeamId:'team-fra', stadiumId:'std-gillette', matchdayId:'md-jornada3', groupCode:'I', kickoffUtc:'2026-06-26T19:00:00Z' }) // 3pm EDT
  await upsertMatch('m-i6', { homeTeamId:'team-sen', awayTeamId:'team-irq', stadiumId:'std-bmo',      matchdayId:'md-jornada3', groupCode:'I', kickoffUtc:'2026-06-26T19:00:00Z' }) // 3pm EDT

  // ── GROUP J: Argentina, Argelia, Austria, Jordania ─────────────────────────
  // Times already in UTC per Wikipedia
  // Jornada 1
  await upsertMatch('m-j1', { homeTeamId:'team-arg', awayTeamId:'team-alg', stadiumId:'std-arrowhead',matchdayId:'md-jornada1', groupCode:'J', kickoffUtc:'2026-06-17T01:00:00Z' }) // 9pm CDT Jun16
  await upsertMatch('m-j2', { homeTeamId:'team-aut', awayTeamId:'team-jor', stadiumId:'std-levis',    matchdayId:'md-jornada1', groupCode:'J', kickoffUtc:'2026-06-17T04:00:00Z' }) // 9pm PDT Jun16
  // Jornada 2
  await upsertMatch('m-j3', { homeTeamId:'team-arg', awayTeamId:'team-aut', stadiumId:'std-cowboys',  matchdayId:'md-jornada2', groupCode:'J', kickoffUtc:'2026-06-22T22:00:00Z' }) // 5pm CDT
  await upsertMatch('m-j4', { homeTeamId:'team-jor', awayTeamId:'team-alg', stadiumId:'std-levis',    matchdayId:'md-jornada2', groupCode:'J', kickoffUtc:'2026-06-23T07:00:00Z' }) // 12am PDT Jun23
  // Jornada 3
  await upsertMatch('m-j5', { homeTeamId:'team-alg', awayTeamId:'team-aut', stadiumId:'std-arrowhead',matchdayId:'md-jornada3', groupCode:'J', kickoffUtc:'2026-06-27T06:00:00Z' }) // 1am CDT Jun27
  await upsertMatch('m-j6', { homeTeamId:'team-jor', awayTeamId:'team-arg', stadiumId:'std-cowboys',  matchdayId:'md-jornada3', groupCode:'J', kickoffUtc:'2026-06-27T06:00:00Z' }) // 1am CDT Jun27

  // ── GROUP K: Portugal, Rep. D. del Congo, Uzbekistán, Colombia ─────────────
  // NRG Houston = UTC-5 (CDT); Azteca/Akron = UTC-6 (MDT); Hard Rock/Mercedes = UTC-4 (EDT)
  // Jornada 1
  await upsertMatch('m-k1', { homeTeamId:'team-prt', awayTeamId:'team-cod', stadiumId:'std-nrg',      matchdayId:'md-jornada1', groupCode:'K', kickoffUtc:'2026-06-17T17:00:00Z' }) // 12pm CDT
  await upsertMatch('m-k2', { homeTeamId:'team-uzb', awayTeamId:'team-col', stadiumId:'std-azteca',   matchdayId:'md-jornada1', groupCode:'K', kickoffUtc:'2026-06-18T02:00:00Z' }) // 8pm MDT Jun17
  // Jornada 2
  await upsertMatch('m-k3', { homeTeamId:'team-prt', awayTeamId:'team-uzb', stadiumId:'std-nrg',      matchdayId:'md-jornada2', groupCode:'K', kickoffUtc:'2026-06-23T17:00:00Z' }) // 12pm CDT
  await upsertMatch('m-k4', { homeTeamId:'team-col', awayTeamId:'team-cod', stadiumId:'std-akron',    matchdayId:'md-jornada2', groupCode:'K', kickoffUtc:'2026-06-24T02:00:00Z' }) // 8pm MDT Jun23
  // Jornada 3
  await upsertMatch('m-k5', { homeTeamId:'team-col', awayTeamId:'team-prt', stadiumId:'std-hardrock', matchdayId:'md-jornada3', groupCode:'K', kickoffUtc:'2026-06-27T23:30:00Z' }) // 7:30pm EDT
  await upsertMatch('m-k6', { homeTeamId:'team-cod', awayTeamId:'team-uzb', stadiumId:'std-mercedesbenz', matchdayId:'md-jornada3', groupCode:'K', kickoffUtc:'2026-06-27T23:30:00Z' }) // 7:30pm EDT

  // ── GROUP L: Inglaterra, Croacia, Ghana, Panamá ────────────────────────────
  // AT&T = CDT (UTC-5); BMO = EDT (UTC-4); Gillette/Lincoln/MetLife = EDT (UTC-4)
  // Jornada 1
  await upsertMatch('m-l1', { homeTeamId:'team-eng', awayTeamId:'team-cro', stadiumId:'std-cowboys',  matchdayId:'md-jornada1', groupCode:'L', kickoffUtc:'2026-06-18T00:00:00Z' }) // 8pm EDT Jun17 = 7pm CDT
  await upsertMatch('m-l2', { homeTeamId:'team-gha', awayTeamId:'team-pan', stadiumId:'std-bmo',      matchdayId:'md-jornada1', groupCode:'L', kickoffUtc:'2026-06-18T03:00:00Z' }) // 11pm EDT Jun17
  // Jornada 2
  await upsertMatch('m-l3', { homeTeamId:'team-eng', awayTeamId:'team-gha', stadiumId:'std-gillette', matchdayId:'md-jornada2', groupCode:'L', kickoffUtc:'2026-06-24T00:00:00Z' }) // 8pm EDT Jun23
  await upsertMatch('m-l4', { homeTeamId:'team-pan', awayTeamId:'team-cro', stadiumId:'std-bmo',      matchdayId:'md-jornada2', groupCode:'L', kickoffUtc:'2026-06-24T03:00:00Z' }) // 11pm EDT Jun23
  // Jornada 3
  await upsertMatch('m-l5', { homeTeamId:'team-pan', awayTeamId:'team-eng', stadiumId:'std-metlife',  matchdayId:'md-jornada3', groupCode:'L', kickoffUtc:'2026-06-28T01:00:00Z' }) // 9pm EDT Jun27
  await upsertMatch('m-l6', { homeTeamId:'team-cro', awayTeamId:'team-gha', stadiumId:'std-lincoln',  matchdayId:'md-jornada3', groupCode:'L', kickoffUtc:'2026-06-28T01:00:00Z' }) // 9pm EDT Jun27

  // ── Inauguration match (Group A opener — México vs Sudáfrica) ─────────────
  const inauguracionId = 'match-inauguration'
  await prisma.match.upsert({
    where: { id: inauguracionId },
    update: {
      homeTeamId: 'team-mex',
      awayTeamId: 'team-rsa',
      stadiumId: 'std-azteca',
      matchdayId: 'md-jornada1',
      groupCode: 'A',
    },
    create: {
      id: inauguracionId,
      eventId: event.id,
      homeTeamId: 'team-mex',
      awayTeamId: 'team-rsa',
      stadiumId: 'std-azteca',
      matchdayId: 'md-jornada1',
      phase: MatchPhase.GROUPS,
      groupCode: 'A',
      kickoffAtUtc: utcDate('2026-06-11T19:00:00Z'),
      kickoffAtCostaRica: crDate('2026-06-11T19:00:00Z'),
      status: MatchStatus.PROGRAMADO,
    },
  })

  // ── Final ──────────────────────────────────────────────────────────────────
  const kickoffFinal = '2026-07-19T22:00:00Z'
  await prisma.match.upsert({
    where: { id: 'match-final' },
    update: {},
    create: {
      id: 'match-final',
      eventId: event.id,
      placeholderHomeName: 'Finalista 1',
      placeholderAwayName: 'Finalista 2',
      stadiumId: 'std-metlife',
      matchdayId: 'md-final',
      phase: MatchPhase.FINAL,
      kickoffAtUtc: utcDate(kickoffFinal),
      kickoffAtCostaRica: crDate(kickoffFinal),
      status: MatchStatus.PROGRAMADO,
    },
  })

  // ── Third place ────────────────────────────────────────────────────────────
  const kickoffThird = '2026-07-18T21:00:00Z'
  await prisma.match.upsert({
    where: { id: 'match-3er-lugar' },
    update: {},
    create: {
      id: 'match-3er-lugar',
      eventId: event.id,
      placeholderHomeName: 'Perdedor Semifinal 1',
      placeholderAwayName: 'Perdedor Semifinal 2',
      stadiumId: 'std-cowboys',
      matchdayId: 'md-3er',
      phase: MatchPhase.THIRD_PLACE,
      kickoffAtUtc: utcDate(kickoffThird),
      kickoffAtCostaRica: crDate(kickoffThird),
      status: MatchStatus.PROGRAMADO,
    },
  })

  // ── Default quiniela ───────────────────────────────────────────────────────
  const adminId = await getOrCreateAdminUserId()

  const quiniela = await prisma.quiniela.upsert({
    where: { id: 'quiniela-mundial-2026' },
    update: {},
    create: {
      id: 'quiniela-mundial-2026',
      eventId: event.id,
      name: 'Ki-Niela Mundial 2026',
      description: 'Quiniela oficial del Mundial FIFA 2026',
      visibility: 'INVITE_ONLY',
      status: 'ACTIVE',
      randomPredictionsEnabled: true,
      randomMinGoals: 0,
      randomMaxGoals: 7,
      lockMinutesBeforeMatch: 10,
      timezone: 'America/Costa_Rica',
      inviteCode: 'MUNDIAL2026',
      createdByUserId: adminId,
    },
  })

  // Admin is QUINIELA_ADMIN member
  await prisma.quinielaMember.upsert({
    where: { quinielaId_userId: { quinielaId: quiniela.id, userId: adminId } },
    update: { role: 'QUINIELA_ADMIN', status: 'ACTIVE' },
    create: {
      quinielaId: quiniela.id,
      userId: adminId,
      role: 'QUINIELA_ADMIN',
      status: 'ACTIVE',
      autoPredictionsEnabled: false,
      joinedAt: new Date(),
      approvedAt: new Date(),
      approvedByUserId: adminId,
    },
  })

  // Final is always a star match
  await prisma.quinielaStarMatch.upsert({
    where: { quinielaId_matchId: { quinielaId: quiniela.id, matchId: 'match-final' } },
    update: { isStar: true },
    create: { quinielaId: quiniela.id, matchId: 'match-final', isStar: true },
  })

  // Inauguration also star
  await prisma.quinielaStarMatch.upsert({
    where: { quinielaId_matchId: { quinielaId: quiniela.id, matchId: inauguracionId } },
    update: { isStar: true },
    create: { quinielaId: quiniela.id, matchId: inauguracionId, isStar: true },
  })

  console.log('Seed completed successfully — 48 group stage matches + Final + 3er lugar seeded.')
}

async function getOrCreateAdminUserId(): Promise<string> {
  const { hashSync } = await import('bcryptjs')
  const admin = await prisma.user.upsert({
    where: { email: 'admin@kiniela.com' },
    update: {},
    create: {
      name: 'Admin Ki-Niela',
      email: 'admin@kiniela.com',
      passwordHash: hashSync('Admin1234!', 12),
      globalRole: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  })
  return admin.id
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

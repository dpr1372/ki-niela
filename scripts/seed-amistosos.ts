/**
 * Seed para evento "Amistosos Internacionales" (mayo–junio 2026).
 * Crea Event, Teams, Stadiums, Matchdays, Matches, Quiniela y QuinielaMember admin.
 *
 * Uso (local):
 *   npx tsx scripts/seed-amistosos.ts
 * Uso (Railway):
 *   railway run npx tsx scripts/seed-amistosos.ts
 *   o con DATABASE_URL=... npx tsx scripts/seed-amistosos.ts
 *
 * Idempotente: usa upserts con IDs estables prefijados con `am-`.
 */
import { PrismaClient, MatchPhase, MatchStatus } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })
const TZ = 'America/Costa_Rica'

/** Convierte hora local Costa Rica → Date UTC. ESPN.co.cr ya muestra en CR. */
function crLocalToUtc(yyyyMmDd: string, hhmm: string): Date {
  // fromZonedTime: interpreta el string como hora local en TZ y devuelve Date UTC
  return fromZonedTime(`${yyyyMmDd}T${hhmm}:00`, TZ)
}

function crZoned(utc: Date): Date {
  return toZonedTime(utc, TZ)
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

async function main() {
  console.log('Seeding Amistosos Internacionales (mayo–junio 2026)...')

  // ── Event ──────────────────────────────────────────────────────────────────
  const event = await prisma.event.upsert({
    where: { id: 'event-amistosos-2026' },
    update: {
      name: 'Amistosos Internacionales',
      description: 'Fecha FIFA de amistosos previo al Mundial 2026 (mayo–junio 2026)',
    },
    create: {
      id: 'event-amistosos-2026',
      name: 'Amistosos Internacionales',
      description: 'Fecha FIFA de amistosos previo al Mundial 2026 (mayo–junio 2026)',
      sport: 'football',
      startDate: new Date('2026-05-30T00:00:00Z'),
      endDate: new Date('2026-06-04T23:59:59Z'),
      timezone: 'America/Costa_Rica',
      status: 'ACTIVE',
    },
  })

  // ── Teams (todos los participantes) ────────────────────────────────────────
  const teamsData: Array<{ id: string; fifaCode: string; name: string }> = [
    // Sábado 30
    { id: 'am-team-cuw', fifaCode: 'CUW', name: 'Curazao' },
    { id: 'am-team-sco', fifaCode: 'SCO', name: 'Escocia' },
    { id: 'am-team-ind', fifaCode: 'IND', name: 'India' },
    { id: 'am-team-zim', fifaCode: 'ZIM', name: 'Zimbabwe' },
    { id: 'am-team-jam', fifaCode: 'JAM', name: 'Jamaica' },
    { id: 'am-team-nga', fifaCode: 'NGA', name: 'Nigeria' },
    { id: 'am-team-ksa', fifaCode: 'KSA', name: 'Arabia Saudita' },
    { id: 'am-team-ecu', fifaCode: 'ECU', name: 'Ecuador' },
    { id: 'am-team-tri', fifaCode: 'TRI', name: 'Trinidad y Tobago' },
    { id: 'am-team-kor', fifaCode: 'KOR', name: 'Corea del Sur' },
    { id: 'am-team-aus', fifaCode: 'AUS', name: 'Australia' },
    { id: 'am-team-mex', fifaCode: 'MEX', name: 'México' },
    // Domingo 31
    { id: 'am-team-isl', fifaCode: 'ISL', name: 'Islandia' },
    { id: 'am-team-jpn', fifaCode: 'JPN', name: 'Japón' },
    { id: 'am-team-mng', fifaCode: 'MNG', name: 'Mongolia' },
    { id: 'am-team-sgp', fifaCode: 'SGP', name: 'Singapur' },
    { id: 'am-team-jor', fifaCode: 'JOR', name: 'Jordania' },
    { id: 'am-team-sui', fifaCode: 'SUI', name: 'Suiza' },
    { id: 'am-team-kos', fifaCode: 'KOS', name: 'Kosovo' },
    { id: 'am-team-cze', fifaCode: 'CZE', name: 'República Checa' },
    { id: 'am-team-srb', fifaCode: 'SRB', name: 'Serbia' },
    { id: 'am-team-cpv', fifaCode: 'CPV', name: 'Cabo Verde' },
    { id: 'am-team-ukr', fifaCode: 'UKR', name: 'Ucrania' },
    { id: 'am-team-pol', fifaCode: 'POL', name: 'Polonia' },
    { id: 'am-team-fin', fifaCode: 'FIN', name: 'Finlandia' },
    { id: 'am-team-ger', fifaCode: 'GER', name: 'Alemania' },
    { id: 'am-team-sen', fifaCode: 'SEN', name: 'Senegal' },
    { id: 'am-team-usa', fifaCode: 'USA', name: 'Estados Unidos' },
    { id: 'am-team-pan', fifaCode: 'PAN', name: 'Panamá' },
    { id: 'am-team-bra', fifaCode: 'BRA', name: 'Brasil' },
    // Lunes 1
    { id: 'am-team-mne', fifaCode: 'MNE', name: 'Montenegro' },
    { id: 'am-team-bul', fifaCode: 'BUL', name: 'Bulgaria' },
    { id: 'am-team-mlt', fifaCode: 'MLT', name: 'Malta' },
    { id: 'am-team-svk', fifaCode: 'SVK', name: 'Eslovaquia' },
    { id: 'am-team-swe', fifaCode: 'SWE', name: 'Suecia' },
    { id: 'am-team-nor', fifaCode: 'NOR', name: 'Noruega' },
    { id: 'am-team-mkd', fifaCode: 'MKD', name: 'Macedonia del Norte' },
    { id: 'am-team-tur', fifaCode: 'TUR', name: 'Turquía' },
    { id: 'am-team-tun', fifaCode: 'TUN', name: 'Túnez' },
    { id: 'am-team-aut', fifaCode: 'AUT', name: 'Austria' },
    { id: 'am-team-crc', fifaCode: 'CRC', name: 'Costa Rica' },
    { id: 'am-team-col', fifaCode: 'COL', name: 'Colombia' },
    { id: 'am-team-uzb', fifaCode: 'UZB', name: 'Uzbekistán' },
    { id: 'am-team-can', fifaCode: 'CAN', name: 'Canadá' },
    // Martes 2
    { id: 'am-team-bel', fifaCode: 'BEL', name: 'Bélgica' },
    { id: 'am-team-cro', fifaCode: 'CRO', name: 'Croacia' },
    { id: 'am-team-rou', fifaCode: 'ROU', name: 'Rumanía' },
    { id: 'am-team-geo', fifaCode: 'GEO', name: 'Georgia' },
    { id: 'am-team-mad', fifaCode: 'MAD', name: 'Madagascar' },
    { id: 'am-team-mar', fifaCode: 'MAR', name: 'Marruecos' },
    { id: 'am-team-gha', fifaCode: 'GHA', name: 'Ghana' },
    { id: 'am-team-wal', fifaCode: 'WAL', name: 'Gales' },
    { id: 'am-team-nzl', fifaCode: 'NZL', name: 'Nueva Zelanda' },
    { id: 'am-team-hai', fifaCode: 'HAI', name: 'Haití' },
    // Miércoles 3
    { id: 'am-team-gum', fifaCode: 'GUM', name: 'Guam' },
    { id: 'am-team-phi', fifaCode: 'PHI', name: 'Filipinas' },
    { id: 'am-team-ken', fifaCode: 'KEN', name: 'Kenia' },
    { id: 'am-team-kgz', fifaCode: 'KGZ', name: 'Kirguistán' },
    { id: 'am-team-vgb', fifaCode: 'VGB', name: 'Islas Vírgenes Británicas' },
    { id: 'am-team-gib', fifaCode: 'GIB', name: 'Gibraltar' },
    { id: 'am-team-isr', fifaCode: 'ISR', name: 'Israel' },
    { id: 'am-team-alb', fifaCode: 'ALB', name: 'Albania' },
    { id: 'am-team-cod', fifaCode: 'COD', name: 'Rep. D. del Congo' },
    { id: 'am-team-den', fifaCode: 'DEN', name: 'Dinamarca' },
    { id: 'am-team-ita', fifaCode: 'ITA', name: 'Italia' },
    { id: 'am-team-lux', fifaCode: 'LUX', name: 'Luxemburgo' },
    { id: 'am-team-alg', fifaCode: 'ALG', name: 'Argelia' },
    { id: 'am-team-ned', fifaCode: 'NED', name: 'Países Bajos' },
    { id: 'am-team-dom', fifaCode: 'DOM', name: 'República Dominicana' },
    { id: 'am-team-slv', fifaCode: 'SLV', name: 'El Salvador' },
  ]

  for (const t of teamsData) {
    await prisma.team.upsert({
      where: { id: t.id },
      update: { name: t.name, fifaCode: t.fifaCode },
      create: { ...t, eventId: event.id },
    })
  }

  // ── Stadiums ───────────────────────────────────────────────────────────────
  const stadiumsData = [
    { id: 'am-std-hampden', name: 'Hampden Park', city: 'Glasgow', country: 'Escocia' },
    { id: 'am-std-thevalley', name: 'The Valley', city: 'Londres', country: 'Inglaterra' },
    { id: 'am-std-redbull', name: 'Red Bull Arena', city: 'Harrison, NJ', country: 'EUA' },
    { id: 'am-std-rosebowl', name: 'Rose Bowl', city: 'Pasadena, CA', country: 'EUA' },
    { id: 'am-std-japannational', name: 'Japan National Stadium', city: 'Tokio', country: 'Japón' },
    { id: 'am-std-jalanbesar', name: 'Jalan Besar Stadium', city: 'Kallang', country: 'Singapur' },
    { id: 'am-std-kybunpark', name: 'Kybunpark', city: 'St. Gallen', country: 'Suiza' },
    { id: 'am-std-generali', name: 'Generali Arena', city: 'Praga', country: 'República Checa' },
    { id: 'am-std-restelo', name: 'Estádio do Restelo', city: 'Lisboa', country: 'Portugal' },
    { id: 'am-std-wroclaw', name: 'Municipal Stadium Wroclaw', city: 'Wroclaw', country: 'Polonia' },
    { id: 'am-std-mewa', name: 'MEWA ARENA', city: 'Mainz', country: 'Alemania' },
    { id: 'am-std-bofa', name: 'Bank of America Stadium', city: 'Charlotte, NC', country: 'EUA' },
    { id: 'am-std-maracana', name: 'Estadio Maracaná', city: 'Río de Janeiro', country: 'Brasil' },
    { id: 'am-std-hristobotev', name: 'Hristo Botev Stadium', city: 'Plovdiv', country: 'Bulgaria' },
    { id: 'am-std-molarena', name: 'MOL Aréna', city: 'Dunajská Streda', country: 'Eslovaquia' },
    { id: 'am-std-ullevaal', name: 'Ullevaal Stadion', city: 'Oslo', country: 'Noruega' },
    { id: 'am-std-ulker', name: 'Ülker Stadyumu', city: 'Estambul', country: 'Turquía' },
    { id: 'am-std-ernsthappel', name: 'Ernst-Happel-Stadion', city: 'Viena', country: 'Austria' },
    { id: 'am-std-elcampin', name: 'Estadio Nemesio Camacho El Campín', city: 'Bogotá', country: 'Colombia' },
    { id: 'am-std-commonwealth', name: 'Commonwealth Stadium', city: 'Edmonton', country: 'Canadá' },
    { id: 'am-std-rijeka', name: 'Stadion HNK Rijeka', city: 'Rijeka', country: 'Croacia' },
    { id: 'am-std-meskhi', name: 'Mikheil Meskhi Stadioni', city: 'Tiflis', country: 'Georgia' },
    { id: 'am-std-moulayabdallah', name: 'Stade Prince Moulay Abdallah', city: 'Rabat', country: 'Marruecos' },
    { id: 'am-std-cardiff', name: 'Cardiff City Stadium', city: 'Cardiff', country: 'Gales' },
    { id: 'am-std-chase', name: 'Chase Stadium', city: 'Fort Lauderdale, FL', country: 'EUA' },
    { id: 'am-std-rizal', name: 'Rizal Memorial Stadium', city: 'Manila', country: 'Filipinas' },
    { id: 'am-std-omurzakov', name: 'Dolen Omurzakov Stadium', city: 'Bishkek', country: 'Kirguistán' },
    { id: 'am-std-europapoint', name: 'Europa Point Stadium', city: 'Gibraltar', country: 'Gibraltar' },
    { id: 'am-std-airalbania', name: 'Air Albania Stadium', city: 'Tirana', country: 'Albania' },
    { id: 'am-std-mauricedufrasne', name: 'Stade Maurice Dufrasne', city: 'Lieja', country: 'Bélgica' },
    { id: 'am-std-luxembourg', name: 'Stade de Luxembourg', city: 'Luxemburgo', country: 'Luxemburgo' },
    { id: 'am-std-dekuip', name: 'De Kuip', city: 'Róterdam', country: 'Países Bajos' },
    { id: 'am-std-pgenarodowy', name: 'PGE Narodowy', city: 'Varsovia', country: 'Polonia' },
    { id: 'am-std-rommelfernandez', name: 'Estadio Rommel Fernández Gutiérrez', city: 'Panamá', country: 'Panamá' },
    { id: 'am-std-tbd', name: 'Por confirmar', city: '—', country: '—' },
  ]

  for (const s of stadiumsData) {
    await prisma.stadium.upsert({
      where: { id: s.id },
      update: { name: s.name, city: s.city, country: s.country },
      create: { ...s, eventId: event.id },
    })
  }

  // ── Matchdays (uno por día) ────────────────────────────────────────────────
  const matchdaysData = [
    { id: 'am-md-sab30', name: 'Sábado 30 de mayo', number: 1, phase: MatchPhase.GROUPS },
    { id: 'am-md-dom31', name: 'Domingo 31 de mayo', number: 2, phase: MatchPhase.GROUPS },
    { id: 'am-md-lun01', name: 'Lunes 1 de junio', number: 3, phase: MatchPhase.GROUPS },
    { id: 'am-md-mar02', name: 'Martes 2 de junio', number: 4, phase: MatchPhase.GROUPS },
    { id: 'am-md-mie03', name: 'Miércoles 3 de junio', number: 5, phase: MatchPhase.GROUPS },
  ]

  for (const md of matchdaysData) {
    await prisma.matchday.upsert({
      where: { id: md.id },
      update: { name: md.name, number: md.number, phase: md.phase },
      create: { ...md, eventId: event.id },
    })
  }

  // ── Matches ────────────────────────────────────────────────────────────────
  // Horas en hora local Costa Rica (lo que muestra ESPN.co.cr).
  type AmMatch = {
    id: string
    home: string
    away: string
    stadium: string
    matchday: string
    date: string // YYYY-MM-DD (CR)
    time: string // HH:mm (CR)
  }

  const matches: AmMatch[] = [
    // ── Sábado 30 mayo ───────────────────────────────────────────────────────
    { id: 'am-m-001', home: 'am-team-cuw', away: 'am-team-sco', stadium: 'am-std-hampden',     matchday: 'am-md-sab30', date: '2026-05-30', time: '06:00' },
    { id: 'am-m-002', home: 'am-team-ind', away: 'am-team-zim', stadium: 'am-std-thevalley',   matchday: 'am-md-sab30', date: '2026-05-30', time: '07:30' },
    { id: 'am-m-003', home: 'am-team-jam', away: 'am-team-nga', stadium: 'am-std-thevalley',   matchday: 'am-md-sab30', date: '2026-05-30', time: '12:30' },
    { id: 'am-m-004', home: 'am-team-ksa', away: 'am-team-ecu', stadium: 'am-std-redbull',     matchday: 'am-md-sab30', date: '2026-05-30', time: '17:30' },
    { id: 'am-m-005', home: 'am-team-tri', away: 'am-team-kor', stadium: 'am-std-tbd',         matchday: 'am-md-sab30', date: '2026-05-30', time: '19:00' },
    { id: 'am-m-006', home: 'am-team-aus', away: 'am-team-mex', stadium: 'am-std-rosebowl',    matchday: 'am-md-sab30', date: '2026-05-30', time: '20:00' },
    // ── Domingo 31 mayo ──────────────────────────────────────────────────────
    { id: 'am-m-007', home: 'am-team-isl', away: 'am-team-jpn', stadium: 'am-std-japannational', matchday: 'am-md-dom31', date: '2026-05-31', time: '04:25' },
    { id: 'am-m-008', home: 'am-team-mng', away: 'am-team-sgp', stadium: 'am-std-jalanbesar',  matchday: 'am-md-dom31', date: '2026-05-31', time: '05:30' },
    { id: 'am-m-009', home: 'am-team-jor', away: 'am-team-sui', stadium: 'am-std-kybunpark',   matchday: 'am-md-dom31', date: '2026-05-31', time: '07:00' },
    { id: 'am-m-010', home: 'am-team-kos', away: 'am-team-cze', stadium: 'am-std-generali',    matchday: 'am-md-dom31', date: '2026-05-31', time: '08:00' },
    { id: 'am-m-011', home: 'am-team-srb', away: 'am-team-cpv', stadium: 'am-std-restelo',     matchday: 'am-md-dom31', date: '2026-05-31', time: '08:30' },
    { id: 'am-m-012', home: 'am-team-ukr', away: 'am-team-pol', stadium: 'am-std-wroclaw',     matchday: 'am-md-dom31', date: '2026-05-31', time: '09:30' },
    { id: 'am-m-013', home: 'am-team-fin', away: 'am-team-ger', stadium: 'am-std-mewa',        matchday: 'am-md-dom31', date: '2026-05-31', time: '12:45' },
    { id: 'am-m-014', home: 'am-team-sen', away: 'am-team-usa', stadium: 'am-std-bofa',        matchday: 'am-md-dom31', date: '2026-05-31', time: '13:30' },
    { id: 'am-m-015', home: 'am-team-pan', away: 'am-team-bra', stadium: 'am-std-maracana',    matchday: 'am-md-dom31', date: '2026-05-31', time: '15:30' },
    // ── Lunes 1 junio ────────────────────────────────────────────────────────
    { id: 'am-m-016', home: 'am-team-mne', away: 'am-team-bul', stadium: 'am-std-hristobotev', matchday: 'am-md-lun01', date: '2026-06-01', time: '10:00' },
    { id: 'am-m-017', home: 'am-team-mlt', away: 'am-team-svk', stadium: 'am-std-molarena',    matchday: 'am-md-lun01', date: '2026-06-01', time: '10:00' },
    { id: 'am-m-018', home: 'am-team-swe', away: 'am-team-nor', stadium: 'am-std-ullevaal',    matchday: 'am-md-lun01', date: '2026-06-01', time: '11:00' },
    { id: 'am-m-019', home: 'am-team-mkd', away: 'am-team-tur', stadium: 'am-std-ulker',       matchday: 'am-md-lun01', date: '2026-06-01', time: '11:30' },
    { id: 'am-m-020', home: 'am-team-tun', away: 'am-team-aut', stadium: 'am-std-ernsthappel', matchday: 'am-md-lun01', date: '2026-06-01', time: '12:45' },
    { id: 'am-m-021', home: 'am-team-crc', away: 'am-team-col', stadium: 'am-std-elcampin',    matchday: 'am-md-lun01', date: '2026-06-01', time: '17:00' },
    { id: 'am-m-022', home: 'am-team-uzb', away: 'am-team-can', stadium: 'am-std-commonwealth',matchday: 'am-md-lun01', date: '2026-06-01', time: '19:00' },
    // ── Martes 2 junio ───────────────────────────────────────────────────────
    { id: 'am-m-023', home: 'am-team-bel', away: 'am-team-cro', stadium: 'am-std-rijeka',      matchday: 'am-md-mar02', date: '2026-06-02', time: '10:00' },
    { id: 'am-m-024', home: 'am-team-rou', away: 'am-team-geo', stadium: 'am-std-meskhi',      matchday: 'am-md-mar02', date: '2026-06-02', time: '11:00' },
    { id: 'am-m-025', home: 'am-team-mad', away: 'am-team-mar', stadium: 'am-std-moulayabdallah', matchday: 'am-md-mar02', date: '2026-06-02', time: '11:00' },
    { id: 'am-m-026', home: 'am-team-gha', away: 'am-team-wal', stadium: 'am-std-cardiff',     matchday: 'am-md-mar02', date: '2026-06-02', time: '12:45' },
    { id: 'am-m-027', home: 'am-team-nzl', away: 'am-team-hai', stadium: 'am-std-chase',       matchday: 'am-md-mar02', date: '2026-06-02', time: '18:00' },
    // ── Miércoles 3 junio ────────────────────────────────────────────────────
    { id: 'am-m-028', home: 'am-team-gum', away: 'am-team-phi', stadium: 'am-std-rizal',       matchday: 'am-md-mie03', date: '2026-06-03', time: '05:30' },
    { id: 'am-m-029', home: 'am-team-ken', away: 'am-team-kgz', stadium: 'am-std-omurzakov',   matchday: 'am-md-mie03', date: '2026-06-03', time: '06:30' },
    { id: 'am-m-030', home: 'am-team-vgb', away: 'am-team-gib', stadium: 'am-std-europapoint', matchday: 'am-md-mie03', date: '2026-06-03', time: '11:00' },
    { id: 'am-m-031', home: 'am-team-isr', away: 'am-team-alb', stadium: 'am-std-airalbania',  matchday: 'am-md-mie03', date: '2026-06-03', time: '12:00' },
    { id: 'am-m-032', home: 'am-team-cod', away: 'am-team-den', stadium: 'am-std-mauricedufrasne', matchday: 'am-md-mie03', date: '2026-06-03', time: '12:00' },
    { id: 'am-m-033', home: 'am-team-ita', away: 'am-team-lux', stadium: 'am-std-luxembourg',  matchday: 'am-md-mie03', date: '2026-06-03', time: '12:45' },
    { id: 'am-m-034', home: 'am-team-alg', away: 'am-team-ned', stadium: 'am-std-dekuip',      matchday: 'am-md-mie03', date: '2026-06-03', time: '12:45' },
    { id: 'am-m-035', home: 'am-team-nga', away: 'am-team-pol', stadium: 'am-std-pgenarodowy', matchday: 'am-md-mie03', date: '2026-06-03', time: '12:45' },
    { id: 'am-m-036', home: 'am-team-dom', away: 'am-team-pan', stadium: 'am-std-rommelfernandez', matchday: 'am-md-mie03', date: '2026-06-03', time: '18:45' },
    { id: 'am-m-037', home: 'am-team-slv', away: 'am-team-kor', stadium: 'am-std-tbd',         matchday: 'am-md-mie03', date: '2026-06-03', time: '19:00' },
  ]

  for (const m of matches) {
    const utc = crLocalToUtc(m.date, m.time)
    await prisma.match.upsert({
      where: { id: m.id },
      update: {
        homeTeamId: m.home,
        awayTeamId: m.away,
        stadiumId: m.stadium,
        matchdayId: m.matchday,
        kickoffAtUtc: utc,
        kickoffAtCostaRica: crZoned(utc),
      },
      create: {
        id: m.id,
        eventId: event.id,
        homeTeamId: m.home,
        awayTeamId: m.away,
        stadiumId: m.stadium,
        matchdayId: m.matchday,
        phase: MatchPhase.GROUPS,
        kickoffAtUtc: utc,
        kickoffAtCostaRica: crZoned(utc),
        status: MatchStatus.PROGRAMADO,
      },
    })
  }

  // ── Quiniela ───────────────────────────────────────────────────────────────
  const adminId = await getOrCreateAdminUserId()

  const quiniela = await prisma.quiniela.upsert({
    where: { id: 'quiniela-amistosos-2026' },
    update: {
      eventId: event.id,
      name: 'Ki-Niela Amistosos Internacionales',
      description: 'Quiniela de prueba con la fecha FIFA de amistosos previo al Mundial 2026',
    },
    create: {
      id: 'quiniela-amistosos-2026',
      eventId: event.id,
      name: 'Ki-Niela Amistosos Internacionales',
      description: 'Quiniela de prueba con la fecha FIFA de amistosos previo al Mundial 2026',
      visibility: 'INVITE_ONLY',
      status: 'ACTIVE',
      randomPredictionsEnabled: true,
      randomMinGoals: 0,
      randomMaxGoals: 7,
      lockMinutesBeforeMatch: 10,
      timezone: 'America/Costa_Rica',
      inviteCode: 'AMISTOSOS2026',
      createdByUserId: adminId,
    },
  })

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

  console.log(`✓ Evento "${event.name}" listo (${matches.length} partidos).`)
  console.log(`✓ Quiniela "${quiniela.name}" creada con inviteCode "AMISTOSOS2026".`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const EVENT_ID = 'event-wc2026'

// Helper: build UTC kickoff from Costa Rica local time (UTC-6, no DST).
const cr = (y, mo, d, h, mi = 0) => new Date(Date.UTC(y, mo - 1, d, h + 6, mi))

// Resolve duplicate stadium IDs to canonical ones we'll use.
const ST = {
  cowboys: 'std-cowboys',         // Arlington (Dallas) AT&T Stadium
  mercedes: 'std-mercedesbenz',   // Atlanta
  azteca: 'std-azteca',           // CDMX
  metlife: 'std-metlife',         // East Rutherford (NY/NJ)
  gillette: 'std-gillette',       // Boston (Foxborough)
  jalisco: 'std-jalisco',         // Guadalajara
  bbva: 'std-bbva',               // Monterrey (Guadalupe)
  nrg: 'std-nrg',                 // Houston
  sofi: 'std-sofi',               // Los Angeles (Inglewood)
  arrowhead: 'std-arrowhead',     // Kansas City
  hardrock: 'std-hardrock',       // Miami Gardens
  lincoln: 'std-lincoln',         // Philadelphia
  levis: 'std-sf',                // San Francisco / Santa Clara
  lumen: 'std-seattle',           // Seattle
  bmo: 'std-bmo',                 // Toronto
  bcplace: 'std-bcp',             // Vancouver
  akron: 'std-akron',             // Guadalajara (Akron)
}

// Source: FIFA official 2026 calendar with Costa Rica timezone view.
// Times in Costa Rica local (UTC-6).
const fixtures = [
  // ====== ROUND OF 32 (28 Jun - 3 Jul) ======
  { phase: 'ROUND_OF_32', mdayId: 'md-octavos', code: 'R32-1',  utc: cr(2026,6,28,11),    home: '1A', away: '3CDEF', stadium: ST.metlife },
  { phase: 'ROUND_OF_32', mdayId: 'md-octavos', code: 'R32-2',  utc: cr(2026,6,28,14,30), home: '1B', away: '3ACDH', stadium: ST.gillette },
  { phase: 'ROUND_OF_32', mdayId: 'md-octavos', code: 'R32-3',  utc: cr(2026,6,28,19),    home: '2C', away: '2D',    stadium: ST.cowboys },
  { phase: 'ROUND_OF_32', mdayId: 'md-octavos', code: 'R32-4',  utc: cr(2026,6,29,11),    home: '1C', away: '2F',    stadium: ST.nrg },
  { phase: 'ROUND_OF_32', mdayId: 'md-octavos', code: 'R32-5',  utc: cr(2026,6,29,14,30), home: '1E', away: '3ABCD', stadium: ST.gillette },
  { phase: 'ROUND_OF_32', mdayId: 'md-octavos', code: 'R32-6',  utc: cr(2026,6,29,19),    home: '1F', away: '2C',    stadium: ST.bbva },
  { phase: 'ROUND_OF_32', mdayId: 'md-octavos', code: 'R32-7',  utc: cr(2026,6,30,11),    home: '1D', away: '3BEFH', stadium: ST.lumen },
  { phase: 'ROUND_OF_32', mdayId: 'md-octavos', code: 'R32-8',  utc: cr(2026,6,30,14,30), home: '2A', away: '2B',    stadium: ST.lincoln },
  { phase: 'ROUND_OF_32', mdayId: 'md-octavos', code: 'R32-9',  utc: cr(2026,6,30,19),    home: '1G', away: '3ABEF', stadium: ST.levis },
  { phase: 'ROUND_OF_32', mdayId: 'md-octavos', code: 'R32-10', utc: cr(2026,7,1,11),     home: '1H', away: '3BDEF', stadium: ST.bcplace },
  { phase: 'ROUND_OF_32', mdayId: 'md-octavos', code: 'R32-11', utc: cr(2026,7,1,14,30),  home: '2E', away: '2I',    stadium: ST.cowboys },
  { phase: 'ROUND_OF_32', mdayId: 'md-octavos', code: 'R32-12', utc: cr(2026,7,1,19),     home: '2G', away: '2H',    stadium: ST.azteca },
  { phase: 'ROUND_OF_32', mdayId: 'md-octavos', code: 'R32-13', utc: cr(2026,7,2,12),     home: '1I', away: '3CFGH', stadium: ST.bmo },
  { phase: 'ROUND_OF_32', mdayId: 'md-octavos', code: 'R32-14', utc: cr(2026,7,2,16),     home: '1J', away: '3ABCG', stadium: ST.mercedes },
  { phase: 'ROUND_OF_32', mdayId: 'md-octavos', code: 'R32-15', utc: cr(2026,7,3,12),     home: '1K', away: '3DEFG', stadium: ST.arrowhead },
  { phase: 'ROUND_OF_32', mdayId: 'md-octavos', code: 'R32-16', utc: cr(2026,7,3,16),     home: '1L', away: '3DEHJ', stadium: ST.hardrock },

  // ====== ROUND OF 16 (4 - 7 Jul) ======
  { phase: 'ROUND_OF_16', mdayId: 'md-dieciseis', code: 'R16-1', utc: cr(2026,7,4,11),    home: 'Ganador R32-1',  away: 'Ganador R32-2',  stadium: ST.lincoln },
  { phase: 'ROUND_OF_16', mdayId: 'md-dieciseis', code: 'R16-2', utc: cr(2026,7,4,15),    home: 'Ganador R32-3',  away: 'Ganador R32-4',  stadium: ST.cowboys },
  { phase: 'ROUND_OF_16', mdayId: 'md-dieciseis', code: 'R16-3', utc: cr(2026,7,5,11),    home: 'Ganador R32-5',  away: 'Ganador R32-6',  stadium: ST.metlife },
  { phase: 'ROUND_OF_16', mdayId: 'md-dieciseis', code: 'R16-4', utc: cr(2026,7,5,15),    home: 'Ganador R32-7',  away: 'Ganador R32-8',  stadium: ST.bbva },
  { phase: 'ROUND_OF_16', mdayId: 'md-dieciseis', code: 'R16-5', utc: cr(2026,7,6,12),    home: 'Ganador R32-9',  away: 'Ganador R32-10', stadium: ST.azteca },
  { phase: 'ROUND_OF_16', mdayId: 'md-dieciseis', code: 'R16-6', utc: cr(2026,7,6,16),    home: 'Ganador R32-11', away: 'Ganador R32-12', stadium: ST.levis },
  { phase: 'ROUND_OF_16', mdayId: 'md-dieciseis', code: 'R16-7', utc: cr(2026,7,7,12),    home: 'Ganador R32-13', away: 'Ganador R32-14', stadium: ST.mercedes },
  { phase: 'ROUND_OF_16', mdayId: 'md-dieciseis', code: 'R16-8', utc: cr(2026,7,7,16),    home: 'Ganador R32-15', away: 'Ganador R32-16', stadium: ST.hardrock },

  // ====== QUARTER FINALS (9 - 11 Jul) ======
  { phase: 'QUARTER_FINAL', mdayId: 'md-cuartos', code: 'QF-1', utc: cr(2026,7,9,13),  home: 'Ganador R16-1', away: 'Ganador R16-2', stadium: ST.cowboys },
  { phase: 'QUARTER_FINAL', mdayId: 'md-cuartos', code: 'QF-2', utc: cr(2026,7,9,17),  home: 'Ganador R16-3', away: 'Ganador R16-4', stadium: ST.gillette },
  { phase: 'QUARTER_FINAL', mdayId: 'md-cuartos', code: 'QF-3', utc: cr(2026,7,10,13), home: 'Ganador R16-5', away: 'Ganador R16-6', stadium: ST.metlife },
  { phase: 'QUARTER_FINAL', mdayId: 'md-cuartos', code: 'QF-4', utc: cr(2026,7,11,13), home: 'Ganador R16-7', away: 'Ganador R16-8', stadium: ST.sofi },

  // ====== SEMIFINALS (14 - 15 Jul) ======
  { phase: 'SEMI_FINAL', mdayId: 'md-semis', code: 'SF-1', utc: cr(2026,7,14,13), home: 'Ganador QF-1', away: 'Ganador QF-2', stadium: ST.cowboys },
  { phase: 'SEMI_FINAL', mdayId: 'md-semis', code: 'SF-2', utc: cr(2026,7,15,13), home: 'Ganador QF-3', away: 'Ganador QF-4', stadium: ST.mercedes },
]

console.log('Seeding', fixtures.length, 'knockout matches...')

for (const f of fixtures) {
  const id = `match-${f.code.toLowerCase()}`
  await prisma.match.upsert({
    where: { id },
    update: {
      kickoffAtUtc: f.utc,
      kickoffAtCostaRica: f.utc,
      placeholderHomeName: f.home,
      placeholderAwayName: f.away,
      stadiumId: f.stadium,
      matchdayId: f.mdayId,
      phase: f.phase,
    },
    create: {
      id,
      eventId: EVENT_ID,
      matchdayId: f.mdayId,
      phase: f.phase,
      kickoffAtUtc: f.utc,
      kickoffAtCostaRica: f.utc,
      placeholderHomeName: f.home,
      placeholderAwayName: f.away,
      stadiumId: f.stadium,
      status: 'PROGRAMADO',
    },
  })
  console.log(`  ${f.code} | ${f.utc.toISOString()} (CR ${f.utc.toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' })}) | ${f.home} vs ${f.away}`)
}

console.log('\nDone.')
await prisma.$disconnect()

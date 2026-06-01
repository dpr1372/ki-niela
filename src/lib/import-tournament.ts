/**
 * Importa un torneo completo desde ESPN y crea (o re-sincroniza) su Event +
 * Teams + Stadiums + Matchdays + Matches, dejando cada Match ligado a ESPN vía
 * `externalId` para que el job sync-live-scores lo actualice en vivo.
 *
 * Idempotente:
 *  - Event:   id determinístico `evt-{slug}-{año}` → upsert.
 *  - Team:    id determinístico por espnId → upsert (no duplica "Brasil"/"Brazil").
 *  - Stadium: id determinístico por nombre normalizado → upsert.
 *  - Matchday: uno por día calendario Costa Rica → upsert.
 *  - Match:   upsert por `externalId` (clave natural @unique). Re-sincronizar
 *             ACTUALIZA fecha/equipos/fase de partidos existentes y AGREGA los
 *             nuevos, SIN tocar Prediction/Score (no se borran filas).
 *
 * Opcionalmente crea una Quiniela colgada del evento (mismo patrón que
 * src/app/api/events/[eventId]/quinielas/route.ts): el creador queda como
 * QUINIELA_ADMIN ACTIVE y la FINAL se marca como partido estrella.
 *
 * El aislamiento por quiniela NO cambia: dos quinielas del mismo torneo
 * comparten Event/Match pero sus members/predictions/scores siguen aislados
 * por quinielaId (ver @@unique en schema.prisma).
 */
import { Prisma, MatchPhase, MatchStatus } from '@prisma/client'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { nanoid } from 'nanoid'
import { prisma } from '@/lib/prisma'
import { fetchFixturesForImport, type ImportFixture } from '@/lib/live-providers/espn'
import { normalize } from '@/lib/team-matching'
import { phaseFromEspnSlug, tournamentBySlug } from '@/lib/tournaments'

const TZ = 'America/Costa_Rica'

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const WEEKDAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** Identificador determinístico, seguro para usar como id de fila. */
function slugifyId(...parts: string[]): string {
  return parts
    .join('-')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

/** Día calendario Costa Rica de una fecha UTC → clave "YYYY-MM-DD". */
function crDayKey(utc: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(utc) // en-CA → "YYYY-MM-DD"
}

/** Etiqueta legible "lunes 1 de junio" a partir de una clave YYYY-MM-DD. */
function crDayLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return `${WEEKDAYS_ES[dt.getUTCDay()]} ${d} de ${MONTHS_ES[m - 1]}`
}

export type ImportTournamentInput = {
  slug: string
  startDate: string // "YYYY-MM-DD" inclusive
  endDate: string // "YYYY-MM-DD" inclusive
  createdByUserId: string
  /** Si se omite, no se crea quiniela (solo se siembra el evento). */
  quinielaName?: string
  lockMinutesBeforeMatch?: number
  randomMinGoals?: number
  randomMaxGoals?: number
}

export type ImportTournamentResult = {
  eventId: string
  quinielaId: string | null
  inviteCode: string | null
  counts: {
    fixtures: number
    teams: number
    stadiums: number
    matchdays: number
    matchesCreated: number
    matchesUpdated: number
    skippedNoTeams: number
  }
}

export async function importTournament(
  input: ImportTournamentInput,
): Promise<ImportTournamentResult> {
  const meta = tournamentBySlug(input.slug)
  if (!meta) throw new Error(`Torneo no soportado: ${input.slug}`)
  if (input.startDate > input.endDate) {
    throw new Error('La fecha inicial no puede ser posterior a la final.')
  }

  const fixtures = await fetchFixturesForImport(input.slug, input.startDate, input.endDate)

  // Año para el id determinístico del evento — del rango, no del reloj.
  const year = input.startDate.slice(0, 4)
  const eventId = slugifyId('evt', input.slug, year)

  // ── Event ──────────────────────────────────────────────────────────────────
  const startUtc = fromZonedTime(`${input.startDate}T00:00:00`, TZ)
  const endUtc = fromZonedTime(`${input.endDate}T23:59:59`, TZ)
  await prisma.event.upsert({
    where: { id: eventId },
    update: { name: meta.name, startDate: startUtc, endDate: endUtc },
    create: {
      id: eventId,
      name: meta.name,
      description: `Importado de ESPN (${input.slug})`,
      sport: 'football',
      startDate: startUtc,
      endDate: endUtc,
      timezone: TZ,
      status: 'ACTIVE',
    },
  })

  // ── Teams (dedup por clase de equivalencia normalizada) ─────────────────────
  // espnId es estable, pero usamos normalize(name) como clave de dedup para no
  // crear dos filas del mismo país con nombres distintos dentro del rango.
  const teamIdByKey = new Map<string, string>() // normalize(name) → teamId
  const teamIdByEspnId = new Map<string, string>()

  async function ensureTeam(t: ImportFixture['home']): Promise<string | null> {
    if (!t) return null
    if (teamIdByEspnId.has(t.espnId)) return teamIdByEspnId.get(t.espnId)!
    const key = normalize(t.name)
    if (teamIdByKey.has(key)) {
      const id = teamIdByKey.get(key)!
      teamIdByEspnId.set(t.espnId, id)
      return id
    }
    const teamId = slugifyId('tm', eventId, t.abbreviation || t.name)
    await prisma.team.upsert({
      where: { id: teamId },
      update: { name: t.name, fifaCode: t.abbreviation ?? null, flagUrl: t.logoUrl ?? null },
      create: {
        id: teamId,
        eventId,
        name: t.name,
        fifaCode: t.abbreviation ?? null,
        flagUrl: t.logoUrl ?? null,
      },
    })
    teamIdByKey.set(key, teamId)
    teamIdByEspnId.set(t.espnId, teamId)
    return teamId
  }

  // ── Stadiums (dedup por nombre normalizado) ─────────────────────────────────
  const stadiumIdByKey = new Map<string, string>()
  async function ensureStadium(f: ImportFixture): Promise<string | null> {
    if (!f.venueName) return null
    const key = normalize(f.venueName)
    if (stadiumIdByKey.has(key)) return stadiumIdByKey.get(key)!
    const stadiumId = slugifyId('std', eventId, f.venueName)
    await prisma.stadium.upsert({
      where: { id: stadiumId },
      update: { name: f.venueName, city: f.venueCity ?? '—', country: f.venueCountry ?? '—' },
      create: {
        id: stadiumId,
        eventId,
        name: f.venueName,
        city: f.venueCity ?? '—',
        country: f.venueCountry ?? '—',
      },
    })
    stadiumIdByKey.set(key, stadiumId)
    return stadiumId
  }

  // ── Matchdays (uno por día calendario Costa Rica) ───────────────────────────
  const matchdayIdByDay = new Map<string, string>()
  // number incremental estable: ordenamos las claves de día al final, pero como
  // upsert es idempotente usamos el índice ordinal del día dentro del rango.
  const dayKeysSorted = Array.from(
    new Set(
      fixtures
        .filter((f) => f.kickoffIsoUtc)
        .map((f) => crDayKey(new Date(f.kickoffIsoUtc!))),
    ),
  ).sort()
  for (let i = 0; i < dayKeysSorted.length; i++) {
    const dayKey = dayKeysSorted[i]
    const matchdayId = slugifyId('md', eventId, dayKey)
    await prisma.matchday.upsert({
      where: { id: matchdayId },
      update: { name: crDayLabel(dayKey), number: i + 1 },
      create: {
        id: matchdayId,
        eventId,
        name: crDayLabel(dayKey),
        number: i + 1,
        phase: MatchPhase.GROUPS,
      },
    })
    matchdayIdByDay.set(dayKey, matchdayId)
  }

  // ── Matches (upsert por externalId — NO borra predicciones) ─────────────────
  let matchesCreated = 0
  let matchesUpdated = 0
  let skippedNoTeams = 0

  for (const f of fixtures) {
    if (!f.kickoffIsoUtc) {
      skippedNoTeams++
      continue
    }
    const utc = new Date(f.kickoffIsoUtc) // ESPN entrega ISO en UTC
    const dayKey = crDayKey(utc)
    const phase = phaseFromEspnSlug(f.seasonSlug) as MatchPhase

    const homeTeamId = await ensureTeam(f.home)
    const awayTeamId = await ensureTeam(f.away)
    const stadiumId = await ensureStadium(f)
    const matchdayId = matchdayIdByDay.get(dayKey) ?? null

    const existing = await prisma.match.findUnique({
      where: { externalId: f.externalId },
      select: { id: true },
    })

    await prisma.match.upsert({
      where: { externalId: f.externalId },
      update: {
        homeTeamId,
        awayTeamId,
        placeholderHomeName: homeTeamId ? null : f.home?.name ?? null,
        placeholderAwayName: awayTeamId ? null : f.away?.name ?? null,
        stadiumId,
        matchdayId,
        phase,
        kickoffAtUtc: utc,
        kickoffAtCostaRica: toZonedTime(utc, TZ),
      },
      create: {
        eventId,
        homeTeamId,
        awayTeamId,
        placeholderHomeName: homeTeamId ? null : f.home?.name ?? null,
        placeholderAwayName: awayTeamId ? null : f.away?.name ?? null,
        stadiumId,
        matchdayId,
        phase,
        kickoffAtUtc: utc,
        kickoffAtCostaRica: toZonedTime(utc, TZ),
        status: MatchStatus.PROGRAMADO,
        externalId: f.externalId,
        externalProvider: 'espn',
      },
    })
    if (existing) matchesUpdated++
    else matchesCreated++
  }

  // ── Quiniela (opcional) ─────────────────────────────────────────────────────
  let quinielaId: string | null = null
  let inviteCode: string | null = null

  if (input.quinielaName && input.quinielaName.trim().length >= 2) {
    inviteCode = nanoid(8).toUpperCase()
    const quiniela = await prisma.quiniela.create({
      data: {
        eventId,
        name: input.quinielaName.trim(),
        description: `Quiniela de ${meta.name}`,
        visibility: 'INVITE_ONLY',
        status: 'ACTIVE',
        randomPredictionsEnabled: true,
        randomMinGoals: input.randomMinGoals ?? 0,
        randomMaxGoals: input.randomMaxGoals ?? 7,
        lockMinutesBeforeMatch: input.lockMinutesBeforeMatch ?? 10,
        timezone: TZ,
        inviteCode,
        createdByUserId: input.createdByUserId,
      },
    })
    quinielaId = quiniela.id

    await prisma.quinielaMember.create({
      data: {
        quinielaId: quiniela.id,
        userId: input.createdByUserId,
        role: 'QUINIELA_ADMIN',
        status: 'ACTIVE',
        autoPredictionsEnabled: false,
        approvedAt: new Date(),
        approvedByUserId: input.createdByUserId,
      },
    })

    // La FINAL siempre es partido estrella (misma regla que el endpoint de quinielas).
    const finalMatch = await prisma.match.findFirst({
      where: { eventId, phase: 'FINAL' },
    })
    if (finalMatch) {
      await prisma.quinielaStarMatch.upsert({
        where: { quinielaId_matchId: { quinielaId: quiniela.id, matchId: finalMatch.id } },
        update: { isStar: true },
        create: { quinielaId: quiniela.id, matchId: finalMatch.id, isStar: true },
      })
    }
  }

  const result: ImportTournamentResult = {
    eventId,
    quinielaId,
    inviteCode,
    counts: {
      fixtures: fixtures.length,
      teams: teamIdByKey.size,
      stadiums: stadiumIdByKey.size,
      matchdays: dayKeysSorted.length,
      matchesCreated,
      matchesUpdated,
      skippedNoTeams,
    },
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: input.createdByUserId,
      action: 'TOURNAMENT_IMPORTED',
      entityType: 'Event',
      entityId: eventId,
      oldValue: Prisma.JsonNull,
      newValue: result as unknown as Prisma.InputJsonValue,
    },
  })

  return result
}

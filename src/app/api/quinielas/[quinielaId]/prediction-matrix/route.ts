import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getMemberContext } from '@/lib/quiniela-auth'
import { isMatchLocked } from '@/lib/timezone'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ quinielaId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { quinielaId } = await params
  const member = await getMemberContext(quinielaId, session.user.id)
  if (!member) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const phase = searchParams.get('phase')
  const matchdayId = searchParams.get('matchdayId')

  const quiniela = await prisma.quiniela.findUnique({
    where: { id: quinielaId },
    select: { eventId: true, lockMinutesBeforeMatch: true },
  })
  if (!quiniela) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Include matches that are either flagged as locked/in-progress/finished by status,
  // OR whose kickoff has already passed the lock threshold by time.
  // This guarantees that as soon as the privacy lock kicks in, the match shows up here.
  const lockThreshold = new Date(Date.now() + quiniela.lockMinutesBeforeMatch * 60_000)
  const matches = await prisma.match.findMany({
    where: {
      eventId: quiniela.eventId,
      OR: [
        { status: { in: ['BLOQUEADO', 'EN_JUEGO', 'MEDIO_TIEMPO', 'TIEMPO_EXTRA', 'PENALES', 'FINALIZADO'] } },
        { kickoffAtUtc: { lte: lockThreshold } },
      ],
      ...(phase ? { phase: phase as never } : {}),
      ...(matchdayId ? { matchdayId } : {}),
    },
    include: {
      homeTeam: { select: { name: true, fifaCode: true, flagUrl: true } },
      awayTeam: { select: { name: true, fifaCode: true, flagUrl: true } },
    },
    orderBy: { kickoffAtUtc: 'asc' },
  })

  const matchIds = matches.map((m) => m.id)

  const members = await prisma.quinielaMember.findMany({
    where: { quinielaId, status: 'ACTIVE', role: 'PARTICIPANT' },
    include: { user: { select: { id: true, name: true } } },
  })

  const predictions = await prisma.prediction.findMany({
    where: { quinielaId, matchId: { in: matchIds } },
  })

  const scores = await prisma.score.findMany({
    where: { quinielaId, matchId: { in: matchIds } },
  })

  const starMatches = await prisma.quinielaStarMatch.findMany({
    where: { quinielaId, matchId: { in: matchIds }, isStar: true },
  })
  const starSet = new Set(starMatches.map((s) => s.matchId))

  const predMap = new Map<string, typeof predictions[0]>()
  for (const p of predictions) predMap.set(`${p.userId}:${p.matchId}`, p)

  const scoreMap = new Map<string, typeof scores[0]>()
  for (const s of scores) scoreMap.set(`${s.userId}:${s.matchId}`, s)

  const lockMinutes = quiniela.lockMinutesBeforeMatch

  const rows = members.map((m) => ({
    userId: m.userId,
    name: m.user.name ?? 'Sin nombre',
    isMe: m.userId === session.user.id,
    cells: matches.map((match) => {
      const locked = isMatchLocked(new Date(match.kickoffAtUtc), lockMinutes) || match.status !== 'PROGRAMADO'
      // Privacy: only show other users' predictions after match is locked
      const canSee = m.userId === session.user.id || locked
      const pred = canSee ? predMap.get(`${m.userId}:${match.id}`) : undefined
      const score = scoreMap.get(`${m.userId}:${match.id}`)
      return {
        matchId: match.id,
        prediction: pred
          ? {
              home: pred.predictedHomeGoals,
              away: pred.predictedAwayGoals,
              isBot: pred.generatedByBot,
            }
          : null,
        points: score?.points ?? null,
        reason: score?.reason ?? null,
      }
    }),
  }))

  const matchHeaders = matches.map((m) => ({
    id: m.id,
    homeTeam: m.homeTeam?.name ?? m.placeholderHomeName ?? '?',
    awayTeam: m.awayTeam?.name ?? m.placeholderAwayName ?? '?',
    homeFifa: m.homeTeam?.fifaCode ?? null,
    awayFifa: m.awayTeam?.fifaCode ?? null,
    homeFlag: m.homeTeam?.flagUrl ?? null,
    awayFlag: m.awayTeam?.flagUrl ?? null,
    officialHome: m.officialHomeGoals,
    officialAway: m.officialAwayGoals,
    status: m.status,
    isStar: starSet.has(m.id),
  }))

  return NextResponse.json({ matches: matchHeaders, rows })
}

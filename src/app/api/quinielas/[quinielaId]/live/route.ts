import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getMemberContext } from '@/lib/quiniela-auth'
import { isMatchLocked } from '@/lib/timezone'
import { calculateScore } from '@/lib/scoring'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ quinielaId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { quinielaId } = await params
  const member = await getMemberContext(quinielaId, session.user.id)
  if (!member) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const quiniela = await prisma.quiniela.findUnique({
    where: { id: quinielaId },
    select: { id: true, eventId: true, lockMinutesBeforeMatch: true },
  })
  if (!quiniela) return NextResponse.json({ error: 'Quiniela no encontrada' }, { status: 404 })

  // Active matches: BLOQUEADO/EN_JUEGO/MEDIO_TIEMPO/TIEMPO_EXTRA/PENALES + recently FINALIZADO
  const matches = await prisma.match.findMany({
    where: {
      eventId: quiniela.eventId,
      status: { in: ['BLOQUEADO', 'EN_JUEGO', 'MEDIO_TIEMPO', 'TIEMPO_EXTRA', 'PENALES', 'FINALIZADO'] },
    },
    include: {
      homeTeam: { select: { id: true, name: true, fifaCode: true, flagUrl: true } },
      awayTeam: { select: { id: true, name: true, fifaCode: true, flagUrl: true } },
      stadium: { select: { name: true, city: true } },
      matchday: { select: { name: true, phase: true } },
    },
    orderBy: { kickoffAtUtc: 'desc' },
    take: 30,
  })

  if (matches.length === 0) return NextResponse.json({ matches: [] })

  const matchIds = matches.map((m) => m.id)
  const [predictions, members, stars] = await Promise.all([
    prisma.prediction.findMany({
      where: { quinielaId, matchId: { in: matchIds } },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.quinielaMember.findMany({
      where: { quinielaId, status: 'ACTIVE', role: 'PARTICIPANT' },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.quinielaStarMatch.findMany({
      where: { quinielaId, matchId: { in: matchIds }, isStar: true },
      select: { matchId: true },
    }),
  ])

  const starSet = new Set(stars.map((s) => s.matchId))
  const predsByMatch = new Map<string, typeof predictions>()
  for (const p of predictions) {
    const arr = predsByMatch.get(p.matchId) ?? []
    arr.push(p)
    predsByMatch.set(p.matchId, arr)
  }

  const result = matches.map((m) => {
      // A match is "locked for visibility" once kickoff lock window has passed
      // OR its status indicates it's already in-flight / finished. This ensures
      // FINALIZADO matches always reveal predictions even if kickoff timestamps
      // are in the future (test data) or were edited after the fact.
      const locked =
        isMatchLocked(m.kickoffAtUtc, quiniela.lockMinutesBeforeMatch) ||
        m.status !== 'PROGRAMADO'
      const matchPreds = predsByMatch.get(m.id) ?? []
      const isStar = starSet.has(m.id) || m.phase === 'FINAL'

      // Reference score: official if final, else live
      const refHome = m.status === 'FINALIZADO' ? m.officialHomeGoals : m.liveHomeGoals
      const refAway = m.status === 'FINALIZADO' ? m.officialAwayGoals : m.liveAwayGoals
      const hasRef = refHome !== null && refAway !== null

      const profiles = members.map((mem) => {
        const pred = matchPreds.find((p) => p.userId === mem.userId)
        const isSelf = mem.userId === session.user.id

        // Privacy: only show others' predictions after lock
        const showPrediction = isSelf || locked

        let live: { points: number; reason: string } | null = null
        if (pred && hasRef) {
          live = calculateScore(
            pred.predictedHomeGoals,
            pred.predictedAwayGoals,
            refHome!,
            refAway!,
            isStar,
          )
        }

        return {
          userId: mem.userId,
          userName: mem.user.name,
          isSelf,
          hasPrediction: !!pred,
          predictedHome: showPrediction && pred ? pred.predictedHomeGoals : null,
          predictedAway: showPrediction && pred ? pred.predictedAwayGoals : null,
          generatedByBot: pred?.generatedByBot ?? false,
          livePoints: live?.points ?? null,
          liveReason: live?.reason ?? null,
          isProvisional: m.status !== 'FINALIZADO',
        }
      })

      return {
        id: m.id,
        status: m.status,
        phase: m.phase,
        isStar,
        kickoffAtUtc: m.kickoffAtUtc,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        placeholderHomeName: m.placeholderHomeName,
        placeholderAwayName: m.placeholderAwayName,
        stadium: m.stadium,
        matchday: m.matchday,
        liveHomeGoals: m.liveHomeGoals,
        liveAwayGoals: m.liveAwayGoals,
        officialHomeGoals: m.officialHomeGoals,
        officialAwayGoals: m.officialAwayGoals,
        liveUpdatedAt: m.liveUpdatedAt,
        profiles: profiles.sort((a, b) => (b.livePoints ?? -1) - (a.livePoints ?? -1)),
      }
    })

  return NextResponse.json({ matches: result })
}

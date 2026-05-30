import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateScore } from '@/lib/scoring'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const matchId: string | undefined = body.matchId

  // Get finished matches with official results
  const matches = await prisma.match.findMany({
    where: {
      status: 'FINALIZADO',
      officialHomeGoals: { not: null },
      officialAwayGoals: { not: null },
      ...(matchId ? { id: matchId } : {}),
    },
    select: {
      id: true,
      eventId: true,
      officialHomeGoals: true,
      officialAwayGoals: true,
    },
  })

  // Solo compiten los PARTICIPANT activos. Limpia cualquier Score que pertenezca
  // a un no-competidor: SUPER_ADMIN globales, o miembros que NO son PARTICIPANT
  // activos en su quiniela (p.ej. QUINIELA_ADMIN). El rol es por quiniela, así
  // que un mismo usuario puede competir en una y administrar en otra.
  const adminUsers = await prisma.user.findMany({
    where: { globalRole: 'SUPER_ADMIN' },
    select: { id: true },
  })
  const adminIds = adminUsers.map((u) => u.id)
  let prunedAdmin = 0
  if (adminIds.length > 0) {
    const del = await prisma.score.deleteMany({
      where: { userId: { in: adminIds } },
    })
    prunedAdmin = del.count
  }

  // Pares (quinielaId,userId) que SÍ compiten. Score que no esté en este set
  // se elimina (no-competidor o miembro inactivo/sin-rol-participante).
  const competitors = await prisma.quinielaMember.findMany({
    where: { status: 'ACTIVE', role: 'PARTICIPANT' },
    select: { quinielaId: true, userId: true },
  })
  const isCompetitor = new Set(competitors.map((c) => `${c.quinielaId}:${c.userId}`))

  let recalculated = 0

  for (const match of matches) {
    // Trae todas las predicciones del partido; filtramos a competidores abajo.
    const predictions = await prisma.prediction.findMany({
      where: { matchId: match.id },
      select: { id: true, quinielaId: true, userId: true, predictedHomeGoals: true, predictedAwayGoals: true },
    })

    for (const pred of predictions) {
      // No-competidor (QUINIELA_ADMIN, inactivo, etc.): borra su Score si existe
      // y no lo recalcules.
      if (!isCompetitor.has(`${pred.quinielaId}:${pred.userId}`)) {
        await prisma.score.deleteMany({
          where: { quinielaId: pred.quinielaId, userId: pred.userId, matchId: match.id },
        })
        continue
      }
      const starRecord = await prisma.quinielaStarMatch.findUnique({
        where: { quinielaId_matchId: { quinielaId: pred.quinielaId, matchId: match.id } },
        select: { isStar: true },
      })
      const isStar = starRecord?.isStar ?? false

      const { points, reason } = calculateScore(
        pred.predictedHomeGoals,
        pred.predictedAwayGoals,
        match.officialHomeGoals!,
        match.officialAwayGoals!,
        isStar,
      )

      await prisma.score.upsert({
        where: { quinielaId_userId_matchId: { quinielaId: pred.quinielaId, userId: pred.userId, matchId: match.id } },
        create: {
          quinielaId: pred.quinielaId,
          eventId: match.eventId,
          userId: pred.userId,
          matchId: match.id,
          predictionId: pred.id,
          points,
          reason,
          isStarMatch: isStar,
          calculatedAt: new Date(),
        },
        update: {
          predictionId: pred.id,
          points,
          reason,
          isStarMatch: isStar,
          calculatedAt: new Date(),
        },
      })
      recalculated++
    }
  }

  return NextResponse.json({ recalculated, prunedAdmin })
}

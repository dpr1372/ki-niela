import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { calculateScore } from '@/lib/scoring'

const liveSchema = z.object({
  liveHomeGoals: z.number().int().min(0),
  liveAwayGoals: z.number().int().min(0),
  status: z.enum(['EN_JUEGO', 'MEDIO_TIEMPO', 'TIEMPO_EXTRA', 'PENALES', 'FINALIZADO']),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.user.globalRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Solo el super admin puede actualizar marcadores en vivo.' }, { status: 403 })
  }

  const { matchId } = await params
  const body = await req.json().catch(() => null)
  const parsed = liveSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const existing = await prisma.match.findUnique({
    where: { id: matchId },
    select: { kickoffAtUtc: true },
  })
  if (!existing) return NextResponse.json({ error: 'Partido no encontrado.' }, { status: 404 })
  if (existing.kickoffAtUtc.getTime() > Date.now()) {
    return NextResponse.json(
      { error: 'No se puede actualizar el marcador antes del inicio del partido.' },
      { status: 400 },
    )
  }

  const { liveHomeGoals, liveAwayGoals, status } = parsed.data
  const isFinal = status === 'FINALIZADO'

  const match = await prisma.match.update({
    where: { id: matchId },
    data: {
      liveHomeGoals,
      liveAwayGoals,
      status,
      liveUpdatedAt: new Date(),
      ...(isFinal
        ? {
            officialHomeGoals: liveHomeGoals,
            officialAwayGoals: liveAwayGoals,
            resultConfirmedAt: new Date(),
          }
        : {}),
    },
  })

  if (isFinal) {
    const predictions = await prisma.prediction.findMany({ where: { matchId } })
    const starMatches = await prisma.quinielaStarMatch.findMany({
      where: { matchId, isStar: true },
    })
    const starQuinielaIds = new Set(starMatches.map((s) => s.quinielaId))

    for (const pred of predictions) {
      const isStar = starQuinielaIds.has(pred.quinielaId)
      const result = calculateScore(
        pred.predictedHomeGoals,
        pred.predictedAwayGoals,
        liveHomeGoals,
        liveAwayGoals,
        isStar,
      )
      await prisma.score.upsert({
        where: { quinielaId_userId_matchId: { quinielaId: pred.quinielaId, userId: pred.userId, matchId } },
        update: { points: result.points, reason: result.reason, isStarMatch: isStar, calculatedAt: new Date() },
        create: {
          quinielaId: pred.quinielaId,
          eventId: match.eventId,
          userId: pred.userId,
          matchId,
          predictionId: pred.id,
          points: result.points,
          reason: result.reason,
          isStarMatch: isStar,
        },
      })
    }
  }

  return NextResponse.json({
    match,
    message: isFinal ? 'Partido finalizado. Puntos calculados.' : 'Marcador en vivo actualizado.',
  })
}

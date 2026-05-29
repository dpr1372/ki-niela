import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getMemberContext } from '@/lib/quiniela-auth'

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
  const scope = searchParams.get('scope') ?? 'general'
  const matchdayId = searchParams.get('matchdayId')
  const phase = searchParams.get('phase')
  const userId = searchParams.get('userId')

  const quiniela = await prisma.quiniela.findUnique({ where: { id: quinielaId }, select: { eventId: true } })
  if (!quiniela) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let matchIdFilter: string[] | undefined

  if (scope === 'matchday' && matchdayId) {
    const ms = await prisma.match.findMany({ where: { matchdayId }, select: { id: true } })
    matchIdFilter = ms.map((m) => m.id)
  } else if (scope === 'phase' && phase) {
    const ms = await prisma.match.findMany({ where: { phase: phase as never, eventId: quiniela.eventId }, select: { id: true } })
    matchIdFilter = ms.map((m) => m.id)
  }

  const scoreWhere = {
    quinielaId,
    ...(userId ? { userId } : {}),
    ...(matchIdFilter ? { matchId: { in: matchIdFilter } } : {}),
  }

  const scores = await prisma.score.findMany({
    where: scoreWhere,
    select: { points: true, reason: true, isStarMatch: true, userId: true },
  })

  const predictions = await prisma.prediction.findMany({
    where: {
      quinielaId,
      ...(userId ? { userId } : {}),
      ...(matchIdFilter ? { matchId: { in: matchIdFilter } } : {}),
    },
    select: { generatedByBot: true, userId: true },
  })

  const totalPoints = scores.reduce((s, r) => s + r.points, 0)
  const exactCount = scores.filter((r) => r.reason === 'Marcador exacto').length
  const winnerCount = scores.filter((r) => r.reason === 'Ganador correcto').length
  const drawCount = scores.filter((r) => r.reason === 'Empate correcto').length
  const missCount = scores.filter((r) => r.reason === 'Sin acierto').length
  const botCount = predictions.filter((p) => p.generatedByBot).length
  const manualCount = predictions.filter((p) => !p.generatedByBot).length

  return NextResponse.json({
    totalPoints,
    exactCount,
    winnerCount,
    drawCount,
    missCount,
    botCount,
    manualCount,
    totalPredictions: predictions.length,
    totalScored: scores.length,
  })
}

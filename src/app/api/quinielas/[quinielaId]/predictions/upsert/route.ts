import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getMemberContext } from '@/lib/quiniela-auth'
import { isMatchLocked } from '@/lib/timezone'
import { z } from 'zod'

const schema = z.object({
  matchId: z.string(),
  predictedHomeGoals: z.number().int().min(0),
  predictedAwayGoals: z.number().int().min(0),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ quinielaId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { quinielaId } = await params

  const member = await getMemberContext(quinielaId, session.user.id)
  if (!member || member.status !== 'ACTIVE') {
    return NextResponse.json(
      { error: 'Tu usuario aún no está activo en esta quiniela.' },
      { status: 403 },
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 422 })

  const { matchId, predictedHomeGoals, predictedAwayGoals } = parsed.data

  const quiniela = await prisma.quiniela.findUnique({
    where: { id: quinielaId },
    select: { lockMinutesBeforeMatch: true, eventId: true },
  })
  if (!quiniela) return NextResponse.json({ error: 'Quiniela no encontrada' }, { status: 404 })

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { kickoffAtUtc: true, eventId: true, homeTeamId: true, awayTeamId: true },
  })
  if (!match || match.eventId !== quiniela.eventId) {
    return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 })
  }

  // Knockout matches require both teams to be known
  if (!match.homeTeamId || !match.awayTeamId) {
    return NextResponse.json(
      { error: 'Los equipos de este partido aún no han sido definidos.' },
      { status: 400 },
    )
  }

  if (isMatchLocked(match.kickoffAtUtc, quiniela.lockMinutesBeforeMatch)) {
    return NextResponse.json({ error: 'El partido ya está bloqueado.' }, { status: 400 })
  }

  const prediction = await prisma.prediction.upsert({
    where: { quinielaId_userId_matchId: { quinielaId, userId: session.user.id, matchId } },
    update: { predictedHomeGoals, predictedAwayGoals, generatedByBot: false },
    create: {
      quinielaId,
      eventId: quiniela.eventId,
      userId: session.user.id,
      matchId,
      predictedHomeGoals,
      predictedAwayGoals,
      generatedByBot: false,
    },
  })

  return NextResponse.json({ prediction, message: 'Marcador guardado.' })
}

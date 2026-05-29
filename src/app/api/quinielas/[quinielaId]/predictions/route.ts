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
  const matchId = searchParams.get('matchId')

  const quiniela = await prisma.quiniela.findUnique({
    where: { id: quinielaId },
    select: { lockMinutesBeforeMatch: true },
  })
  if (!quiniela) return NextResponse.json({ error: 'Quiniela no encontrada' }, { status: 404 })

  if (matchId) {
    // For a specific match — apply privacy rule
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { kickoffAtUtc: true },
    })
    const locked = match ? isMatchLocked(match.kickoffAtUtc, quiniela.lockMinutesBeforeMatch) : false

    const predictions = await prisma.prediction.findMany({
      where: {
        quinielaId,
        matchId,
        // Before lock: only own prediction; after lock: all
        ...(locked ? {} : { userId: session.user.id }),
      },
      include: { user: { select: { id: true, name: true } } },
    })
    return NextResponse.json(predictions)
  }

  // All predictions for the quiniela — only own
  const predictions = await prisma.prediction.findMany({
    where: { quinielaId, userId: session.user.id },
  })
  return NextResponse.json(predictions)
}

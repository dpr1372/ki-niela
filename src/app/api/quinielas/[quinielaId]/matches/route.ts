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

  const quiniela = await prisma.quiniela.findUnique({
    where: { id: quinielaId },
    select: { eventId: true },
  })
  if (!quiniela) return NextResponse.json({ error: 'Quiniela no encontrada' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const phase = searchParams.get('phase')
  const matchdayId = searchParams.get('matchdayId')

  const matches = await prisma.match.findMany({
    where: {
      eventId: quiniela.eventId,
      ...(phase ? { phase: phase as never } : {}),
      ...(matchdayId ? { matchdayId } : {}),
    },
    include: {
      homeTeam: { select: { id: true, name: true, fifaCode: true, flagUrl: true, groupCode: true } },
      awayTeam: { select: { id: true, name: true, fifaCode: true, flagUrl: true, groupCode: true } },
      stadium: { select: { id: true, name: true, city: true, country: true } },
      matchday: { select: { id: true, name: true, number: true, phase: true } },
    },
    orderBy: { kickoffAtUtc: 'asc' },
  })

  return NextResponse.json(matches)
}

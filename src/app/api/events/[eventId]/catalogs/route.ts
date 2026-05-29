import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { eventId } = await params

  const [teams, stadiums, matchdays] = await Promise.all([
    prisma.team.findMany({
      where: { eventId },
      select: { id: true, name: true, fifaCode: true, flagUrl: true, groupCode: true },
      orderBy: [{ groupCode: 'asc' }, { name: 'asc' }],
    }),
    prisma.stadium.findMany({
      where: { eventId },
      select: { id: true, name: true, city: true, country: true },
      orderBy: { name: 'asc' },
    }),
    prisma.matchday.findMany({
      where: { eventId },
      select: { id: true, name: true, number: true, phase: true },
      orderBy: { number: 'asc' },
    }),
  ])

  return NextResponse.json({ teams, stadiums, matchdays })
}

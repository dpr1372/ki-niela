import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { nanoid } from 'nanoid'

const createSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE', 'INVITE_ONLY']).default('INVITE_ONLY'),
  randomPredictionsEnabled: z.boolean().default(true),
  randomMinGoals: z.number().int().min(0).default(0),
  randomMaxGoals: z.number().int().min(0).default(7),
  lockMinutesBeforeMatch: z.number().int().min(0).default(10),
  timezone: z.string().default('America/Costa_Rica'),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params
  const quinielas = await prisma.quiniela.findMany({
    where: { eventId, status: { not: 'ARCHIVED' } },
    include: {
      _count: { select: { members: { where: { status: 'ACTIVE', role: 'PARTICIPANT' } } } },
    },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(quinielas)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.user.globalRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Solo el super admin puede crear quinielas.' }, { status: 403 })
  }

  const { eventId } = await params
  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const event = await prisma.event.findUnique({ where: { id: eventId } })
  if (!event) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })

  const quiniela = await prisma.quiniela.create({
    data: {
      ...parsed.data,
      eventId,
      inviteCode: nanoid(8).toUpperCase(),
      createdByUserId: session.user.id,
    },
  })

  // Creator becomes QUINIELA_ADMIN
  await prisma.quinielaMember.create({
    data: {
      quinielaId: quiniela.id,
      userId: session.user.id,
      role: 'QUINIELA_ADMIN',
      status: 'ACTIVE',
      approvedAt: new Date(),
      approvedByUserId: session.user.id,
    },
  })

  // Final is always a star match — find it and add
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

  return NextResponse.json(quiniela, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ quinielaId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { status: true },
  })
  if (user?.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Tu usuario aún no está activo a nivel global.' }, { status: 403 })
  }

  const { quinielaId } = await params
  const quiniela = await prisma.quiniela.findUnique({
    where: { id: quinielaId },
    select: { id: true, status: true },
  })
  if (!quiniela) return NextResponse.json({ error: 'Quiniela no encontrada' }, { status: 404 })
  if (quiniela.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'La quiniela no está abierta.' }, { status: 400 })
  }

  const existing = await prisma.quinielaMember.findUnique({
    where: { quinielaId_userId: { quinielaId, userId: session.user.id } },
  })
  if (existing) {
    return NextResponse.json({ error: 'Ya solicitaste acceso o eres miembro.', member: existing }, { status: 409 })
  }

  const member = await prisma.quinielaMember.create({
    data: {
      quinielaId,
      userId: session.user.id,
      role: 'PARTICIPANT',
      status: 'PENDING_APPROVAL',
      autoPredictionsEnabled: true,
    },
  })

  return NextResponse.json({ member, message: 'Solicitud enviada. Espera la aprobación del administrador.' })
}

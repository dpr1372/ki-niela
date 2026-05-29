import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const patchSchema = z.object({
  status: z.enum(['ACTIVE', 'CLOSED', 'ARCHIVED']),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ quinielaId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.user.globalRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { quinielaId } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 422 })

  const quiniela = await prisma.quiniela.update({
    where: { id: quinielaId },
    data: { status: parsed.data.status },
    select: { id: true, name: true, status: true },
  })

  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id,
      action: 'QUINIELA_STATUS_CHANGED',
      entityType: 'Quiniela',
      entityId: quinielaId,
      newValue: { status: parsed.data.status },
    },
  })

  return NextResponse.json(quiniela)
}

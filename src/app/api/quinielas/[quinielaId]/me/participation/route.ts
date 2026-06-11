import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({ participate: z.boolean() })

/**
 * Toggle "participar en el puntaje" para un SUPER_ADMIN en una quiniela.
 *
 * El SUPER_ADMIN administra cualquier quiniela por su globalRole. Este endpoint
 * decide si además COMPITE:
 *  - participate=true  → membresía PARTICIPANT + ACTIVE → entra al ranking.
 *  - participate=false → membresía QUINIELA_ADMIN + ACTIVE → deja de competir
 *    (sus scores no se borran, solo deja de rankear porque ya no es PARTICIPANT).
 *
 * Solo el propio SUPER_ADMIN sobre sí mismo. Un usuario normal participa por el
 * flujo de membresía habitual, no por aquí.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ quinielaId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.user.globalRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Solo un Super Admin puede usar esta opción.' }, { status: 403 })
  }

  const { quinielaId } = await params
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 422 })

  const quiniela = await prisma.quiniela.findUnique({ where: { id: quinielaId }, select: { id: true } })
  if (!quiniela) return NextResponse.json({ error: 'Quiniela no encontrada' }, { status: 404 })

  const role = parsed.data.participate ? 'PARTICIPANT' : 'QUINIELA_ADMIN'

  const member = await prisma.quinielaMember.upsert({
    where: { quinielaId_userId: { quinielaId, userId: session.user.id } },
    update: { role, status: 'ACTIVE' },
    create: {
      quinielaId,
      userId: session.user.id,
      role,
      status: 'ACTIVE',
      autoPredictionsEnabled: false,
      joinedAt: new Date(),
      approvedAt: new Date(),
      approvedByUserId: session.user.id,
    },
  })

  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id,
      action: parsed.data.participate ? 'SUPERADMIN_JOINED_SCORING' : 'SUPERADMIN_LEFT_SCORING',
      entityType: 'QuinielaMember',
      entityId: member.id,
      newValue: { role, quinielaId },
    },
  })

  return NextResponse.json({
    message: parsed.data.participate
      ? 'Ahora participás en el puntaje de esta quiniela.'
      : 'Ya no participás en el puntaje (seguís como administrador).',
    participate: parsed.data.participate,
  })
}

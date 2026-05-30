import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * Unirse a una quiniela por CÓDIGO DE INVITACIÓN.
 *
 * El código secreto ES la compuerta: quien lo tiene se une de inmediato como
 * PARTICIPANT ACTIVE (auto-servicio, igual que cuando un admin agrega a alguien
 * directo). Para revocar un código filtrado, el admin lo regenera.
 *
 * Bordes:
 *  - Ya ACTIVE → 409 (no cambia nada).
 *  - PENDING_APPROVAL / INVITED → promueve a ACTIVE (el código aprueba).
 *  - INACTIVE / REJECTED → 409: NO se reactiva solo; respeta la decisión del admin.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { status: true },
  })
  if (user?.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Tu usuario aún no está activo a nivel global.' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const raw = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : ''
  if (!raw) return NextResponse.json({ error: 'Ingresa un código de invitación.' }, { status: 400 })

  // Los códigos se guardan en mayúsculas (nanoid(8).toUpperCase()), así que
  // normalizar la entrada a mayúsculas da una búsqueda case-insensitive.
  const quiniela = await prisma.quiniela.findUnique({
    where: { inviteCode: raw },
    select: { id: true, name: true, status: true },
  })
  if (!quiniela) return NextResponse.json({ error: 'Código inválido.' }, { status: 404 })
  if (quiniela.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'La quiniela no está abierta.' }, { status: 400 })
  }

  const existing = await prisma.quinielaMember.findUnique({
    where: { quinielaId_userId: { quinielaId: quiniela.id, userId: session.user.id } },
  })

  if (existing) {
    if (existing.status === 'ACTIVE') {
      return NextResponse.json({ error: 'Ya eres miembro de esta quiniela.' }, { status: 409 })
    }
    if (existing.status === 'INACTIVE' || existing.status === 'REJECTED') {
      return NextResponse.json(
        { error: 'Tu acceso a esta quiniela fue desactivado. Contacta al administrador.' },
        { status: 409 },
      )
    }
    // PENDING_APPROVAL / INVITED → el código los aprueba.
    const member = await prisma.quinielaMember.update({
      where: { quinielaId_userId: { quinielaId: quiniela.id, userId: session.user.id } },
      data: { status: 'ACTIVE', approvedAt: new Date(), approvedByUserId: session.user.id },
    })
    await prisma.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: 'MEMBER_JOINED_BY_CODE',
        entityType: 'QuinielaMember',
        entityId: member.id,
        oldValue: { status: existing.status },
        newValue: { status: 'ACTIVE', role: member.role, via: 'INVITE_CODE' },
      },
    })
    return NextResponse.json({ member, quinielaId: quiniela.id, message: `Te uniste a ${quiniela.name}.` })
  }

  const member = await prisma.quinielaMember.create({
    data: {
      quinielaId: quiniela.id,
      userId: session.user.id,
      role: 'PARTICIPANT',
      status: 'ACTIVE',
      autoPredictionsEnabled: true,
      approvedAt: new Date(),
      approvedByUserId: session.user.id,
    },
  })
  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id,
      action: 'MEMBER_JOINED_BY_CODE',
      entityType: 'QuinielaMember',
      entityId: member.id,
      oldValue: Prisma.JsonNull,
      newValue: { status: 'ACTIVE', role: 'PARTICIPANT', via: 'INVITE_CODE' },
    },
  })

  return NextResponse.json({ member, quinielaId: quiniela.id, message: `Te uniste a ${quiniela.name}.` })
}

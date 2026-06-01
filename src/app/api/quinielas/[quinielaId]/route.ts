import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getMemberContext, isAdminOf } from '@/lib/quiniela-auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ quinielaId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { quinielaId } = await params
  const member = await getMemberContext(quinielaId, session.user.id)
  if (!member) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const quiniela = await prisma.quiniela.findUnique({
    where: { id: quinielaId },
    include: {
      event: true,
      _count: { select: { members: { where: { status: 'ACTIVE', role: 'PARTICIPANT' } } } },
    },
  })

  if (!quiniela) return NextResponse.json({ error: 'Quiniela no encontrada' }, { status: 404 })
  return NextResponse.json({ quiniela, member, globalRole: session.user.globalRole })
}

/**
 * Borrar una quiniela. Solo el admin de ESA quiniela (o un SUPER_ADMIN).
 *
 * Borra SOLO lo que pertenece a la quiniela: members, predictions, scores y
 * partidos-estrella. NUNCA toca Event/Team/Match — son compartidos por torneo,
 * así que otras quinielas del mismo evento quedan intactas (aislamiento).
 *
 * Requiere confirmación por nombre: el body debe traer { confirmName } que
 * coincida exactamente con el nombre de la quiniela (doble confirmación: el
 * cliente además exige un segundo clic).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ quinielaId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { quinielaId } = await params
  const member = await getMemberContext(quinielaId, session.user.id)
  const isSuperAdmin = session.user.globalRole === 'SUPER_ADMIN'
  if (!isAdminOf(member) && !isSuperAdmin) {
    return NextResponse.json({ error: 'Solo el administrador puede borrar la quiniela.' }, { status: 403 })
  }

  const quiniela = await prisma.quiniela.findUnique({
    where: { id: quinielaId },
    select: { id: true, name: true },
  })
  if (!quiniela) return NextResponse.json({ error: 'Quiniela no encontrada' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const confirmName = typeof body?.confirmName === 'string' ? body.confirmName.trim() : ''
  if (confirmName !== quiniela.name) {
    return NextResponse.json(
      { error: 'El nombre de confirmación no coincide.' },
      { status: 422 },
    )
  }

  // Borrado transaccional, en orden de dependencias. Solo filas de esta quiniela.
  await prisma.$transaction([
    prisma.score.deleteMany({ where: { quinielaId } }),
    prisma.prediction.deleteMany({ where: { quinielaId } }),
    prisma.quinielaStarMatch.deleteMany({ where: { quinielaId } }),
    prisma.quinielaMember.deleteMany({ where: { quinielaId } }),
    prisma.quiniela.delete({ where: { id: quinielaId } }),
  ])

  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id,
      action: 'QUINIELA_DELETED',
      entityType: 'Quiniela',
      entityId: quinielaId,
      oldValue: { name: quiniela.name } as Prisma.InputJsonValue,
      newValue: Prisma.JsonNull,
    },
  })

  return NextResponse.json({ ok: true, message: 'Quiniela eliminada.' })
}

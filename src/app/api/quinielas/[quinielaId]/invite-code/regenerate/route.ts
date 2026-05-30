import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { nanoid } from 'nanoid'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getMemberContext, isAdminOf } from '@/lib/quiniela-auth'

/**
 * Regenera el código de invitación de una quiniela. Solo el QUINIELA_ADMIN (o
 * un SUPER_ADMIN global). El código viejo deja de funcionar de inmediato en
 * /api/quinielas/join.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ quinielaId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { quinielaId } = await params
  const member = await getMemberContext(quinielaId, session.user.id)
  const isSuperAdmin = session.user.globalRole === 'SUPER_ADMIN'
  if (!isAdminOf(member) && !isSuperAdmin) {
    return NextResponse.json({ error: 'Solo el administrador puede regenerar el código.' }, { status: 403 })
  }

  const current = await prisma.quiniela.findUnique({
    where: { id: quinielaId },
    select: { inviteCode: true },
  })
  if (!current) return NextResponse.json({ error: 'Quiniela no encontrada' }, { status: 404 })

  // El inviteCode es @unique. Reintenta ante colisión (P2002) — rarísimo.
  let inviteCode = ''
  for (let attempt = 0; attempt < 5; attempt++) {
    inviteCode = nanoid(8).toUpperCase()
    try {
      await prisma.quiniela.update({ where: { id: quinielaId }, data: { inviteCode } })
      break
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002' && attempt < 4) continue
      throw e
    }
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id,
      action: 'INVITE_CODE_REGENERATED',
      entityType: 'Quiniela',
      entityId: quinielaId,
      oldValue: current.inviteCode ? { inviteCode: current.inviteCode } : Prisma.JsonNull,
      newValue: { inviteCode },
    },
  })

  return NextResponse.json({ inviteCode, message: 'Código regenerado.' })
}

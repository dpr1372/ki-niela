import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getMemberContext } from '@/lib/quiniela-auth'
import { z } from 'zod'

const schema = z.object({ enabled: z.boolean() })

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ quinielaId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { quinielaId } = await params
  const member = await getMemberContext(quinielaId, session.user.id)

  if (!member) return NextResponse.json({ error: 'No eres miembro de esta quiniela.' }, { status: 403 })
  if (member.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Tu usuario aún no está activo en esta quiniela.' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 422 })

  await prisma.quinielaMember.update({
    where: { id: member.id },
    data: { autoPredictionsEnabled: parsed.data.enabled },
  })

  const message = parsed.data.enabled
    ? 'Predicciones automáticas activadas.'
    : 'Predicciones automáticas desactivadas.'

  return NextResponse.json({ message, autoPredictionsEnabled: parsed.data.enabled })
}

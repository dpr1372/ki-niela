import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getMemberContext, isAdminOf } from '@/lib/quiniela-auth'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE', 'INVITE_ONLY']).optional(),
  status: z.enum(['ACTIVE', 'CLOSED', 'ARCHIVED']).optional(),
  randomPredictionsEnabled: z.boolean().optional(),
  randomMinGoals: z.number().int().min(0).optional(),
  randomMaxGoals: z.number().int().min(0).optional(),
  lockMinutesBeforeMatch: z.number().int().min(0).optional(),
  timezone: z.string().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ quinielaId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { quinielaId } = await params
  const member = await getMemberContext(quinielaId, session.user.id)
  if (!isAdminOf(member)) {
    return NextResponse.json({ error: 'Solo el administrador puede cambiar la configuración.' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const quiniela = await prisma.quiniela.update({
    where: { id: quinielaId },
    data: parsed.data,
  })

  const messages: string[] = []
  if (parsed.data.randomPredictionsEnabled === true) messages.push('Pronósticos aleatorios habilitados.')
  if (parsed.data.randomPredictionsEnabled === false) messages.push('Pronósticos aleatorios deshabilitados.')

  return NextResponse.json({ quiniela, message: messages[0] ?? 'Configuración guardada.' })
}

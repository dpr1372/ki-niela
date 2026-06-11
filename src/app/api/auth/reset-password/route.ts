import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { hashSync } from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
})

const INVALID = 'Enlace inválido o expirado. Solicitá uno nuevo.'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const parsed = resetSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 422 })
  }

  const { token, password } = parsed.data
  const tokenHash = createHash('sha256').update(token).digest('hex')

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, usedAt: true, expiresAt: true },
  })

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: INVALID }, { status: 400 })
  }

  const passwordHash = hashSync(password, 12)

  // Actualizar contraseña y marcar el token como usado en una sola transacción.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ])

  return NextResponse.json({ message: 'Contraseña actualizada. Ya puedes iniciar sesión.' })
}

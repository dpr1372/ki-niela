import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { sendPasswordReset } from '@/lib/mailer-templates'

const forgotSchema = z.object({
  email: z.string().email(),
})

const APP_URL = process.env.NEXTAUTH_URL ?? 'https://ki-niela-production.up.railway.app'
const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hora

// Mensaje genérico: nunca revela si el correo existe (evita enumerar cuentas).
const GENERIC = { message: 'Si el correo existe, recibirás instrucciones.' }

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const parsed = forgotSchema.safeParse(body)
  if (!parsed.success) {
    // Aun con email inválido devolvemos el mensaje genérico para no filtrar nada.
    return NextResponse.json(GENERIC, { status: 200 })
  }

  const email = parsed.data.email.trim().toLowerCase()
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  })

  // Si no existe el usuario, respondemos igual (genérico) y no enviamos nada.
  if (user) {
    // Token en claro va por correo; en BD guardamos solo su hash.
    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')

    // Invalidamos solicitudes previas sin usar para que solo el último enlace sirva.
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    })
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    })

    const resetUrl = `${APP_URL}/reset-password?token=${rawToken}`
    // No bloqueamos la respuesta si el correo falla (igual que en register).
    await Promise.allSettled([
      sendPasswordReset({ userName: user.name, userEmail: user.email, resetUrl }),
    ])
  }

  return NextResponse.json(GENERIC, { status: 200 })
}

import { NextRequest, NextResponse } from 'next/server'
import { hashSync } from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const { name, email, password } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'El correo ya está registrado.' }, { status: 409 })
  }

  const passwordHash = hashSync(password, 12)
  const user = await prisma.user.create({
    data: { name, email, passwordHash, globalRole: 'USER', status: 'INACTIVE' },
    select: { id: true, name: true, email: true, globalRole: true },
  })

  return NextResponse.json(
    {
      ...user,
      message: 'Cuenta creada. Un administrador debe activarte antes de poder ingresar.',
    },
    { status: 201 },
  )
}

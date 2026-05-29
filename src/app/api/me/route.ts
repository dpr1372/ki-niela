import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { compareSync, hashSync } from 'bcryptjs'

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  email: z.string().email().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(100).optional(),
}).refine(
  (d) => !(d.newPassword && !d.currentPassword),
  { message: 'Debes ingresar tu contraseña actual para cambiarla.', path: ['currentPassword'] }
)

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { name, email, currentPassword, newPassword } = parsed.data

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })

  // Validate current password if changing password
  if (newPassword) {
    if (!currentPassword || !compareSync(currentPassword, user.passwordHash)) {
      return NextResponse.json({ error: 'Contraseña actual incorrecta.' }, { status: 400 })
    }
  }

  // Check email uniqueness
  if (email && email !== user.email) {
    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return NextResponse.json({ error: 'Ese correo ya está en uso.' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(name ? { name } : {}),
      ...(email && email !== user.email ? { email } : {}),
      ...(newPassword ? { passwordHash: hashSync(newPassword, 12) } : {}),
    },
    select: { id: true, name: true, email: true, globalRole: true },
  })

  return NextResponse.json({ user: updated, message: 'Perfil actualizado.' })
}

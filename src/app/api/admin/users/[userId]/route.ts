import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendUserActivatedGlobally } from '@/lib/mailer-templates'

const patchSchema = z.object({
  action: z.enum(['activate', 'deactivate']).optional(),
  globalRole: z.enum(['SUPER_ADMIN', 'USER']).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.user.globalRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { userId } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 422 })

  const isSelf = userId === session.user.id

  if (isSelf && parsed.data.action === 'deactivate') {
    return NextResponse.json({ error: 'No puedes desactivarte a ti mismo.' }, { status: 400 })
  }
  if (isSelf && parsed.data.globalRole === 'USER') {
    return NextResponse.json({ error: 'No puedes quitarte el rol de Super Admin a ti mismo.' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (parsed.data.action === 'activate') data.status = 'ACTIVE'
  if (parsed.data.action === 'deactivate') data.status = 'INACTIVE'
  if (parsed.data.globalRole) data.globalRole = parsed.data.globalRole

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  const previous = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true },
  })

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, email: true, status: true, globalRole: true },
  })

  // Send activation email if user was just activated (transition from non-active → ACTIVE)
  if (parsed.data.action === 'activate' && previous?.status !== 'ACTIVE') {
    await sendUserActivatedGlobally({ userName: user.name, userEmail: user.email })
      .catch((e) => console.error('[admin/users] activation email failed:', e))
  }

  return NextResponse.json(user)
}

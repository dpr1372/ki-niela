/**
 * Admin diagnostic endpoint for SMTP/email config.
 *
 * GET  /api/admin/diag/mailer        → reports which env vars are set
 * POST /api/admin/diag/mailer        → sends a real test email to the admin's
 *                                       own address and returns the SMTP result
 *
 * Both routes require SUPER_ADMIN. Returns no secrets, just booleans and
 * provider hints so the admin can see at a glance whether SMTP is configured
 * on Railway and where the email is going (or failing).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sendMail } from '@/lib/mailer'

function snapshot() {
  return {
    SMTP_HOST: process.env.SMTP_HOST ?? null,
    SMTP_PORT: process.env.SMTP_PORT ?? null,
    SMTP_USER_set: !!process.env.SMTP_USER,
    SMTP_PASS_set: !!process.env.SMTP_PASS,
    SMTP_FROM: process.env.SMTP_FROM ?? null,
    ADMIN_NOTIFY_EMAIL: process.env.ADMIN_NOTIFY_EMAIL ?? null,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? null,
    NODE_ENV: process.env.NODE_ENV ?? null,
  }
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.user.globalRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const env = snapshot()
  const configured =
    !!env.SMTP_HOST && !!env.SMTP_PORT && env.SMTP_USER_set && env.SMTP_PASS_set
  return NextResponse.json({ configured, env })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.user.globalRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const to: string = body?.to ?? session.user.email ?? process.env.ADMIN_NOTIFY_EMAIL ?? ''
  if (!to) {
    return NextResponse.json({ error: 'No hay dirección destino.' }, { status: 400 })
  }

  const env = snapshot()
  const result = await sendMail({
    to,
    subject: '[Ki-Niela] Test de SMTP',
    html: `<p>Si recibes este correo, SMTP funciona desde Railway.</p>
           <p>Hora del servidor: ${new Date().toISOString()}</p>`,
    text: 'Test de SMTP desde Ki-Niela.',
  })

  return NextResponse.json({ to, result, env })
}

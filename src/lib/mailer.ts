import nodemailer from 'nodemailer'

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter

  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !port || !user || !pass) {
    return null
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
  return transporter
}

export type MailMessage = {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendMail(msg: MailMessage): Promise<{ ok: true } | { ok: false; reason: string }> {
  const t = getTransporter()
  if (!t) {
    // Dev fallback: log to console so the app remains functional without SMTP configured.
    console.log(`[mailer:dev] To=${msg.to} Subject=${msg.subject}`)
    console.log(msg.text ?? msg.html)
    return { ok: false, reason: 'SMTP not configured (logged to console)' }
  }
  const from = process.env.SMTP_FROM ?? '"Ki-Niela" <noreply@kiniela.local>'
  try {
    await t.sendMail({ from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text })
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'send error' }
  }
}

import nodemailer from 'nodemailer'

let transporter: nodemailer.Transporter | null = null
let configReason: string | null = null

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter

  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  const missing: string[] = []
  if (!host) missing.push('SMTP_HOST')
  if (!port) missing.push('SMTP_PORT')
  if (!user) missing.push('SMTP_USER')
  if (!pass) missing.push('SMTP_PASS')
  if (missing.length > 0) {
    configReason = `Faltan variables: ${missing.join(', ')}`
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

export type SendResult = { ok: true; messageId?: string } | { ok: false; reason: string }

export async function sendMail(msg: MailMessage): Promise<SendResult> {
  const t = getTransporter()
  if (!t) {
    const reason = configReason ?? 'SMTP no configurado'
    console.warn(`[mailer] SKIPPING send to ${msg.to} — ${reason}`)
    console.warn(`[mailer] Subject: ${msg.subject}`)
    return { ok: false, reason }
  }
  const from = process.env.SMTP_FROM ?? '"Ki-Niela" <noreply@kiniela.local>'
  try {
    const info = await t.sendMail({
      from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    })
    console.log(`[mailer] sent to=${msg.to} id=${info.messageId} subject="${msg.subject}"`)
    return { ok: true, messageId: info.messageId }
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'send error'
    console.error(`[mailer] FAILED to=${msg.to} reason=${reason}`)
    return { ok: false, reason }
  }
}

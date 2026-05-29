/**
 * Mailer with two transport modes:
 *
 * 1. **Brevo HTTP API** (preferred when BREVO_API_KEY is set) — goes via
 *    HTTPS:443, which Railway never blocks. Required workaround for the
 *    fact that Railway free/hobby tier blocks outbound SMTP (port 587/465).
 *
 * 2. **SMTP via nodemailer** (fallback when SMTP_* vars are set but no
 *    BREVO_API_KEY) — works on platforms that allow outbound SMTP.
 *
 * If neither is configured, sendMail logs and returns ok:false so the app
 * keeps working without crashing.
 */

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
    requireTLS: port === 587,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
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

/**
 * Parse "Name <email@host.com>" or just "email@host.com" into Brevo's
 * { name, email } shape required by the HTTP API.
 */
function parseFrom(raw: string): { name?: string; email: string } {
  const m = raw.match(/^"?([^"<]+?)"?\s*<\s*([^>]+)\s*>$/)
  if (m) return { name: m[1].trim(), email: m[2].trim() }
  return { email: raw.trim() }
}

async function sendViaBrevoApi(msg: MailMessage): Promise<SendResult> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) return { ok: false, reason: 'BREVO_API_KEY not set' }

  const fromRaw = process.env.SMTP_FROM ?? '"Ki-Niela" <noreply@kiniela.local>'
  const sender = parseFrom(fromRaw)

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'accept': 'application/json',
      },
      body: JSON.stringify({
        sender,
        to: [{ email: msg.to }],
        subject: msg.subject,
        htmlContent: msg.html,
        textContent: msg.text,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const reason = data?.message ?? data?.code ?? `HTTP ${res.status}`
      console.error(`[mailer:brevo-api] FAILED to=${msg.to} reason=${reason}`)
      return { ok: false, reason: String(reason) }
    }
    const messageId: string | undefined = data?.messageId
    console.log(`[mailer:brevo-api] sent to=${msg.to} id=${messageId} subject="${msg.subject}"`)
    return { ok: true, messageId }
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'send error'
    console.error(`[mailer:brevo-api] FAILED to=${msg.to} reason=${reason}`)
    return { ok: false, reason }
  }
}

async function sendViaSmtp(msg: MailMessage): Promise<SendResult> {
  const t = getTransporter()
  if (!t) {
    const reason = configReason ?? 'SMTP no configurado'
    console.warn(`[mailer:smtp] SKIPPING send to ${msg.to} — ${reason}`)
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
    console.log(`[mailer:smtp] sent to=${msg.to} id=${info.messageId} subject="${msg.subject}"`)
    return { ok: true, messageId: info.messageId }
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'send error'
    console.error(`[mailer:smtp] FAILED to=${msg.to} reason=${reason}`)
    return { ok: false, reason }
  }
}

export async function sendMail(msg: MailMessage): Promise<SendResult> {
  // Prefer Brevo HTTP API (works on Railway). Fall back to SMTP otherwise.
  if (process.env.BREVO_API_KEY) {
    return sendViaBrevoApi(msg)
  }
  return sendViaSmtp(msg)
}

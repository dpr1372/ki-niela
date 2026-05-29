import { sendMail } from './mailer'

const APP_URL = process.env.NEXTAUTH_URL ?? 'https://ki-niela-production.up.railway.app'
const ADMIN_EMAIL = process.env.ADMIN_NOTIFY_EMAIL ?? 'admin@kiniela.com'

function wrap(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <tr><td style="background:linear-gradient(90deg,#082f49 0%,#065f46 100%);padding:24px;color:#fff;text-align:center;">
          <img src="${APP_URL}/brand/ki-niela-icon.png" alt="Ki-Niela" width="72" height="72" style="display:block;margin:0 auto 8px;width:72px;height:72px;object-fit:contain;border:0;outline:none;text-decoration:none;" />
          <h1 style="margin:0;font-size:22px;font-weight:900;letter-spacing:-0.5px;color:#ffffff;">Ki-Niela</h1>
          <p style="margin:4px 0 0;font-size:13px;color:#bfdbfe;">${title}</p>
        </td></tr>
        <tr><td style="padding:24px;color:#374151;font-size:14px;line-height:1.6;">
          ${body}
        </td></tr>
        <tr><td style="background:#f9fafb;padding:16px;text-align:center;color:#9ca3af;font-size:11px;border-top:1px solid #e5e7eb;">
          Ki-Niela — Quinielas deportivas recreativas
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function sendNewUserRegisteredToAdmin(opts: { userName: string; userEmail: string }) {
  const body = `
    <p>Se ha registrado un nuevo usuario en Ki-Niela:</p>
    <table style="background:#f9fafb;border-radius:8px;padding:12px;margin:16px 0;border-left:4px solid #065f46;">
      <tr><td style="padding:4px 12px;color:#6b7280;">Nombre:</td><td style="padding:4px 12px;font-weight:bold;">${opts.userName}</td></tr>
      <tr><td style="padding:4px 12px;color:#6b7280;">Correo:</td><td style="padding:4px 12px;font-weight:bold;">${opts.userEmail}</td></tr>
    </table>
    <p>Para que pueda iniciar sesión, debes activarlo:</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}/admin/usuarios" style="background:#082f49;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
        Activar usuario
      </a>
    </p>
  `
  return sendMail({
    to: ADMIN_EMAIL,
    subject: `Nuevo registro: ${opts.userName}`,
    html: wrap('Nuevo usuario registrado', body),
    text: `Nuevo registro en Ki-Niela: ${opts.userName} (${opts.userEmail}). Activarlo en ${APP_URL}/admin/usuarios`,
  })
}

export async function sendWelcomeToNewUser(opts: { userName: string; userEmail: string }) {
  const body = `
    <p>¡Hola <strong>${opts.userName}</strong>!</p>
    <p>Tu cuenta en <strong>Ki-Niela</strong> fue creada correctamente.</p>
    <p style="background:#fef3c7;border-radius:8px;padding:12px;border-left:4px solid #f59e0b;color:#78350f;">
      ⏳ Tu cuenta queda <strong>pendiente de activación</strong>.
      Un administrador la revisará y aprobará en breve. Recibirás un correo cuando esté lista.
    </p>
    <p>Una vez activada podrás:</p>
    <ul style="color:#374151;line-height:1.8;">
      <li>Unirte a quinielas con un código de invitación</li>
      <li>Registrar tus pronósticos partido por partido</li>
      <li>Ver tu posición en la tabla y estadísticas</li>
    </ul>
    <p style="margin-top:24px;color:#6b7280;font-size:13px;">¡Te esperamos en el juego!</p>
  `
  return sendMail({
    to: opts.userEmail,
    subject: '¡Bienvenido a Ki-Niela!',
    html: wrap('Cuenta creada', body),
    text: `Hola ${opts.userName}, tu cuenta en Ki-Niela fue creada. Pendiente de activación por el administrador.`,
  })
}

export async function sendUserActivatedGlobally(opts: { userName: string; userEmail: string }) {
  const body = `
    <p>¡Hola <strong>${opts.userName}</strong>!</p>
    <p>Tu cuenta en <strong>Ki-Niela</strong> fue <strong style="color:#065f46;">activada</strong> ✅</p>
    <p>Ya puedes iniciar sesión y comenzar a participar:</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}/login" style="background:#065f46;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
        Iniciar sesión
      </a>
    </p>
    <p style="color:#6b7280;font-size:13px;">
      💡 <strong>Tip:</strong> para unirte a una quiniela, necesitas el código de invitación.
      Pídelo al administrador de la quiniela.
    </p>
  `
  return sendMail({
    to: opts.userEmail,
    subject: 'Tu cuenta Ki-Niela fue activada',
    html: wrap('Cuenta activada', body),
    text: `Hola ${opts.userName}, tu cuenta Ki-Niela fue activada. Inicia sesión en ${APP_URL}/login`,
  })
}

export async function sendQuinielaAccessRequestToAdmin(opts: {
  adminEmail: string
  userName: string
  userEmail: string
  quinielaName: string
  quinielaId: string
}) {
  const body = `
    <p>Un usuario solicitó unirse a tu quiniela <strong>${opts.quinielaName}</strong>:</p>
    <table style="background:#f9fafb;border-radius:8px;padding:12px;margin:16px 0;border-left:4px solid #065f46;">
      <tr><td style="padding:4px 12px;color:#6b7280;">Nombre:</td><td style="padding:4px 12px;font-weight:bold;">${opts.userName}</td></tr>
      <tr><td style="padding:4px 12px;color:#6b7280;">Correo:</td><td style="padding:4px 12px;font-weight:bold;">${opts.userEmail}</td></tr>
    </table>
    <p>Aprueba o rechaza la solicitud:</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}/quinielas/${opts.quinielaId}/participantes" style="background:#082f49;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
        Ver solicitudes
      </a>
    </p>
  `
  return sendMail({
    to: opts.adminEmail,
    subject: `Nueva solicitud en ${opts.quinielaName}`,
    html: wrap('Solicitud de acceso a quiniela', body),
    text: `${opts.userName} (${opts.userEmail}) solicitó acceso a la quiniela ${opts.quinielaName}.`,
  })
}

export async function sendQuinielaAccessApproved(opts: {
  userName: string
  userEmail: string
  quinielaName: string
  quinielaId: string
}) {
  const body = `
    <p>¡Hola <strong>${opts.userName}</strong>!</p>
    <p>Tu solicitud para unirte a <strong>${opts.quinielaName}</strong> fue <strong style="color:#065f46;">aprobada</strong> ✅</p>
    <p>Ya puedes registrar tus pronósticos:</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}/quinielas/${opts.quinielaId}/dashboard" style="background:#065f46;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
        Ir a la quiniela
      </a>
    </p>
    <p style="color:#6b7280;font-size:13px;">
      ⏰ <strong>Recuerda:</strong> cada partido se bloquea 10 minutos antes de su hora de inicio.
    </p>
  `
  return sendMail({
    to: opts.userEmail,
    subject: `Aprobado en ${opts.quinielaName}`,
    html: wrap('Acceso aprobado', body),
    text: `Hola ${opts.userName}, fuiste aprobado en la quiniela ${opts.quinielaName}.`,
  })
}

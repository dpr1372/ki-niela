/**
 * Test SMTP configuration
 * Usage:
 *   npx tsx scripts/test-smtp.ts
 */
import { sendMail } from '@/lib/mailer'

async function main() {
  console.log('Testing SMTP configuration...')
  console.log('SMTP_HOST:', process.env.SMTP_HOST)
  console.log('SMTP_PORT:', process.env.SMTP_PORT)
  console.log('SMTP_USER:', process.env.SMTP_USER || '(empty)')
  console.log('SMTP_PASS:', process.env.SMTP_PASS ? '[configured]' : '[missing]')
  console.log('SMTP_FROM:', process.env.SMTP_FROM)
  console.log()

  const result = await sendMail({
    to: 'daniel.cr031288@gmail.com',
    subject: '✅ Ki-Niela SMTP Test',
    html: '<p>¡SMTP está funcionando correctamente!</p><p>Los correos de Ki-Niela ya se enviarán.</p>',
    text: 'SMTP test OK',
  })

  if (result.ok) {
    console.log('✅ Email enviado exitosamente a daniel.cr031288@gmail.com')
  } else {
    console.log('❌ Error:', result.reason)
  }
}

main().catch(console.error)

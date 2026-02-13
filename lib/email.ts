import nodemailer from 'nodemailer'

// ── SMTP Configuration ────────────────────────────────
// Set these in .env.local / K8s secret:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
  auth:
    process.env.SMTP_USER && process.env.SMTP_PASS
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === 'production',
  },
})

const FROM = process.env.SMTP_FROM || 'MOSiR Portal <noreply@e-mosir.pl>'

// ── Public API ─────────────────────────────────────────

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  if (!process.env.SMTP_HOST) {
    console.warn('[email] SMTP_HOST not configured – skipping email send')
    return { success: false, error: 'SMTP not configured' }
  }

  try {
    const info = await transporter.sendMail({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    })
    console.log('[email] Message sent:', info.messageId)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[email] Send failed:', message)
    return { success: false, error: message }
  }
}

// ── Health check ───────────────────────────────────────

export async function verifySmtp(): Promise<boolean> {
  if (!process.env.SMTP_HOST) return false
  try {
    await transporter.verify()
    return true
  } catch {
    return false
  }
}

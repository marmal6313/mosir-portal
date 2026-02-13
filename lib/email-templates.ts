// ── Email Templates for MOSiR Portal notifications ─────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.e-mosir.pl'

// ── Base layout ────────────────────────────────────────

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MOSiR Portal</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:#2563eb;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">MOSiR Portal</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                Otrzymujesz tego maila, bo masz włączone powiadomienia email w
                <a href="${APP_URL}/dashboard/profile" style="color:#2563eb;text-decoration:none;">ustawieniach profilu</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Button helper ──────────────────────────────────────

function button(text: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="background-color:#2563eb;border-radius:8px;">
        <a href="${url}" target="_blank" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">
          ${text}
        </a>
      </td>
    </tr>
  </table>`
}

// ── Type badge ─────────────────────────────────────────

function typeBadge(type: string): string {
  const colors: Record<string, { bg: string; text: string; label: string }> = {
    info: { bg: '#dbeafe', text: '#1d4ed8', label: 'Informacja' },
    success: { bg: '#dcfce7', text: '#166534', label: 'Sukces' },
    warning: { bg: '#fef3c7', text: '#92400e', label: 'Uwaga' },
    error: { bg: '#fee2e2', text: '#991b1b', label: 'Błąd' },
  }
  const c = colors[type] || colors.info
  return `<span style="display:inline-block;padding:4px 10px;border-radius:6px;background-color:${c.bg};color:${c.text};font-size:12px;font-weight:600;">${c.label}</span>`
}

// ── Public Templates ───────────────────────────────────

export interface NotificationEmailData {
  title: string
  message: string
  type: string
  actionUrl?: string
  taskId?: string
}

export function notificationEmail(data: NotificationEmailData): { subject: string; html: string; text: string } {
  const url = data.actionUrl
    ? `${APP_URL}${data.actionUrl}`
    : data.taskId
      ? `${APP_URL}/dashboard/tasks/${data.taskId}`
      : APP_URL

  const html = layout(`
    <div style="margin-bottom:16px;">${typeBadge(data.type)}</div>
    <h2 style="margin:0 0 12px;color:#111827;font-size:18px;font-weight:600;">${escapeHtml(data.title)}</h2>
    <p style="margin:0;color:#4b5563;font-size:14px;line-height:1.6;">${escapeHtml(data.message)}</p>
    ${button('Otwórz w portalu', url)}
  `)

  const text = `${data.title}\n\n${data.message}\n\nLink: ${url}`

  return {
    subject: `[MOSiR] ${data.title}`,
    html,
    text,
  }
}

// ── Helpers ─────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

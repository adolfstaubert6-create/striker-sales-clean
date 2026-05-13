const FROM = 'adolf.staubert@striker-energy.de'

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) }
  }

  let parsed
  try { parsed = JSON.parse(event.body) } catch {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Invalid JSON' }) }
  }

  const { to, subject, body, companyId, companyName } = parsed

  if (!to || !subject || !body) {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing to, subject, or body' }) }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'RESEND_API_KEY not configured' }) }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    FROM,
        to:      [to],
        subject,
        text:    body,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      const msg = data.message || data.name || `HTTP ${res.status}`
      console.error(`[send-email] Resend error for ${companyName || companyId}: ${msg}`)
      return { statusCode: res.status, body: JSON.stringify({ success: false, error: msg }) }
    }

    console.log(`[send-email] Sent to ${to} (company: ${companyName || companyId}), messageId: ${data.id}`)
    return { statusCode: 200, body: JSON.stringify({ success: true, messageId: data.id }) }

  } catch (err) {
    console.error('[send-email] Unexpected error:', err.message)
    return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) }
  }
}

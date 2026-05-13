const FROM = 'adolf.staubert@striker-energy.de'

function cleanEmailText(text) {
  if (!text) return ''
  return text
    .replace(/<\/?STRIKER_EMAIL>/gi, '')
    .replace(/^SUBJECT:.*$/gm, '')
    .replace(/^BODY:\s*/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) }
  }

  let parsed
  try { parsed = JSON.parse(event.body) } catch {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Invalid JSON' }) }
  }

  const { to, subject, body, subjectDe, bodyDe, companyId, companyName, attachments = [] } = parsed

  const finalSubject = cleanEmailText(subjectDe || subject)
  const finalBody    = cleanEmailText(bodyDe    || body)

  if (!to || !finalSubject || !finalBody) {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing to, subject, or body' }) }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'RESEND_API_KEY not configured' }) }
  }

  console.log(`[send-email] to=${to} | subject="${finalSubject}" | attachments=${attachments.length}`)

  const resendPayload = {
    from:    FROM,
    to:      [to],
    subject: finalSubject,
    text:    finalBody,
  }

  if (attachments.length > 0) {
    resendPayload.attachments = attachments.map(a => ({
      filename: a.filename,
      content:  a.content,
    }))
    console.log(`[send-email] attachment names: ${attachments.map(a => a.filename).join(', ')}`)
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(resendPayload),
    })

    const data = await res.json()

    if (!res.ok) {
      const msg = data.message || data.name || `HTTP ${res.status}`
      console.error(`[send-email] Resend error for ${companyName || companyId}: ${msg}`)
      return { statusCode: res.status, body: JSON.stringify({ success: false, error: msg }) }
    }

    console.log(`[send-email] OK | to=${to} | messageId=${data.id} | attachments=${attachments.length}`)
    return { statusCode: 200, body: JSON.stringify({ success: true, messageId: data.id }) }

  } catch (err) {
    console.error('[send-email] Unexpected error:', err.message)
    return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) }
  }
}

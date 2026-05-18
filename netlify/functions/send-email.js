const { randomUUID } = require('crypto')

const FROM        = 'adolf.staubert@striker-energy.de'
const FB_API_KEY  = process.env.VITE_FIREBASE_API_KEY
const FB_PROJECT  = process.env.VITE_FIREBASE_PROJECT_ID
const FS_BASE     = () => `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents`

// ── Firestore helpers ─────────────────────────────────────────────────────────
function toFsVal(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean')        return { booleanValue: v }
  if (typeof v === 'number')         return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'string')         return { stringValue: v }
  if (v instanceof Date)             return { timestampValue: v.toISOString() }
  return { stringValue: String(v) }
}
function toFsFields(obj) {
  const f = {}
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) f[k] = toFsVal(v)
  return f
}
async function fsCreate(col, data) {
  if (!FB_API_KEY || !FB_PROJECT) return null
  try {
    await fetch(`${FS_BASE()}/${col}?key=${FB_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: toFsFields(data) }),
    })
  } catch (e) {
    console.warn('[send-email] fsCreate error:', e.message)
  }
}

// ── Subject normalizer (same as check-replies) ────────────────────────────────
function normalizeSubject(s) {
  return (s || '')
    .replace(/^(Re|Fwd|Fw|AW|SV|WG|Antw|ENC|RIF|FS|VB|RES|Odp|Trans|Ref|Vs|NA|Svar|Ynt)(\s*:)+\s*/gi, '')
    .replace(/\s+/g, ' ').trim().toLowerCase()
}

// ── Thread fingerprint ────────────────────────────────────────────────────────
function threadFingerprint(toEmail, normalizedSubject) {
  const { createHash } = require('crypto')
  return createHash('sha1')
    .update(`${(toEmail || '').toLowerCase()}::${normalizedSubject}`)
    .digest('hex').slice(0, 16)
}

// ── Clean AI noise from email text ───────────────────────────────────────────
function cleanEmailText(text) {
  if (!text) return ''
  return text
    .replace(/<\/?STRIKER_EMAIL>/gi, '')
    .replace(/^SUBJECT:.*$/gm, '')
    .replace(/^BODY:\s*/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ── Handler ───────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) }
  }

  let parsed
  try { parsed = JSON.parse(event.body) } catch {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Invalid JSON' }) }
  }

  const { to, subject, body, subjectDe, bodyDe, companyId, companyName } = parsed

  const finalSubject = cleanEmailText(subjectDe || subject)
  const finalBody    = cleanEmailText(bodyDe    || body)

  if (!to || !finalSubject || !finalBody) {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing to, subject, or body' }) }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'RESEND_API_KEY not configured' }) }
  }

  // Generate deterministic Message-ID for thread tracking
  const uuid      = randomUUID()
  const messageId = `<${uuid}@striker-energy.de>`
  const normSubj  = normalizeSubject(finalSubject)
  const threadFP  = threadFingerprint(to, normSubj)

  console.log(`[send-email] to=${to} | subject="${finalSubject}" | msgId=${messageId}`)

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    FROM,
        to:      [to],
        subject: finalSubject,
        text:    finalBody,
        headers: { 'Message-ID': messageId },
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      const msg = data.message || data.name || `HTTP ${res.status}`
      console.error(`[send-email] Resend error for ${companyName || companyId}: ${msg}`)
      return { statusCode: res.status, body: JSON.stringify({ success: false, error: msg }) }
    }

    console.log(`[send-email] OK | to=${to} | resendId=${data.id} | messageId=${messageId}`)

    // Store outbound metadata for thread matching
    await fsCreate('outbound_emails', {
      companyId:         companyId || null,
      companyName:       companyName || null,
      toEmail:           to.toLowerCase(),
      subject:           finalSubject,
      normalizedSubject: normSubj,
      messageId,
      threadFingerprint: threadFP,
      resendId:          data.id,
      sentAt:            new Date(),
    })

    return { statusCode: 200, body: JSON.stringify({ success: true, messageId, resendId: data.id }) }

  } catch (err) {
    console.error('[send-email] Unexpected error:', err.message)
    return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) }
  }
}

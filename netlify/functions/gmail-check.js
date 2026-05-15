/**
 * STRIKER Gmail Checker — scans inbox for replies from known companies
 *
 * GET  /.netlify/functions/gmail-check          → health check
 * POST /.netlify/functions/gmail-check          → run check
 *
 * Required env vars:
 *   GMAIL_CLIENT_ID       — from Google Cloud Console (OAuth2 Desktop app)
 *   GMAIL_CLIENT_SECRET   — from Google Cloud Console
 *   GMAIL_REFRESH_TOKEN   — obtained via OAuth Playground (see README below)
 *   VITE_FIREBASE_API_KEY
 *   VITE_FIREBASE_PROJECT_ID
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW TO GET GMAIL OAUTH2 CREDENTIALS
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Go to https://console.cloud.google.com → APIs & Services → Credentials
 * 2. Create OAuth 2.0 Client ID → Desktop Application
 * 3. Copy Client ID + Client Secret → .env
 * 4. Go to https://developers.google.com/oauthplayground
 *    - Click gear icon → check "Use your own OAuth credentials"
 *    - Enter your Client ID + Secret
 * 5. Select scope: https://www.googleapis.com/auth/gmail.readonly
 * 6. Authorize → Exchange auth code for tokens
 * 7. Copy Refresh Token → .env as GMAIL_REFRESH_TOKEN
 * 8. Enable Gmail API at: https://console.cloud.google.com/apis/library/gmail.googleapis.com
 */

const { google } = require('googleapis')

// ── Env ───────────────────────────────────────────────────────────────────────
const FB_API_KEY = process.env.VITE_FIREBASE_API_KEY
const FB_PROJECT = process.env.VITE_FIREBASE_PROJECT_ID
const FS_BASE    = () => `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents`

// ── Firestore REST helpers (same pattern as agent.js) ─────────────────────────
function toFsVal(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean')        return { booleanValue: v }
  if (typeof v === 'number')         return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'string')         return { stringValue: v }
  if (typeof v === 'object')         return { mapValue: { fields: toFsFields(v) } }
  return { stringValue: String(v) }
}

function toFsFields(obj) {
  const f = {}
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) f[k] = toFsVal(v)
  return f
}

async function fsListAll(collectionId) {
  const url = `${FS_BASE()}/${collectionId}?key=${FB_API_KEY}&pageSize=300`
  const res  = await fetch(url)
  const data = await res.json()
  return (data.documents || []).map(d => ({
    id:     d.name.split('/').pop(),
    fields: d.fields,
    // helper to get string value
    get: (k) => d.fields?.[k]?.stringValue ?? d.fields?.[k]?.booleanValue ?? null,
  }))
}

async function fsPatch(docPath, data) {
  const mask = Object.keys(data).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
  const res  = await fetch(`${FS_BASE()}/${docPath}?key=${FB_API_KEY}&${mask}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields: toFsFields(data) }),
  })
  return res.json()
}

async function fsCreate(collectionId, data) {
  const res = await fetch(`${FS_BASE()}/${collectionId}?key=${FB_API_KEY}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields: toFsFields(data) }),
  })
  return res.json()
}

// ── Gmail helpers ─────────────────────────────────────────────────────────────
function buildOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  )
  client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
  return client
}

// Search Gmail for messages FROM any of the given email addresses
async function searchGmailFrom(gmail, addresses) {
  if (!addresses.length) return []

  // Build OR query in batches of 20 (Gmail query length limit)
  const BATCH = 20
  const messages = []

  for (let i = 0; i < addresses.length; i += BATCH) {
    const batch = addresses.slice(i, i + BATCH)
    const query = `from:(${batch.join(' OR ')}) in:inbox`
    console.log(`[gmail] searching: ${query.slice(0, 100)}...`)

    try {
      const res = await gmail.users.messages.list({
        userId: 'me',
        q:      query,
        maxResults: 50,
      })
      const list = res.data.messages || []
      messages.push(...list)
    } catch (e) {
      console.error('[gmail] search error:', e.message)
    }
  }
  return messages
}

// Get full message details (FROM address + snippet)
async function getMessageDetails(gmail, messageId) {
  const res = await gmail.users.messages.get({
    userId: 'me',
    id:     messageId,
    format: 'metadata',
    metadataHeaders: ['From', 'Subject', 'Date'],
  })
  const msg     = res.data
  const headers = msg.payload?.headers || []
  const from    = headers.find(h => h.name === 'From')?.value || ''
  const subject = headers.find(h => h.name === 'Subject')?.value || ''
  const date    = headers.find(h => h.name === 'Date')?.value || ''
  // Extract plain email from "Name <email@domain.com>"
  const emailMatch = from.match(/<([^>]+)>/) || from.match(/([^\s]+@[^\s]+)/)
  const fromEmail  = emailMatch ? emailMatch[1].toLowerCase() : from.toLowerCase()

  return { fromEmail, subject, date, snippet: msg.snippet || '', messageId }
}

// ── Main handler ──────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const jsonOk  = (body) => ({ statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const jsonErr = (msg, code = 500) => ({ statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: msg }) })

  if (event.httpMethod === 'GET') {
    return jsonOk({ ok: true, fn: 'gmail-check', gmailConfigured: !!(process.env.GMAIL_REFRESH_TOKEN) })
  }
  if (event.httpMethod !== 'POST') return jsonErr('Method not allowed', 405)

  // ── Validate env ────────────────────────────────────────────────────────────
  const missing = ['GMAIL_CLIENT_ID','GMAIL_CLIENT_SECRET','GMAIL_REFRESH_TOKEN',
                   'VITE_FIREBASE_API_KEY','VITE_FIREBASE_PROJECT_ID']
    .filter(k => !process.env[k])
  if (missing.length) return jsonErr(`Missing env vars: ${missing.join(', ')}`)

  console.log('[gmail-check] ═══ START ═══')
  const t0 = Date.now()

  try {
    // ── 1. Load companies with email from Firestore ─────────────────────────
    const companies = await fsListAll('companies')
    const withEmail = companies.filter(c => {
      const email     = c.get('email')
      const hasReply  = c.get('replyReceived')
      return email && email.includes('@') && !hasReply
    })
    console.log(`[gmail-check] companies with email (no reply yet): ${withEmail.length}`)

    if (!withEmail.length) {
      return jsonOk({ ok: true, checked: 0, newReplies: 0, message: 'No companies to check' })
    }

    // ── 2. Init Gmail ───────────────────────────────────────────────────────
    const auth    = buildOAuth2Client()
    const gmail   = google.gmail({ version: 'v1', auth })

    // ── 3. Search inbox for messages from company emails ────────────────────
    const addresses = withEmail.map(c => c.get('email').toLowerCase())
    const messages  = await searchGmailFrom(gmail, addresses)
    console.log(`[gmail-check] found ${messages.length} matching messages`)

    if (!messages.length) {
      return jsonOk({ ok: true, checked: withEmail.length, newReplies: 0, elapsed: `${((Date.now()-t0)/1000).toFixed(1)}s` })
    }

    // ── 4. Get details + match to companies ─────────────────────────────────
    // Build lookup: email → company
    const emailToCompany = {}
    withEmail.forEach(c => { emailToCompany[c.get('email').toLowerCase()] = c })

    const newReplies = []
    const seenEmails = new Set()

    for (const msg of messages) {
      try {
        const details = await getMessageDetails(gmail, msg.id)
        const company = emailToCompany[details.fromEmail]
        if (!company || seenEmails.has(details.fromEmail)) continue
        seenEmails.add(details.fromEmail)

        const companyName = company.get('name') || company.id
        const now         = new Date().toISOString()
        console.log(`[gmail-check] reply found: ${companyName} ← ${details.fromEmail}`)

        // ── 5a. Update company in Firestore ──────────────────────────────────
        await fsPatch(`companies/${company.id}`, {
          replyReceived:  true,
          replyAt:        now,
          replySnippet:   (details.snippet || '').slice(0, 200),
          replySubject:   details.subject,
          status:         'contacted',     // auto-status change
          updatedAt:      now,
        })

        // ── 5b. Add interaction / audit trail entry ──────────────────────────
        await fsCreate('interactions', {
          companyId:  company.id,
          type:       'reply_received',
          message:    `Prijatá odpoveď emailom od ${details.fromEmail} — "${details.subject}"`,
          createdBy:  'system',
          createdAt:  now,
        })

        newReplies.push({
          companyId:   company.id,
          companyName,
          fromEmail:   details.fromEmail,
          subject:     details.subject,
          snippet:     (details.snippet || '').slice(0, 100),
        })

      } catch (e) {
        console.error('[gmail-check] message detail error:', e.message)
      }
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(`[gmail-check] ═══ DONE | ${newReplies.length} new replies | ${elapsed}s ═══`)

    return jsonOk({
      ok:         true,
      checked:    withEmail.length,
      newReplies: newReplies.length,
      replies:    newReplies,
      elapsed:    `${elapsed}s`,
    })

  } catch (err) {
    console.error('[gmail-check] Fatal:', err.message)
    return jsonErr(err.message)
  }
}

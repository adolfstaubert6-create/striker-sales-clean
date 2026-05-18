/**
 * STRIKER Reply Checker — IONOS IMAP polling
 *
 * Scheduled: every 10 minutes via cron-job.org
 * POST /.netlify/functions/check-replies  (manual trigger)
 * GET  /.netlify/functions/check-replies  (health check)
 *
 * Required env vars:
 *   IONOS_IMAP_HOST        imap.ionos.de
 *   IONOS_IMAP_PORT        993
 *   IONOS_EMAIL            adolf.staubert@striker-energy.de
 *   IONOS_PASSWORD         <mailbox password>
 *   VITE_FIREBASE_API_KEY
 *   VITE_FIREBASE_PROJECT_ID
 */

const { ImapFlow } = require('imapflow')
const { simpleParser } = require('mailparser')

// ── Config ────────────────────────────────────────────────────────────────────
const IMAP_HOST    = process.env.IONOS_IMAP_HOST    || 'imap.ionos.de'
const IMAP_PORT    = parseInt(process.env.IONOS_IMAP_PORT || '993', 10)
const IMAP_USER    = process.env.IONOS_EMAIL
const IMAP_PASS    = process.env.IONOS_PASSWORD
const FB_API_KEY   = process.env.VITE_FIREBASE_API_KEY
const FB_PROJECT   = process.env.VITE_FIREBASE_PROJECT_ID
const FROM_ADDRESS = (IMAP_USER || '').toLowerCase()

// Keywords that indicate high interest
const HIGH_INTEREST_KEYWORDS = [
  'interested', 'interesse', 'interessiert',
  'angebot', 'offer', 'quote', 'preis', 'price',
  'call', 'anruf', 'meeting', 'treffen', 'termin',
  'ja', 'yes', 'gerne', 'gefällt', 'super', 'toll',
  'wann', 'when', 'kosten', 'cost',
]

// ── Firestore REST helpers ────────────────────────────────────────────────────
const FS_BASE = () =>
  `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents`

function toFsVal(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean')        return { booleanValue: v }
  if (typeof v === 'number')         return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'string')         return { stringValue: v }
  if (v instanceof Date)             return { timestampValue: v.toISOString() }
  if (typeof v === 'object')         return { mapValue: { fields: toFsFields(v) } }
  return { stringValue: String(v) }
}

function toFsFields(obj) {
  const f = {}
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) f[k] = toFsVal(v)
  return f
}

function fromFsDoc(doc) {
  const id = doc.name?.split('/').pop()
  function getVal(field) {
    if (!field) return null
    if (field.stringValue  !== undefined) return field.stringValue
    if (field.booleanValue !== undefined) return field.booleanValue
    if (field.integerValue !== undefined) return parseInt(field.integerValue, 10)
    if (field.timestampValue !== undefined) return field.timestampValue
    if (field.mapValue)    return Object.fromEntries(Object.entries(field.mapValue.fields || {}).map(([k, v]) => [k, getVal(v)]))
    return null
  }
  const data = {}
  for (const [k, v] of Object.entries(doc.fields || {})) data[k] = getVal(v)
  return { id, ...data }
}

async function fsQuery(collection, field, value) {
  const url = `${FS_BASE()}/${collection}?key=${FB_API_KEY}&pageSize=500`
  const res  = await fetch(url)
  const data = await res.json()
  return (data.documents || [])
    .map(fromFsDoc)
    .filter(d => !field || d[field] === value)
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

async function fsExists(collection, field, value) {
  const docs = await fsQuery(collection, field, value)
  return docs.length > 0
}

// ── IMAP helpers ──────────────────────────────────────────────────────────────
function buildImapClient() {
  return new ImapFlow({
    host:    IMAP_HOST,
    port:    IMAP_PORT,
    secure:  true,
    auth:    { user: IMAP_USER, pass: IMAP_PASS },
    logger:  false,
    tls:     { rejectUnauthorized: false },
    connectionTimeout: 15000,
    greetingTimeout:   10000,
  })
}

// Extract plain text from parsed mail (fallback chain)
function extractBody(parsed) {
  if (parsed.text) return parsed.text.slice(0, 2000).trim()
  if (parsed.html) {
    return parsed.html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .slice(0, 2000)
      .trim()
  }
  return ''
}

// Detect high-interest keywords in subject + body
function detectHighInterest(subject, body) {
  const text = ((subject || '') + ' ' + (body || '')).toLowerCase()
  return HIGH_INTEREST_KEYWORDS.some(kw => text.includes(kw))
}

// Check if this looks like a reply (Re: prefix or In-Reply-To header)
function isReply(parsed) {
  const subject = parsed.subject || ''
  const inReplyTo = parsed.inReplyTo || ''
  const references = (parsed.references || []).join(' ')
  return (
    /^re:/i.test(subject.trim()) ||
    inReplyTo.length > 0 ||
    references.length > 0
  )
}

// ── Match reply to a company ──────────────────────────────────────────────────
function matchCompanyByEmail(fromAddress, companies) {
  const from = fromAddress.toLowerCase()
  return companies.find(c => {
    const ce = (c.email || '').toLowerCase()
    if (!ce) return false
    // Exact match
    if (from === ce) return true
    // Same domain
    const fromDomain = from.split('@')[1]
    const compDomain = ce.split('@')[1]
    if (fromDomain && compDomain && fromDomain === compDomain) return true
    return false
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function runCheck() {
  if (!IMAP_USER || !IMAP_PASS) throw new Error('IONOS_EMAIL or IONOS_PASSWORD not set')
  if (!FB_API_KEY || !FB_PROJECT)  throw new Error('Firebase env vars not set')

  console.log(`[check-replies] connecting to ${IMAP_HOST}:${IMAP_PORT} as ${IMAP_USER}`)

  // Load all companies with emails
  const companies = await fsQuery('companies')
  const withEmail = companies.filter(c => c.email)
  console.log(`[check-replies] loaded ${companies.length} companies, ${withEmail.length} with email`)

  // Load existing reply message IDs to avoid duplicates
  const existingReplies = await fsQuery('email_replies')
  const knownMessageIds = new Set(existingReplies.map(r => r.messageId).filter(Boolean))
  console.log(`[check-replies] ${knownMessageIds.size} known replies in DB`)

  const client = buildImapClient()
  let newReplies = 0

  try {
    await client.connect()
    console.log('[check-replies] IMAP connected ✓')
  } catch (connErr) {
    // Surface auth / network errors clearly
    const msg = connErr.message || String(connErr)
    const hint = /authenticationfailed|invalid credentials|command failed/i.test(msg)
      ? ' (check IONOS_PASSWORD in Netlify env vars)'
      : /timeout|connect/i.test(msg)
      ? ' (IMAP host unreachable — check IONOS_IMAP_HOST)'
      : ''
    throw new Error(`IMAP connection failed: ${msg}${hint}`)
  }

  try {
    const lock = await client.getMailboxLock('INBOX')
    try {
      // Fetch messages since last 7 days
      const since = new Date()
      since.setDate(since.getDate() - 7)

      const messages = []
      // imapflow fetch API: use source range + fetchOptions
      for await (const msg of client.fetch({ since }, {
        uid:      true,
        envelope: true,
        source:   false,
      })) {
        messages.push(msg)
      }
      console.log(`[check-replies] fetched ${messages.length} messages from last 7 days`)

      for (const msg of messages) {
        try {
          const msgId    = msg.envelope?.messageId || `uid-${msg.uid}`
          const fromAddr = (msg.envelope?.from?.[0]?.address || '').toLowerCase()
          const toAddrs  = (msg.envelope?.to   || []).map(a => (a.address || '').toLowerCase())
          const subject  = msg.envelope?.subject || ''

          if (fromAddr === FROM_ADDRESS) continue
          if (knownMessageIds.has(msgId)) continue
          const toUs = toAddrs.some(a => a === FROM_ADDRESS)
          if (!toUs) continue

          // Reply detection: Re: prefix is sufficient (header fetch removed for stability)
          const looksLikeReply = /^re:/i.test(subject.trim())
          if (!looksLikeReply) continue

          const company = matchCompanyByEmail(fromAddr, withEmail)
          if (!company) {
            console.log(`[check-replies] no match for: ${fromAddr}`)
            continue
          }

          // Download full message for body text
          let bodyText = ''
          try {
            const dl = await client.download(msg.uid, undefined, { uid: true })
            const chunks = []
            for await (const chunk of dl.content) chunks.push(chunk)
            const raw = Buffer.concat(chunks)
            const parsed = await simpleParser(raw)
            bodyText = extractBody(parsed)
          } catch (dlErr) {
            console.warn(`[check-replies] body download failed uid ${msg.uid}:`, dlErr.message)
            bodyText = subject
          }

          const replySnippet = bodyText.slice(0, 120).replace(/\n/g, ' ')
          const highInterest = detectHighInterest(subject, bodyText)
          const replyDate    = msg.envelope?.date || new Date()

          console.log(`[check-replies] reply: ${fromAddr} → ${company.name} | high_interest=${highInterest}`)

          await fsCreate('email_replies', {
            companyId:   company.id,
            companyName: company.name,
            messageId:   msgId,
            fromEmail:   fromAddr,
            subject,
            bodyText:    bodyText.slice(0, 3000),
            snippet:     replySnippet,
            highInterest,
            processedAt: new Date(),
            replyDate:   replyDate instanceof Date ? replyDate : new Date(replyDate),
          })
          knownMessageIds.add(msgId)

          const updateFields = {
            replyReceived: true,
            replySubject:  subject,
            replySnippet,
            replyFrom:     fromAddr,
            lastReplyAt:   replyDate instanceof Date ? replyDate : new Date(replyDate),
            updatedAt:     new Date(),
          }
          if (highInterest) updateFields.highInterest = true
          await fsPatch(`companies/${company.id}`, updateFields)
          newReplies++
          console.log(`[check-replies] ✓ saved reply for ${company.name}`)
        } catch (msgErr) {
          console.error(`[check-replies] msg error uid ${msg.uid}:`, msgErr.message)
        }
      }
    } finally {
      lock.release()
    }
  } finally {
    try { await client.logout() } catch {}
    console.log('[check-replies] IMAP disconnected')
  }

  return { newReplies, companiesChecked: withEmail.length }
}

// ── Netlify handler ───────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true,
        fn: 'check-replies',
        imapHost:    IMAP_HOST,
        imapUser:    IMAP_USER || '(not set)',
        fbConfigured: !!(FB_API_KEY && FB_PROJECT),
        imapConfigured: !!(IMAP_USER && IMAP_PASS),
      }),
    }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const missing = ['IONOS_EMAIL', 'IONOS_PASSWORD', 'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID']
    .filter(k => !process.env[k])
  if (missing.length) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: `Missing env vars: ${missing.join(', ')}` }),
    }
  }

  try {
    const result = await runCheck()
    console.log(`[check-replies] done: ${result.newReplies} new replies`)
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, ...result }),
    }
  } catch (e) {
    console.error('[check-replies] fatal error:', e.message)
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ ok: false, error: e.message }),
    }
  }
}

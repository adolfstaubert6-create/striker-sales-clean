/**
 * STRIKER Reply Checker — IONOS IMAP + 3-layer matching
 *
 * Layer 1 HIGH:   In-Reply-To / References → outbound_emails.messageId
 * Layer 2 MEDIUM: exact fromEmail + normalizedSubject → outbound_emails
 * Layer 3 LOW:    domain match (non-free only) → possible_match flag only
 *
 * POST /.netlify/functions/check-replies  — run check
 * GET  /.netlify/functions/check-replies  — health check
 */

const https            = require('https')
const { ImapFlow }     = require('imapflow')
const { simpleParser } = require('mailparser')

const IMAP_HOST    = process.env.IONOS_IMAP_HOST    || 'imap.ionos.de'
const IMAP_PORT    = parseInt(process.env.IONOS_IMAP_PORT || '993', 10)
const IMAP_USER    = process.env.IONOS_EMAIL
const IMAP_PASS    = process.env.IONOS_PASSWORD
const FB_API_KEY   = process.env.VITE_FIREBASE_API_KEY
const FB_PROJECT   = process.env.VITE_FIREBASE_PROJECT_ID
const FROM_ADDRESS = (IMAP_USER || '').toLowerCase()

// Free email providers — domain matching disabled for these
const FREE_DOMAINS = new Set([
  'gmail.com','yahoo.com','hotmail.com','outlook.com','live.com',
  'aol.com','icloud.com','me.com','mail.com','gmx.com','gmx.de',
  'web.de','t-online.de','yahoo.de','hotmail.de','outlook.de',
  'protonmail.com','proton.me','fastmail.com','zoho.com',
])

const HIGH_INTEREST_KEYWORDS = [
  'interested','interesse','interessiert','angebot','offer','quote',
  'preis','price','call','anruf','meeting','treffen','termin',
  'ja','yes','gerne','gefällt','super','toll','wann','when','kosten','cost',
]

// ── Firestore REST ────────────────────────────────────────────────────────────
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
  function g(field) {
    if (!field) return null
    if (field.stringValue    !== undefined) return field.stringValue
    if (field.booleanValue   !== undefined) return field.booleanValue
    if (field.integerValue   !== undefined) return parseInt(field.integerValue, 10)
    if (field.timestampValue !== undefined) return field.timestampValue
    if (field.mapValue) return Object.fromEntries(
      Object.entries(field.mapValue.fields || {}).map(([k, v]) => [k, g(v)])
    )
    return null
  }
  const data = {}
  for (const [k, v] of Object.entries(doc.fields || {})) data[k] = g(v)
  return { id, ...data }
}
async function fsQuery(col) {
  const res  = await fetch(`${FS_BASE()}/${col}?key=${FB_API_KEY}&pageSize=500`)
  const data = await res.json()
  return (data.documents || []).map(fromFsDoc)
}
async function fsPatch(docPath, data) {
  const mask = Object.keys(data).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
  const res  = await fetch(`${FS_BASE()}/${docPath}?key=${FB_API_KEY}&${mask}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFsFields(data) }),
  })
  return res.json()
}
async function fsCreate(col, data) {
  const res = await fetch(`${FS_BASE()}/${col}?key=${FB_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFsFields(data) }),
  })
  return res.json()
}

// ── Text helpers ──────────────────────────────────────────────────────────────
function normalizeSubject(s) {
  return (s || '')
    .replace(/^(Re|Fwd|Fw|AW|SV|WG|Antw|ENC|RIF|FS|VB|RES|Odp|Trans|Ref|Vs|NA|Svar|Ynt)(\s*:)+\s*/gi, '')
    .replace(/[—–‒―]/g, '-') // normalize em/en dashes to hyphen
    .replace(/\s+/g, ' ').trim().toLowerCase()
}

function extractBody(parsed) {
  if (parsed.text) return parsed.text.slice(0, 2000).trim()
  if (parsed.html) return parsed.html.replace(/<[^>]+>/g,' ').replace(/\s{2,}/g,' ').slice(0,2000).trim()
  return ''
}

function detectHighInterest(subject, body) {
  const text = ((subject||'')+' '+(body||'')).toLowerCase()
  return HIGH_INTEREST_KEYWORDS.some(kw => text.includes(kw))
}

function parseMsgIds(header) {
  if (!header) return []
  return (header.match(/<[^>]+>/g) || []).map(s => s.toLowerCase())
}

// ── AI reply draft generation ────────────────────────────────────────────────
async function callClaude(prompt, maxTokens) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model:      'claude-haiku-4-5',
      max_tokens: maxTokens || 400,
      messages:   [{ role: 'user', content: prompt }],
    })
    const req = https.request({
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'x-api-key': apiKey,
        'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const p = JSON.parse(data)
          if (res.statusCode !== 200) reject(new Error(p.error?.message || `HTTP ${res.statusCode}`))
          else resolve(p.content?.[0]?.text || '')
        } catch(e) { reject(e) }
      })
    })
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Claude timeout')) })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function generateAiReplyDraft(replySnippet, companyName, originalSubject) {
  try {
    const prompt = `Du bist ein professioneller B2B Sales-Assistent für STRIKER Wärmetechnologie.
STRIKER: 45kW Strom → 120-160kW Wärme. Preis: 8.000–10.000 EUR. Für Hotels, Wäschereien, Wellness.

Firma: ${companyName}
Ursprüngliches Email-Thema: ${originalSubject}
Antwort des Kunden:
---
${(replySnippet || '').slice(0, 600)}
---

Schreibe eine kurze, professionelle B2B-Antwort auf Deutsch (Sie-Form, max 120 Wörter).
Nur Email-Text, kein Meta-Kommentar.
Format GENAU so (nichts davor oder danach):
BETREFF: <Betreff>

<Email-Text>`

    const text  = await callClaude(prompt, 400)
    const lines = text.trim().split('\n')
    const sLine = lines.find(l => /^BETREFF:/i.test(l.trim()))
    const subjectDe = sLine ? sLine.replace(/^BETREFF:\s*/i, '').trim() : `Re: ${originalSubject}`
    const after     = sLine ? text.slice(text.indexOf(sLine) + sLine.length) : text
    const bodyDe    = after.replace(/^\s*\n+/, '').trim()
    return { subjectDe, bodyDe }
  } catch (e) {
    console.warn('[check-replies] AI draft failed:', e.message)
    return null
  }
}

// ── IMAP ──────────────────────────────────────────────────────────────────────
function buildImapClient() {
  return new ImapFlow({
    host: IMAP_HOST, port: IMAP_PORT, secure: true,
    auth: { user: IMAP_USER, pass: IMAP_PASS },
    logger: false, tls: { rejectUnauthorized: false },
    connectionTimeout: 15000, greetingTimeout: 10000,
  })
}

// ── 3-layer matching engine ───────────────────────────────────────────────────
function buildOutboundIndexes(outbounds) {
  const byMsgId      = new Map() // messageId (lowercase) → outbound
  const byFingerprint = new Map() // toEmail::normalizedSubject → outbound

  for (const o of outbounds) {
    if (o.messageId) {
      byMsgId.set(o.messageId.toLowerCase(), o)
    }
    if (o.toEmail && o.normalizedSubject !== undefined && o.normalizedSubject !== null) {
      const key = `${o.toEmail.toLowerCase()}::${o.normalizedSubject}`
      byFingerprint.set(key, o)
    }
  }
  return { byMsgId, byFingerprint }
}

function matchReply({ fromAddr, subject, inReplyToIds, referenceIds }, { byMsgId, byFingerprint }, companies) {
  const normSubj = normalizeSubject(subject)

  // ── Layer 1: HIGH — Message-ID thread headers ──────────────────────────────
  const allRefIds = [...inReplyToIds, ...referenceIds]
  for (const id of allRefIds) {
    const o = byMsgId.get(id.toLowerCase())
    if (o) return { confidence: 'high', outbound: o, companyId: o.companyId }
  }

  // ── Layer 2: MEDIUM — exact email + normalized subject ─────────────────────
  const fingerprintKey = `${fromAddr}::${normSubj}`
  const o2 = byFingerprint.get(fingerprintKey)
  if (o2) return { confidence: 'medium', outbound: o2, companyId: o2.companyId }

  // ── Layer 2b: MEDIUM — exact email match (subject normalization fallback) ──
  // Catches cases where em-dash or encoding differs between stored and received
  const o2b = companies.find(c => {
    if (!c.email) return false
    if (FREE_DOMAINS.has(fromAddr.split('@')[1])) return false // still block free for company match
    return c.email.toLowerCase() === fromAddr
  })
  // For free-domain senders (gmail etc), only match via outbound toEmail
  const o2bOut = !o2b ? null : null // skip company-only match for free domains
  // Looser: find outbound record where toEmail === fromAddr
  const o2c = [...byFingerprint.values()].find(o => o.toEmail?.toLowerCase() === fromAddr)
  if (o2c) {
    console.log(`[check-replies] Layer 2b hit: toEmail match ${fromAddr}, normSubj mismatch. stored="${o2c.normalizedSubject}" incoming="${normSubj}"`)
    return { confidence: 'medium', outbound: o2c, companyId: o2c.companyId }
  }

  // ── Layer 3: LOW — domain match (non-free domains only) ───────────────────
  const fromDomain = fromAddr.split('@')[1]
  if (fromDomain && !FREE_DOMAINS.has(fromDomain)) {
    const domainMatch = companies.find(c => {
      const cd = (c.email || '').split('@')[1]?.toLowerCase()
      return cd && cd === fromDomain
    })
    if (domainMatch) {
      return { confidence: 'low', outbound: null, companyId: domainMatch.id }
    }
  }

  return null
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function runCheck() {
  if (!IMAP_USER || !IMAP_PASS)   throw new Error('IONOS_EMAIL or IONOS_PASSWORD not set')
  if (!FB_API_KEY || !FB_PROJECT) throw new Error('Firebase env vars not set')

  console.log(`[check-replies] connecting to ${IMAP_HOST}:${IMAP_PORT} as ${IMAP_USER}`)

  // Load data from Firestore
  const [companies, existingReplies, outbounds] = await Promise.all([
    fsQuery('companies'),
    fsQuery('email_replies'),
    fsQuery('outbound_emails'),
  ])

  const withEmail     = companies.filter(c => c.email)
  const knownMsgIds   = new Set(existingReplies.map(r => r.messageId).filter(Boolean))
  const { byMsgId, byFingerprint } = buildOutboundIndexes(outbounds)

  console.log(`[check-replies] ${withEmail.length} companies | ${outbounds.length} outbound records | ${knownMsgIds.size} known replies`)

  const client = buildImapClient()
  let newReplies = 0, lowConfidence = 0, messagesScanned = 0

  try {
    await client.connect()
    console.log('[check-replies] IMAP connected ✓')
  } catch (connErr) {
    const msg  = connErr.message || String(connErr)
    const hint = /authenticationfailed|command failed/i.test(msg) ? ' (check IONOS_PASSWORD)' : ''
    throw new Error(`IMAP connection failed: ${msg}${hint}`)
  }

  try {
    const lock = await client.getMailboxLock('INBOX')
    try {
      const since = new Date()
      since.setDate(since.getDate() - 30)

      const messages = []
      for await (const msg of client.fetch({ since }, {
        uid: true, envelope: true, headers: true, flags: true,
      })) {
        messages.push(msg)
      }
      messagesScanned = messages.length
      console.log(`[check-replies] ${messages.length} messages fetched (last 30 days)`)

      for (const msg of messages) {
        try {
          const msgId    = (msg.envelope?.messageId || `uid-${msg.uid}`).toLowerCase()
          const fromAddr = (msg.envelope?.from?.[0]?.address || '').toLowerCase()
          const toAddrs  = (msg.envelope?.to || []).map(a => (a.address||'').toLowerCase())
          const subject  = msg.envelope?.subject || ''

          if (fromAddr === FROM_ADDRESS) { console.log(`[check-replies] skip self: ${msgId}`); continue }
          if (knownMsgIds.has(msgId))   { console.log(`[check-replies] skip known: ${msgId}`); continue }
          if (!toAddrs.some(a => a === FROM_ADDRESS)) { console.log(`[check-replies] skip wrong-to: from=${fromAddr} to=${toAddrs.join(',')}`); continue }

          // Parse threading headers
          const inReplyToRaw  = msg.headers?.get('in-reply-to') || ''
          const referencesRaw = msg.headers?.get('references')  || ''
          const inReplyToIds  = parseMsgIds(inReplyToRaw)
          const referenceIds  = parseMsgIds(referencesRaw)

          // Need Re: OR threading headers to consider as reply
          const looksLikeReply = /^re:/i.test(subject.trim()) || inReplyToIds.length > 0 || referenceIds.length > 0
          if (!looksLikeReply) { console.log(`[check-replies] skip not-reply: from=${fromAddr} subj="${subject.slice(0,40)}"`); continue }

          // Run 3-layer matching
          const match = matchReply(
            { fromAddr, subject, inReplyToIds, referenceIds },
            { byMsgId, byFingerprint },
            withEmail
          )

          if (!match) {
            console.log(`[check-replies] no match (${fromAddr}) — subject: "${subject.slice(0,50)}"`)
            continue
          }

          console.log(`[check-replies] match confidence=${match.confidence} | from=${fromAddr} | companyId=${match.companyId}`)

          // LOW confidence: save to DB with flag, do NOT update company
          if (match.confidence === 'low') {
            lowConfidence++
            await fsCreate('email_replies', {
              companyId:       match.companyId,
              messageId:       msgId,
              fromEmail:       fromAddr,
              subject,
              matchConfidence: 'low',
              possibleMatch:   true,
              processedAt:     new Date(),
              replyDate:       msg.envelope?.date || new Date(),
            })
            knownMsgIds.add(msgId)
            console.log(`[check-replies] LOW confidence saved (not updating company)`)
            continue
          }

          // HIGH / MEDIUM: fetch full body + save everything
          let bodyText = ''
          try {
            const dl = await client.download(msg.uid, undefined, { uid: true })
            const chunks = []
            for await (const chunk of dl.content) chunks.push(chunk)
            const parsed = await simpleParser(Buffer.concat(chunks))
            bodyText = extractBody(parsed)
          } catch (dlErr) {
            console.warn(`[check-replies] body download failed uid ${msg.uid}:`, dlErr.message)
            bodyText = subject
          }

          const replySnippet = bodyText.slice(0, 120).replace(/\n/g, ' ')
          const highInterest = detectHighInterest(subject, bodyText)
          const replyDate    = msg.envelope?.date || new Date()
          const company      = companies.find(c => c.id === match.companyId)

          const newDoc = await fsCreate('email_replies', {
            companyId:       match.companyId,
            companyName:     company?.name || null,
            messageId:       msgId,
            fromEmail:       fromAddr,
            subject,
            normalizedSubject: normalizeSubject(subject),
            bodyText:        bodyText.slice(0, 3000),
            snippet:         replySnippet,
            highInterest,
            matchConfidence: match.confidence,
            outboundMsgId:   match.outbound?.messageId || null,
            processedAt:     new Date(),
            replyDate:       replyDate instanceof Date ? replyDate : new Date(replyDate),
          })
          knownMsgIds.add(msgId)

          const companyUpdate = {
            replyReceived: true,
            replySubject:  subject,
            replySnippet,
            replyFrom:     fromAddr,
            lastReplyAt:   replyDate instanceof Date ? replyDate : new Date(replyDate),
            updatedAt:     new Date(),
          }
          if (highInterest) companyUpdate.highInterest = true

          await fsPatch(`companies/${match.companyId}`, companyUpdate)

          // Generate AI reply draft and save back to the reply doc
          const newDocId = newDoc?.name?.split('/').pop()
          if (newDocId) {
            const aiDraft = await generateAiReplyDraft(replySnippet, company?.name || companyName || '', subject)
            if (aiDraft) {
              await fsPatch(`email_replies/${newDocId}`, {
                aiDraftSubject: aiDraft.subjectDe,
                aiDraftBody:    aiDraft.bodyDe,
                aiDraftStatus:  'pending',
              })
              console.log(`[check-replies] ✓ AI draft generated for ${company?.name}`)
            }
          }

          newReplies++
          console.log(`[check-replies] ✓ ${match.confidence.toUpperCase()} match → ${company?.name || match.companyId} | high_interest=${highInterest}`)
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

  return { newReplies, lowConfidenceSkipped: lowConfidence, companiesChecked: withEmail.length, outboundRecords: outbounds.length, messagesScanned }
}

// ── Netlify handler ───────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

  if (event.httpMethod === 'GET') {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({
      ok: true, fn: 'check-replies',
      imapHost: IMAP_HOST, imapUser: IMAP_USER || '(not set)',
      fbConfigured: !!(FB_API_KEY && FB_PROJECT),
      imapConfigured: !!(IMAP_USER && IMAP_PASS),
    })}
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const missing = ['IONOS_EMAIL','IONOS_PASSWORD','VITE_FIREBASE_API_KEY','VITE_FIREBASE_PROJECT_ID'].filter(k => !process.env[k])
  if (missing.length) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: `Missing env: ${missing.join(', ')}` }) }

  try {
    const result = await runCheck()
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, ...result }) }
  } catch (e) {
    console.error('[check-replies] fatal:', e.message)
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ ok: false, error: e.message }) }
  }
}

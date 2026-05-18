/**
 * STRIKER Reply Checker — IONOS IMAP + 3-layer matching
 * DEBUG MODE: full diagnostics returned in response JSON
 *
 * Layer 1 HIGH:   In-Reply-To / References → outbound_emails.messageId
 * Layer 2 MEDIUM: exact fromEmail + normalizedSubject → outbound_emails
 * Layer 2b MEDIUM: exact fromEmail == outbound.toEmail (subject fallback)
 * Layer 3 LOW:    domain match (non-free only) → possible_match flag only
 */

const https            = require('https')
const { ImapFlow }     = require('imapflow')
const { simpleParser } = require('mailparser')

const IMAP_HOST    = process.env.IONOS_IMAP_HOST || 'imap.ionos.de'
const IMAP_PORT    = parseInt(process.env.IONOS_IMAP_PORT || '993', 10)
const IMAP_USER    = process.env.IONOS_EMAIL
const IMAP_PASS    = process.env.IONOS_PASSWORD
const FB_API_KEY   = process.env.VITE_FIREBASE_API_KEY
const FB_PROJECT   = process.env.VITE_FIREBASE_PROJECT_ID
const FROM_ADDRESS = (IMAP_USER || '').toLowerCase()

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
    .replace(/[—–‒―]/g, '-')
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
  const str = Array.isArray(header) ? header.join(' ') : String(header)
  return (str.match(/<[^>]+>/g) || []).map(s => s.toLowerCase())
}

// ── AI reply draft ────────────────────────────────────────────────────────────
async function callClaude(prompt, maxTokens) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-haiku-4-5', max_tokens: maxTokens || 400,
      messages: [{ role: 'user', content: prompt }],
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

async function generateAiAnalysis(replySnippet, companyName, originalSubject) {
  try {
    const prompt = `Si asistent pre B2B sales tím STRIKER (interné použitie, slovenčina).
STRIKER: tepelné čerpadlá 45kW → 120-160kW tepla. Cena: 8.000-10.000 EUR. Pre hotely, práčovne, wellness.

Firma: ${companyName}
Predmet emailu: ${originalSubject}
Zákazník napísal:
---
${(replySnippet || '').slice(0, 600)}
---

Odpovedz PRESNE v tomto formáte (nič iné, žiadny úvod ani záver):
ZHRNUTIE: <1-2 vety čo zákazník chce alebo píše>
ZÁMER: <jedno z: záujem | otázka | neutrálne | odmietnutie>
PREDMET_SK: <predmet odpovede po slovensky>

<text odpovede po slovensky, 3-5 viet, profesionálny tón, vykanie, bez formálnych pozdravov>`

    const text = await callClaude(prompt, 500)

    const summaryMatch = text.match(/^ZHRNUTIE:\s*(.+)$/m)
    const intentMatch  = text.match(/^ZÁMER:\s*(.+)$/m)
    const subjectMatch = text.match(/^PREDMET_SK:\s*(.+)$/m)

    const aiSummary      = summaryMatch ? summaryMatch[1].trim() : ''
    const aiIntent       = intentMatch  ? intentMatch[1].trim()  : 'neutrálne'
    const aiDraftSkSubject = subjectMatch ? subjectMatch[1].trim() : `Re: ${originalSubject}`

    // Body = everything after the last header line
    const lastHeaderIdx = Math.max(
      text.lastIndexOf('ZHRNUTIE:'),
      text.lastIndexOf('ZÁMER:'),
      text.lastIndexOf('PREDMET_SK:'),
    )
    const afterHeaders = lastHeaderIdx >= 0
      ? text.slice(text.indexOf('\n', lastHeaderIdx) + 1)
      : text
    const aiDraftSkBody = afterHeaders.replace(/^\s*\n+/, '').trim()

    return { aiSummary, aiIntent, aiDraftSkSubject, aiDraftSkBody }
  } catch (e) {
    console.warn('[check-replies] AI analysis failed:', e.message)
    return null
  }
}

// ── IMAP client ───────────────────────────────────────────────────────────────
function buildImapClient() {
  return new ImapFlow({
    host: IMAP_HOST, port: IMAP_PORT, secure: true,
    auth: { user: IMAP_USER, pass: IMAP_PASS },
    logger: false, tls: { rejectUnauthorized: false },
    connectionTimeout: 15000, greetingTimeout: 10000,
  })
}

// ── 3-layer matching engine ───────────────────────────────────────────────────
function buildOutboundIndexes(outbounds, companies) {
  const byMsgId       = new Map()
  const byFingerprint = new Map()
  const byToEmail     = new Map()

  // Build a set of valid (non-ghost) companyIds — companies that have name + email
  const validCompanyIds = new Set(
    (companies || []).filter(c => c.name && c.email).map(c => c.id)
  )

  // Sort: valid companyId outbounds first, so they win when multiple share same key
  const sorted = [...outbounds].sort((a, b) => {
    const aValid = validCompanyIds.has(a.companyId) ? 1 : 0
    const bValid = validCompanyIds.has(b.companyId) ? 1 : 0
    return aValid - bValid // valid entries overwrite ghost entries
  })

  for (const o of sorted) {
    if (o.messageId) {
      byMsgId.set(o.messageId.toLowerCase(), o)
    }
    if (o.toEmail) {
      const normStored = (o.normalizedSubject || '').replace(/[—–‒―]/g, '-')
      const key = `${o.toEmail.toLowerCase()}::${normStored}`
      byFingerprint.set(key, o)
      byToEmail.set(o.toEmail.toLowerCase(), o)
    }
  }
  return { byMsgId, byFingerprint, byToEmail }
}

function matchReplyDebug({ fromAddr, subject, inReplyToIds, referenceIds }, { byMsgId, byFingerprint, byToEmail }, companies) {
  const normSubj  = normalizeSubject(subject)
  const debugInfo = { normSubj, layer1: null, layer2: null, layer2b: null, layer3: null }

  // Layer 1: HIGH — In-Reply-To / References
  const allRefIds = [...inReplyToIds, ...referenceIds]
  debugInfo.layer1 = { checked: allRefIds, result: null }
  for (const id of allRefIds) {
    const o = byMsgId.get(id.toLowerCase())
    if (o) {
      debugInfo.layer1.result = `HIT: matched messageId ${id}`
      return { confidence: 'high', outbound: o, companyId: o.companyId, debug: debugInfo }
    }
  }
  debugInfo.layer1.result = allRefIds.length === 0 ? 'SKIP: no In-Reply-To/References headers' : `MISS: ${allRefIds.length} ids checked, none in outbound index`

  // Layer 2: MEDIUM — exact email + normalized subject
  const fpKey = `${fromAddr}::${normSubj}`
  debugInfo.layer2 = { key: fpKey, result: null }
  const o2 = byFingerprint.get(fpKey)
  if (o2) {
    debugInfo.layer2.result = `HIT: exact fingerprint match`
    return { confidence: 'medium', outbound: o2, companyId: o2.companyId, debug: debugInfo }
  }
  // Show what keys ARE in the index for this fromAddr for debugging
  const candidateKeys = [...byFingerprint.keys()].filter(k => k.startsWith(fromAddr + '::'))
  debugInfo.layer2.result = `MISS: key not found. Outbound keys for this email: [${candidateKeys.join(' | ')}]`

  // Layer 2b: MEDIUM — exact toEmail match (subject encoding fallback)
  debugInfo.layer2b = { fromAddr, result: null }
  const o2b = byToEmail.get(fromAddr)
  if (o2b) {
    debugInfo.layer2b.result = `HIT: toEmail match. stored normalizedSubject="${o2b.normalizedSubject}" incoming normSubj="${normSubj}"`
    console.log(`[check-replies] Layer 2b hit: ${fromAddr} stored="${o2b.normalizedSubject}" incoming="${normSubj}"`)
    return { confidence: 'medium', outbound: o2b, companyId: o2b.companyId, debug: debugInfo }
  }
  debugInfo.layer2b.result = `MISS: no outbound record with toEmail=${fromAddr}`

  // Layer 3: LOW — domain match (non-free only)
  const fromDomain = fromAddr.split('@')[1]
  debugInfo.layer3 = { fromDomain, isFree: FREE_DOMAINS.has(fromDomain), result: null }
  if (fromDomain && !FREE_DOMAINS.has(fromDomain)) {
    const domainMatch = companies.find(c => {
      const cd = (c.email || '').split('@')[1]?.toLowerCase()
      return cd && cd === fromDomain
    })
    if (domainMatch) {
      debugInfo.layer3.result = `HIT: domain match company=${domainMatch.name || domainMatch.id}`
      return { confidence: 'low', outbound: null, companyId: domainMatch.id, debug: debugInfo }
    }
    debugInfo.layer3.result = `MISS: domain ${fromDomain} not found in company emails`
  } else {
    debugInfo.layer3.result = `SKIP: free domain ${fromDomain}`
  }

  return { confidence: null, outbound: null, companyId: null, debug: debugInfo }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function runCheck() {
  if (!IMAP_USER || !IMAP_PASS)   throw new Error('IONOS_EMAIL or IONOS_PASSWORD not set')
  if (!FB_API_KEY || !FB_PROJECT) throw new Error('Firebase env vars not set')

  console.log(`[check-replies] connecting to ${IMAP_HOST}:${IMAP_PORT} as ${IMAP_USER}`)

  const [companies, existingReplies, outbounds] = await Promise.all([
    fsQuery('companies'),
    fsQuery('email_replies'),
    fsQuery('outbound_emails'),
  ])

  const withEmail   = companies.filter(c => c.email)
  const knownMsgIds = new Set(existingReplies.map(r => r.messageId).filter(Boolean))
  const indexes     = buildOutboundIndexes(outbounds, companies)

  console.log(`[check-replies] companies_with_email=${withEmail.length} outbound=${outbounds.length} known_replies=${knownMsgIds.size}`)
  console.log(`[check-replies] outbound toEmails: ${[...indexes.byToEmail.keys()].join(', ')}`)

  const client = buildImapClient()
  let foldersFound  = []
  let mailboxUsed   = 'INBOX'
  let newReplies    = 0
  let lowConfidence = 0

  // IMAP connect
  try {
    await client.connect()
    console.log(`[check-replies] IMAP connected ✓ account=${IMAP_USER}`)
  } catch (connErr) {
    const msg  = connErr.message || String(connErr)
    const hint = /authenticationfailed|command failed/i.test(msg) ? ' (check IONOS_PASSWORD)' : ''
    throw new Error(`IMAP connection failed: ${msg}${hint}`)
  }

  // List folders
  try {
    for await (const mailbox of client.list()) {
      foldersFound.push(mailbox.path)
    }
    console.log(`[check-replies] folders: ${foldersFound.join(', ')}`)
  } catch (listErr) {
    console.warn('[check-replies] folder list failed:', listErr.message)
  }

  // Scan INBOX
  const scannedSubjects = []
  const scannedFrom     = []
  const scannedDates    = []
  const debugMatches    = []
  const skipReasons     = []

  try {
    const lock = await client.getMailboxLock('INBOX')
    try {
      const since = new Date()
      since.setDate(since.getDate() - 30)
      console.log(`[check-replies] fetching INBOX since ${since.toISOString()}`)

      const messages = []
      for await (const msg of client.fetch({ since }, {
        uid: true, envelope: true, flags: true,
      })) {
        messages.push(msg)
      }

      console.log(`[check-replies] ${messages.length} messages in INBOX (last 30 days)`)

      if (messages.length === 0) {
        console.warn(`[check-replies] IMAP connected but no messages found in INBOX since ${since.toDateString()}`)
      }

      for (const msg of messages) {
        try {
          const msgId    = (msg.envelope?.messageId || `uid-${msg.uid}`).toLowerCase()
          const fromAddr = (msg.envelope?.from?.[0]?.address || '').toLowerCase()
          const toAddrs  = (msg.envelope?.to || []).map(a => (a.address||'').toLowerCase())
          const subject  = msg.envelope?.subject || ''
          const date     = msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : null
          const flags    = [...(msg.flags || [])]

          // Record this message immediately before any parsing that could throw
          scannedSubjects.push(subject.slice(0, 80))
          scannedFrom.push(fromAddr)
          scannedDates.push(date)

          console.log(`[check-replies] msg uid=${msg.uid} from=${fromAddr} subj="${subject.slice(0,50)}" date=${date}`)

          // Layer 1 (In-Reply-To) disabled: Resend overwrites Message-ID with SES ID
          // so our stored messageId never matches. Detection via Re: prefix only.
          const inReplyToIds = []
          const referenceIds = []

          const msgDebug = {
            uid: msg.uid,
            folder: 'INBOX',
            from: fromAddr,
            to: toAddrs,
            subject,
            normalizedSubject: normalizeSubject(subject),
            messageId: msgId,
            inReplyTo: inReplyToIds,
            references: referenceIds,
            date,
            flags,
          }

          // Skip checks
          if (fromAddr === FROM_ADDRESS) {
            skipReasons.push({ uid: msg.uid, from: fromAddr, subject: subject.slice(0,50), reason: 'self: from == our address' })
            console.log(`[check-replies] skip self uid=${msg.uid}`)
            continue
          }
          if (knownMsgIds.has(msgId)) {
            skipReasons.push({ uid: msg.uid, from: fromAddr, subject: subject.slice(0,50), reason: 'already processed (knownMsgIds)' })
            console.log(`[check-replies] skip known uid=${msg.uid}`)
            continue
          }
          if (!toAddrs.some(a => a === FROM_ADDRESS)) {
            skipReasons.push({ uid: msg.uid, from: fromAddr, to: toAddrs, subject: subject.slice(0,50), reason: `wrong-to: none of [${toAddrs.join(',')}] == ${FROM_ADDRESS}` })
            console.log(`[check-replies] skip wrong-to uid=${msg.uid} to=[${toAddrs.join(',')}]`)
            continue
          }

          const looksLikeReply = /^re:/i.test(subject.trim()) || inReplyToIds.length > 0 || referenceIds.length > 0
          if (!looksLikeReply) {
            skipReasons.push({ uid: msg.uid, from: fromAddr, subject: subject.slice(0,50), reason: 'not-reply: no Re: prefix and no In-Reply-To/References headers' })
            console.log(`[check-replies] skip not-reply uid=${msg.uid} subj="${subject.slice(0,40)}"`)
            continue
          }

          // Run matching
          const matchResult = matchReplyDebug(
            { fromAddr, subject, inReplyToIds, referenceIds },
            indexes,
            withEmail
          )

          debugMatches.push({ ...msgDebug, matchConfidence: matchResult.confidence, matchDebug: matchResult.debug })

          if (!matchResult.confidence) {
            skipReasons.push({ uid: msg.uid, from: fromAddr, subject: subject.slice(0,50), reason: 'no-match: all 3 layers failed', debug: matchResult.debug })
            console.log(`[check-replies] no match uid=${msg.uid} from=${fromAddr}`)
            continue
          }

          console.log(`[check-replies] MATCH confidence=${matchResult.confidence} uid=${msg.uid} from=${fromAddr} companyId=${matchResult.companyId}`)

          if (matchResult.confidence === 'low') {
            lowConfidence++
            await fsCreate('email_replies', {
              companyId:       matchResult.companyId,
              messageId:       msgId,
              fromEmail:       fromAddr,
              subject,
              matchConfidence: 'low',
              possibleMatch:   true,
              processedAt:     new Date(),
              replyDate:       msg.envelope?.date || new Date(),
            })
            knownMsgIds.add(msgId)
            continue
          }

          // HIGH / MEDIUM — download body
          let bodyText = ''
          try {
            const dl = await client.download(msg.uid, undefined, { uid: true })
            const chunks = []
            for await (const chunk of dl.content) chunks.push(chunk)
            const parsed = await simpleParser(Buffer.concat(chunks))
            bodyText = extractBody(parsed)
          } catch (dlErr) {
            console.warn(`[check-replies] body download failed uid=${msg.uid}:`, dlErr.message)
            bodyText = subject
          }

          const replySnippet = bodyText.slice(0, 120).replace(/\n/g, ' ')
          const highInterest = detectHighInterest(subject, bodyText)
          const replyDate    = msg.envelope?.date || new Date()
          const company      = companies.find(c => c.id === matchResult.companyId)

          const newDoc = await fsCreate('email_replies', {
            companyId:         matchResult.companyId,
            companyName:       company?.name || null,
            messageId:         msgId,
            fromEmail:         fromAddr,
            subject,
            normalizedSubject: normalizeSubject(subject),
            bodyText:          bodyText.slice(0, 3000),
            snippet:           replySnippet,
            highInterest,
            matchConfidence:   matchResult.confidence,
            outboundMsgId:     matchResult.outbound?.messageId || null,
            processedAt:       new Date(),
            replyDate:         replyDate instanceof Date ? replyDate : new Date(replyDate),
          })
          knownMsgIds.add(msgId)

          await fsPatch(`companies/${matchResult.companyId}`, {
            replyReceived: true,
            replySubject:  subject,
            replySnippet,
            replyFrom:     fromAddr,
            lastReplyAt:   replyDate instanceof Date ? replyDate : new Date(replyDate),
            updatedAt:     new Date(),
            ...(highInterest ? { highInterest: true } : {}),
          })

          const newDocId = newDoc?.name?.split('/').pop()
          if (newDocId) {
            const analysis = await generateAiAnalysis(replySnippet, company?.name || '', subject)
            if (analysis) {
              await fsPatch(`email_replies/${newDocId}`, {
                aiSummary:        analysis.aiSummary,
                aiIntent:         analysis.aiIntent,
                aiDraftSkSubject: analysis.aiDraftSkSubject,
                aiDraftSkBody:    analysis.aiDraftSkBody,
                aiDraftStatus:    'pending_sk',
              })
              console.log(`[check-replies] ✓ AI analysis (SK) for ${company?.name || matchResult.companyId} | intent=${analysis.aiIntent}`)
            }
          }

          newReplies++
          console.log(`[check-replies] ✓ SAVED ${matchResult.confidence.toUpperCase()} → ${company?.name || matchResult.companyId} highInterest=${highInterest}`)
        } catch (msgErr) {
          console.error(`[check-replies] msg error uid=${msg.uid}:`, msgErr.message)
          skipReasons.push({ uid: msg.uid, reason: `EXCEPTION: ${msgErr.message}`, stack: msgErr.stack?.split('\n').slice(0,3).join(' | ') })
        }
      }

      return {
        ok:               true,
        mailboxUsed,
        foldersFound,
        messagesScanned:  messages.length,
        outboundRecords:  outbounds.length,
        companiesChecked: withEmail.length,
        newReplies,
        lowConfidenceSkipped: lowConfidence,
        scannedFrom,
        scannedSubjects,
        scannedDates,
        debugMatches,
        skipReasons,
        outboundToEmails: [...indexes.byToEmail.keys()],
        imapAccount:      IMAP_USER,
        sinceDate:        since.toISOString(),
      }
    } finally {
      lock.release()
    }
  } finally {
    try { await client.logout() } catch {}
    console.log('[check-replies] IMAP disconnected')
  }
}

// ── Netlify handler ───────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

  if (event.httpMethod === 'GET') {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({
      ok: true, fn: 'check-replies',
      imapHost: IMAP_HOST, imapUser: IMAP_USER || '(not set)',
      fbConfigured:   !!(FB_API_KEY && FB_PROJECT),
      imapConfigured: !!(IMAP_USER && IMAP_PASS),
    })}
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const missing = ['IONOS_EMAIL','IONOS_PASSWORD','VITE_FIREBASE_API_KEY','VITE_FIREBASE_PROJECT_ID']
    .filter(k => !process.env[k])
  if (missing.length) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: `Missing env: ${missing.join(', ')}` }) }
  }

  try {
    const result = await runCheck()
    return { statusCode: 200, headers: CORS, body: JSON.stringify(result) }
  } catch (e) {
    console.error('[check-replies] fatal:', e.message)
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ ok: false, error: e.message }) }
  }
}

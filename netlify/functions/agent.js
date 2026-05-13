/**
 * STRIKER Autonomous Sales Agent — 5-step pipeline
 *
 * POST  /.netlify/functions/agent
 * Body: { segment: "hotel"|"laundry"|"spa"|"hospital"|"restaurant",
 *         locality: "München",
 *         count: 5 }
 *
 * NOTE: Each company requires ~4 AI calls + 1 web scrape.
 * For count > 3 deploy as a Netlify Background Function (26 min timeout).
 * Set function timeout in netlify.toml: [functions] timeout = 900
 *
 * Required env vars:
 *   GOOGLE_PLACES_API_KEY
 *   ANTHROPIC_API_KEY
 *   VITE_FIREBASE_API_KEY      (same key used by frontend)
 *   VITE_FIREBASE_PROJECT_ID
 */

// ── Env ───────────────────────────────────────────────────────────────────────
const GOOGLE_KEY    = process.env.GOOGLE_PLACES_API_KEY
const CLAUDE_KEY    = process.env.ANTHROPIC_API_KEY
const FB_API_KEY    = process.env.VITE_FIREBASE_API_KEY
const FB_PROJECT    = process.env.VITE_FIREBASE_PROJECT_ID
const CLAUDE_MODEL  = 'claude-sonnet-4-6'

const PLACES_MASK   = [
  'places.id', 'places.displayName', 'places.formattedAddress',
  'places.location', 'places.rating', 'places.nationalPhoneNumber', 'places.websiteUri',
].join(',')

const CATEGORY_QUERIES = {
  hotel: 'hotels', laundry: 'laundry service', spa: 'wellness spa',
  hospital: 'hospital', restaurant: 'restaurants',
}

// ── Firestore REST helpers ────────────────────────────────────────────────────
const FS_BASE = () => `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents`

function toFsVal(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean')        return { booleanValue: v }
  if (typeof v === 'number')         return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'string')         return { stringValue: v }
  if (Array.isArray(v))              return { arrayValue: { values: v.map(toFsVal) } }
  if (typeof v === 'object')         return { mapValue: { fields: toFsFields(v) } }
  return { stringValue: String(v) }
}

function toFsFields(obj) {
  const f = {}
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) f[k] = toFsVal(v)
  return f
}

async function fsQuery(collectionId, fieldPath, value) {
  const url = `${FS_BASE()}:runQuery?key=${FB_API_KEY}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from:  [{ collectionId }],
        where: { fieldFilter: { field: { fieldPath }, op: 'EQUAL', value: toFsVal(value) } },
        limit: 1,
      },
    }),
  })
  const rows = await res.json()
  return Array.isArray(rows) ? rows.filter(r => r.document) : []
}

async function fsCreate(collectionId, data) {
  const res = await fetch(`${FS_BASE()}/${collectionId}?key=${FB_API_KEY}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields: toFsFields(data) }),
  })
  return res.json()
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

// ── Email scraper ─────────────────────────────────────────────────────────────
const EMAIL_RE   = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const EMAIL_SKIP = [/noreply/i, /no-reply/i, /example/i, /@sentry/i, /@google/i, /\.(png|jpg|gif|svg)$/i]

async function scrapeEmail(website) {
  if (!website) return null
  const base     = website.startsWith('http') ? website.replace(/\/$/, '') : `https://${website.replace(/\/$/, '')}`
  const urls     = [`${base}/impressum`, `${base}/kontakt`, `${base}/contact`, base]
  const deadline = Date.now() + 8000

  for (const url of urls) {
    if (Date.now() >= deadline) break
    const ctrl = new AbortController()
    const t    = setTimeout(() => ctrl.abort(), Math.min(deadline - Date.now(), 4000))
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } })
      clearTimeout(t)
      if (!res.ok) continue
      const html   = await res.text()
      const emails = [...(html.match(EMAIL_RE) || [])].filter(e => !EMAIL_SKIP.some(p => p.test(e)))
      if (emails.length) { console.log(`[agent] email scraped: ${emails[0]} from ${url}`); return emails[0] }
    } catch { clearTimeout(t) }
  }
  return null
}

// ── BPS scoring (ported from calculateBusinessScore.js) ───────────────────────
function calcBPS(company) {
  const name     = (company.name    || '').toLowerCase()
  const location = ((company.address || '') + ' ' + (company.city || '')).toLowerCase()
  const category = (company.category || 'hotel').toLowerCase()
  const rating   = typeof company.rating === 'number' ? company.rating : null
  const BASE     = { hotel: 30, laundry: 45, spa: 40, wellness: 40, hospital: 30, restaurant: 30 }

  let score      = BASE[category] ?? 30
  const positive = []
  const risks    = []

  if (/wellness|spa\b|therme|thermal|kúpele/i.test(name))          { score += 20; positive.push('Wellness/SPA') }
  if (/\bpool\b|schwimmbad|hallenbad/i.test(name))                  { score += 15; positive.push('Bazén') }
  if (/sauna/i.test(name))                                           { score += 10; positive.push('Sauna') }
  if (/grand|palace|luxury|luxus|premium|5-stern/i.test(name))      { score += 12; positive.push('Luxus') }
  if (/resort|feriendorf/i.test(name))                               { score += 10; positive.push('Resort') }
  if (/arlberg|alpen|allgäu|tirol|schwarzwald|ski/i.test(location)) { score += 15; positive.push('Horská/lyžiarska oblasť') }
  if (/bad\s+[a-záäöü]/i.test(location))                            { score += 12; positive.push('Kúpeľné mesto') }
  if (CATEGORY_QUERIES[category] === 'laundry service')              { /* base already 45 */ }

  if (rating !== null) {
    if      (rating >= 4.5) { score += 15; positive.push(`Rating ${rating}★`) }
    else if (rating >= 4.0) { score += 10; positive.push(`Rating ${rating}★`) }
    else if (rating >= 3.5) { score +=  5; positive.push(`Rating ${rating}★`) }
    else                    { score -= 10; risks.push(`Nízky rating ${rating}★`) }
  }

  if (company.website) { score += 10; positive.push('Web') } else { score -= 7; risks.push('Bez webu') }
  if (company.email)   { score += 15; positive.push('Email dostupný') }
  if (company.phone)   { score +=  5; positive.push('Telefón') }

  score = Math.min(100, Math.max(0, score))
  const confidence = score >= 70 ? 'vysoká' : score >= 50 ? 'stredná' : 'nízka'
  const reason     =
    score >= 70 ? `Vysoký potenciál — ${positive.slice(0, 2).join(', ')}` :
    score >= 50 ? `Stredný potenciál — ${positive.slice(0, 2).join(', ') || 'obmedzené dáta'}` :
                  `Nízky potenciál — ${risks[0] || 'málo dostupných údajov'}`

  return { score, reason, positive, risks, confidence }
}

// ── Claude caller ─────────────────────────────────────────────────────────────
async function claude(prompt, maxTokens = 600) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01' },
    body:    JSON.stringify({ model: CLAUDE_MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Claude API: ${data.error?.message || res.status}`)
  return data.content?.[0]?.text || ''
}

// ── STEP 1: Search ────────────────────────────────────────────────────────────
async function step1Search(segment, locality, count) {
  const query = `${CATEGORY_QUERIES[segment] || segment} in ${locality}, Germany`
  console.log(`[agent:1:search] "${query}" max=${count}`)

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': PLACES_MASK },
    body:    JSON.stringify({ textQuery: query, maxResultCount: Math.min(count, 20), languageCode: 'de' }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Places API: ${data.error?.message || res.status}`)

  const places = (data.places || []).map(p => ({
    googlePlaceId: p.id,
    name:          p.displayName?.text || '',
    address:       p.formattedAddress  || '',
    city:          locality,
    country:       'DE',
    category:      segment,
    rating:        typeof p.rating === 'number' ? p.rating : null,
    phone:         p.nationalPhoneNumber || '',
    website:       p.websiteUri ? p.websiteUri.replace(/^https?:\/\//, '').replace(/\/$/, '') : '',
    status:        'new',
  }))
  console.log(`[agent:1:search] found ${places.length} places`)
  return places
}

// ── STEP 2: Enrich + Firestore upsert ─────────────────────────────────────────
async function step2Enrich(company) {
  console.log(`[agent:2:enrich] ${company.name}`)

  // Scrape email from website
  const email = await scrapeEmail(company.website)
  const enriched = { ...company, email: email || '' }

  // Calculate BPS
  const bps = calcBPS(enriched)
  console.log(`[agent:2:enrich] ${company.name} | email=${email || 'none'} | BPS=${bps.score}`)

  // Firestore: check duplicate, then create
  let docId = null
  let isDup  = false

  if (company.googlePlaceId) {
    const existing = await fsQuery('companies', 'googlePlaceId', company.googlePlaceId)
    if (existing.length) {
      docId = existing[0].document.name.split('/').pop()
      isDup = true
      console.log(`[agent:2:enrich] duplicate: ${company.name} → ${docId}`)
    }
  }

  if (!docId) {
    const now = new Date().toISOString()
    const doc = await fsCreate('companies', {
      ...enriched,
      aiScore:      bps.score,
      aiReason:     bps.reason,
      aiPositive:   bps.positive,
      aiRisks:      bps.risks,
      aiConfidence: bps.confidence,
      createdAt:    now,
      updatedAt:    now,
    })
    docId = doc.name?.split('/').pop()
    console.log(`[agent:2:enrich] saved: ${company.name} → ${docId}`)
  }

  return { ...enriched, bps, docId, isDuplicate: isDup }
}

// ── STEP 3: Strategize ────────────────────────────────────────────────────────
async function step3Strategize(company) {
  console.log(`[agent:3:strategize] ${company.name}`)

  const prompt = `Analyzuj túto firmu pre predaj STRIKER kavitačnej kúriacej technológie.
STRIKER: 45kW elektrickej energie → 120-160kW tepla. Cena 8000-10000 EUR. Ideálny pre hotely, práčovne, wellness.

Firma: ${company.name}
Segment: ${company.category}
Lokalita: ${company.city}, ${company.country}
BPS skóre: ${company.bps.score}/100 (${company.bps.confidence} istota)
Pozitívne: ${company.bps.positive.join(', ') || '–'}
Riziká: ${company.bps.risks.join(', ') || '–'}
Web: ${company.website || '–'} | Email: ${company.email || 'neznámy'}

Vráť VÝLUČNE valid JSON bez markdown:
{"nextStep":"konkrétny ďalší krok max 1 veta","emailType":"first_contact","priority":"high|medium|low","reasoning":"max 2 vety"}`

  const raw = (await claude(prompt, 300)).trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  try {
    const result = JSON.parse(raw)
    console.log(`[agent:3:strategize] ${company.name} → priority=${result.priority}`)
    return result
  } catch {
    console.warn(`[agent:3:strategize] JSON parse failed, using fallback`)
    return { nextStep: 'Kontaktovať telefonicky', emailType: 'first_contact', priority: 'medium', reasoning: raw.slice(0, 150) }
  }
}

// ── STEP 4: Draft ─────────────────────────────────────────────────────────────
async function step4Draft(company, strategy) {
  console.log(`[agent:4:draft] ${company.name}`)

  // Generate Slovak draft
  const skPrompt = `Napíš prvý kontaktný email v SLOVENČINE pre firmu ${company.name} (${company.category}) v ${company.city}.
BPS: ${company.bps.score}/100. ${company.bps.reason}
STRIKER: kavitačná kúriaca technológia. 45kW vstupu → 120-160kW tepla. Úspora 50-70%. Cena 8000-10000 EUR.
Ďalší krok: ${strategy.nextStep}

RESPOND ONLY IN SLOVAK. NO meta-text. Output ONLY:
PREDMET: <predmet>

<telo emailu max 130 slov, B2B, jasný CTA>`

  const skRaw  = await claude(skPrompt, 500)
  const skLines = skRaw.split('\n')
  const skSLine = skLines.find(l => /^PREDMET:/i.test(l.trim()))
  const subjectSk = skSLine ? skSLine.replace(/^PREDMET:\s*/i, '').trim() : `STRIKER — ${company.name}`
  const bodySk    = skSLine
    ? skRaw.slice(skRaw.indexOf(skSLine) + skSLine.length).replace(/^\s*\n+/, '').trim()
    : skRaw.trim()

  // Translate to German
  const dePrompt = `Translate to professional German B2B email. Sie-form. Max 130 words. NO meta-text, NO markdown, NO [AKTION]. Only clean email text.
Output ONLY:
BETREFF: <subject>

<body>

--- Original Slovak ---
${subjectSk}

${bodySk}`

  const deRaw  = await claude(dePrompt, 500)
  const deLines = deRaw.split('\n')
  const deSLine = deLines.find(l => /^BETREFF:/i.test(l.trim()))
  const subjectDe = deSLine ? deSLine.replace(/^BETREFF:\s*/i, '').trim() : subjectSk
  const bodyDe    = deSLine
    ? deRaw.slice(deRaw.indexOf(deSLine) + deSLine.length).replace(/^\s*\n+/, '').trim()
    : deRaw.trim()

  console.log(`[agent:4:draft] ${company.name} | SK: "${subjectSk}" | DE: "${subjectDe}"`)
  return { sk: { subject: subjectSk, body: bodySk }, de: { subject: subjectDe, body: bodyDe } }
}

// ── STEP 5: Save agent results ────────────────────────────────────────────────
async function step5Save(docId, strategy, draft) {
  console.log(`[agent:5:save] ${docId}`)
  const now = new Date().toISOString()

  // Patch company with agent metadata
  await fsPatch(`companies/${docId}`, {
    agentStatus:  'pending',
    agentReport:  strategy,
    agentRunAt:   now,
    updatedAt:    now,
  })

  // Save email draft to emails collection
  await fsCreate('emails', {
    companyId:   docId,
    type:        'first_contact',
    subjectSk:   draft.sk.subject,
    bodySk:      draft.sk.body,
    subjectDe:   draft.de.subject,
    bodyDe:      draft.de.body,
    status:      'active_draft',
    generatedBy: 'agent',
    aiModel:     CLAUDE_MODEL,
    createdAt:   now,
    updatedAt:   now,
    edited:      false,
  })

  console.log(`[agent:5:save] done → ${docId}`)
}

// ── Main handler ──────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === 'GET') {
    return { statusCode: 200, body: JSON.stringify({ ok: true, fn: 'agent', model: CLAUDE_MODEL }) }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  // Validate env
  const missing = ['GOOGLE_PLACES_API_KEY','ANTHROPIC_API_KEY','VITE_FIREBASE_API_KEY','VITE_FIREBASE_PROJECT_ID']
    .filter(k => !process.env[k])
  if (missing.length) {
    return { statusCode: 500, body: JSON.stringify({ error: `Missing env vars: ${missing.join(', ')}` }) }
  }

  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  const { segment = 'hotel', locality, count = 3 } = body
  if (!locality) return { statusCode: 400, body: JSON.stringify({ error: 'locality is required' }) }
  if (!CATEGORY_QUERIES[segment]) return { statusCode: 400, body: JSON.stringify({ error: `Unknown segment: ${segment}` }) }

  console.log(`[agent] ═══ START | segment=${segment} locality=${locality} count=${count} ═══`)
  const t0     = Date.now()
  const report = []

  try {
    // ─ Step 1: Search ──────────────────────────────────────────────────────
    const places = await step1Search(segment, locality, count)
    if (!places.length) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, count: 0, report: [], message: 'No results from Google Places' }) }
    }

    // ─ Steps 2–5: Process each company sequentially ────────────────────────
    for (const place of places) {
      const entry = { name: place.name, status: 'processing' }
      console.log(`\n[agent] ── Processing: ${place.name} ──`)

      try {
        // Step 2: Enrich
        const enriched = await step2Enrich(place)
        entry.docId      = enriched.docId
        entry.duplicate  = enriched.isDuplicate
        entry.bps        = enriched.bps.score
        entry.email      = enriched.email || null
        entry.confidence = enriched.bps.confidence

        // Step 3: Strategize
        const strategy   = await step3Strategize(enriched)
        entry.priority   = strategy.priority
        entry.nextStep   = strategy.nextStep
        entry.emailType  = strategy.emailType

        // Step 4: Draft
        const draft      = await step4Draft(enriched, strategy)
        entry.draftSk    = draft.sk.subject
        entry.draftDe    = draft.de.subject

        // Step 5: Save
        await step5Save(enriched.docId, strategy, draft)
        entry.status = 'done'

      } catch (err) {
        console.error(`[agent] Failed for ${place.name}:`, err.message)
        entry.status = 'error'
        entry.error  = err.message
      }

      report.push(entry)
      console.log(`[agent] ${place.name} → ${entry.status}`)
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    const done    = report.filter(r => r.status === 'done').length
    const errors  = report.filter(r => r.status === 'error').length
    console.log(`\n[agent] ═══ DONE | ${done} ok, ${errors} errors | ${elapsed}s ═══`)

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, segment, locality, total: report.length, done, errors, elapsed: `${elapsed}s`, report }),
    }

  } catch (err) {
    console.error('[agent] Fatal error:', err.message)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message, partial: report }),
    }
  }
}

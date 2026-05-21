/**
 * STRIKER Intelligence Hunt — Division B AI Multi-Company Hunter
 * Analógia agent.js pre Division A, ale pre intelligence_targets kolekciu
 *
 * POST /.netlify/functions/intel-hunt
 * Body: { segment, locality, country, count }
 *
 * Pipeline:
 *   1. Google Places search (segment + locality)
 *   2. Email scraping (homepage + impressum)
 *   3. STRIKER FIT scoring (based on segment, signals, rating)
 *   4. Save to intelligence_targets (division: 'B')
 *
 * Required env:
 *   GOOGLE_PLACES_API_KEY
 *   VITE_FIREBASE_API_KEY
 *   VITE_FIREBASE_PROJECT_ID
 */

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY
const FB_API_KEY = process.env.VITE_FIREBASE_API_KEY
const FB_PROJECT = process.env.VITE_FIREBASE_PROJECT_ID

const PLACES_MASK = [
  'places.id', 'places.displayName', 'places.formattedAddress',
  'places.location', 'places.rating', 'places.nationalPhoneNumber',
  'places.websiteUri', 'places.userRatingCount',
].join(',')

const CATEGORY_QUERIES = {
  hotel:      'hotels',
  wellness:   'wellness spa',
  laundry:    'laundry service',
  hospital:   'hospital clinic',
  restaurant: 'restaurants',
  food:       'food production manufacturing',
  brewery:    'brewery',
  industrial: 'industrial manufacturing plant',
}

const SEGMENT_LABELS = {
  hotel: 'Hotel / Ubytovanie', wellness: 'Wellness / Spa', laundry: 'Priemyselná práčovňa',
  hospital: 'Nemocnica / Klinika', restaurant: 'Reštaurácia / Gastro', food: 'Potravinárstvo',
  brewery: 'Pivovar', industrial: 'Priemysel / Iné',
}

// ── STRIKER FIT base scores by segment ────────────────────────────────────────

const SEGMENT_BASE = {
  hotel:      { fit: 72, heat: 76, pain: 55, financial: 62, urgency: 48 },
  wellness:   { fit: 88, heat: 92, pain: 65, financial: 68, urgency: 55 },
  laundry:    { fit: 85, heat: 88, pain: 72, financial: 58, urgency: 52 },
  hospital:   { fit: 73, heat: 74, pain: 62, financial: 70, urgency: 50 },
  restaurant: { fit: 52, heat: 58, pain: 48, financial: 55, urgency: 42 },
  food:       { fit: 68, heat: 70, pain: 60, financial: 60, urgency: 48 },
  brewery:    { fit: 82, heat: 85, pain: 65, financial: 62, urgency: 50 },
  industrial: { fit: 65, heat: 68, pain: 58, financial: 60, urgency: 46 },
}

const LUXURY_RE   = /luxury|luxus|premium|resort|grand|palace|royal|seehotel|berghotel|schloss/i
const WELLNESS_RE = /wellness|spa|therme|thermal|sauna|pool|kur|bad\s/i
const ECO_RE      = /bio|öko|eco|green|natur|nachhaltig/i

function calcStrikerFit(company, segment) {
  const base     = SEGMENT_BASE[segment] || SEGMENT_BASE.hotel
  const name     = company.name || ''
  const website  = company.website || ''
  const email    = company.email   || ''
  const rating   = company.rating  || null
  const reviews  = company.reviewCount || 0

  let fit       = base.fit
  let heat      = base.heat
  let financial = base.financial
  const urgency = base.urgency
  const pain    = base.pain

  // Signal boosts
  if (LUXURY_RE.test(name))   { fit += 8;  financial += 10 }
  if (WELLNESS_RE.test(name)) { fit += 10; heat += 8 }
  if (ECO_RE.test(name))      { fit += 5;  pain += 5 }
  if (website)                { fit += 5 }
  if (email)                  { fit += 6 }
  if (rating >= 4.5)          { fit += 5;  financial += 8 }
  else if (rating >= 4.0)     { fit += 3;  financial += 4 }
  if (reviews >= 200)         { financial += 6 }
  if (reviews >= 500)         { financial += 4 }

  fit       = Math.min(100, Math.max(0, fit))
  heat      = Math.min(100, Math.max(0, heat))
  financial = Math.min(100, Math.max(0, financial))

  const overall = Math.round(fit * 0.35 + heat * 0.25 + pain * 0.15 + financial * 0.15 + urgency * 0.10)
  const rec     = overall >= 70 ? 'immediate' : overall >= 45 ? 'monitor' : 'unsuitable'

  // Detected signals from name/website
  const signals = []
  if (WELLNESS_RE.test(name)) signals.push('Wellness/Spa signál v názve')
  if (LUXURY_RE.test(name))   signals.push('Prémiový segment')
  if (ECO_RE.test(name))      signals.push('Eco/Green positioning')
  if (rating >= 4.5)          signals.push(`Vysoké hodnotenie ${rating}★`)
  if (reviews >= 200)         signals.push(`${reviews}+ recenzií — aktívna prevádzka`)
  if (email)                  signals.push('Email kontakt dostupný')

  const whyFound = `${name} je ${SEGMENT_LABELS[segment] || segment} v ${company.city || 'regióne'}. ` +
    (WELLNESS_RE.test(name) ? 'Wellness/Spa prevádzka predpokladá vysokú spotrebu teplej vody. ' : '') +
    (rating >= 4.5 ? 'Prémiové hodnotenie naznačuje aktívnu prevádzku a financnú silu. ' : '') +
    `Segment ${SEGMENT_LABELS[segment] || segment} je prioritný pre STRIKER technológiu.`

  return {
    strikerFitScore:      fit,
    heatDemandScore:      heat,
    energyPainScore:      pain,
    urgencyScore:         urgency,
    financialPowerScore:  financial,
    buyingIntentScore:    40,
    buyingIntent:         'weak',
    overallScore:         Math.min(100, Math.max(0, overall)),
    recommendation:       rec,
    recommendationReason: rec === 'immediate'
      ? `Segment ${SEGMENT_LABELS[segment]} má vysoký potenciál pre STRIKER — odporúčame prioritný kontakt.`
      : rec === 'monitor'
      ? `Stredný potenciál — firma si zaslúži ďalšiu analýzu pred kontaktom.`
      : `Nízky STRIKER FIT — nie je prioritný target.`,
    nextStep: rec === 'immediate'
      ? 'Kontaktovať priamo — spustiť Firecrawl analýzu pre personalizovaný prístup'
      : 'Spustiť Firecrawl analýzu na overenie potenciálu',
    signals,
    whyFound,
  }
}

// ── Firestore REST ────────────────────────────────────────────────────────────

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
  const res  = await fetch(`${FS_BASE()}:runQuery?key=${FB_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId }], where: { fieldFilter: { field: { fieldPath }, op: 'EQUAL', value: toFsVal(value) } }, limit: 1 } }),
  })
  const rows = await res.json()
  return Array.isArray(rows) ? rows.filter(r => r.document) : []
}
async function fsCreate(collectionId, data) {
  const res = await fetch(`${FS_BASE()}/${collectionId}?key=${FB_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFsFields(data) }),
  })
  return res.json()
}

// ── Email scraper ─────────────────────────────────────────────────────────────

const EMAIL_RE   = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const EMAIL_SKIP = [/noreply/i, /no-reply/i, /example/i, /@sentry/i, /@google/i, /\.(png|jpg|gif|svg)$/i]

async function scrapeEmail(website) {
  if (!website) return null
  const base  = website.startsWith('http') ? website.replace(/\/$/, '') : `https://${website.replace(/\/$/, '')}`
  const urls  = [`${base}/impressum`, base]
  const deadline = Date.now() + 5000
  for (const url of urls) {
    if (Date.now() >= deadline) break
    const ctrl = new AbortController()
    const t    = setTimeout(() => ctrl.abort(), Math.min(deadline - Date.now(), 2500))
    try {
      const res    = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } })
      clearTimeout(t)
      if (!res.ok) continue
      const html   = await res.text()
      const emails = [...(html.match(EMAIL_RE) || [])].filter(e => !EMAIL_SKIP.some(p => p.test(e)))
      if (emails.length) return emails[0]
    } catch { clearTimeout(t) }
  }
  return null
}

// ── Google Places search ──────────────────────────────────────────────────────

async function searchPlaces(segment, locality, country, count) {
  const q   = `${CATEGORY_QUERIES[segment] || segment} in ${locality}, ${country}`
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': PLACES_MASK },
    body:    JSON.stringify({ textQuery: q, maxResultCount: Math.min(count, 20), languageCode: 'de' }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Places API: ${data.error?.message || res.status}`)
  return (data.places || []).map(p => ({
    googlePlaceId: p.id,
    name:          p.displayName?.text || '',
    address:       p.formattedAddress  || '',
    city:          locality,
    country:       country,
    segment,
    segmentLabel:  SEGMENT_LABELS[segment] || segment,
    rating:        typeof p.rating === 'number' ? p.rating : null,
    reviewCount:   p.userRatingCount || 0,
    phone:         p.nationalPhoneNumber || '',
    web:           p.websiteUri ? p.websiteUri.replace(/^https?:\/\//, '').replace(/\/$/, '') : '',
    website:       p.websiteUri || '',
    status:        'new',
  }))
}

// ── Process one company ───────────────────────────────────────────────────────

async function processCompany(place, segment) {
  const now    = new Date().toISOString()
  let   docId  = null
  let   isDup  = false

  // Duplicate check
  if (place.googlePlaceId) {
    const existing = await fsQuery('intelligence_targets', 'googlePlaceId', place.googlePlaceId)
    if (existing.length) {
      docId = existing[0].document.name.split('/').pop()
      isDup = true
    }
  }

  // Email scraping
  const email = isDup ? null : await scrapeEmail(place.website)
  const enriched = { ...place, email: email || '' }

  // STRIKER FIT scoring
  const scores = calcStrikerFit({ ...enriched }, segment)

  if (!isDup) {
    const doc = await fsCreate('intelligence_targets', {
      // Basic info
      name:          enriched.name,
      web:           enriched.web,
      website:       enriched.website,
      email:         enriched.email,
      phone:         enriched.phone,
      address:       enriched.address,
      city:          enriched.city,
      country:       enriched.country,
      segment,
      segmentLabel:  SEGMENT_LABELS[segment] || segment,
      rating:        enriched.rating,
      reviewCount:   enriched.reviewCount,
      googlePlaceId: enriched.googlePlaceId,
      division:      'B',
      status:        'new',
      // Scores
      ...scores,
      // Empty arrays for later enrichment
      signals:          scores.signals,
      sources:          [],
      contacts:         [],
      extractedKeywords:[],
      detectedSignals:  [],
      // Timestamps
      createdAt:   now,
      updatedAt:   now,
    })
    docId = doc.name?.split('/').pop()
  }

  return {
    name:         enriched.name,
    city:         enriched.city,
    web:          enriched.web,
    email:        enriched.email || null,
    rating:       enriched.rating,
    overallScore: scores.overallScore,
    strikerFit:   scores.strikerFitScore,
    recommendation: scores.recommendation,
    docId,
    duplicate: isDup,
    status: isDup ? 'dup' : 'saved',
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }

  const missing = ['GOOGLE_PLACES_API_KEY','VITE_FIREBASE_API_KEY','VITE_FIREBASE_PROJECT_ID'].filter(k => !process.env[k])
  if (missing.length) return { statusCode: 500, body: JSON.stringify({ error: `Chýbajú env vars: ${missing.join(', ')}` }) }

  let body
  try { body = JSON.parse(event.body) } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const { segment = 'hotel', locality, country = 'DE', count = 5 } = body
  if (!locality) return { statusCode: 400, body: JSON.stringify({ error: 'locality je povinné' }) }
  if (!CATEGORY_QUERIES[segment]) return { statusCode: 400, body: JSON.stringify({ error: `Neznámy segment: ${segment}` }) }

  const safeCount = Math.min(Number(count) || 5, 15)
  const t0        = Date.now()

  console.log(`[intel-hunt] START | ${segment} · ${locality} · ${country} · count=${safeCount}`)

  try {
    // Step 1: Google Places search
    const places = await searchPlaces(segment, locality, country, safeCount)
    if (!places.length) return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, total: 0, done: 0, report: [], message: 'Google Places nenašiel žiadne výsledky' }),
    }

    console.log(`[intel-hunt] Found ${places.length} places`)

    // Step 2-4: Process all companies in parallel
    const results = await Promise.allSettled(places.map(place => processCompany(place, segment)))

    const report = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value
      console.error(`[intel-hunt] ✗ ${places[i].name}:`, r.reason?.message)
      return { name: places[i].name, status: 'error', error: r.reason?.message || 'unknown' }
    })

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    const done    = report.filter(r => r.status === 'saved').length
    const dups    = report.filter(r => r.status === 'dup').length
    const errors  = report.filter(r => r.status === 'error').length

    console.log(`[intel-hunt] DONE | saved=${done} dups=${dups} errors=${errors} | ${elapsed}s`)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, segment, locality, country, total: report.length, done, dups, errors, elapsed: `${elapsed}s`, report }),
    }

  } catch (err) {
    console.error('[intel-hunt] Fatal:', err.message)
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: err.message }) }
  }
}

/**
 * STRIKER Intelligence Hunt — Division B AI Multi-Company Hunter
 *
 * POST /.netlify/functions/intel-hunt
 * Body: { segment, locality, country, count }
 *
 * Pipeline per company:
 *   1. Google Places search (segment + locality)
 *   2. scrapeEmailAndSignals — fetches homepage + 1 signal page:
 *        • extracts first email
 *        • runs keyword signal analysis with concrete evidence (snippet + URL per hit)
 *   3. STRIKER FIT scoring (algorithmic, based on segment / name / rating)
 *   4. Save to intelligence_targets (division: 'B') including signalEvidence
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
  const name     = company.name    || ''
  const website  = company.website || ''
  const email    = company.email   || ''
  const rating   = company.rating  || null
  const reviews  = company.reviewCount || 0

  let fit       = base.fit
  let heat      = base.heat
  let financial = base.financial
  const urgency = base.urgency
  let pain      = base.pain

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

  const signals = []
  if (WELLNESS_RE.test(name)) signals.push('Wellness/Spa signál v názve')
  if (LUXURY_RE.test(name))   signals.push('Prémiový segment')
  if (ECO_RE.test(name))      signals.push('Eco/Green positioning')
  if (rating >= 4.5)          signals.push(`Vysoké hodnotenie ${rating}★`)
  if (reviews >= 200)         signals.push(`${reviews}+ recenzií — aktívna prevádzka`)
  if (email)                  signals.push('Email kontakt dostupný')

  const whyFound = `${name} je ${SEGMENT_LABELS[segment] || segment} v ${company.city || 'regióne'}. ` +
    (WELLNESS_RE.test(name) ? 'Wellness/Spa prevádzka predpokladá vysokú spotrebu teplej vody. ' : '') +
    (rating >= 4.5 ? 'Prémiové hodnotenie naznačuje aktívnu prevádzku a finančnú silu. ' : '') +
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

// ── Signal keyword groups (same as crawl-signals.js) ─────────────────────────
// Inlined here so functions stay self-contained (CommonJS, no shared imports)

const SIGNAL_GROUPS = [
  { id: 'energy_efficiency',      label: 'Energy Efficiency',      weight: 10, keywords: ['energie', 'energieeffizienz', 'energy efficiency', 'energiesparen', 'energieverbrauch', 'stromverbrauch', 'wärmepumpe', 'heat pump', 'energiekosten', 'energy costs', 'niedrigenergie', 'low energy', 'energieoptimierung'] },
  { id: 'modernization',          label: 'Modernisierung',          weight: 9,  keywords: ['modernisierung', 'modernization', 'modernisiert', 'sanierung', 'renovierung', 'renovation', 'umbau', 'refurbishment', 'nachrüstung', 'retrofit', 'upgrade', 'erneuerung', 'instandhaltung', 'maintenance', 'haustechnik'] },
  { id: 'sustainability',         label: 'Nachhaltigkeit',          weight: 9,  keywords: ['nachhaltigkeit', 'sustainability', 'nachhaltig', 'sustainable', 'umwelt', 'environment', 'klimaschutz', 'climate protection', 'verantwortung'] },
  { id: 'co2_reduction',          label: 'CO₂-Reduzierung',         weight: 10, keywords: ['co2', 'co₂', 'carbon', 'treibhausgas', 'greenhouse gas', 'emissionen', 'emissions', 'dekarbonisierung', 'klimaneutral', 'carbon neutral', 'net zero', 'co2-fußabdruck', 'carbon footprint'] },
  { id: 'hvac',                   label: 'HVAC / Klima',            weight: 10, keywords: ['hvac', 'klimaanlage', 'air conditioning', 'lüftung', 'ventilation', 'heizung', 'heating', 'klimatisierung', 'kühlung', 'cooling', 'heizkessel', 'boiler'] },
  { id: 'heating_modernization',  label: 'Heizungsmodernisierung',  weight: 10, keywords: ['heizungsmodernisierung', 'heating modernization', 'fernwärme', 'district heating', 'heizungsanlage', 'heating system', 'heiztechnik', 'wärmeversorgung', 'heizkesselersatz', 'brennwert', 'condensing boiler', 'pellets', 'biomasse'] },
  { id: 'renovation',             label: 'Gebäuderenovierung',      weight: 8,  keywords: ['gebäuderenovierung', 'building renovation', 'fassade', 'facade', 'dämmung', 'insulation', 'wärmedämmung', 'thermal insulation', 'altbau', 'old building'] },
  { id: 'green_building',         label: 'Green Building',          weight: 8,  keywords: ['green building', 'leed', 'breeam', 'dgnb', 'energieausweis', 'energy certificate', 'effizienzhaus', 'passivhaus', 'passive house'] },
  { id: 'decarbonization',        label: 'Dekarbonisierung',        weight: 10, keywords: ['dekarbonisierung', 'decarbonization', 'klimaneutralität', 'climate neutrality', 'energiewende', 'energy transition', 'erneuerbare energien', 'renewable energy', 'solarenergie', 'solar', 'photovoltaik', 'geothermie', 'geothermal'] },
]

// ── HTML → plain text ──────────────────────────────────────────────────────────

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 10000)
}

// ── Email regex helpers ────────────────────────────────────────────────────────

const EMAIL_RE   = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const EMAIL_SKIP = [/noreply/i, /no-reply/i, /example/i, /@sentry/i, /@google/i, /\.(png|jpg|gif|svg)$/i]

function extractFirstEmail(text) {
  const emails = [...(text.match(EMAIL_RE) || [])].filter(e => !EMAIL_SKIP.some(p => p.test(e)))
  return emails[0] || null
}

// ── Signal evidence extraction ─────────────────────────────────────────────────
// Input:  pages = [{ url, text }]
// Output: { detectedSignals, signalCount, strikerNeedScore, signalReason, signalEvidence }

function extractSignalEvidence(pages) {
  const detectedMap = {}
  const allEvidence = []
  const seenKwUrl   = new Set()

  for (const { url, text } of pages) {
    const tLow = text.toLowerCase()
    for (const g of SIGNAL_GROUPS) {
      for (const kw of g.keywords) {
        const kwLow = kw.toLowerCase()
        const idx   = tLow.indexOf(kwLow)
        if (idx === -1) continue

        const dedupeKey = `${kwLow}::${url}`
        if (!seenKwUrl.has(dedupeKey)) {
          seenKwUrl.add(dedupeKey)
          const start   = Math.max(0, idx - 120)
          const end     = Math.min(text.length, idx + kw.length + 120)
          const raw     = text.slice(start, end).replace(/\s+/g, ' ').trim()
          const snippet = (start > 0 ? '…' : '') + raw + (end < text.length ? '…' : '')
          allEvidence.push({ groupId: g.id, groupLabel: g.label, keyword: kw, snippet, url })
        }

        if (!detectedMap[g.id]) {
          detectedMap[g.id] = { id: g.id, label: g.label, weight: g.weight, matches: new Set(), hitCount: 0 }
        }
        if (!detectedMap[g.id].matches.has(kw)) {
          detectedMap[g.id].matches.add(kw)
          detectedMap[g.id].hitCount++
        }
      }
    }
  }

  const detectedSignals = Object.values(detectedMap).map(g => ({
    id: g.id, label: g.label, weight: g.weight, matches: [...g.matches], hitCount: g.hitCount,
  }))

  const total        = detectedSignals.reduce((s, g) => s + g.weight * Math.min(g.hitCount, 3), 0)
  const maxPossible  = SIGNAL_GROUPS.reduce((s, g) => s + g.weight * 3, 0)
  const strikerNeedScore = Math.min(100, Math.round((total / maxPossible) * 100))

  const top3 = [...detectedSignals]
    .sort((a, b) => b.weight * b.hitCount - a.weight * a.hitCount)
    .slice(0, 3).map(s => s.label)

  const signalReason = detectedSignals.length > 0
    ? `Detekované oblasti: ${top3.join(', ')}${detectedSignals.length > 3 ? ` a ${detectedSignals.length - 3} ďalšie` : ''}.`
    : 'Žiadne signály nenájdené.'

  // Cap: max 2 evidence items per group, 25 total
  const byGroup        = {}
  const signalEvidence = []
  for (const ev of allEvidence) {
    byGroup[ev.groupId] = (byGroup[ev.groupId] || 0) + 1
    if (byGroup[ev.groupId] <= 2) signalEvidence.push(ev)
    if (signalEvidence.length >= 25) break
  }

  return { detectedSignals, signalCount: detectedSignals.length, strikerNeedScore, signalReason, signalEvidence }
}

// ── Fetch a page with timeout — returns { text, url } or null ─────────────────

async function fetchPageSafe(url, timeoutMs) {
  const ctrl = new AbortController()
  const t    = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal:  ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow',
    })
    clearTimeout(t)
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('html') && !ct.includes('text')) return null
    const html = await res.text()
    const text = htmlToText(html)
    return text.length > 50 ? { url, text } : null
  } catch {
    clearTimeout(t)
    return null
  }
}

// ── Scrape email AND signal evidence from company website ─────────────────────
//
// Budget: homepage (3s) + one signal page (2s) = max 5s extra per company.
// We reuse fetched text for both email extraction and keyword analysis.

const QUICK_SIGNAL_PATHS = ['/nachhaltigkeit', '/sustainability', '/esg', '/energie', '/energy', '/umwelt']

async function scrapeEmailAndSignals(website) {
  const empty = {
    email:         null,
    detectedSignals: [],
    signalCount:   0,
    strikerNeedScore: 0,
    signalReason:  'Žiadne signály nenájdené.',
    signalEvidence: [],
    signalSources: [],
  }

  if (!website) return empty

  const base     = website.startsWith('http') ? website.replace(/\/$/, '') : `https://${website.replace(/\/$/, '')}`
  const deadline = Date.now() + 9000   // 9s total hard cap

  const pages = []

  // 1. Homepage — most likely to have email; also contributes to signals
  const home = await fetchPageSafe(base, 3000)
  if (home) pages.push(home)

  // 2. /impressum — best for email; often has no signals but worth checking
  if (Date.now() < deadline) {
    const impr = await fetchPageSafe(base + '/impressum', 2000)
    if (impr) pages.push(impr)
  }

  // 3. One quick signal-specific page (first that responds)
  if (Date.now() < deadline) {
    for (const path of QUICK_SIGNAL_PATHS) {
      if (Date.now() >= deadline) break
      const page = await fetchPageSafe(base + path, 2000)
      if (page) { pages.push(page); break }
    }
  }

  // Extract email from all page text combined
  const allText = pages.map(p => p.text).join(' ')
  const email   = extractFirstEmail(allText)

  if (pages.length === 0) return { ...empty, email }

  // Signal analysis with evidence
  const signals = extractSignalEvidence(pages)

  console.log(`[intel-hunt] signals for ${base}: score=${signals.strikerNeedScore} groups=${signals.signalCount} evidence=${signals.signalEvidence.length}`)

  return {
    email,
    ...signals,
    signalSources: pages.map(p => p.url),
  }
}

// ── Firestore REST ────────────────────────────────────────────────────────────

const FS_BASE = () => `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents`

function toFsVal(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean')        return { booleanValue: v }
  if (typeof v === 'number')         return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'string')         return { stringValue: v }
  if (Array.isArray(v))             return { arrayValue: { values: v.map(toFsVal) } }
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
  const now   = new Date().toISOString()
  let docId   = null
  let isDup   = false

  // Duplicate check
  if (place.googlePlaceId) {
    const existing = await fsQuery('intelligence_targets', 'googlePlaceId', place.googlePlaceId)
    if (existing.length) {
      docId = existing[0].document.name.split('/').pop()
      isDup = true
    }
  }

  // Scrape email AND website signals (reuses fetched pages for both)
  const scraped = isDup ? { email: null, detectedSignals: [], signalCount: 0, strikerNeedScore: 0, signalReason: '', signalEvidence: [], signalSources: [] }
                        : await scrapeEmailAndSignals(place.website)

  const enriched = { ...place, email: scraped.email || '' }

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

      // FIT scores
      ...scores,

      // Website signal evidence — the concrete proof
      detectedSignals:  scraped.detectedSignals,
      signalCount:      scraped.signalCount,
      strikerNeedScore: scraped.strikerNeedScore,
      signalReason:     scraped.signalReason,
      signalEvidence:   scraped.signalEvidence,
      signalSources:    scraped.signalSources,
      analyzedAt:       scraped.signalCount > 0 ? now : null,

      // Empty arrays for later enrichment
      sources:          [],
      contacts:         [],
      extractedKeywords: [],

      // Timestamps
      createdAt: now,
      updatedAt: now,
    })
    docId = doc.name?.split('/').pop()
  }

  return {
    name:            enriched.name,
    city:            enriched.city,
    web:             enriched.web,
    email:           enriched.email || null,
    rating:          enriched.rating,
    overallScore:    scores.overallScore,
    strikerFit:      scores.strikerFitScore,
    strikerNeedScore: scraped.strikerNeedScore,
    signalCount:     scraped.signalCount,
    evidenceCount:   scraped.signalEvidence.length,
    recommendation:  scores.recommendation,
    docId,
    duplicate:       isDup,
    status:          isDup ? 'dup' : 'saved',
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }

  const missing = ['GOOGLE_PLACES_API_KEY', 'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID'].filter(k => !process.env[k])
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
    const places = await searchPlaces(segment, locality, country, safeCount)
    if (!places.length) return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, total: 0, done: 0, report: [], message: 'Google Places nenašiel žiadne výsledky' }),
    }

    console.log(`[intel-hunt] Found ${places.length} places`)

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

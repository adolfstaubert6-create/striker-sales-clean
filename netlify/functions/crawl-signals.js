/**
 * crawl-signals — Intelligence Signal Engine
 *
 * PHILOSOPHY:
 *   We don't look for companies. We look for companies with a REAL ENERGY
 *   PROBLEM who are publicly signaling they're solving it.
 *
 * TWO-SOURCE ANALYSIS:
 *
 *   1. WEBSITE INTELLIGENCE — targeted pages only:
 *      /aktuelles /news /presse /blog /projekte /investitionen
 *      /nachhaltigkeit /sustainability /esg /energie /klima /co2 /umwelt
 *      — NOT homepage, NOT rooms, NOT restaurant, NOT spa amenities
 *
 *   2. REVIEW INTELLIGENCE — Google Reviews via SerpAPI (hotels/wellness):
 *      Heating complaints, cold rooms, hot water issues reveal real problems.
 *
 * SIGNAL TIERS (scored once per detected group, cumulative):
 *   VERY_STRONG  +35  Active investment in heating/energy project
 *   STRONG       +25  Concrete modernization news, cost-pressure statements
 *   MEDIUM       +15  ESG reports, CO₂ targets, structured sustainability
 *   WEAK          +5  Generic marketing sustainability claims (noise)
 *
 * POST /.netlify/functions/crawl-signals
 * Body: { name, city, country?, segment?, segmentLabel?, web?, docId? }
 *
 * Response (same field names as before — callers unchanged):
 *   { ok, detectedSignals, signalCount, strikerNeedScore, signalReason,
 *     signalEvidence, signalSources, reviewCount, reviewRating, analyzedAt }
 */

const SERPAPI_KEY = process.env.SERPAPI_API_KEY
const FB_API_KEY  = process.env.VITE_FIREBASE_API_KEY
const FB_PROJECT  = process.env.VITE_FIREBASE_PROJECT_ID

// ── Firestore REST helpers ─────────────────────────────────────────────────────

const FS_BASE = () =>
  `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents`

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
async function fsPatch(docId, data) {
  const fields = toFsFields(data)
  const mask   = Object.keys(fields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
  const url    = `${FS_BASE()}/intelligence_targets/${docId}?key=${FB_API_KEY}&${mask}`
  const res = await fetch(url, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body:   JSON.stringify({ fields }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Firestore PATCH ${res.status}: ${err.error?.message || 'unknown'}`)
  }
  return res.json()
}

// ── Signal groups — 4 tiers ───────────────────────────────────────────────────
//
// Keyword design principle:
//   VERY_STRONG = action verbs + energy/heating objects  → "We are doing it"
//   STRONG      = concrete nouns for projects/costs      → "We are affected"
//   MEDIUM      = structured reporting / targets          → "We declared it"
//   WEAK        = vague brand sustainability claims       → "We say it"
//
// Scoring: each group adds its weight ONCE when detected, regardless of how
// many keywords match. This prevents keyword-stuffed pages from inflating score.

const SIGNAL_GROUPS = [

  // ── VERY STRONG (+35) ── Active investment or project in heating / energy ──
  {
    id: 'active_energy_investment',
    label: 'Aktívna energetická investícia',
    tier: 'VERY_STRONG',
    weight: 35,
    keywords: [
      // Heating system actions
      'heizungsanlage ersetzen', 'heizungsanlage ersetzt', 'heizungsanlage austausch',
      'neue heizungsanlage', 'neuer heizkessel', 'heizkessel ersetzt',
      'heiztechnik modernisiert', 'heizungssystem erneuert',
      'wärmepumpe einbau', 'wärmepumpe installiert', 'wärmepumpe projekt',
      'neue wärmeanlage', 'wärmeerzeugung modernisiert',
      // Energy project actions
      'energieprojekt', 'energetische sanierung', 'energetische modernisierung',
      'investition in energie', 'investition in heizung',
      'heizprojekt', 'wärmeprojekt',
    ],
  },

  // ── STRONG (+25) ── Concrete modernization news or cost-pressure signals ──
  {
    id: 'modernization_news',
    label: 'Modernizácia / rekonštrukcia',
    tier: 'STRONG',
    weight: 25,
    keywords: [
      'modernisierung', 'modernisiert', 'sanierung', 'saniert',
      'renovierung', 'renoviert', 'umbau', 'umgebaut',
      'erweiterung', 'neubau', 'infrastrukturprojekt',
      'bauarbeiten', 'generalüberholung',
    ],
  },
  {
    id: 'cost_pressure',
    label: 'Tlak nákladov / efektivita',
    tier: 'STRONG',
    weight: 25,
    keywords: [
      'energiekosten', 'heizkosten', 'wärmekosten', 'betriebskosten',
      'kostenreduktion', 'kostensenkung', 'kosten reduzieren',
      'effizienzsteigerung', 'energieverbrauch reduzieren',
      'energieoptimierung', 'energieeffizienz steigern',
      'wirtschaftlichkeit verbessern',
    ],
  },

  // ── MEDIUM (+15) ── Structured ESG / declared climate targets ──
  {
    id: 'esg_climate',
    label: 'ESG / Klimastratégia',
    tier: 'MEDIUM',
    weight: 15,
    keywords: [
      'esg', 'nachhaltigkeitsbericht', 'sustainability report',
      'klimastrategie', 'klimaziele', 'co2 reduktion', 'co₂ reduktion',
      'co2-neutral', 'klimaneutral', 'dekarbonisierung', 'klimaschutzprogramm',
      'energiewende', 'klimaneutralität bis',
    ],
  },

  // ── WEAK (+5) ── Generic brand sustainability claims (noise, not signal) ──
  {
    id: 'sustainability_generic',
    label: 'Udržateľnosť (marketing)',
    tier: 'WEAK',
    weight: 5,
    keywords: [
      'nachhaltigkeit', 'nachhaltig', 'umweltfreundlich',
      'ökologisch', 'ressourcenschonung', 'verantwortung',
    ],
  },
]

// Review signals — only activated for hotel/wellness/spa segments
const REVIEW_SIGNAL_GROUP = {
  id:      'guest_complaint',
  label:   'Sťažnosti hostí (teplota/kúrenie)',
  tier:    'STRONG',
  weight:  25,
  keywords: [
    'kalt', 'kälte', 'warm', 'heizung', 'warmwasser',
    'temperatur', 'friert', 'defekt', 'kaputt', 'störung',
    'nicht funktioniert', 'technische probleme',
  ],
}

// Segments that benefit from review analysis
const REVIEW_SEGMENTS = new Set(['hotel', 'wellness', 'spa', 'hospital'])

// ── Website intelligence — targeted pages ONLY ────────────────────────────────
//
// These paths are where REAL intelligence lives.
// Homepage and amenity pages are deliberately excluded.

const INTELLIGENCE_PATHS = [
  '/aktuelles', '/news', '/presse', '/pressemitteilungen', '/blog',
  '/projekte', '/investitionen', '/bauvorhaben',
  '/nachhaltigkeit', '/sustainability', '/esg',
  '/energie', '/energieeffizienz', '/klima', '/co2', '/umwelt',
]

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

async function fetchPage(url, timeoutMs = 4000) {
  const ctrl = new AbortController()
  const t    = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal:  ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; STRIKERBot/2.0)' },
      redirect: 'follow',
    })
    clearTimeout(t)
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('html') && !ct.includes('text')) return null
    const text = htmlToText(await res.text())
    return text.length > 80 ? { url, text } : null
  } catch {
    clearTimeout(t)
    return null
  }
}

async function crawlIntelligencePages(web) {
  if (!web) return { pages: [], sources: [] }
  const base = web.startsWith('http') ? web.replace(/\/$/, '') : `https://${web.replace(/\/$/, '')}`

  const pages   = []
  const sources = []
  let   tried   = 0

  for (const path of INTELLIGENCE_PATHS) {
    if (tried >= 6) break
    tried++
    const page = await fetchPage(base + path)
    if (page) {
      pages.push({ ...page, pageType: path.replace('/', '') || 'root' })
      sources.push(page.url)
    }
    if (pages.reduce((s, p) => s + p.text.length, 0) > 40000) break
  }
  return { pages, sources }
}

// ── Google Reviews via SerpAPI ─────────────────────────────────────────────────

async function searchGoogleMaps(name, city, country) {
  const gl  = ['at', 'ch'].includes((country || '').toLowerCase()) ? country.toLowerCase() : 'de'
  const q   = encodeURIComponent(`${name} ${city}`)
  const url = `https://serpapi.com/search.json?engine=google_maps&q=${q}&api_key=${SERPAPI_KEY}&hl=de&gl=${gl}&num=3`
  const ctrl = new AbortController()
  const t    = setTimeout(() => ctrl.abort(), 9000)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) throw new Error(`SerpAPI Maps HTTP ${res.status}`)
    const data = await res.json()
    const hits  = data.local_results || []
    if (!hits.length) throw new Error('No Google Maps results')
    return hits[0]
  } catch (e) {
    clearTimeout(t)
    throw e
  }
}

async function fetchReviews(dataId) {
  if (!dataId) return []
  const url  = `https://serpapi.com/search.json?engine=google_maps_reviews&data_id=${encodeURIComponent(dataId)}&api_key=${SERPAPI_KEY}&hl=de&num=20`
  const ctrl = new AbortController()
  const t    = setTimeout(() => ctrl.abort(), 9000)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) return []
    const data = await res.json()
    return data.reviews || []
  } catch {
    clearTimeout(t)
    return []
  }
}

// ── Signal analysis — website pages ───────────────────────────────────────────

function analyzeWebPages(pages) {
  const detectedMap  = {}
  const allEvidence  = []
  const seenKwPage   = new Set()

  for (const { url, text, pageType } of pages) {
    const tLow = text.toLowerCase()

    for (const g of SIGNAL_GROUPS) {
      for (const kw of g.keywords) {
        const kwLow = kw.toLowerCase()
        const idx   = tLow.indexOf(kwLow)
        if (idx === -1) continue

        const dedupeKey = `${kwLow}::${url}`
        if (!seenKwPage.has(dedupeKey)) {
          seenKwPage.add(dedupeKey)
          const start   = Math.max(0, idx - 110)
          const end     = Math.min(text.length, idx + kw.length + 110)
          const raw     = text.slice(start, end).replace(/\s+/g, ' ').trim()
          const snippet = (start > 0 ? '…' : '') + raw + (end < text.length ? '…' : '')
          allEvidence.push({ groupId: g.id, groupLabel: g.label, tier: g.tier, keyword: kw, snippet, url, pageType, source: 'web' })
        }

        if (!detectedMap[g.id]) {
          detectedMap[g.id] = { id: g.id, label: g.label, tier: g.tier, weight: g.weight, matches: new Set(), hitCount: 0 }
        }
        if (!detectedMap[g.id].matches.has(kw)) {
          detectedMap[g.id].matches.add(kw)
          detectedMap[g.id].hitCount++
        }
      }
    }
  }

  return { detectedMap, allEvidence }
}

// ── Signal analysis — Google Reviews ─────────────────────────────────────────

function analyzeReviews(reviews, placeUrl) {
  const detectedMap = {}
  const allEvidence = []
  const seenKwRev   = new Set()
  const g           = REVIEW_SIGNAL_GROUP

  for (const review of reviews) {
    const text = (review.snippet || review.text || '').trim()
    if (!text) continue
    const tLow  = text.toLowerCase()
    const rating = typeof review.rating === 'number' ? review.rating : null

    for (const kw of g.keywords) {
      const kwLow = kw.toLowerCase()
      const idx   = tLow.indexOf(kwLow)
      if (idx === -1) continue

      const dedupeKey = `${kwLow}::${text.slice(0, 40)}`
      if (!seenKwRev.has(dedupeKey)) {
        seenKwRev.add(dedupeKey)
        const start   = Math.max(0, idx - 60)
        const end     = Math.min(text.length, idx + kw.length + 60)
        const raw     = text.slice(start, end).replace(/\s+/g, ' ').trim()
        const snippet = (start > 0 ? '…' : '') + raw + (end < text.length ? '…' : '')
        allEvidence.push({ groupId: g.id, groupLabel: g.label, tier: g.tier, keyword: kw, snippet, url: placeUrl, rating, source: 'review' })
      }

      if (!detectedMap[g.id]) {
        detectedMap[g.id] = { id: g.id, label: g.label, tier: g.tier, weight: g.weight, matches: new Set(), hitCount: 0 }
      }
      if (!detectedMap[g.id].matches.has(kw)) {
        detectedMap[g.id].matches.add(kw)
        detectedMap[g.id].hitCount++
      }
    }
  }

  return { detectedMap, allEvidence }
}

// ── Merge + score ─────────────────────────────────────────────────────────────

function buildResult(webDetected, webEvidence, revDetected, revEvidence) {
  // Merge detected groups from both sources
  const merged = { ...webDetected }
  for (const [id, g] of Object.entries(revDetected)) {
    if (merged[id]) {
      for (const kw of g.matches) merged[id].matches.add(kw)
      merged[id].hitCount += g.hitCount
    } else {
      merged[id] = { ...g }
    }
  }

  const detectedSignals = Object.values(merged).map(g => ({
    id:       g.id,
    label:    g.label,
    tier:     g.tier,
    weight:   g.weight,
    matches:  [...g.matches],
    hitCount: g.hitCount,
  }))

  // Score: sum of weights per detected group, capped at 100
  const rawScore      = detectedSignals.reduce((s, g) => s + g.weight, 0)
  const strikerNeedScore = Math.min(100, rawScore)

  // Evidence: cap at 2 per group (prefer VERY_STRONG first), 25 total
  const allEvidence = [...webEvidence, ...revEvidence]
    .sort((a, b) => {
      const tierRank = { VERY_STRONG: 0, STRONG: 1, MEDIUM: 2, WEAK: 3 }
      return (tierRank[a.tier] ?? 4) - (tierRank[b.tier] ?? 4)
    })

  const byGroup        = {}
  const signalEvidence = []
  for (const ev of allEvidence) {
    byGroup[ev.groupId] = (byGroup[ev.groupId] || 0) + 1
    if (byGroup[ev.groupId] <= 2) signalEvidence.push(ev)
    if (signalEvidence.length >= 25) break
  }

  // Signal reason — distinguish real from marketing
  const realSignals = detectedSignals.filter(s => s.tier !== 'WEAK')
  const topReal     = [...realSignals].sort((a, b) => b.weight - a.weight).slice(0, 2)
  const hasWeak     = detectedSignals.some(s => s.tier === 'WEAK')

  let signalReason
  if (topReal.length > 0) {
    const labels = topReal.map(s => s.label).join(', ')
    const extra  = realSignals.length > 2 ? ` +${realSignals.length - 2}` : ''
    signalReason = `Reálny signál: ${labels}${extra}.`
    if (hasWeak && realSignals.length === 0) signalReason += ' (ostatné sú marketingový obsah)'
  } else if (hasWeak) {
    signalReason = 'Iba marketingový obsah — žiadny reálny energetický signál.'
  } else {
    signalReason = 'Žiadne signály — skontrolovať ručne alebo firma nemá verejné dáta.'
  }

  return { detectedSignals, signalCount: detectedSignals.length, strikerNeedScore, signalReason, signalEvidence }
}

// ── Empty result ──────────────────────────────────────────────────────────────

function emptyResult(reason) {
  return {
    detectedSignals:  [],
    signalCount:      0,
    strikerNeedScore: 0,
    signalReason:     reason,
    signalEvidence:   [],
    signalSources:    [],
    reviewCount:      0,
    reviewRating:     null,
    analyzedAt:       new Date().toISOString(),
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  let body
  try { body = JSON.parse(event.body || '{}') }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const {
    name         = '',
    city         = '',
    country      = 'DE',
    segment      = '',
    segmentLabel = '',
    web          = '',      // still accepted — used for website intelligence
    docId,
  } = body

  if (!name) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'name required' }) }

  console.log(`[crawl-signals] START "${name}" city=${city} segment=${segment} web=${web || '—'} docId=${docId}`)
  const t0 = Date.now()

  // ── SOURCE 1: Website intelligence (targeted pages) ──────────────────────────
  const webTask = web
    ? crawlIntelligencePages(web)
    : Promise.resolve({ pages: [], sources: [] })

  // ── SOURCE 2: Google Reviews (hotels/wellness only) ───────────────────────────
  const isReviewSegment = REVIEW_SEGMENTS.has(segment.toLowerCase())
  let reviewTask = Promise.resolve({ reviews: [], place: null })

  if (isReviewSegment && SERPAPI_KEY) {
    reviewTask = searchGoogleMaps(name, city, country)
      .then(async place => {
        const reviews = place?.data_id ? await fetchReviews(place.data_id) : []
        return { reviews, place }
      })
      .catch(e => {
        console.warn('[crawl-signals] Reviews failed:', e.message)
        return { reviews: [], place: null }
      })
  }

  const [{ pages, sources }, { reviews, place }] = await Promise.all([webTask, reviewTask])

  console.log(`[crawl-signals] pages=${pages.length} reviews=${reviews.length} ${Date.now() - t0}ms`)

  // ── Analyse ───────────────────────────────────────────────────────────────────
  const { detectedMap: webDet, allEvidence: webEv } = analyzeWebPages(pages)

  const placeUrl = place?.link || (SERPAPI_KEY && isReviewSegment
    ? `https://www.google.com/maps/search/${encodeURIComponent(name + ' ' + city)}`
    : '')
  const { detectedMap: revDet, allEvidence: revEv } = analyzeReviews(reviews, placeUrl)

  const signals = buildResult(webDet, webEv, revDet, revEv)

  const allSources = [
    ...sources,
    ...(placeUrl ? [placeUrl] : []),
  ]

  const payload = {
    ...signals,
    signalSources: allSources,
    reviewCount:   place?.reviews  ?? reviews.length,
    reviewRating:  place?.rating   ?? null,
    analyzedAt:    new Date().toISOString(),
  }

  console.log(`[crawl-signals] score=${payload.strikerNeedScore} groups=${payload.signalCount} evidence=${payload.signalEvidence.length} tier=${signals.detectedSignals.map(s=>s.tier).join('+')||'none'} ${Date.now()-t0}ms`)

  // ── Persist ───────────────────────────────────────────────────────────────────
  if (docId && FB_API_KEY && FB_PROJECT) {
    await fsPatch(docId, payload).catch(e =>
      console.warn('[crawl-signals] Firestore PATCH failed:', e.message)
    )
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, name, ...payload }) }
}

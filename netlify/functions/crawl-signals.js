/**
 * crawl-signals — Energy Pressure Intelligence Engine
 *
 * CORE DEFINITION:
 *   Find companies under ENERGY PRESSURE — organizations that publicly signal
 *   an energy problem, high costs, modernization of heating/energy systems,
 *   or need for more efficient heat production.
 *
 * TWO SOURCES:
 *   1. Website — targeted pages only: /news /aktuelles /presse /projekte
 *                /esg /nachhaltigkeit /energie /klima /co2 /umwelt
 *   2. Google Reviews (hotels/wellness) — ONLY cold room / hot water / heating complaints
 *
 * CONTEXT RULE (hard, no exceptions):
 *   A keyword match is ONLY valid when, within ±200 characters:
 *     • AT LEAST ONE energy pressure indicator is present
 *     • NO marketing/room/food discard term is present
 *
 *   Energy indicators: Heizung, Energie, Kosten, Wärme, Verbrauch, Effizienz,
 *                      CO2, Kessel, Anlage, Technik, Betriebskosten, Energiekosten
 *   Discard terms:     Zimmer, Suite, Design, Luxus, Ausstattung, Einrichtung,
 *                      Speise, Restaurant, Möbel, Massage
 *
 * SCORING (once per detected group, cumulative, capped 100):
 *   VERY_STRONG +35 · STRONG +25 · MEDIUM +15 · WEAK +5
 *
 * POST /.netlify/functions/crawl-signals
 * Body: { name, city, country?, segment?, web?, docId? }
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

// ── Signal keyword groups ─────────────────────────────────────────────────────
//
// These are what we SEARCH for in page text.
// They do NOT score on their own — they must also pass the context check below.

const SIGNAL_GROUPS = [
  // VERY STRONG (+35) — Active energy/heating investment
  {
    id: 'active_energy_investment', label: 'Aktívna energetická investícia',
    tier: 'VERY_STRONG', weight: 35,
    keywords: [
      'heizungsanlage ersetzen', 'heizungsanlage ersetzt', 'heizungsanlage austausch',
      'neue heizungsanlage', 'neuer heizkessel', 'heizkessel ersetzt',
      'heiztechnik modernisiert', 'heizungssystem erneuert',
      'wärmepumpe einbau', 'wärmepumpe installiert', 'wärmepumpe projekt',
      'neue wärmeanlage', 'wärmeerzeugung modernisiert',
      'energieprojekt', 'energetische sanierung', 'energetische modernisierung',
      'investition in energie', 'investition in heizung',
    ],
  },
  // STRONG (+25) — Concrete modernization or cost-pressure
  {
    id: 'modernization_news', label: 'Modernizácia / rekonštrukcia',
    tier: 'STRONG', weight: 25,
    keywords: [
      'modernisierung', 'modernisiert', 'sanierung', 'saniert',
      'renovierung', 'renoviert', 'umbau', 'umgebaut',
      'erweiterung', 'neubau', 'infrastrukturprojekt', 'generalüberholung',
    ],
  },
  {
    id: 'cost_pressure', label: 'Tlak nákladov / efektivita',
    tier: 'STRONG', weight: 25,
    keywords: [
      'energiekosten', 'heizkosten', 'wärmekosten', 'betriebskosten',
      'kostenreduktion', 'kostensenkung', 'kosten reduzieren',
      'effizienzsteigerung', 'energieverbrauch reduzieren',
      'energieoptimierung', 'energieeffizienz steigern',
    ],
  },
  // MEDIUM (+15) — ESG / declared climate targets
  {
    id: 'esg_climate', label: 'ESG / Klimastratégia',
    tier: 'MEDIUM', weight: 15,
    keywords: [
      'esg', 'nachhaltigkeitsbericht', 'sustainability report',
      'klimastrategie', 'klimaziele', 'co2 reduktion', 'co₂ reduktion',
      'co2-neutral', 'klimaneutral', 'dekarbonisierung', 'klimaschutzprogramm',
    ],
  },
  // WEAK (+5) — Generic sustainability mentions
  {
    id: 'sustainability_generic', label: 'Udržateľnosť (marketing)',
    tier: 'WEAK', weight: 5,
    keywords: [
      'nachhaltigkeit', 'nachhaltig', 'umweltfreundlich',
      'ökologisch', 'ressourcenschonung', 'verantwortung',
    ],
  },
]

// Review signals — hotel/wellness only
const REVIEW_SIGNAL_GROUP = {
  id: 'guest_complaint', label: 'Sťažnosti hostí (teplota/kúrenie)',
  tier: 'STRONG', weight: 25,
  keywords: [
    'kalt', 'kälte', 'warm', 'heizung', 'warmwasser',
    'temperatur', 'friert', 'defekt', 'kaputt', 'störung',
    'nicht funktioniert', 'technische probleme',
  ],
}

const REVIEW_SEGMENTS = new Set(['hotel', 'wellness', 'spa', 'hospital'])

// ── Context validation ─────────────────────────────────────────────────────────
//
// Both checks operate on a ±200-char window around each keyword match.

// At least one of these must appear for a match to be counted
const ENERGY_PRESSURE_TERMS = [
  'heizung', 'heizkessel', 'heizungsanlage', 'heiztechnik', 'heizsystem',
  'heizkosten', 'heizbedarf',
  'energie', 'energiekosten', 'energieverbrauch', 'energieeffizienz',
  'energieeinsparung', 'energieoptimierung', 'energieprojekt',
  'kosten', 'betriebskosten', 'kostenreduktion', 'kostensenkung',
  'wärme', 'wärmeversorgung', 'wärmeerzeugung', 'wärmepumpe',
  'warmwasser', 'wärmekosten', 'wärmebedarf',
  'verbrauch', 'stromverbrauch',
  'effizienz', 'effizienzsteigerung',
  'co2', 'co₂', 'emission', 'treibhausgas',
  'kessel', 'dampfkessel',
  'anlage', 'haustechnik', 'gebäudetechnik', 'technische anlage',
  'infrastruktur', 'technik', 'technologie',
  'investition', 'projekt',
]

// If ANY of these appear in the context → discard the match
const MARKETING_DISCARD_TERMS = [
  'zimmer', 'suite', 'doppelzimmer', 'einzelzimmer', 'appartement',
  'inneneinrichtung', 'einrichtung', 'eingerichtet', 'möbel', 'mobiliar',
  'dekor', 'interieur', 'interior', 'design', 'luxus', 'ausstattung',
  'restaurant', 'speisekarte', 'menü', 'frühstück', 'abendessen', 'buffet',
  'massage', 'körperpflege', 'schönheitspflege', 'behandlung',
]

// Reviews: if the text is primarily about food/service (not heating) → skip
const REVIEW_DISCARD_TERMS = [
  'essen', 'speise', 'mahlzeit', 'frühstück', 'abendessen', 'restaurant',
  'küche', 'speisekarte', 'menü', 'gericht', 'buffet',
  'service', 'personal', 'mitarbeiter', 'rezeption', 'empfang',
  'freundlich', 'unfreundlich', 'bedienung', 'kellner',
  'lage', 'aussicht', 'parkplatz', 'preis', 'teuer', 'günstig',
]

function hasEnergyContext(ctx) {
  const c = ctx.toLowerCase()
  return ENERGY_PRESSURE_TERMS.some(t => c.includes(t))
}

function hasMarketingContext(ctx) {
  const c = ctx.toLowerCase()
  return MARKETING_DISCARD_TERMS.some(t => c.includes(t))
}

// Returns true if the review is about food/service and NOT about heating
function isNonHeatingReview(text) {
  const t           = text.toLowerCase()
  const heatingHits = REVIEW_SIGNAL_GROUP.keywords.filter(k => t.includes(k)).length
  if (heatingHits > 0) return false                                    // has heating content → keep
  const discardHits = REVIEW_DISCARD_TERMS.filter(d => t.includes(d)).length
  return discardHits > 0                                               // only food/service → discard
}

// ── Targeted intelligence pages ───────────────────────────────────────────────

const INTELLIGENCE_PATHS = [
  '/aktuelles', '/news', '/presse', '/pressemitteilungen', '/blog',
  '/projekte', '/investitionen', '/bauvorhaben',
  '/nachhaltigkeit', '/sustainability', '/esg',
  '/energie', '/energieeffizienz', '/klima', '/co2', '/umwelt',
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
  const pages = [], sources = []
  let tried = 0
  for (const path of INTELLIGENCE_PATHS) {
    if (tried >= 6) break
    tried++
    const page = await fetchPage(base + path)
    if (page) { pages.push({ ...page, pageType: path.replace('/', '') }); sources.push(page.url) }
    if (pages.reduce((s, p) => s + p.text.length, 0) > 40000) break
  }
  return { pages, sources }
}

// ── SerpAPI ───────────────────────────────────────────────────────────────────

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
    const hits = data.local_results || []
    if (!hits.length) throw new Error('No Google Maps results')
    return hits[0]
  } catch (e) { clearTimeout(t); throw e }
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
  } catch { clearTimeout(t); return [] }
}

// ── Website signal analysis — with context validation ─────────────────────────
//
// Every keyword match must pass two context checks on the ±200-char window:
//   PASS  → at least one ENERGY_PRESSURE_TERM present
//   FAIL  → any MARKETING_DISCARD_TERM present  (immediately discarded)

function analyzeWebPages(pages) {
  const detectedMap = {}
  const allEvidence = []
  const seenKwPage  = new Set()

  for (const { url, text, pageType } of pages) {
    const tLow = text.toLowerCase()

    for (const g of SIGNAL_GROUPS) {
      for (const kw of g.keywords) {
        const kwLow = kw.toLowerCase()
        const idx   = tLow.indexOf(kwLow)
        if (idx === -1) continue

        // Extract ±200-char context window
        const ctxStart = Math.max(0, idx - 200)
        const ctxEnd   = Math.min(text.length, idx + kw.length + 200)
        const ctx      = text.slice(ctxStart, ctxEnd)

        // Rule 1: discard if marketing/room/food context detected
        if (hasMarketingContext(ctx)) continue

        // Rule 2: only count if energy pressure context confirmed
        if (!hasEnergyContext(ctx)) continue

        // Passed both checks — record evidence
        const dedupeKey = `${kwLow}::${url}`
        if (!seenKwPage.has(dedupeKey)) {
          seenKwPage.add(dedupeKey)
          // Snippet: ±110 chars (tighter than context window)
          const sStart  = Math.max(0, idx - 110)
          const sEnd    = Math.min(text.length, idx + kw.length + 110)
          const raw     = text.slice(sStart, sEnd).replace(/\s+/g, ' ').trim()
          const snippet = (sStart > 0 ? '…' : '') + raw + (sEnd < text.length ? '…' : '')
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

// ── Review signal analysis — heating complaints ONLY ─────────────────────────
//
// A review is processed only if:
//   • It contains a heating/temperature keyword (REVIEW_SIGNAL_GROUP.keywords)
//   • It is NOT primarily about food, service, or ambiance

function analyzeReviews(reviews, placeUrl) {
  const detectedMap = {}
  const allEvidence = []
  const seenKwRev   = new Set()
  const g           = REVIEW_SIGNAL_GROUP

  for (const review of reviews) {
    const text = (review.snippet || review.text || '').trim()
    if (!text) continue

    // Discard: not about heating (food/service/ambiance review)
    if (isNonHeatingReview(text)) continue

    const tLow  = text.toLowerCase()
    const rating = typeof review.rating === 'number' ? review.rating : null

    for (const kw of g.keywords) {
      const kwLow = kw.toLowerCase()
      const idx   = tLow.indexOf(kwLow)
      if (idx === -1) continue

      const dedupeKey = `${kwLow}::${text.slice(0, 40)}`
      if (!seenKwRev.has(dedupeKey)) {
        seenKwRev.add(dedupeKey)
        const sStart  = Math.max(0, idx - 70)
        const sEnd    = Math.min(text.length, idx + kw.length + 70)
        const raw     = text.slice(sStart, sEnd).replace(/\s+/g, ' ').trim()
        const snippet = (sStart > 0 ? '…' : '') + raw + (sEnd < text.length ? '…' : '')
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
    id: g.id, label: g.label, tier: g.tier, weight: g.weight,
    matches: [...g.matches], hitCount: g.hitCount,
  }))

  const rawScore         = detectedSignals.reduce((s, g) => s + g.weight, 0)
  const strikerNeedScore = Math.min(100, rawScore)

  // Sort evidence: VERY_STRONG first, then STRONG, etc.
  const tierRank  = { VERY_STRONG: 0, STRONG: 1, MEDIUM: 2, WEAK: 3 }
  const allEvidence = [...webEvidence, ...revEvidence]
    .sort((a, b) => (tierRank[a.tier] ?? 4) - (tierRank[b.tier] ?? 4))

  const byGroup        = {}
  const signalEvidence = []
  for (const ev of allEvidence) {
    byGroup[ev.groupId] = (byGroup[ev.groupId] || 0) + 1
    if (byGroup[ev.groupId] <= 2) signalEvidence.push(ev)
    if (signalEvidence.length >= 25) break
  }

  const realSignals = detectedSignals.filter(s => s.tier !== 'WEAK')
  const top2        = [...realSignals].sort((a, b) => b.weight - a.weight).slice(0, 2)
  const hasWeak     = detectedSignals.some(s => s.tier === 'WEAK')

  let signalReason
  if (top2.length > 0) {
    const extra = realSignals.length > 2 ? ` +${realSignals.length - 2}` : ''
    signalReason = `Reálny signál: ${top2.map(s => s.label).join(', ')}${extra}.`
  } else if (hasWeak) {
    signalReason = 'Iba marketingový obsah — žiadny reálny energetický tlak.'
  } else {
    signalReason = 'Žiadne signály — firma nemá verejné energetické dáta.'
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
    name    = '',
    city    = '',
    country = 'DE',
    segment = '',
    web     = '',
    docId,
  } = body

  if (!name) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'name required' }) }

  if (!SERPAPI_KEY && !web) {
    const result = emptyResult('SERPAPI_API_KEY nie je nastavený a web nie je k dispozícii.')
    if (docId && FB_API_KEY && FB_PROJECT) await fsPatch(docId, result).catch(() => {})
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, name, ...result }) }
  }

  console.log(`[crawl-signals] START "${name}" city=${city} seg=${segment} web=${web || '—'} docId=${docId}`)
  const t0 = Date.now()

  // ── Source 1: website (targeted pages) ────────────────────────────────────
  const webTask = web
    ? crawlIntelligencePages(web)
    : Promise.resolve({ pages: [], sources: [] })

  // ── Source 2: Google Reviews (hotels/wellness only) ───────────────────────
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

  // ── Analyse ───────────────────────────────────────────────────────────────
  const { detectedMap: webDet, allEvidence: webEv } = analyzeWebPages(pages)

  const placeUrl = place?.link || (SERPAPI_KEY && isReviewSegment
    ? `https://www.google.com/maps/search/${encodeURIComponent(name + ' ' + city)}`
    : '')
  const { detectedMap: revDet, allEvidence: revEv } = analyzeReviews(reviews, placeUrl)

  const signals = buildResult(webDet, webEv, revDet, revEv)

  const payload = {
    ...signals,
    signalSources: [...sources, ...(placeUrl ? [placeUrl] : [])],
    reviewCount:   place?.reviews  ?? reviews.length,
    reviewRating:  place?.rating   ?? null,
    analyzedAt:    new Date().toISOString(),
  }

  console.log(`[crawl-signals] score=${payload.strikerNeedScore} groups=${payload.signalCount} evidence=${payload.signalEvidence.length} tier=${signals.detectedSignals.map(s => s.tier).join('+') || 'none'} ${Date.now() - t0}ms`)

  if (docId && FB_API_KEY && FB_PROJECT) {
    await fsPatch(docId, payload).catch(e =>
      console.warn('[crawl-signals] Firestore PATCH failed:', e.message)
    )
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, name, ...payload }) }
}

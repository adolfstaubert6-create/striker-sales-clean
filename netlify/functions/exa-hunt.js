/**
 * exa-hunt.js — Division B Intelligence via Exa.ai
 *
 * PRIMARY SOURCE: Exa semantic search
 *   Finds companies that publicly communicate an energy problem.
 *   Semantic queries are crafted so only companies WITH a problem appear —
 *   not companies that already solved it or sell heating equipment.
 *
 * CLAUDE FILTER:
 *   Each result is evaluated: is this company SEEKING a solution (keep)
 *   or has it already implemented one / is clearly irrelevant (discard)?
 *   One batched Haiku call handles all results cheaply.
 *
 * ENRICHMENT: Google Places (optional)
 *   After qualifying, look up each company for phone, rating, address.
 *   If Places finds nothing, the company is still saved with Exa data.
 *
 * SIGNAL EVIDENCE:
 *   The Exa snippet/highlight IS the first concrete signal — it shows the
 *   exact public statement that triggered the result.
 *
 * POST /.netlify/functions/exa-hunt
 * Body: { segment, locality, country, count }
 *
 * Required env: EXA_API_KEY, ANTHROPIC_API_KEY
 * Optional env: GOOGLE_PLACES_API_KEY, VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID
 */

const EXA_KEY      = process.env.EXA_API_KEY
const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY
const GOOGLE_KEY   = process.env.GOOGLE_PLACES_API_KEY
const FB_API_KEY   = process.env.VITE_FIREBASE_API_KEY
const FB_PROJECT   = process.env.VITE_FIREBASE_PROJECT_ID
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'

// ── Segment config ─────────────────────────────────────────────────────────────

const SEGMENT_LABELS = {
  hotel:      'Hotel / Ubytovanie',
  wellness:   'Wellness / Spa',
  laundry:    'Priemyselná práčovňa',
  hospital:   'Nemocnica / Klinika',
  restaurant: 'Reštaurácia / Gastro',
  food:       'Potravinárstvo',
  brewery:    'Pivovar',
  industrial: 'Priemysel / Iné',
}

// Base STRIKER FIT score by segment — elevated because the company already
// appeared in an energy-problem search, so it's pre-qualified
const SEGMENT_BASE = {
  hotel:      62,
  wellness:   74,
  laundry:    72,
  hospital:   64,
  restaurant: 50,
  food:       60,
  brewery:    70,
  industrial: 57,
}

// ── Exa semantic query per segment ────────────────────────────────────────────
// Queries are written to surface companies WITH a problem, not companies that
// already solved it or that sell heating products.

function buildExaQuery(segment, city) {
  switch (segment) {
    case 'hotel':
      return `Hotel ${city} hohe Heizkosten Heizungsanlage modernisieren Lösung suchen`
    case 'wellness':
      return `Wellness Spa ${city} Energiekosten Heizung Modernisierung`
    case 'laundry':
      return `Wäscherei ${city} Dampfkosten Energie Modernisierung`
    case 'hospital':
      return `Krankenhaus Klinik ${city} Energieeffizienz Heizung Modernisierung`
    case 'restaurant':
      return `Restaurant Gastronomie ${city} Energiekosten Heizung Betriebskosten senken`
    case 'food':
      return `Lebensmittelproduktion Bäckerei Molkerei ${city} Energiekosten Wärme Modernisierung`
    case 'brewery':
      return `Brauerei ${city} Dampfkosten Energiekosten Modernisierung Heizung`
    case 'industrial':
      return `Industrie Produktion ${city} Energiekosten Wärme Modernisierung Heizanlage`
    default:
      return `${segment} ${city} Energiekosten Heizung Modernisierung Lösung`
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function extractDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase() }
  catch { return null }
}

function extractSnippet(result) {
  if (result.highlights?.length) return result.highlights[0]
  if (result.text)               return result.text.slice(0, 400)
  return ''
}

// Score snippet for STRIKER FIT boost
function scoreSnippet(snippet, segment) {
  const text = (snippet || '').toLowerCase()
  const base = SEGMENT_BASE[segment] || 58

  const veryStrongKws = ['heizungsanlage', 'neue heizung', 'wärmepumpe', 'energieprojekt',
    'heating modernization', 'boiler replacement', 'heating system replacement']
  const strongKws     = ['energiekosten', 'heating costs', 'modernisierung', 'sanierung',
    'betriebskosten', 'effizienzsteigerung', 'energy costs', 'cost reduction',
    'heizung', 'heating']
  const mediumKws     = ['nachhaltigkeit', 'esg', 'sustainability', 'klimastrategie',
    'co2', 'energy efficiency', 'energieeffizienz']

  let boost = 0
  let tier  = 'MEDIUM'

  if (veryStrongKws.some(kw => text.includes(kw))) { boost = 30; tier = 'VERY_STRONG' }
  else if (strongKws.some(kw => text.includes(kw))) { boost = 20; tier = 'STRONG' }
  else if (mediumKws.some(kw => text.includes(kw))) { boost = 10; tier = 'MEDIUM' }

  const score          = Math.min(100, base + boost)
  const recommendation = score >= 70 ? 'immediate' : score >= 50 ? 'monitor' : 'unsuitable'
  return { score, tier, recommendation }
}

// Clean up page title to extract a usable company name
function extractName(title, url) {
  if (!title) return extractDomain(url) || ''
  return title.split(/\s+[–—|]\s+|\s+-\s+/)[0].trim().slice(0, 80)
}

// ── Exa search ─────────────────────────────────────────────────────────────────

async function exaSearch(query, numResults) {
  const ctrl = new AbortController()
  const t    = setTimeout(() => ctrl.abort(), 15000)
  try {
    const res = await fetch('https://api.exa.ai/search', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': EXA_KEY },
      body:    JSON.stringify({
        query,
        type:       'neural',
        numResults,
        contents: {
          text:       { maxCharacters: 600 },
          highlights: { numSentences: 3, highlightsPerUrl: 1 },
        },
      }),
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Exa API ${res.status}: ${err.slice(0, 120)}`)
    }
    const data = await res.json()
    return data.results || []
  } catch (e) {
    clearTimeout(t)
    throw e
  }
}

// ── Claude filter — seeking vs. already solved ─────────────────────────────────
// One batched Haiku call for all results. Falls back to accepting all if Claude fails.

async function claudeFilter(results, segment, city) {
  if (!CLAUDE_KEY || !results.length) {
    return results.map((_, i) => ({ index: i + 1, seeking: true, reason: 'no filter' }))
  }

  const listings = results.map((r, i) => {
    const snippet = extractSnippet(r).slice(0, 250)
    return `[${i + 1}] ${r.title || r.url}\n${r.url}\n${snippet}`
  }).join('\n\n')

  const prompt = `You are STRIKER B2B sales intelligence. We sell industrial heating technology (45kW → 120-160kW heat output, price 8000-10000 EUR, 50-70% savings on heating costs) to hotels, laundries, wellness centers, hospitals.

These results were found by searching for "${segment} ${city} energy/heating problems":

${listings}

For each result, determine:
- seeking: TRUE if the company HAS a heating/energy problem and is actively LOOKING for a solution (high costs, old system, planning upgrade, renovation, ESG pressure)
- seeking: FALSE if they ALREADY implemented a solution, are a heating VENDOR/installer, are generic news/blog content, or are clearly irrelevant

Return ONLY a valid JSON array, same count and order as input:
[{"index":1,"seeking":true,"reason":"one-line reason"}, ...]`

  try {
    const fetchP   = fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01' },
      body:    JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
    })
    const timeoutP = new Promise((_, rej) => setTimeout(() => rej(new Error('Claude timeout')), 12000))
    const res      = await Promise.race([fetchP, timeoutP])
    const data     = await res.json()
    if (!res.ok) throw new Error(data.error?.message || `Claude ${res.status}`)

    const raw    = (data.content?.[0]?.text || '').trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(raw)

    console.log(`[exa-hunt] Claude filter: ${parsed.filter(r => r.seeking).length}/${parsed.length} kept`)
    return parsed
  } catch (e) {
    console.warn('[exa-hunt] Claude filter failed:', e.message, '— accepting all')
    return results.map((_, i) => ({ index: i + 1, seeking: true, reason: 'filter error' }))
  }
}

// ── Google Places enrichment (optional) ───────────────────────────────────────

async function enrichWithPlaces(name, city, country) {
  if (!GOOGLE_KEY) return null
  const ctrl = new AbortController()
  const t    = setTimeout(() => ctrl.abort(), 6000)
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method:  'POST',
      headers: {
        'Content-Type':     'application/json',
        'X-Goog-Api-Key':   GOOGLE_KEY,
        'X-Goog-FieldMask': 'places.id,places.formattedAddress,places.rating,places.nationalPhoneNumber,places.userRatingCount',
      },
      body:   JSON.stringify({ textQuery: `${name} ${city} ${country || 'DE'}`, maxResultCount: 1, languageCode: 'de' }),
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!res.ok) return null
    const data  = await res.json()
    const place = data.places?.[0]
    if (!place) return null
    return {
      googlePlaceId: place.id                                          || '',
      address:       place.formattedAddress                            || '',
      rating:        typeof place.rating === 'number' ? place.rating  : null,
      phone:         place.nationalPhoneNumber                         || '',
      reviewCount:   place.userRatingCount                             || 0,
    }
  } catch {
    clearTimeout(t)
    return null
  }
}

// ── Firestore REST ─────────────────────────────────────────────────────────────

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
async function fsQueryByDomain(domain) {
  const res  = await fetch(`${FS_BASE()}:runQuery?key=${FB_API_KEY}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      structuredQuery: {
        from:  [{ collectionId: 'intelligence_targets' }],
        where: { fieldFilter: { field: { fieldPath: 'web' }, op: 'EQUAL', value: toFsVal(domain) } },
        limit: 1,
      },
    }),
  })
  const rows = await res.json()
  return Array.isArray(rows) ? rows.filter(r => r.document) : []
}
async function fsCreate(data) {
  const res = await fetch(`${FS_BASE()}/intelligence_targets?key=${FB_API_KEY}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields: toFsFields(data) }),
  })
  return res.json()
}

// ── Save one qualifying result to Firestore ────────────────────────────────────

async function saveResult(result, claudeVerdict, segment, city, country, seenDomains) {
  const url     = result.url || result.id || ''
  const domain  = extractDomain(url)
  if (!domain) return null

  // Dedup within this run
  if (seenDomains.has(domain)) return null
  seenDomains.add(domain)

  const name         = extractName(result.title, url)
  const snippet      = extractSnippet(result)
  const segmentLabel = SEGMENT_LABELS[segment] || segment
  const now          = new Date().toISOString()

  const { score, tier, recommendation } = scoreSnippet(snippet, segment)

  // Firestore dedup by domain
  const existing = await fsQueryByDomain(domain)
  if (existing.length) {
    const docId = existing[0].document.name.split('/').pop()
    console.log(`[exa-hunt] dup: ${name} (${domain}) → ${docId}`)
    return { name, city, web: domain, email: null, rating: null, overallScore: score, recommendation, segmentLabel, docId, duplicate: true, status: 'dup' }
  }

  // Google Places enrichment (parallel-friendly — already called in batch above)
  const places = await enrichWithPlaces(name, city, country)

  // Signal evidence — the Exa snippet IS the proof that the company is talking about this
  const signalEvidence = snippet ? [{
    groupId:    'exa_search',
    groupLabel: 'Exa semantic search',
    tier,
    keyword:    claudeVerdict?.reason || '',
    snippet,
    url,
    source:     'exa',
  }] : []

  const doc = await fsCreate({
    name,
    web:           domain,
    website:       url,
    email:         '',
    phone:         places?.phone         || '',
    address:       places?.address       || '',
    city,
    country:       country || 'DE',
    segment,
    segmentLabel,
    rating:        places?.rating        ?? null,
    reviewCount:   places?.reviewCount   ?? 0,
    googlePlaceId: places?.googlePlaceId || '',
    division:      'B',
    status:        'new',

    // FIT scores
    strikerFitScore:      score,
    heatDemandScore:      score,
    energyPainScore:      score,
    urgencyScore:         52,
    financialPowerScore:  52,
    buyingIntentScore:    55,
    buyingIntent:         tier === 'VERY_STRONG' ? 'strong' : 'medium',
    overallScore:         score,
    recommendation,
    recommendationReason: recommendation === 'immediate'
      ? 'Firma verejne komunikuje energetický problém — Exa semantic search + Claude overenie.'
      : recommendation === 'monitor'
      ? 'Stredný potenciál — potrebné ďalšie overenie.'
      : 'Nízky potenciál pre STRIKER.',
    nextStep: recommendation === 'immediate'
      ? 'Kontaktovať priamo — firma aktívne rieši energetiku.'
      : 'Analyzovať ďalšie zdroje pred kontaktom.',
    whyFound: `${name} objavená cez Exa semantic search — ${claudeVerdict?.reason || 'publicly signals energy problem'}.`,

    // Signal evidence
    signalEvidence,
    signalCount:      signalEvidence.length,
    strikerNeedScore: score,
    signalReason:     signalEvidence.length > 0
      ? `Exa: firma verejne komunikuje energetický problém (tier: ${tier}).`
      : 'Žiadne signály.',
    signalSources:    url ? [url] : [],
    analyzedAt:       now,

    // Empty for later enrichment
    detectedSignals:   [],
    signals:           [],
    sources:           [],
    contacts:          [],
    extractedKeywords: [],

    createdAt: now,
    updatedAt: now,
  })

  const docId = doc.name?.split('/').pop()
  console.log(`[exa-hunt] saved: ${name} (${domain}) score=${score} tier=${tier} → ${docId}`)

  return {
    name,
    city,
    web:           domain,
    email:         null,
    rating:        places?.rating ?? null,
    overallScore:  score,
    strikerFit:    score,
    recommendation,
    segmentLabel,
    docId,
    duplicate:     false,
    status:        'saved',
  }
}

// ── Handler ────────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  if (!EXA_KEY) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'EXA_API_KEY nie je nastavený.' }) }
  }

  const missing = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID'].filter(k => !process.env[k])
  if (missing.length) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: `Chýbajú env vars: ${missing.join(', ')}` }) }
  }

  let body
  try { body = JSON.parse(event.body) }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const { segment = 'hotel', locality = '', country = 'DE', count = 5 } = body

  if (!locality.trim()) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'locality je povinné' }) }
  }
  if (!SEGMENT_LABELS[segment]) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: `Neznámy segment: ${segment}` }) }
  }

  const safeCount = Math.min(Number(count) || 5, 15)
  const city      = locality.trim()
  const t0        = Date.now()
  const query     = buildExaQuery(segment, city)

  console.log(`[exa-hunt] START | segment=${segment} city=${city} country=${country} count=${safeCount}`)
  console.log(`[exa-hunt] Query: "${query}"`)

  try {
    // ── Step 1: Exa semantic search ──────────────────────────────────────────
    const numFetch  = Math.min(safeCount * 3, 20)  // fetch more — Claude will filter some out
    const rawResults = await exaSearch(query, numFetch)
    console.log(`[exa-hunt] Exa returned ${rawResults.length} results`)

    if (!rawResults.length) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true, total: 0, done: 0, dups: 0, errors: 0,
          elapsed: `${((Date.now() - t0) / 1000).toFixed(1)}s`,
          report:  [],
          message: `Exa nenašla výsledky pre: "${query}"`,
        }),
      }
    }

    // ── Step 2: Claude filter — seeking vs. already solved ────────────────────
    const verdicts = await claudeFilter(rawResults, segment, city)

    // Keep only results Claude marked as seeking, in order, up to safeCount
    const qualified = rawResults
      .map((r, i) => ({ result: r, verdict: verdicts.find(v => v.index === i + 1) }))
      .filter(({ verdict }) => verdict?.seeking !== false)
      .slice(0, safeCount)

    console.log(`[exa-hunt] After filter: ${qualified.length}/${rawResults.length} qualify`)

    // ── Step 3: Save qualifying results to Firestore ──────────────────────────
    const seenDomains = new Set()
    const settled     = await Promise.allSettled(
      qualified.map(({ result, verdict }) =>
        saveResult(result, verdict, segment, city, country, seenDomains)
      )
    )

    const report = []
    let   errors = 0
    for (const s of settled) {
      if (s.status === 'rejected') {
        errors++
        console.error('[exa-hunt] ✗', s.reason?.message)
      } else if (s.value) {
        report.push(s.value)
      }
    }

    const done    = report.filter(r => r.status === 'saved').length
    const dups    = report.filter(r => r.status === 'dup').length
    const elapsed = `${((Date.now() - t0) / 1000).toFixed(1)}s`

    console.log(`[exa-hunt] DONE | saved=${done} dups=${dups} errors=${errors} | ${elapsed}`)

    return {
      statusCode: 200,
      headers:    { 'Content-Type': 'application/json' },
      body:       JSON.stringify({ ok: true, segment, locality: city, country, total: report.length, done, dups, errors, elapsed, report }),
    }

  } catch (err) {
    console.error('[exa-hunt] Fatal:', err.message)
    return {
      statusCode: 500,
      headers:    { 'Content-Type': 'application/json' },
      body:       JSON.stringify({ ok: false, error: err.message }),
    }
  }
}

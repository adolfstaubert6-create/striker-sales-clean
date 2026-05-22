/**
 * FÁZA 6 — Live Google Reviews Signal Engine
 * Tries SerpAPI Google Maps → reviews → Claude analysis.
 * Falls back to segment-based estimates if any step fails.
 */

const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY
const SERPAPI_KEY  = process.env.SERPAPI_API_KEY
const CLAUDE_MODEL = 'claude-sonnet-4-6'

// ── Signal keyword detection ───────────────────────────────────────────────────

const KEYWORDS = [
  // heating / heat
  'heizung','heating','heat','warm','wärme','kalt','kúrenie','teplota','heiß',
  'warmwasser','hot water','cold rooms','kalte zimmer','friert','mrazivo',
  // renovation / modernization
  'renovierung','modernisierung','renovation','umbau','sanierung',
  'modernizácia','rekonštrukcia','veraltet','outdated','starý','alt',
  // technical problems
  'technisch','defekt','kaputt','broken','problem','störung','problém',
  'nefunguje','nicht funktioniert','ausfall','malfunction',
  // costs / energy
  'teuer','kosten','expensive','energiekosten','náklady','drahý',
  'steigende kosten','rising costs','energie','energy costs',
  // wellness / thermal
  'wellness','spa','pool','sauna','schwimmbad','bazén','thermal','therme',
  // boiler / equipment
  'heizkessel','kessel','boiler','kotol','dampf','steam',
]

function detectSignals(texts) {
  const combined = texts.join(' ').toLowerCase()
  return KEYWORDS.filter(kw => combined.includes(kw))
}

// ── Segment-based fallback (same as signal-engine.js) ─────────────────────────

function segmentFallback(segment, fitScore) {
  const seg = (segment || '').toLowerCase()
  const isL = seg.includes('waesch') || seg.includes('laund') || seg.includes('textil') || seg.includes('praco')
  const isH = seg.includes('hotel') || seg.includes('gastro') || seg.includes('resort') || seg.includes('wellness')
  const fit = fitScore || 50

  if (isL) return {
    heatPressure: 88,          heatPressureReason: 'Priemyselné práčovne spotrebúvajú teplo nepretržite 24 hodín denne.',
    thermalDependency: 93,     thermalDependencyReason: 'Bez teplej vody práčovňa okamžite zastavuje prevádzku.',
    operatingCostPressure: 85, operatingCostPressureReason: 'Energia tvorí 30–40 % celkových prevádzkových nákladov práčovne.',
    modernizationNeed: 72,     modernizationNeedReason: 'Starý kotol je typický pre práčovne — servisné náklady rastú.',
    boilerDependencyProb: 87,  boilerDependencyProbReason: 'Väčšina priemyselných práčovní používa plynový kotol ako primárny zdroj.',
    willingnessToSolve: 75,    willingnessToSolveReason: 'Energeticky náročné prevádzky aktívne hľadajú úspory pri vysokých nákladoch.',
  }
  if (isH) return {
    heatPressure: 74,          heatPressureReason: 'Hotel potrebuje teplú vodu nepretržite — izby, kuchyňa, wellness.',
    thermalDependency: 76,     thermalDependencyReason: 'Hotelová prevádzka silne závisí od stability dodávky tepla.',
    operatingCostPressure: 68, operatingCostPressureReason: 'Energia tvorí 20–30 % prevádzkových nákladov hotela.',
    modernizationNeed: 65,     modernizationNeedReason: 'Staršie hotely mávajú zastarané vykurovacie systémy s nízkym výkonom.',
    boilerDependencyProb: 73,  boilerDependencyProbReason: 'Plynový kotol je štandardom v hotelovej prevádzke.',
    willingnessToSolve: 70,    willingnessToSolveReason: 'Hotely pod tlakom rastúcich cien energie hľadajú stabilizáciu nákladov.',
  }
  const base = Math.round(45 + (fit - 50) * 0.4)
  return {
    heatPressure: Math.min(80, base + 5),          heatPressureReason: 'Segment naznačuje priemernú tepelnú záťaž prevádzky.',
    thermalDependency: Math.min(75, base),          thermalDependencyReason: 'Závislosť od tepla odhadnutá podľa typu segmentu.',
    operatingCostPressure: Math.min(72, base + 2), operatingCostPressureReason: 'Energetické náklady sú relevantné pre tento typ prevádzky.',
    modernizationNeed: Math.min(65, base - 5),     modernizationNeedReason: 'Potreba modernizácie odhadnutá na základe segmentu a FIT skóre.',
    boilerDependencyProb: Math.min(68, base),      boilerDependencyProbReason: 'Plynový kotol je pravdepodobný pri tomto type firmy.',
    willingnessToSolve: Math.min(65, base - 3),    willingnessToSolveReason: 'Ochota riešiť závisí od tlaku nákladov a veľkosti firmy.',
  }
}

// ── SerpAPI calls ─────────────────────────────────────────────────────────────

async function searchGoogleMaps(companyName, city, country, apiKey) {
  const gl  = ['at', 'ch'].includes((country || '').toLowerCase()) ? country.toLowerCase() : 'de'
  const q   = encodeURIComponent(`${companyName} ${city}`)
  const url = `https://serpapi.com/search.json?engine=google_maps&q=${q}&api_key=${apiKey}&hl=de&gl=${gl}&num=3`

  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), 7000)
  try {
    const res  = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`SerpAPI search HTTP ${res.status}`)
    const data = await res.json()
    const hits = data.local_results || []
    if (!hits.length) throw new Error('No Google Maps results')
    return hits[0]   // best match
  } catch (e) {
    clearTimeout(timer)
    throw e
  }
}

async function fetchReviews(dataId, apiKey) {
  if (!dataId) return []
  const url = `https://serpapi.com/search.json?engine=google_maps_reviews&data_id=${encodeURIComponent(dataId)}&api_key=${apiKey}&hl=de&num=10`

  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), 6000)
  try {
    const res  = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return []
    const data = await res.json()
    return (data.reviews || []).map(r => r.snippet || r.text || '').filter(Boolean)
  } catch {
    clearTimeout(timer)
    return []
  }
}

// ── Claude analysis of reviews ────────────────────────────────────────────────

async function analyzeWithClaude(companyName, segment, segmentLabel, fitScore, place, reviewTexts, detectedSignals) {
  const ratingInfo  = place.rating ? `Rating: ${place.rating}/5 (${place.reviews || 0} reviews)` : 'No rating'
  const signalStr   = detectedSignals.length ? detectedSignals.slice(0, 12).join(', ') : 'žiadne priamo detekované'
  const reviewSample = reviewTexts.slice(0, 8).join('\n---\n').slice(0, 1800) || 'Recenzie nedostupné'

  const prompt = `STRIKER Signal Analyst. Analyze Google reviews for energy/heating sales signals.
STRIKER: 45kW→120-160kW heat, saves 70% heating costs, price 8000-10000 EUR.

Company: ${companyName} | ${segmentLabel || segment} | FIT: ${fitScore}/100
${ratingInfo} | Detected keywords: ${signalStr}

Reviews (in original language):
${reviewSample}

Return ONLY valid JSON (all reason strings in Slovak, max 12 words each):
{"heatPressure":75,"heatPressureReason":"Recenzie spomínajú problémy s teplom.","thermalDependency":80,"thermalDependencyReason":"Prevádzka vyžaduje stálu dodávku tepla.","operatingCostPressure":70,"operatingCostPressureReason":"Signály rastúcich prevádzkových nákladov.","modernizationNeed":68,"modernizationNeedReason":"Technické problémy naznačujú starú techniku.","boilerDependencyProb":75,"boilerDependencyProbReason":"Segment typicky používa plynový kotol.","willingnessToSolve":72,"willingnessToSolveReason":"Zákazníci poukazujú na aktívne riešenie.","liveSignals":["signal 1","signal 2"],"reviewSummary":"2 vety zhrnutie kľúčových energetických signálov z recenzií.","dataQuality":"high"}`

  const fetchP   = fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
  })
  const timeoutP = new Promise((_, rej) => setTimeout(() => rej(new Error('Claude timeout 8s')), 8000))

  const res  = await Promise.race([fetchP, timeoutP])
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || `Claude ${res.status}`)

  const raw    = (data.content?.[0]?.text || '').trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  const parsed = JSON.parse(raw)

  // Validate required fields
  const required = ['heatPressure', 'thermalDependency', 'operatingCostPressure', 'modernizationNeed', 'boilerDependencyProb', 'willingnessToSolve']
  for (const f of required) if (parsed[f] == null) throw new Error(`missing: ${f}`)

  return parsed
}

// ── Main handler ───────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  let body
  try { body = JSON.parse(event.body || '{}') }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const {
    companyName, segment = '', segmentLabel = '', city = '', country = 'DE',
    strikerFitScore = 50,
    painPoints      = [],
    aiReasoning     = '',
  } = body

  if (!companyName) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'companyName required' }) }

  const t0 = Date.now()
  console.log(`[serpapi-reviews] START "${companyName}" city=${city} seg=${segment}`)

  // Hard 12s overall timeout — if exceeded, use fallback
  const hardTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error('hard timeout 12s')), 12000))

  async function livePipeline() {
    if (!SERPAPI_KEY) throw new Error('SERPAPI_API_KEY not set')
    if (!CLAUDE_KEY)  throw new Error('ANTHROPIC_API_KEY not set')

    // Step 1: Find company on Google Maps
    console.log('[serpapi-reviews] Step 1: Google Maps search')
    const place = await searchGoogleMaps(companyName, city, country, SERPAPI_KEY)
    console.log(`[serpapi-reviews] Found: "${place.title}" rating=${place.rating} reviews=${place.reviews}`)

    // Step 2: Fetch review texts (non-critical — proceed even if empty)
    let reviewTexts = []
    if (place.data_id) {
      console.log(`[serpapi-reviews] Step 2: Fetching reviews data_id=${place.data_id}`)
      reviewTexts = await fetchReviews(place.data_id, SERPAPI_KEY)
      console.log(`[serpapi-reviews] Got ${reviewTexts.length} review texts`)
    } else {
      console.warn('[serpapi-reviews] No data_id — skipping reviews fetch')
    }

    // Step 3: Detect keyword signals
    const detectedSignals = detectSignals([
      place.description || '',
      place.snippet     || '',
      ...reviewTexts,
    ])
    console.log(`[serpapi-reviews] Detected ${detectedSignals.length} keywords: ${detectedSignals.slice(0, 6).join(', ')}`)

    // Step 4: Claude analysis
    console.log('[serpapi-reviews] Step 4: Claude analysis')
    const result = await analyzeWithClaude(companyName, segment, segmentLabel, strikerFitScore, place, reviewTexts, detectedSignals)
    console.log(`[serpapi-reviews] Claude OK ${Date.now()-t0}ms`)

    return {
      ...result,
      reviewsSource:    'serpapi',
      reviewRating:     place.rating     || null,
      reviewCount:      place.reviews    || null,
      reviewsCachedAt:  new Date().toISOString(),
    }
  }

  try {
    const result = await Promise.race([livePipeline(), hardTimeout])
    console.log(`[serpapi-reviews] DONE LIVE ${Date.now()-t0}ms`)
    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({ ok: true, usedFallback: false, ...result }),
    }
  } catch (e) {
    console.warn(`[serpapi-reviews] Live failed (${e.message}) — segment fallback`)
    const fb = segmentFallback(segment, strikerFitScore)
    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({
        ok: true, usedFallback: true,
        reviewsSource: 'simulated',
        reviewsCachedAt: new Date().toISOString(),
        liveSignals: [],
        reviewSummary: null,
        dataQuality: 'none',
        ...fb,
      }),
    }
  }
}

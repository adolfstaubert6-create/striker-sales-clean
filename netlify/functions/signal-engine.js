const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY
const CLAUDE_MODEL = 'claude-sonnet-4-6'

// ── Segment-based fallback ─────────────────────────────────────────────────────

function segmentFallback(segment, fitScore) {
  const seg = (segment || '').toLowerCase()
  const isL = seg.includes('waesch') || seg.includes('laund') || seg.includes('textil') || seg.includes('praco')
  const isH = seg.includes('hotel') || seg.includes('gastro') || seg.includes('resort') || seg.includes('wellness')
  const fit = fitScore || 50

  // Laundry — very high heat demand by structural nature (steam, 24/7)
  if (isL) return {
    heatPressure: 90,               heatPressureReason: 'Priemyselná práčovňa spotrebúva teplo/paru nepretržite 24/7.',
    thermalDependency: 94,          thermalDependencyReason: 'Bez pary a teplej vody prevádzka okamžite stojí.',
    operatingCostPressure: 87,      operatingCostPressureReason: 'Energia 30–40 % prevádzkových nákladov — primárna položka.',
    modernizationNeed: 55,          modernizationNeedReason: 'Typický vek kotlov v práčovniach 10–20 rokov.',
    boilerDependencyProb: 88,       boilerDependencyProbReason: 'Plynový/parný kotol je štandardom priemyselnej práčovne.',
    willingnessToSolve: 72,         willingnessToSolveReason: 'Vysoké náklady vytvárajú silný tlak na úspory.',
  }
  // Hotel/wellness — high heat demand especially with pool/sauna
  if (isH) return {
    heatPressure: 76,               heatPressureReason: 'Hotel potrebuje teplú vodu 24/7 — izby, kuchyňa, wellness.',
    thermalDependency: 78,          thermalDependencyReason: 'Hotelová prevádzka závisí od nepretržitej dodávky tepla.',
    operatingCostPressure: 70,      operatingCostPressureReason: 'Energia 20–30 % prevádzkových nákladov hotela.',
    modernizationNeed: 50,          modernizationNeedReason: 'Priemerný vek hotelovej kotolne 12–18 rokov.',
    boilerDependencyProb: 75,       boilerDependencyProbReason: 'Plynový kotol dominuje hotelovej prevádzke.',
    willingnessToSolve: 65,         willingnessToSolveReason: 'Tlak nákladov na energie rastie — motivácia riešiť.',
  }
  // Generic — scale with fit score, base on structural probability only
  const base = Math.round(40 + (fit - 50) * 0.35)
  return {
    heatPressure: Math.min(78, base + 5),          heatPressureReason: 'Odhadovaná tepelná záťaž podľa typu segmentu.',
    thermalDependency: Math.min(72, base),          thermalDependencyReason: 'Závislosť od tepla podľa prevádzkovej charakteristiky.',
    operatingCostPressure: Math.min(70, base + 2), operatingCostPressureReason: 'Energetické náklady relevantné pre tento typ prevádzky.',
    modernizationNeed: Math.min(50, base - 8),     modernizationNeedReason: 'Odhadovaný vek zariadenia na základe segmentu.',
    boilerDependencyProb: Math.min(65, base),      boilerDependencyProbReason: 'Plynový kotol pravdepodobný pre daný typ firmy.',
    willingnessToSolve: Math.min(60, base - 5),    willingnessToSolveReason: 'Ochota riešiť závisí od intenzity nákladového tlaku.',
  }
}

// ── Claude signal estimation ───────────────────────────────────────────────────

async function runClaude(companyName, segment, segmentLabel, city, fitScore, painPoints, aiReasoning) {
  const painStr  = (painPoints || []).slice(0, 5).join(', ') || 'nie sú k dispozícii'
  const ctxStr   = aiReasoning ? `\nKontext: ${aiReasoning.slice(0, 200)}` : ''

  const prompt = `STRIKER Signal Engine. Return ONLY valid JSON, no markdown.
Company: ${companyName} | Segment: ${segmentLabel || segment} | City: ${city}
STRIKER FIT: ${fitScore}/100${ctxStr}

Score these 6 energy metrics (0-100). Base them on STRUCTURAL PROBABILITY from segment type,
operational characteristics, and building/equipment age — NOT on ESG marketing language or
hiring of Energy/Facility/Sustainability managers (those are weak signals, max +5).

Key structural indicators per metric:
- heatPressure: pool/sauna/wellness=high, laundry/steam=very high, hospital/food=high, hotel=medium-high
- thermalDependency: 24/7 operations=very high, laundry/food=very high, hotel=high
- operatingCostPressure: segment energy intensity (laundry/food/wellness > hotel > restaurant)
- modernizationNeed: building age 15+ years=high, typical segment equipment age
- boilerDependencyProb: gas/oil/pellet boiler likelihood by segment (laundry/hospital/hotel=high)
- willingnessToSolve: based on cost pressure severity, NOT on public ESG statements

All reason strings in Slovak, max 12 words, factual (no marketing language).

{"heatPressure":82,"heatPressureReason":"Práčovňa spotrebúva teplo nepretržite.","thermalDependency":90,"thermalDependencyReason":"Bez tepla prevádzka okamžite stojí.","operatingCostPressure":78,"operatingCostPressureReason":"Energia tvorí väčšinu prevádzkových nákladov.","modernizationNeed":55,"modernizationNeedReason":"Typický vek zariadenia 10–15 rokov.","boilerDependencyProb":85,"boilerDependencyProbReason":"Plynový kotol je štandardom v tomto segmente.","willingnessToSolve":70,"willingnessToSolveReason":"Vysoké prevádzkové náklady vytvárajú tlak na riešenie."}`

  const fetchP   = fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
  })
  const timeoutP = new Promise((_, rej) => setTimeout(() => rej(new Error('Claude timeout 12s')), 12000))

  const res  = await Promise.race([fetchP, timeoutP])
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || `Claude ${res.status}`)

  const raw    = (data.content?.[0]?.text || '').trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  const parsed = JSON.parse(raw)

  const required = ['heatPressure', 'thermalDependency', 'operatingCostPressure', 'modernizationNeed', 'boilerDependencyProb', 'willingnessToSolve']
  for (const f of required) {
    if (parsed[f] == null) throw new Error(`missing field: ${f}`)
  }
  return parsed
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  let body
  try { body = JSON.parse(event.body || '{}') }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const { companyName, segment = '', segmentLabel = '', city = '', strikerFitScore = 50, painPoints = [], aiReasoning = '' } = body
  if (!companyName) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'companyName required' }) }

  console.log(`[signal-engine] START "${companyName}" seg=${segment} fit=${strikerFitScore}`)
  const t0 = Date.now()

  let result, usedFallback = false

  if (CLAUDE_KEY) {
    try {
      result = await runClaude(companyName, segment, segmentLabel, city, strikerFitScore, painPoints, aiReasoning)
      console.log(`[signal-engine] Claude OK ${Date.now()-t0}ms`)
    } catch (e) {
      console.warn(`[signal-engine] Claude failed (${e.message}) — segment fallback`)
      result       = segmentFallback(segment, strikerFitScore)
      usedFallback = true
    }
  } else {
    result       = segmentFallback(segment, strikerFitScore)
    usedFallback = true
  }

  console.log(`[signal-engine] DONE ${Date.now()-t0}ms fallback=${usedFallback}`)
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, usedFallback, ...result }) }
}

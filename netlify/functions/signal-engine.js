const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY
const CLAUDE_MODEL = 'claude-sonnet-4-6'

// ── Segment-based fallback ─────────────────────────────────────────────────────

function segmentFallback(segment, fitScore) {
  const seg = (segment || '').toLowerCase()
  const isL = seg.includes('waesch') || seg.includes('laund') || seg.includes('textil') || seg.includes('praco')
  const isH = seg.includes('hotel') || seg.includes('gastro') || seg.includes('resort') || seg.includes('wellness')
  const fit = fitScore || 50

  if (isL) return {
    heatPressure: 88,               heatPressureReason: 'Priemyselné práčovne spotrebúvajú teplo nepretržite 24 hodín denne.',
    thermalDependency: 93,          thermalDependencyReason: 'Bez teplej vody práčovňa okamžite zastavuje prevádzku.',
    operatingCostPressure: 85,      operatingCostPressureReason: 'Energia tvorí 30–40 % celkových prevádzkových nákladov práčovne.',
    modernizationNeed: 72,          modernizationNeedReason: 'Starý kotol je typický pre práčovne — servisné náklady rastú.',
    boilerDependencyProb: 87,       boilerDependencyProbReason: 'Väčšina priemyselných práčovní používa plynový kotol ako primárny zdroj.',
    willingnessToSolve: 75,         willingnessToSolveReason: 'Energeticky náročné prevádzky aktívne hľadajú úspory pri vysokých nákladoch.',
  }
  if (isH) return {
    heatPressure: 74,               heatPressureReason: 'Hotel potrebuje teplú vodu nepretržite — izby, kuchyňa, wellness.',
    thermalDependency: 76,          thermalDependencyReason: 'Hotelová prevádzka silne závisí od stability dodávky tepla.',
    operatingCostPressure: 68,      operatingCostPressureReason: 'Energia tvorí 20–30 % prevádzkových nákladov hotela.',
    modernizationNeed: 65,          modernizationNeedReason: 'Staršie hotely mávajú zastarané vykurovacie systémy s nízkym výkonom.',
    boilerDependencyProb: 73,       boilerDependencyProbReason: 'Plynový kotol je štandardom v hotelovej prevádzke.',
    willingnessToSolve: 70,         willingnessToSolveReason: 'Hotely pod tlakom rastúcich cien energie hľadajú stabilizáciu nákladov.',
  }
  // generic — scale with fit score
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

// ── Claude signal estimation ───────────────────────────────────────────────────

async function runClaude(companyName, segment, segmentLabel, city, fitScore, painPoints, aiReasoning) {
  const painStr  = (painPoints || []).slice(0, 5).join(', ') || 'nie sú k dispozícii'
  const ctxStr   = aiReasoning ? `\nAI kontext: ${aiReasoning.slice(0, 200)}` : ''

  const prompt = `STRIKER Signal Engine. Return ONLY valid JSON, no markdown.
Company: ${companyName} | Segment: ${segmentLabel || segment} | City: ${city}
STRIKER FIT: ${fitScore}/100 | Pain signals: ${painStr}${ctxStr}

Estimate these 6 energy metrics (0-100 scale, 0=none, 100=maximum).
All reason strings in Slovak, max 12 words each, concise and specific.

{"heatPressure":82,"heatPressureReason":"Práčovňa spotrebúva teplo nepretržite.","thermalDependency":90,"thermalDependencyReason":"Bez tepla prevádzka okamžite stojí.","operatingCostPressure":78,"operatingCostPressureReason":"Energia tvorí väčšinu prevádzkových nákladov.","modernizationNeed":68,"modernizationNeedReason":"Starý kotol je typický pre tento segment.","boilerDependencyProb":85,"boilerDependencyProbReason":"Plynový kotol je štandardom v tomto segmente.","willingnessToSolve":73,"willingnessToSolveReason":"Vysoké náklady motivujú k hľadaniu riešení."}`

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

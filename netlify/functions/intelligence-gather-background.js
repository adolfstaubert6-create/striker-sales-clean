/**
 * STRIKER Intelligence Gather — Real AI Business Analysis Engine
 * Division B only
 *
 * Pipeline:
 *   1. Firecrawl → scrape company website (homepage + 4 pages)
 *   2. Signal detection → categorize thermal / hotel / industrial / ESG / urgency signals
 *   3. Claude AI → real business intelligence from actual web content
 *   4. Score calculation → based on detected signals, not guesses
 */

const CLAUDE_KEY    = process.env.ANTHROPIC_API_KEY
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY
const CLAUDE_MODEL  = 'claude-sonnet-4-6'

// ── Signal categories ─────────────────────────────────────────────────────────

const SIGNAL_GROUPS = {
  thermal: {
    label: 'Tepelné signály',
    keywords: ['spa','wellness','sauna','pool','schwimmbad','hallenbad','thermal','therme','whirlpool','jacuzzi','dampfbad','heizung','heating','wärme','warmwasser','warmwater','boiler','kessel','wärmepumpe','heizsystem','teplota','bazén','kúrenie','vykurovanie'],
    weight: 10,
  },
  hotel: {
    label: 'Hotel/Gastro signály',
    keywords: ['hotel','zimmer','rooms','restaurant','kitchen','küche','laundry','wäsche','konferenz','conference','resort','lodge','suite','breakfast','frühstück','lobby','reception','spa','fitness','wellness','ubytovanie','izby'],
    weight: 5,
  },
  industrial: {
    label: 'Priemyselné signály',
    keywords: ['produktion','production','manufacturing','fertig','fabrik','factory','plant','anlage','industrial','prozess','process','dampf','steam','druckdampf','brauerei','brewery','distillery','laundry','práčovňa','priemysel'],
    weight: 8,
  },
  esg: {
    label: 'ESG/Udržateľnosť signály',
    keywords: ['nachhaltig','sustainability','sustainable','eco','green','co2','carbon','klima','klimaschutz','environment','umwelt','iso 14001','iso 50001','energieeffizienz','energy efficiency','erneuerbar','renewable','ökologie','klimaneutral'],
    weight: 4,
  },
  urgency: {
    label: 'Urgentnosť/Modernizácia signály',
    keywords: ['modernisierung','modernization','sanierung','renovation','erneuerung','umbau','neubau','expansion','erweit','invest','projekt','zukunft','strategy','transform','digital','upgrade','wachstum','growth'],
    weight: 6,
  },
  luxury: {
    label: 'Luxus/Prémiový signály',
    keywords: ['luxury','luxus','premium','5-stern','five star','award','exclusive','boutique','design hotel','wellness resort','superior','deluxe','grand'],
    weight: 3,
  },
  job: {
    label: 'Job/HR signály',
    keywords: ['energy manager','energiemanager','facility manager','facilitymanager','sustainability manager','haustechnik','gebäudetechnik','hvac','heizungstechniker','kesselwart','energieoptimierung','energiebeauftragter','technical director','operations manager'],
    weight: 8,
  },
}

function detectSignals(text) {
  if (!text) return {}
  const lower = text.toLowerCase()
  const result = {}
  for (const [group, config] of Object.entries(SIGNAL_GROUPS)) {
    const found = config.keywords.filter(kw => lower.includes(kw))
    if (found.length > 0) result[group] = { label: config.label, found, weight: config.weight, count: found.length }
  }
  return result
}

function calcSignalScore(signalsByCategory, baseScore) {
  let boost = 0
  for (const config of Object.values(signalsByCategory)) {
    boost += Math.min(config.weight * 2, config.count * config.weight)
  }
  return Math.min(100, Math.max(0, baseScore + Math.min(30, boost)))
}

// ── Firecrawl ─────────────────────────────────────────────────────────────────

// Podstránky pre voliteľný second-pass (len ak homepage prebehol rýchlo)
const SUBPAGES = [
  '/ueber-uns', '/about', '/nachhaltigkeit', '/sustainability',
  '/leistungen', '/services',
]

function normalizeUrl(url) {
  if (!url) return null
  url = url.trim().replace(/\/$/, '')
  return url.startsWith('http') ? url : 'https://' + url
}

async function withTimeout(fn, ms, label = 'op') {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      console.error(`[TIMEOUT] ${label} exceeded ${ms}ms — aborting`)
      reject(new Error(`${label} timeout after ${ms}ms`))
    }, ms)
  })
  try {
    const r = await Promise.race([fn(), timeout])
    clearTimeout(timer)
    return r
  } catch (e) {
    clearTimeout(timer)
    console.error(`[TIMEOUT] ${label} caught:`, e.message)
    return null
  }
}

// Scrape jednej stránky s AbortController timeout
async function firecrawlPage(url, timeoutMs = 18000) {
  if (!FIRECRAWL_KEY || !url) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res
  try {
    res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${FIRECRAWL_KEY}` },
      body:    JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
      signal:  controller.signal,
    })
  } catch (fetchErr) {
    clearTimeout(timer)
    const msg = fetchErr.name === 'AbortError' ? `timeout (>${timeoutMs}ms)` : fetchErr.message
    console.error(`[firecrawl] Fetch error for ${url}: ${msg}`)
    return null
  }
  clearTimeout(timer)

  const ct = res.headers.get('content-type') || ''
  console.log(`[firecrawl] ${url} → status=${res.status} ct=${ct.split(';')[0]}`)

  if (!res.ok) {
    const preview = await res.text().catch(() => '').then(t => t.slice(0, 150))
    console.error(`[firecrawl] ${res.status} for ${url} — ${preview}`)
    return null
  }

  if (!ct.includes('application/json')) {
    const preview = await res.text().catch(() => '').then(t => t.slice(0, 150))
    console.error(`[firecrawl] Non-JSON (${ct}) for ${url} — ${preview}`)
    return null
  }

  let data
  try { data = await res.json() }
  catch (e) { console.error(`[firecrawl] JSON parse error for ${url}:`, e.message); return null }

  if (!data.success) { console.warn(`[firecrawl] success=false for ${url}:`, data.error || ''); return null }

  const content = (data.data?.markdown || '').slice(0, 3000)
  if (content.trim().length < 80) return null
  return { url, title: data.data?.metadata?.title || '', content }
}

// Stratégia: homepage first, potom 1 podstránka ak čas dovolí
async function gatherWebPages(baseUrl) {
  if (!FIRECRAWL_KEY || !baseUrl) {
    console.warn('[FC] No Firecrawl key or URL — skipping')
    return { pages: [], scanMode: 'no_key' }
  }

  const t0 = Date.now()
  console.log(`[FC] Phase-1 START homepage: ${baseUrl}`)
  const homepage = await withTimeout(() => firecrawlPage(baseUrl, 18000), 20000, 'FC-homepage')
  const hp_ms = Date.now() - t0

  if (!homepage) {
    console.warn(`[FC] Phase-1 FAILED ${hp_ms}ms — proceeding without web data`)
    return { pages: [], scanMode: 'homepage_failed' }
  }
  console.log(`[FC] Phase-1 DONE ${hp_ms}ms — ${homepage.content.length} chars scraped`)

  const pages = [homepage]
  if (hp_ms < 12000) {
    const subPath = SUBPAGES[0]
    console.log(`[FC] Phase-2 START subpage: ${subPath}`)
    const t1 = Date.now()
    const sub = await withTimeout(() => firecrawlPage(baseUrl + subPath, 8000), 9000, 'FC-subpage')
    if (sub) { pages.push(sub); console.log(`[FC] Phase-2 DONE ${Date.now()-t1}ms — ${sub.content.length} chars`) }
    else { console.log(`[FC] Phase-2 FAILED/skipped ${Date.now()-t1}ms`) }
  } else {
    console.log(`[FC] Phase-2 SKIPPED — homepage took ${hp_ms}ms`)
  }

  return { pages, scanMode: pages.length >= 2 ? 'full' : 'homepage_only' }
}

// ── Claude AI — real business intelligence ────────────────────────────────────

async function analyzeWithClaude({ companyName, segmentLabel, city, country, pages, signalsByCategory, currentScores }) {
  const hasContent   = pages.length > 0
  const webContent   = hasContent
    ? pages.map(p => `### ${p.title || p.url}\n${p.content}`).join('\n\n---\n\n').slice(0, 6000)
    : 'Web firmy nebol dostupný.'
  const signalSummary = Object.entries(signalsByCategory)
    .map(([, v]) => `${v.label}: ${v.found.slice(0, 5).join(', ')}`)
    .join(' | ') || 'žiadne'

  const prompt = `Si STRIKER INTELLIGENCE AI. Analyzuj firmu a vráť VÝLUČNE valid JSON bez markdown.

STRIKER technológia: 45kW → 120-160kW teplo, cena 8000-10000 EUR, ROI 6-36 mesiacov.

FIRMA: ${companyName}
SEGMENT: ${segmentLabel}
LOKALITA: ${[city, country].filter(Boolean).join(', ')}
SIGNÁLY: ${signalSummary}

WEB OBSAH:
${webContent}

POKYNY:
- Analýza musí byť KONKRÉTNA pre túto firmu, nie generická
- Ak web chýba: odhadni podľa segmentu, označ ako "AI odhad"
- Vygeneruj 2-4 konkrétne energetické problémy pre problemProfile
- Každá metrika musí mať číslo 0-100 A textové vysvetlenie prečo

JSON VÝSTUP (všetok text po slovensky):
{
  "websiteSummary": "2-3 vety čo táto firma robí",
  "extractedKeywords": ["max 6 kľúčových slov z webu"],
  "estimatedHeatDemand": "napr. ~150 kW — práčovňa s kontinuálnym ohrevom",
  "estimatedBusinessSize": "napr. Stredná firma · 50-150 zamestnancov",
  "estimatedEnergyIntensity": "veľmi vysoká — nepretržitý ohrev vody 24/7",
  "estimatedROI": "napr. 8-14 mesiacov · úspora ~900 EUR/mesiac",
  "aiReasoning": "2-3 vety prečo je firma dobrý STRIKER target",
  "businessOpportunity": "1-2 vety konkrétna príležitosť",
  "isRealPressure": true,
  "pressureLevel": "vysoký",
  "pressureExplanation": "1-2 vety prečo reálny tlak alebo nie",
  "timingAssessment": "1 veta či je teraz vhodný čas",
  "signals": ["signál 1", "signál 2", "signál 3"],
  "keyEvidence": ["priama citácia z webu alebo fakt 1", "fakt 2"],
  "strikerArgument": "1 veta najsilnejší argument",
  "urgencyBoost": 15,
  "buyingIntentBoost": 10,
  "energyFindings": "1-2 vety o energetických nákladoch",
  "modernizationFindings": "1-2 vety o modernizácii",
  "esgFindings": "1-2 vety o ESG signáloch",

  "problemProfile": [
    {
      "problem": "max 8 slov — konkrétny problém",
      "confidence": 88,
      "source": "https://firma.de/services alebo segment_analysis",
      "detectedText": "priama citácia z webu alebo null ak web chýbal",
      "aiReasoning": "1-2 vety prečo si AI myslí že tento problém existuje",
      "severity": "high",
      "strikerSolution": "1 veta ako STRIKER rieši tento konkrétny problém"
    },
    {
      "problem": "druhý konkrétny problém",
      "confidence": 72,
      "source": "segment_analysis",
      "detectedText": null,
      "aiReasoning": "1-2 vety reasoning",
      "severity": "medium",
      "strikerSolution": "1 veta riešenie"
    }
  ],

  "heatPressure": 85,
  "heatPressureReason": "1 veta prečo toto číslo — napr. práčovňa spotrebuje teplo nepretržite",
  "thermalDependency": 90,
  "thermalDependencyReason": "1 veta — napr. bez tepla prevádzka stojí",
  "operatingCostPressure": 75,
  "operatingCostPressureReason": "1 veta — napr. energie tvoria 35%+ nákladov",
  "modernizationNeed": 65,
  "modernizationNeedReason": "1 veta — napr. kotolňa staršia ako 10 rokov",
  "boilerDependencyProb": 80,
  "boilerDependencyProbReason": "1 veta — napr. segment typicky používa plynový kotol",
  "willingnessToSolve": 70,
  "willingnessToSolveReason": "1 veta — napr. ESG záväzky a rastúce ceny motivujú k zmene"
}`

  const claudeT0 = Date.now()
  console.log(`[CLAUDE] START — model=${CLAUDE_MODEL} max_tokens=3000 web_chars=${pages.map(p=>p.content.length).reduce((a,b)=>a+b,0)}`)

  const claudeFetch = fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01' },
    body:    JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
  })
  const claudeTimeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Claude timeout 45s')), 45000)
  )

  let res
  try {
    res = await Promise.race([claudeFetch, claudeTimeout])
  } catch (e) {
    console.error(`[CLAUDE] FAILED after ${Date.now()-claudeT0}ms:`, e.message)
    throw e
  }

  console.log(`[CLAUDE] HTTP response ${res.status} after ${Date.now()-claudeT0}ms`)

  const data = await res.json().catch(e => { throw new Error(`Claude JSON parse: ${e.message}`) })
  if (!res.ok) throw new Error(data.error?.message || `Claude ${res.status}`)

  const raw = (data.content?.[0]?.text || '').trim().replace(/^```json\s*/i,'').replace(/```\s*$/i,'').trim()
  console.log(`[CLAUDE] DONE ${Date.now()-claudeT0}ms — response length: ${raw.length} chars`)

  try {
    const parsed = JSON.parse(raw)
    console.log('[CLAUDE] JSON parse OK — keys:', Object.keys(parsed).join(', '))
    return parsed
  } catch (parseErr) {
    console.error('[CLAUDE] JSON parse FAILED. Raw preview:', raw.slice(0, 300))
    throw new Error('Claude vrátil nevalidný JSON: ' + parseErr.message)
  }
}

// ── Score calculation based on real signals ───────────────────────────────────

function buildUpdatedScores(ai, signalsByCategory, currentScores) {
  // Boost from real signals (not just Claude estimate)
  const signalUrgBoost  = (signalsByCategory.urgency?.count || 0) * 3 + (signalsByCategory.job?.count || 0) * 5
  const signalIntBoost  = (signalsByCategory.job?.count || 0) * 6 + (signalsByCategory.esg?.count || 0) * 2

  const urgBoost = (ai.urgencyBoost     || 0) + Math.min(15, signalUrgBoost)
  const intBoost = (ai.buyingIntentBoost || 0) + Math.min(15, signalIntBoost)

  const urgency       = Math.min(100, Math.max(0, currentScores.urgency     + urgBoost))
  const buyingIntent  = Math.min(100, Math.max(0, currentScores.buyingIntent + intBoost))
  const buyingIntentStr = buyingIntent >= 70 ? 'strong' : buyingIntent >= 40 ? 'medium' : 'weak'

  // FIT score based on signal-enhanced heat demand
  const heatSignalBoost = (signalsByCategory.thermal?.count || 0) * 5 + (signalsByCategory.hotel?.count || 0) * 2 + (signalsByCategory.industrial?.count || 0) * 4
  const enhancedHeatDemand = Math.min(100, currentScores.heatDemand + Math.min(20, heatSignalBoost))
  const strikerFitScore    = Math.min(100, Math.max(0, Math.round(
    enhancedHeatDemand             * 0.40 +
    currentScores.financialPower   * 0.30 +
    currentScores.energyPain       * 0.20 +
    urgency                        * 0.10
  )))

  return { urgencyScore: urgency, buyingIntentScore: buyingIntent, buyingIntent: buyingIntentStr, strikerFitScore }
}

// ── Firestore REST helpers — no firebase-admin needed ─────────────────────────

function fsVal(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'string') return { stringValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fsVal) } }
  if (typeof v === 'object') {
    const fields = {}
    for (const [k, val] of Object.entries(v)) { if (val !== undefined) fields[k] = fsVal(val) }
    return { mapValue: { fields } }
  }
  return { stringValue: String(v) }
}

function fsDoc(obj) {
  const fields = {}
  for (const [k, v] of Object.entries(obj)) { if (v !== undefined) fields[k] = fsVal(v) }
  return { fields }
}

async function fsWrite(projectId, apiKey, collection, docId, data, label = '') {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}?key=${apiKey}`
  const tag = label ? `[FS:${label}]` : '[FS]'
  console.log(`${tag} PATCH ${collection}/${docId} — fields: ${Object.keys(data).join(', ')}`)
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fsDoc(data)),
    })
    const ms = Date.now() - t0
    if (res.ok) {
      console.log(`${tag} OK ${res.status} in ${ms}ms`)
    } else {
      const body = await res.text().catch(() => '')
      console.error(`${tag} FAILED ${res.status} in ${ms}ms — ${body.slice(0, 300)}`)
    }
    return res.ok
  } catch (e) {
    console.error(`${tag} EXCEPTION after ${Date.now()-t0}ms:`, e.message)
    return false
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  if (!CLAUDE_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY chýba' }) }

  let body
  try { body = JSON.parse(event.body) } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const FS_PROJECT = process.env.FIREBASE_PROJECT_ID
  const FS_KEY     = process.env.FIREBASE_API_KEY

  const {
    targetId,
    companyName, url = '', segment = 'hotel', segmentLabel = '',
    city = '', country = 'DE',
    urgencyScore = 50, buyingIntentScore = 50, strikerFitScore = 50,
    heatDemandScore = 50, energyPainScore = 50, financialPowerScore = 50,
  } = body

  if (!targetId) {
    console.error('[intel-gather-bg] targetId missing — cannot write results to Firestore')
    return { statusCode: 400, body: JSON.stringify({ error: 'targetId required' }) }
  }

  // Write in-progress status immediately so UI shows spinner
  if (FS_PROJECT && FS_KEY) {
    await fsWrite(FS_PROJECT, FS_KEY, 'intelligence_targets', targetId, {
      gatherStatus: 'in_progress',
      gatherStartedAt: new Date().toISOString(),
    }).catch(e => console.warn('[intel-gather-bg] status write failed:', e.message))
  }

  if (!companyName?.trim()) return { statusCode: 400, body: JSON.stringify({ error: 'companyName povinný' }) }

  const baseUrl = normalizeUrl(url)
  const t0      = Date.now()

  // ── DEBUG: env vars check (nikdy neloguj celý key) ──────────────────────────
  console.log('[intel-gather] ENV CHECK:')
  console.log(`  ANTHROPIC_API_KEY present: ${!!CLAUDE_KEY}`)
  console.log(`  FIRECRAWL_API_KEY present: ${!!FIRECRAWL_KEY}`)
  console.log(`  FIRECRAWL_API_KEY prefix:  ${FIRECRAWL_KEY ? FIRECRAWL_KEY.slice(0, 6) + '...' : 'MISSING'}`)
  console.log(`  Firecrawl endpoint: https://api.firecrawl.dev/v1/scrape`)
  console.log(`  Company: "${companyName}" | URL: ${baseUrl || 'none'} | Segment: ${segment}`)
  // ────────────────────────────────────────────────────────────────────────────

  try {
    console.log(`[PIPELINE] START targetId=${targetId} company="${companyName}" url=${baseUrl||'none'}`)

    // ── STEP 1: Firecrawl ──
    console.log(`[PIPELINE] STEP 1 — Firecrawl scrape`)
    let pages    = []
    let scanMode = 'no_url'
    let crawlError = null
    try {
      const crawlResult = await withTimeout(() => gatherWebPages(baseUrl), 28000, 'gatherWebPages')
      pages    = crawlResult?.pages    || []
      scanMode = crawlResult?.scanMode || 'timeout'
      console.log(`[PIPELINE] STEP 1 DONE — ${pages.length} pages, mode=${scanMode}, total_chars=${pages.reduce((a,p)=>a+p.content.length,0)}`)
    } catch (crawlErr) {
      crawlError = crawlErr.message
      scanMode   = 'error'
      console.error('[PIPELINE] STEP 1 ERROR:', crawlErr.message, '— continuing without web data')
    }

    // ── STEP 2: Signal detection ──
    console.log(`[PIPELINE] STEP 2 — Signal detection`)
    const allText           = pages.map(p => p.content).join(' ')
    const signalsByCategory = detectSignals(allText)
    const allDetectedSignals = Object.entries(signalsByCategory).flatMap(([, v]) => v.found)
    console.log(`[PIPELINE] STEP 2 DONE — groups: [${Object.keys(signalsByCategory).join(', ')}] total_signals=${allDetectedSignals.length}`)

    // ── STEP 3: Claude AI ──
    console.log(`[PIPELINE] STEP 3 — Claude AI analysis`)
    const ai = await analyzeWithClaude({
      companyName, segmentLabel: segmentLabel || segment, city, country,
      pages, signalsByCategory,
      currentScores: { urgency: urgencyScore, buyingIntent: buyingIntentScore, strikerFit: strikerFitScore, heatDemand: heatDemandScore, energyPain: energyPainScore, financialPower: financialPowerScore },
    })
    console.log(`[PIPELINE] STEP 3 DONE — score=${ai.heatPressure} problemProfile=${(ai.problemProfile||[]).length} items`)

    // ── STEP 4: Score calculation ──
    console.log(`[PIPELINE] STEP 4 — Score calculation`)
    const updatedScores = buildUpdatedScores(ai, signalsByCategory, { urgency: urgencyScore, buyingIntent: buyingIntentScore, strikerFit: strikerFitScore, heatDemand: heatDemandScore, energyPain: energyPainScore, financialPower: financialPowerScore })
    console.log(`[PIPELINE] STEP 4 DONE — urgency=${updatedScores.urgencyScore} fit=${updatedScores.strikerFitScore}`)

    // ── STEP 5: Sources ──
    const sources = [
      ...(ai.topSources || []).map(s => ({ type: 'web', url: s.url, title: s.title, description: s.relevance })),
      ...pages.map(p => ({ type: 'web', url: p.url, title: p.title || p.url, description: 'Obsah webu firmy' })),
    ].filter(s => s.url).slice(0, 6)

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(`[PIPELINE] ALL STEPS DONE in ${elapsed}s — writing to Firestore now`)

    // ── STEP 6: Firebase write ──
    console.log(`[PIPELINE] STEP 6 — Firestore write targetId=${targetId}`)
    if (!FS_PROJECT || !FS_KEY) {
      console.error('[PIPELINE] STEP 6 FATAL — FIREBASE_PROJECT_ID or FIREBASE_API_KEY missing!')
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Firebase env vars missing' }) }
    }

    const writeOk = await fsWrite(FS_PROJECT, FS_KEY, 'intelligence_targets', targetId, {
        gatherStatus:    'done',
        gatherTimestamp: new Date().toISOString(),

        webPagesCount:   pages.length,
        crawlStatus:     crawlError ? `error: ${crawlError.slice(0, 80)}` : scanMode,
        crawlTimestamp:  new Date().toISOString(),

        signalsByCategory,
        detectedSignals: allDetectedSignals,
        signals:         [...new Set([...(ai.signals || [])])],
        keyEvidence:     ai.keyEvidence      || [],

        websiteSummary:          ai.websiteSummary           || '',
        extractedKeywords:       ai.extractedKeywords        || [],
        estimatedHeatDemand:     ai.estimatedHeatDemand      || '',
        estimatedBusinessSize:   ai.estimatedBusinessSize    || '',
        estimatedEnergyIntensity:ai.estimatedEnergyIntensity || '',
        estimatedROI:            ai.estimatedROI             || '',
        aiReasoning:             ai.aiReasoning              || '',
        businessOpportunity:     ai.businessOpportunity      || '',

        ...updatedScores,
        sources,

        problemProfile:             ai.problemProfile              || [],
        heatPressure:               ai.heatPressure               ?? null,
        heatPressureReason:         ai.heatPressureReason         || '',
        thermalDependency:          ai.thermalDependency          ?? null,
        thermalDependencyReason:    ai.thermalDependencyReason    || '',
        operatingCostPressure:      ai.operatingCostPressure      ?? null,
        operatingCostPressureReason:ai.operatingCostPressureReason|| '',
        modernizationNeed:          ai.modernizationNeed          ?? null,
        modernizationNeedReason:    ai.modernizationNeedReason    || '',
        boilerDependencyProb:       ai.boilerDependencyProb       ?? null,
        boilerDependencyProbReason: ai.boilerDependencyProbReason || '',
        willingnessToSolve:         ai.willingnessToSolve         ?? null,
        willingnessToSolveReason:   ai.willingnessToSolveReason   || '',

        lastGatherSummary: {
          isRealPressure:        ai.isRealPressure,
          pressureLevel:         ai.pressureLevel,
          pressureExplanation:   ai.pressureExplanation,
          timingAssessment:      ai.timingAssessment,
          strikerArgument:       ai.strikerArgument,
          energyFindings:        ai.energyFindings,
          modernizationFindings: ai.modernizationFindings,
          esgFindings:           ai.esgFindings,
          detectedJobRoles:      signalsByCategory.job?.found || [],
        },
      }, 'done-results')

    if (writeOk) {
      console.log(`[PIPELINE] STEP 6 DONE — gatherStatus:done written to Firestore`)
    } else {
      console.error(`[PIPELINE] STEP 6 FAILED — Firestore write returned false`)
    }

    const totalElapsed = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(`[PIPELINE] COMPLETE in ${totalElapsed}s`)
    return { statusCode: 200, body: JSON.stringify({ ok: true, elapsed: totalElapsed }) }

  } catch (err) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    console.error(`[PIPELINE] FATAL ERROR after ${elapsed}s:`, err.message)
    if (FS_PROJECT && FS_KEY) {
      console.log(`[PIPELINE] Writing error status to Firestore`)
      await fsWrite(FS_PROJECT, FS_KEY, 'intelligence_targets', targetId, {
        gatherStatus:    'error',
        gatherError:     err.message.slice(0, 300),
        gatherTimestamp: new Date().toISOString(),
      }, 'error-status')
    }
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) }
  }
}

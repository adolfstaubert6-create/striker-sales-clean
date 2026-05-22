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

const PAGES_TO_TRY = [
  { path: '',                label: 'Hlavná stránka' },
  { path: '/ueber-uns',      label: 'O spoločnosti'  },
  { path: '/about',          label: 'About'          },
  { path: '/nachhaltigkeit', label: 'ESG'            },
  { path: '/sustainability',  label: 'Sustainability'  },
  { path: '/karriere',       label: 'Kariéra'        },
  { path: '/leistungen',     label: 'Služby'         },
  { path: '/services',       label: 'Services'       },
]

async function withTimeout(fn, ms) {
  let timer
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms) })
  try { const r = await Promise.race([fn(), timeout]); clearTimeout(timer); return r }
  catch { clearTimeout(timer); return null }
}

function normalizeUrl(url) {
  if (!url) return null
  url = url.trim().replace(/\/$/, '')
  return url.startsWith('http') ? url : 'https://' + url
}

async function firecrawlPage(url) {
  if (!FIRECRAWL_KEY || !url) return null

  let res
  try {
    res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${FIRECRAWL_KEY}` },
      body:    JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
    })
  } catch (fetchErr) {
    console.error(`[firecrawl] Network error for ${url}:`, fetchErr.message)
    return null
  }

  // Log status pre debug
  const ct = res.headers.get('content-type') || ''
  console.log(`[firecrawl] ${url} → status=${res.status} content-type=${ct}`)

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    console.error(`[firecrawl] ${res.status} for ${url} — body preview: ${errText.slice(0, 200)}`)
    return null
  }

  // Overenie Content-Type pred JSON.parse
  if (!ct.includes('application/json')) {
    const rawText = await res.text().catch(() => '')
    console.error(`[firecrawl] Non-JSON response for ${url}. Content-Type: ${ct}. Preview: ${rawText.slice(0, 300)}`)
    return null
  }

  let data
  try {
    data = await res.json()
  } catch (jsonErr) {
    console.error(`[firecrawl] JSON parse failed for ${url}:`, jsonErr.message)
    return null
  }

  if (!data.success) {
    console.warn(`[firecrawl] success=false for ${url}:`, data.error || 'no error msg')
    return null
  }

  const content = (data.data?.markdown || '').slice(0, 3000)
  if (content.trim().length < 80) return null
  return { url, title: data.data?.metadata?.title || '', content }
}

async function gatherWebPages(baseUrl) {
  if (!FIRECRAWL_KEY || !baseUrl) return []
  const results = await Promise.all(
    PAGES_TO_TRY.slice(0, 6).map(p =>
      withTimeout(() => firecrawlPage(baseUrl + p.path), 8000)
    )
  )
  return results.filter(Boolean)
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

  const res  = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01' },
    body:    JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || `Claude ${res.status}`)

  const raw = (data.content?.[0]?.text || '').trim().replace(/^```json\s*/i,'').replace(/```\s*$/i,'').trim()
  try {
    return JSON.parse(raw)
  } catch (parseErr) {
    console.error('[intel-gather] JSON parse failed. Raw:', raw.slice(0, 500))
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

// ── Main handler ──────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  if (!CLAUDE_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY chýba' }) }

  let body
  try { body = JSON.parse(event.body) } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const {
    companyName, url = '', segment = 'hotel', segmentLabel = '',
    city = '', country = 'DE',
    urgencyScore = 50, buyingIntentScore = 50, strikerFitScore = 50,
    heatDemandScore = 50, energyPainScore = 50, financialPowerScore = 50,
  } = body

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
    // 1. Scrape web pages — zachytí akékoľvek Firecrawl chyby
    let pages = []
    let crawlError = null
    try {
      pages = await withTimeout(() => gatherWebPages(baseUrl), 20000) || []
      console.log(`[intel-gather] Scraped: ${pages.length} pages`)
    } catch (crawlErr) {
      crawlError = crawlErr.message
      console.error('[intel-gather] Firecrawl error (pokračujem bez webu):', crawlErr.message)
    }

    // 2. Signal detection from all web content
    const allText          = pages.map(p => p.content).join(' ')
    const signalsByCategory = detectSignals(allText)
    const allDetectedSignals = Object.entries(signalsByCategory).flatMap(([, v]) => v.found)
    console.log(`[intel-gather] Signals: ${Object.keys(signalsByCategory).join(', ')}`)

    // 3. Claude AI — real business intelligence
    const ai = await analyzeWithClaude({
      companyName, segmentLabel: segmentLabel || segment, city, country,
      pages,
      signalsByCategory,
      currentScores: { urgency: urgencyScore, buyingIntent: buyingIntentScore, strikerFit: strikerFitScore, heatDemand: heatDemandScore, energyPain: energyPainScore, financialPower: financialPowerScore },
    })

    // 4. Signal-based score calculation
    const updatedScores = buildUpdatedScores(ai, signalsByCategory, { urgency: urgencyScore, buyingIntent: buyingIntentScore, strikerFit: strikerFitScore, heatDemand: heatDemandScore, energyPain: energyPainScore, financialPower: financialPowerScore })

    // 5. Build sources from scraped pages
    const sources = [
      ...(ai.topSources || []).map(s => ({ type: 'web', url: s.url, title: s.title, description: s.relevance })),
      ...pages.map(p => ({ type: 'web', url: p.url, title: p.title || p.url, description: 'Obsah webu firmy' })),
    ].filter(s => s.url).slice(0, 6)

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(`[intel-gather] DONE ${elapsed}s | pages=${pages.length} | signals=${allDetectedSignals.length}`)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true, elapsed: `${elapsed}s`,
        webPagesCount:   pages.length,
        crawlStatus:     pages.length > 0 ? 'success' : crawlError ? `error: ${crawlError.slice(0,80)}` : (FIRECRAWL_KEY ? 'no_content' : 'no_api_key'),
        crawlTimestamp:  new Date().toISOString(),

        // Real signal data
        signalsByCategory,
        detectedSignals:  allDetectedSignals,
        signals:          ai.signals || [],
        keyEvidence:      ai.keyEvidence || [],

        // Real AI intelligence
        websiteSummary:          ai.websiteSummary          || '',
        extractedKeywords:       ai.extractedKeywords       || [],
        estimatedHeatDemand:     ai.estimatedHeatDemand     || '',
        estimatedBusinessSize:   ai.estimatedBusinessSize   || '',
        estimatedEnergyIntensity:ai.estimatedEnergyIntensity|| '',
        estimatedROI:            ai.estimatedROI            || '',
        aiReasoning:             ai.aiReasoning             || '',
        businessOpportunity:     ai.businessOpportunity     || '',

        // Scores and interpretation
        updatedScores,
        sources,

        // Problem Profile — s confidence, zdrojom, citáciou a AI reasoning
        problemProfile:             ai.problemProfile             || [],
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

        aiInterpretation: {
          isRealPressure:        ai.isRealPressure,
          pressureLevel:         ai.pressureLevel,
          pressureExplanation:   ai.pressureExplanation,
          timingAssessment:      ai.timingAssessment,
          strikerArgument:       ai.strikerArgument,
          energyFindings:        ai.energyFindings,
          modernizationFindings: ai.modernizationFindings,
          esgFindings:           ai.esgFindings,
          detectedJobRoles:      (signalsByCategory.job?.found || []),
        },

        capabilities: { firecrawl: !!FIRECRAWL_KEY, brave: false },
      }),
    }

  } catch (err) {
    console.error('[intel-gather] ERR:', err.message)
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: err.message }) }
  }
}

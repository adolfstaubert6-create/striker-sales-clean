/**
 * STRIKER INTELLIGENCE — Reálne zdroje dát
 * 4 vrstvy: Firecrawl web scraping · Brave Search · Job Signal Detection · AI Interpretation
 *
 * POST /.netlify/functions/intelligence-gather
 * Body: { companyName, url, segment, city, country,
 *         urgencyScore, buyingIntentScore, strikerFitScore,
 *         heatDemandScore, energyPainScore, financialPowerScore }
 *
 * Env vars:
 *   ANTHROPIC_API_KEY   (povinný)
 *   FIRECRAWL_API_KEY   (voliteľný — web scraping)
 *   BRAVE_SEARCH_API_KEY (voliteľný — externé vyhľadávanie)
 */

const CLAUDE_KEY    = process.env.ANTHROPIC_API_KEY
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY
const BRAVE_KEY     = process.env.BRAVE_SEARCH_API_KEY
const CLAUDE_MODEL  = 'claude-sonnet-4-6'

const JOB_KEYWORDS = [
  'energy manager', 'energiemanager', 'facility manager', 'facilitymanager',
  'sustainability manager', 'nachhaltigkeitsmanager', 'energiebeauftragter',
  'energieberater', 'technische leitung', 'betriebsleitung', 'hvac',
  'heizungstechniker', 'kesselwart', 'energieoptimierung', 'haustechnik',
  'gebäudetechnik', 'technical director', 'operations manager', 'boiler',
  'energy optimization', 'facility optimization', 'klimatechnik',
]

// ── Pomocné funkcie ───────────────────────────────────────────────────────────

async function withTimeout(fn, ms) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms)
  })
  try {
    const result = await Promise.race([fn(), timeout])
    clearTimeout(timer)
    return result
  } catch {
    clearTimeout(timer)
    return null
  }
}

function truncate(text, max) {
  if (!text) return ''
  return text.length > max ? text.slice(0, max) + '…' : text
}

function normalizeUrl(url) {
  if (!url) return null
  url = url.trim().replace(/\/$/, '')
  if (!url.startsWith('http')) url = 'https://' + url
  return url
}

function detectJobSignals(text) {
  if (!text) return []
  const lower = text.toLowerCase()
  return JOB_KEYWORDS.filter(kw => lower.includes(kw)).map(kw => ({
    keyword: kw,
    found: true,
  }))
}

// ── Vrstva 1: Firecrawl web scraping ─────────────────────────────────────────

async function firecrawlPage(url) {
  if (!FIRECRAWL_KEY || !url) return null
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${FIRECRAWL_KEY}` },
    body:    JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!data.success) return null
  return {
    url,
    title:   data.data?.metadata?.title || '',
    content: truncate(data.data?.markdown || '', 2800),
  }
}

async function gatherWebData(baseUrl) {
  if (!FIRECRAWL_KEY || !baseUrl) return []

  // Paralelne skúsime homepage + kariéru/jobs
  const careerVariants = [`${baseUrl}/karriere`, `${baseUrl}/jobs`, `${baseUrl}/stellenangebote`]
  const careerUrl = careerVariants[0] // skúsime prvú, ostatné neskôr ak bude čas

  const [homepage, careerPage] = await Promise.all([
    withTimeout(() => firecrawlPage(baseUrl),    9000),
    withTimeout(() => firecrawlPage(careerUrl),  7000),
  ])

  return [homepage, careerPage].filter(Boolean)
}

// ── Vrstva 2: Brave Search — externé signály ──────────────────────────────────

async function braveSearch(query) {
  if (!BRAVE_KEY) return []
  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=4`,
    { headers: { 'X-Subscription-Token': BRAVE_KEY, 'Accept': 'application/json' } }
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.web?.results || []).map(r => ({
    title:       r.title       || '',
    url:         r.url         || '',
    description: r.description || '',
  }))
}

async function gatherSearchData(companyName, city) {
  if (!BRAVE_KEY) return []

  const q = companyName
  const loc = city ? ` ${city}` : ''

  const queries = [
    `${q}${loc} Energie Kosten Nachhaltigkeit`,
    `${q}${loc} Modernisierung Heizung Energieoptimierung`,
    `${q} Energy Manager Facility Manager Stelle`,
    `${q}${loc} ESG sustainability Betriebskosten`,
  ]

  const allResults = await Promise.all(
    queries.map(query => withTimeout(() => braveSearch(query), 7000))
  )

  // Deduplikácia podľa URL
  const seen = new Set()
  return allResults
    .flat()
    .filter(r => r && r.url && !seen.has(r.url) && seen.add(r.url))
}

// ── Vrstva 3: Job Signal Detection ───────────────────────────────────────────

function extractJobSignals(webPages, searchResults) {
  const allText = [
    ...webPages.map(p => p.content),
    ...searchResults.map(r => r.title + ' ' + r.description),
  ].join(' ')

  const found = detectJobSignals(allText)
  const unique = [...new Set(found.map(j => j.keyword))]

  return unique.map(kw => {
    const ctx = allText
      .toLowerCase()
      .indexOf(kw)
    const snippet = ctx >= 0 ? allText.slice(Math.max(0, ctx - 60), ctx + 120).trim() : ''
    return { keyword: kw, context: snippet }
  })
}

// ── Vrstva 4: AI Interpretation ───────────────────────────────────────────────

async function interpretWithClaude({ companyName, segmentLabel, city, country, webPages, searchResults, jobSignals, currentScores }) {
  const webContent = webPages.map(p =>
    `### ${p.title} (${p.url})\n${p.content}`
  ).join('\n\n')

  const searchContent = searchResults.slice(0, 12).map(r =>
    `- [${r.title}](${r.url})\n  ${r.description}`
  ).join('\n')

  const jobContent = jobSignals.length > 0
    ? jobSignals.map(j => `• ${j.keyword}: "${truncate(j.context, 150)}"`).join('\n')
    : 'Žiadne pracovné signály nenájdené.'

  const hasFirecrawl = webPages.length > 0
  const hasBrave     = searchResults.length > 0

  const prompt = `Si STRIKER INTELLIGENCE AI. Analyzuj nasledujúce REÁLNE dáta o firme a vyhodnoť energetické signály.

FIRMA: ${companyName}
SEGMENT: ${segmentLabel}
LOKALITA: ${[city, country].filter(Boolean).join(', ')}
AKTUÁLNE SKÓRE: urgency=${currentScores.urgency ?? 50}, buyingIntent=${currentScores.buyingIntentScore ?? 50}, strikerFit=${currentScores.strikerFit ?? 50}

${hasFirecrawl ? `## OBSAH WEBU FIRMY (Firecrawl)\n${truncate(webContent, 4000)}` : '## WEB: Firecrawl nedostupný alebo URL neuvedená.'}

${hasBrave ? `## EXTERNÉ SPRÁVY (Brave Search)\n${searchContent}` : '## VYHĽADÁVANIE: Brave Search nedostupný.'}

## PRACOVNÉ PONUKY A JOB SIGNÁLY
${jobContent}

## INŠTRUKCIE PRE ANALÝZU

1. ROZLÍŠ — Toto je najdôležitejšie:
   - MARKETINGOVÝ TEXT: firma sa chváli ("sme ekologickí", "záleží nám na prostredí")
   - REÁLNY TLAK: firma MUSÍ konať (audit, kotolňa 15+ rokov, rastúce náklady, regulácia, tender)

2. VYHODNOŤ:
   - urgencyBoost: o koľko bodov zvýšiť/znížiť urgentnosť (-20 až +30)
   - buyingIntentBoost: o koľko bodov zvýšiť/znížiť záujem o kúpu (-20 až +30)
   - Job signály automaticky zvyšujú oba o +10 až +20

3. EXTRAHUJ zo zdrojov:
   - Konkrétne citácie ako dôkazy (nie marketing)
   - Relevantné URL so stručným dôvodom prečo sú dôležité

4. VŠETKO po SLOVENSKY

Vráť VÝLUČNE valid JSON (bez markdown):
{
  "isRealPressure": <true|false>,
  "pressureExplanation": "<1-2 vety: prečo áno alebo nie>",
  "timingAssessment": "<1-2 vety: je teraz vhodný čas kontaktovať>",
  "urgencyBoost": <int -20 to 30>,
  "buyingIntentBoost": <int -20 to 30>,
  "signals": ["<signál 1>", "<signál 2>", "<signál 3>"],
  "detectedJobRoles": ["<titul>", "<titul>"],
  "keyEvidence": ["<priama citácia alebo fakt 1>", "<fakt 2>", "<fakt 3>"],
  "webSummary": "<čo AI našla na webe firmy, 2-3 vety po slovensky>",
  "searchSummary": "<čo AI našla vo vyhľadávaní, 2-3 vety po slovensky>",
  "topSources": [
    { "url": "<url>", "title": "<nadpis>", "relevance": "<prečo je relevantný>" },
    { "url": "<url>", "title": "<nadpis>", "relevance": "<prečo>" }
  ]
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01' },
    body:    JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || `Claude API ${res.status}`)

  const raw = (data.content?.[0]?.text || '').trim()
    .replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()

  return JSON.parse(raw)
}

// ── Výpočet aktualizovaných skóre ────────────────────────────────────────────

function calcUpdatedScores(current, aiResult, jobSignals) {
  const jobBoost = Math.min(20, jobSignals.length * 8)
  const urgBoost  = (aiResult.urgencyBoost    || 0) + (aiResult.isRealPressure ? jobBoost : 0)
  const intBoost  = (aiResult.buyingIntentBoost || 0) + jobBoost

  const urgency        = Math.min(100, Math.max(0, (current.urgency        || 50) + urgBoost))
  const buyingIntScore = Math.min(100, Math.max(0, (current.buyingIntentScore || 50) + intBoost))
  const buyingIntent   = buyingIntScore >= 70 ? 'strong' : buyingIntScore >= 40 ? 'medium' : 'weak'

  // Recalculate striker fit (heatDemand×0.40 + financialPower×0.30 + energyPain×0.20 + urgency×0.10)
  const strikerFit = Math.round(
    (current.heatDemand     || 50) * 0.40 +
    (current.financialPower || 50) * 0.30 +
    (current.energyPain     || 50) * 0.20 +
    urgency                         * 0.10
  )

  return { urgencyScore: urgency, buyingIntentScore: buyingIntScore, buyingIntent, strikerFitScore: strikerFit }
}

// ── Hlavný handler ────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Nepovolená metóda' }) }
  }
  if (!CLAUDE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY nie je nakonfigurovaný' }) }
  }

  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Neplatné JSON telo' }) }
  }

  const {
    companyName, url = '', segment = 'hotel', city = '', country = 'DE', segmentLabel = '',
    urgencyScore = 50, buyingIntentScore = 50, strikerFitScore = 50,
    heatDemandScore = 50, energyPainScore = 50, financialPowerScore = 50,
  } = body

  if (!companyName?.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Názov firmy je povinný' }) }
  }

  const baseUrl  = normalizeUrl(url)
  const t0       = Date.now()

  console.log(`[intelligence-gather] START — ${companyName} | url=${baseUrl || 'none'} | firecrawl=${!!FIRECRAWL_KEY} | brave=${!!BRAVE_KEY}`)

  try {
    // ─ Fáza 1+2: paralelné zbieranie dát ────────────────────────────────────
    const [webPages, searchResults] = await Promise.all([
      withTimeout(() => gatherWebData(baseUrl), 11000).then(r => r || []),
      withTimeout(() => gatherSearchData(companyName, city), 10000).then(r => r || []),
    ])

    console.log(`[intelligence-gather] Zozbierané: ${webPages.length} strán, ${searchResults.length} výsledkov vyhľadávania`)

    // ─ Fáza 3: Job signal detection ──────────────────────────────────────────
    const jobSignals = extractJobSignals(webPages, searchResults)
    console.log(`[intelligence-gather] Job signály: ${jobSignals.length}`)

    // ─ Fáza 4: AI interpretácia ───────────────────────────────────────────────
    const aiResult = await interpretWithClaude({
      companyName, segmentLabel: segmentLabel || segment, city, country,
      webPages, searchResults, jobSignals,
      currentScores: { urgency: urgencyScore, buyingIntentScore, strikerFit: strikerFitScore, heatDemand: heatDemandScore, energyPain: energyPainScore, financialPower: financialPowerScore },
    })

    // ─ Výpočet aktualizovaných skóre ─────────────────────────────────────────
    const updatedScores = calcUpdatedScores(
      { urgency: urgencyScore, buyingIntentScore, strikerFit: strikerFitScore, heatDemand: heatDemandScore, energyPain: energyPainScore, financialPower: financialPowerScore },
      aiResult,
      jobSignals
    )

    // ─ Príprava zdrojov pre uloženie ─────────────────────────────────────────
    const sources = [
      // Zdroje z Brave Search (top relevantné)
      ...(aiResult.topSources || []).map(s => ({
        type:        'article',
        url:         s.url,
        title:       s.title,
        description: s.relevance,
      })),
      // Zdroje zo scrapovania (stránky firmy)
      ...webPages.map(p => ({
        type:        'web',
        url:         p.url,
        title:       p.title || p.url,
        description: 'Obsah webu firmy analyzovaný AI',
      })),
    ].slice(0, 8)

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(`[intelligence-gather] DONE | ${elapsed}s`)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok:             true,
        elapsed:        `${elapsed}s`,
        webPagesCount:  webPages.length,
        searchCount:    searchResults.length,
        jobSignals:     jobSignals.map(j => ({ role: j.keyword, context: truncate(j.context, 120) })),
        signals:        aiResult.signals || [],
        keyEvidence:    aiResult.keyEvidence || [],
        sources,
        aiInterpretation: {
          isRealPressure:     aiResult.isRealPressure,
          pressureExplanation:aiResult.pressureExplanation,
          timingAssessment:   aiResult.timingAssessment,
          webSummary:         aiResult.webSummary,
          searchSummary:      aiResult.searchSummary,
          urgencyBoost:       aiResult.urgencyBoost,
          buyingIntentBoost:  aiResult.buyingIntentBoost,
          detectedJobRoles:   aiResult.detectedJobRoles || [],
        },
        updatedScores,
        capabilities: {
          firecrawl: !!FIRECRAWL_KEY,
          brave:     !!BRAVE_KEY,
        },
      }),
    }

  } catch (err) {
    console.error('[intelligence-gather] CHYBA:', err.message)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message }),
    }
  }
}

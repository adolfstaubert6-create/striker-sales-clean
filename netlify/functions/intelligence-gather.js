/**
 * STRIKER INTELLIGENCE — Firecrawl Web Intelligence Layer
 *
 * POST /.netlify/functions/intelligence-gather
 * Body: { companyName, url, segment, segmentLabel, city, country,
 *         urgencyScore, buyingIntentScore, strikerFitScore,
 *         heatDemandScore, energyPainScore, financialPowerScore }
 *
 * Scrape stratégia (paralelne, 6 kategórií):
 *   Homepage · O spoločnosti · ESG/Nachhaltigkeit · Technika/Prevádzka
 *   Kariéra/Jobs · Novinky/Presse
 *
 * Povinné env: ANTHROPIC_API_KEY
 * Voliteľné:   FIRECRAWL_API_KEY (bez neho funkcia beží bez scrapovania)
 */

const CLAUDE_KEY    = process.env.ANTHROPIC_API_KEY
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY
const CLAUDE_MODEL  = 'claude-sonnet-4-6'

// ── Kategórie stránok na scrapovanie ─────────────────────────────────────────

const PAGE_CATEGORIES = [
  {
    key: 'about',
    label: 'O spoločnosti',
    paths: ['/ueber-uns', '/about', '/unternehmen', '/company', '/wir', '/o-nas'],
  },
  {
    key: 'esg',
    label: 'ESG / Udržateľnosť',
    paths: ['/nachhaltigkeit', '/sustainability', '/esg', '/umwelt', '/environment', '/klimaschutz', '/green'],
  },
  {
    key: 'technical',
    label: 'Technika / Prevádzka',
    paths: ['/technik', '/anlage', '/facility', '/technologie', '/produktion', '/betrieb', '/infrastruktur', '/haustechnik'],
  },
  {
    key: 'careers',
    label: 'Kariéra / Pracovné ponuky',
    paths: ['/karriere', '/jobs', '/stellenangebote', '/stellenangeboten', '/offene-stellen', '/arbeiten'],
  },
  {
    key: 'news',
    label: 'Novinky / Správy',
    paths: ['/news', '/presse', '/aktuelles', '/neuigkeiten', '/blog', '/pressemitteilungen', '/meldungen'],
  },
]

// Klíčové slová — pracovné signály
const JOB_KEYWORDS = [
  'energy manager', 'energiemanager', 'facility manager', 'facilitymanager',
  'sustainability manager', 'nachhaltigkeitsmanager', 'energiebeauftragter',
  'energieberater', 'hvac', 'heizungstechniker', 'kesselwart', 'haustechnik',
  'gebäudetechnik', 'klimatechnik', 'betriebsleitung', 'technische leitung',
  'technical director', 'operations manager', 'energie-beauftragter',
]

// Klíčové slová — energetické signály
const ENERGY_KEYWORDS = [
  'energiekosten', 'heizkosten', 'betriebskosten', 'energieverbrauch',
  'energieeffizienz', 'energy efficiency', 'kesselaustausch', 'boiler replacement',
  'heizungssanierung', 'heizungsmodernisierung', 'wärmepumpe', 'wärmeversorgung',
  'energieoptimierung', 'co2-reduktion', 'dekarbonisierung', 'decarbonization',
  'klimaziele', 'klimaneutral', 'energiewende', 'sanierung', 'modernisierung',
  'renovation', 'umbau', 'erneuerung', 'energieaudit', 'iso 50001',
  'treibhausgas', 'nachhaltigkeit', 'sustainability',
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

function countKeywords(text, keywords) {
  if (!text) return 0
  const lower = text.toLowerCase()
  return keywords.filter(kw => lower.includes(kw)).length
}

function extractJobSignals(text) {
  if (!text) return []
  const lower = text.toLowerCase()
  const found = JOB_KEYWORDS.filter(kw => lower.includes(kw))
  return [...new Set(found)].map(kw => {
    const idx     = lower.indexOf(kw)
    const context = idx >= 0 ? text.slice(Math.max(0, idx - 60), idx + 130).trim() : ''
    return { role: kw, context: truncate(context, 200) }
  })
}

// ── Firecrawl: scrapovanie jednej stránky ─────────────────────────────────────

async function firecrawlPage(url) {
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${FIRECRAWL_KEY}` },
    body:    JSON.stringify({
      url,
      formats:         ['markdown'],
      onlyMainContent: true,
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!data.success) return null

  const content = data.data?.markdown || ''
  if (content.trim().length < 150) return null   // príliš málo obsahu = 404/prázdna

  return {
    url,
    title:    data.data?.metadata?.title || '',
    content:  truncate(content, 2800),
    rawLen:   content.length,
    energyHits: countKeywords(content, ENERGY_KEYWORDS),
    jobHits:    countKeywords(content, JOB_KEYWORDS),
  }
}

// ── Scrapovanie kategórie — skús varianty, vráť prvý úspešný ─────────────────

async function scrapeCategoryPage(baseUrl, category) {
  for (const path of category.paths.slice(0, 3)) {
    const result = await withTimeout(() => firecrawlPage(baseUrl + path), 7000)
    if (result) return { ...result, category: category.key, categoryLabel: category.label, found: true }
  }
  return { url: baseUrl + category.paths[0], category: category.key, categoryLabel: category.label, found: false, content: '' }
}

// ── Hlavné scrapovanie: homepage + 5 kategórií paralelne ─────────────────────

async function gatherWebData(baseUrl) {
  if (!FIRECRAWL_KEY || !baseUrl) return { pages: [], scrapedPages: [] }

  // Všetko spustíme paralelne: homepage + 5 kategórií
  const [homepageResult, ...categoryResults] = await Promise.all([
    withTimeout(() => firecrawlPage(baseUrl), 10000),
    ...PAGE_CATEGORIES.map(cat => scrapeCategoryPage(baseUrl, cat)),
  ])

  const homepage = homepageResult
    ? { url: baseUrl, title: homepageResult.title, content: homepageResult.content, category: 'homepage', categoryLabel: 'Hlavná stránka', found: true, energyHits: homepageResult.energyHits, jobHits: homepageResult.jobHits }
    : { url: baseUrl, category: 'homepage', categoryLabel: 'Hlavná stránka', found: false, content: '' }

  const allPages = [homepage, ...categoryResults]

  return {
    pages:        allPages.filter(p => p.found && p.content),
    scrapedPages: allPages.map(p => ({
      url:           p.url,
      category:      p.category,
      categoryLabel: p.categoryLabel,
      found:         p.found,
      title:         p.title || '',
      energyHits:    p.energyHits || 0,
      jobHits:       p.jobHits    || 0,
    })),
  }
}

// ── AI interpretácia — Claude analyzuje scrapovaný obsah ─────────────────────

async function interpretWithClaude({ companyName, segmentLabel, city, country, pages, currentScores }) {
  if (pages.length === 0) {
    // Žiadny obsah — Claude odhadne na základe segmentu
    pages = [{ categoryLabel: 'Bez webového obsahu', content: 'Web firmy nebol dostupný alebo URL nebolo zadané.' }]
  }

  const webContent = pages.map(p =>
    `### [${p.categoryLabel}] ${p.url || ''}\n${truncate(p.content, 2500)}`
  ).join('\n\n---\n\n')

  const prompt = `Si STRIKER INTELLIGENCE AI. Analyzuj obsah webu firmy a extrahuj REÁLNE energetické signály.

FIRMA: ${companyName}
SEGMENT: ${segmentLabel}
LOKALITA: ${[city, country].filter(Boolean).join(', ')}
AKTUÁLNE AI SKÓRE: urgency=${currentScores.urgency ?? 50}, buyingIntent=${currentScores.buyingIntentScore ?? 50}, strikerFit=${currentScores.strikerFit ?? 50}

## OBSAH WEBU (Firecrawl):
${truncate(webContent, 6500)}

## TVOJA ÚLOHA:

**ROZLÍŠ** — toto je kritické:
- MARKETINGOVÝ TEXT: "sme zodpovední", "záleží nám na prírode", "zelená firma" → ignoruj, je to len branding
- REÁLNY SIGNÁL: konkrétny projekt, konkrétny problém, konkrétne čísla, tender, audit, výberové konanie → zaznamenej ako dôkaz

**HĽADAJ KONKRÉTNE:**
1. ENERGETICKÉ NÁKLADY: zmienky o rastúcich nákladoch, energiekosten, betriebskosten
2. MODERNIZÁCIA: sanierung, umbau, modernisierung, erneuerung, renovation
3. KOTOLŇA/VYKUROVANIE: kessel, heizung, kesselaustausch, wärmeversorgung
4. ESG ZÁVÄZKY: konkrétne CO2 ciele s termínmi, ISO 50001 certifikácia, energetický audit
5. JOB SIGNÁLY: energy manager, facility manager, haustechnik pozície
6. RECONSTRUCTIONS: konkrétne prebiehajúce projekty

**HODNOŤ REALISTICKY:**
- urgencyBoost: koľko bodov pridať/ubrať od urgentnosti (-20 to +30)
- buyingIntentBoost: koľko bodov pridať/ubrať od záujmu (-20 to +30)
- Nič nenájdené → negatívny alebo nulový boost, nie pozitívny

Vráť VÝLUČNE valid JSON (žiadny markdown), všetok text po SLOVENSKY:
{
  "isRealPressure": <true|false>,
  "pressureLevel": "nízky|stredný|vysoký|kritický",
  "pressureExplanation": "<2 vety: prečo reálny alebo iba marketing>",
  "timingAssessment": "<1-2 vety: je teraz vhodný čas kontaktovať>",
  "energyFindings": "<čo konkrétne sa našlo o energetických nákladoch a spotrebe, 2-3 vety>",
  "modernizationFindings": "<čo konkrétne sa našlo o modernizácii, sanácii, renovácii, 2-3 vety>",
  "esgFindings": "<čo konkrétne sa našlo o ESG, CO2, nachhaltigkeit, 2-3 vety>",
  "urgencyBoost": <int -20 to 30>,
  "buyingIntentBoost": <int -20 to 30>,
  "signals": ["<konkrétny signál 1>", "<signál 2>", "<signál 3>", "<signál 4>"],
  "detectedJobRoles": ["<titul>", "<titul>"],
  "keyEvidence": ["<priama citácia alebo fakt z webu 1>", "<fakt 2>", "<fakt 3>"],
  "strikerArgument": "<hlavný predajný argument pre STRIKER špecificky pre túto firmu, 1-2 vety>",
  "topSources": [
    { "url": "<url stránky>", "title": "<nadpis>", "relevance": "<prečo je relevantná>" }
  ]
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01' },
    body:    JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1400, messages: [{ role: 'user', content: prompt }] }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || `Claude API ${res.status}`)

  const raw = (data.content?.[0]?.text || '').trim()
    .replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()

  return JSON.parse(raw)
}

// ── Výpočet aktualizovaných skóre ────────────────────────────────────────────

function calcUpdatedScores(current, aiResult, jobSignals) {
  const jobBoost = Math.min(20, jobSignals.length * 7)
  const realBoost = aiResult.isRealPressure ? jobBoost : 0

  const urgency        = Math.min(100, Math.max(0, (current.urgency        ?? 50) + (aiResult.urgencyBoost    ?? 0) + realBoost))
  const buyingIntScore = Math.min(100, Math.max(0, (current.buyingIntentScore ?? 50) + (aiResult.buyingIntentBoost ?? 0) + jobBoost))
  const buyingIntent   = buyingIntScore >= 70 ? 'strong' : buyingIntScore >= 40 ? 'medium' : 'weak'

  // Strikerfit: heatDemand×0.40 + financialPower×0.30 + energyPain×0.20 + urgency×0.10
  const strikerFitScore = Math.min(100, Math.max(0, Math.round(
    (current.heatDemand     ?? 50) * 0.40 +
    (current.financialPower ?? 50) * 0.30 +
    (current.energyPain     ?? 50) * 0.20 +
    urgency                         * 0.10
  )))

  return { urgencyScore: urgency, buyingIntentScore: buyingIntScore, buyingIntent, strikerFitScore }
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
    companyName, url = '', segment = 'hotel', segmentLabel = '',
    city = '', country = 'DE',
    urgencyScore = 50, buyingIntentScore = 50, strikerFitScore = 50,
    heatDemandScore = 50, energyPainScore = 50, financialPowerScore = 50,
  } = body

  if (!companyName?.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Názov firmy je povinný' }) }
  }

  const baseUrl = normalizeUrl(url)
  const t0      = Date.now()

  console.log(`[intel-gather] START — "${companyName}" | url=${baseUrl || 'none'} | firecrawl=${!!FIRECRAWL_KEY}`)

  try {
    // ─ Scrapovanie webu (Firecrawl) ──────────────────────────────────────────
    const { pages, scrapedPages } = await withTimeout(
      () => gatherWebData(baseUrl),
      20000
    ) || { pages: [], scrapedPages: [] }

    console.log(`[intel-gather] Scraped: ${pages.length} pages found, ${scrapedPages.length} tried`)

    // ─ Job signal detection naprieč všetkým obsahom ──────────────────────────
    const allText    = pages.map(p => p.content).join(' ')
    const jobSignals = extractJobSignals(allText)
    console.log(`[intel-gather] Job signals: ${jobSignals.length}`)

    // ─ Claude AI interpretácia ────────────────────────────────────────────────
    const aiResult = await interpretWithClaude({
      companyName, segmentLabel: segmentLabel || segment, city, country,
      pages,
      currentScores: { urgency: urgencyScore, buyingIntentScore, strikerFit: strikerFitScore, heatDemand: heatDemandScore, energyPain: energyPainScore, financialPower: financialPowerScore },
    })

    // ─ Aktualizácia skóre ─────────────────────────────────────────────────────
    const updatedScores = calcUpdatedScores(
      { urgency: urgencyScore, buyingIntentScore, strikerFit: strikerFitScore, heatDemand: heatDemandScore, energyPain: energyPainScore, financialPower: financialPowerScore },
      aiResult,
      jobSignals
    )

    // ─ Príprava zdrojov ───────────────────────────────────────────────────────
    const sources = [
      ...(aiResult.topSources || []).map(s => ({
        type:        'web',
        url:         s.url,
        title:       s.title,
        description: s.relevance,
      })),
      // Stránky s energetickými signálmi ako zdroje
      ...pages.filter(p => p.energyHits >= 2).map(p => ({
        type:        'web',
        url:         p.url,
        title:       p.title || p.categoryLabel,
        description: `${p.energyHits} energetických signálov nájdených`,
      })),
    ].filter(s => s.url).slice(0, 8)

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(`[intel-gather] DONE | ${elapsed}s`)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok:            true,
        elapsed:       `${elapsed}s`,
        webPagesCount: pages.length,
        scrapedPages,
        jobSignals:    jobSignals.slice(0, 8),
        signals:       aiResult.signals      || [],
        keyEvidence:   aiResult.keyEvidence  || [],
        sources,
        aiInterpretation: {
          isRealPressure:         aiResult.isRealPressure,
          pressureLevel:          aiResult.pressureLevel,
          pressureExplanation:    aiResult.pressureExplanation,
          timingAssessment:       aiResult.timingAssessment,
          energyFindings:         aiResult.energyFindings,
          modernizationFindings:  aiResult.modernizationFindings,
          esgFindings:            aiResult.esgFindings,
          strikerArgument:        aiResult.strikerArgument,
          detectedJobRoles:       aiResult.detectedJobRoles || [],
          urgencyBoost:           aiResult.urgencyBoost,
          buyingIntentBoost:      aiResult.buyingIntentBoost,
        },
        updatedScores,
        capabilities: { firecrawl: !!FIRECRAWL_KEY, brave: false },
      }),
    }

  } catch (err) {
    console.error('[intel-gather] CHYBA:', err.message)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message }),
    }
  }
}

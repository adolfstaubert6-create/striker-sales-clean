const CLAUDE_KEY    = process.env.ANTHROPIC_API_KEY
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY
const CLAUDE_MODEL  = 'claude-sonnet-4-6'

const JOB_KEYWORDS = ['energy manager','energiemanager','facility manager','facilitymanager','sustainability manager','hvac','heizungstechniker','kesselwart','haustechnik','gebäudetechnik','energieoptimierung','energiebeauftragter']

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

const PAGE_PATHS = [
  { cat: 'homepage',   path: ''                   },
  { cat: 'about',      path: '/ueber-uns'         },
  { cat: 'esg',        path: '/nachhaltigkeit'    },
  { cat: 'technical',  path: '/technik'           },
  { cat: 'careers',    path: '/karriere'          },
]

async function firecrawlPage(url) {
  if (!FIRECRAWL_KEY || !url) return null
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${FIRECRAWL_KEY}` },
    body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!data.success) return null
  const content = (data.data?.markdown || '').slice(0, 2500)
  if (content.trim().length < 100) return null
  return { url, title: data.data?.metadata?.title || '', content }
}

function extractJobSignals(text) {
  if (!text) return []
  const lower = text.toLowerCase()
  return [...new Set(JOB_KEYWORDS.filter(kw => lower.includes(kw)))].map(kw => ({ role: kw, context: '' }))
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  if (!CLAUDE_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY chýba' }) }

  let body
  try { body = JSON.parse(event.body) } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const { companyName, url = '', segment = 'hotel', segmentLabel = '', city = '', country = 'DE', urgencyScore = 50, buyingIntentScore = 50, strikerFitScore = 50, heatDemandScore = 50, energyPainScore = 50, financialPowerScore = 50 } = body
  if (!companyName?.trim()) return { statusCode: 400, body: JSON.stringify({ error: 'companyName povinný' }) }

  const baseUrl = normalizeUrl(url)
  const t0 = Date.now()

  try {
    // Scrape pages in parallel
    const pages = (await Promise.all(
      PAGE_PATHS.map(p => withTimeout(() => firecrawlPage(baseUrl ? baseUrl + p.path : null), 8000))
    )).filter(Boolean)

    const allText    = pages.map(p => p.content).join(' ')
    const jobSignals = extractJobSignals(allText)

    const webContent = pages.length > 0
      ? pages.map(p => `### ${p.title || p.url}\n${p.content}`).join('\n\n---\n\n')
      : 'Web firmy nebol dostupný alebo URL nebolo zadané.'

    const prompt = `Si STRIKER INTELLIGENCE AI. Analyzuj obsah webu firmy.

FIRMA: ${companyName}
SEGMENT: ${segmentLabel || segment}
LOKALITA: ${[city, country].filter(Boolean).join(', ')}
AKTUÁLNE SKÓRE: urgency=${urgencyScore}, buyingIntent=${buyingIntentScore}, fit=${strikerFitScore}

## WEB OBSAH (Firecrawl):
${webContent.slice(0, 5000)}

ROZLÍŠ:
- MARKETING: firma sa chváli (ignoruj)
- REÁLNY SIGNÁL: konkrétny problém, projekt, tender, audit (zaznamenej)

Vráť VÝLUČNE valid JSON (bez markdown), text po SLOVENSKY:
{
  "isRealPressure": <true|false>,
  "pressureLevel": "nízky|stredný|vysoký|kritický",
  "pressureExplanation": "<2 vety>",
  "timingAssessment": "<1 veta>",
  "energyFindings": "<2 vety o energetických nákladoch>",
  "modernizationFindings": "<2 vety o modernizácii>",
  "esgFindings": "<2 vety o ESG/udržateľnosti>",
  "urgencyBoost": <int -20 to 30>,
  "buyingIntentBoost": <int -20 to 30>,
  "signals": ["<signál 1>","<signál 2>","<signál 3>"],
  "keyEvidence": ["<citácia 1>","<citácia 2>"],
  "strikerArgument": "<1 veta hlavný argument>",
  "topSources": [{"url":"<url>","title":"<nadpis>","relevance":"<prečo>"}]
}`

    const res  = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || `Claude ${res.status}`)

    const raw = (data.content?.[0]?.text || '').trim().replace(/^```json\s*/i,'').replace(/```\s*$/i,'').trim()
    let ai
    try { ai = JSON.parse(raw) } catch { throw new Error('AI vrátil neplatný JSON') }

    const jobBoost  = Math.min(15, jobSignals.length * 7)
    const urgBoost  = (ai.urgencyBoost    || 0) + (ai.isRealPressure ? jobBoost : 0)
    const intBoost  = (ai.buyingIntentBoost || 0) + jobBoost
    const urgency   = Math.min(100, Math.max(0, urgencyScore     + urgBoost))
    const buying    = Math.min(100, Math.max(0, buyingIntentScore + intBoost))
    const newFit    = Math.min(100, Math.max(0, Math.round(heatDemandScore * 0.40 + financialPowerScore * 0.30 + energyPainScore * 0.20 + urgency * 0.10)))

    const sources = (ai.topSources || []).map(s => ({ type: 'web', url: s.url, title: s.title, description: s.relevance }))
      .concat(pages.map(p => ({ type: 'web', url: p.url, title: p.title || p.url, description: 'Obsah webu firmy' })))
      .filter(s => s.url).slice(0, 6)

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true, elapsed: `${elapsed}s`, webPagesCount: pages.length,
        jobSignals, signals: ai.signals || [], keyEvidence: ai.keyEvidence || [], sources,
        aiInterpretation: { isRealPressure: ai.isRealPressure, pressureLevel: ai.pressureLevel, pressureExplanation: ai.pressureExplanation, timingAssessment: ai.timingAssessment, energyFindings: ai.energyFindings, modernizationFindings: ai.modernizationFindings, esgFindings: ai.esgFindings, strikerArgument: ai.strikerArgument, detectedJobRoles: jobSignals.map(j => j.role) },
        updatedScores: { urgencyScore: urgency, buyingIntentScore: buying, buyingIntent: buying >= 70 ? 'strong' : buying >= 40 ? 'medium' : 'weak', strikerFitScore: newFit },
        capabilities: { firecrawl: !!FIRECRAWL_KEY, brave: false },
      }),
    }
  } catch (err) {
    console.error('[intelligence-gather]', err.message)
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: err.message }) }
  }
}

/**
 * Real contact finder — scrapes company website + SerpAPI Google search.
 * Returns only verified contacts with source URL + confidence.
 * Never invents names or emails.
 */

const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY
const SERPAPI_KEY  = process.env.SERPAPI_API_KEY
const CLAUDE_MODEL = 'claude-sonnet-4-6'

// Contact pages to try scraping
const CONTACT_PATHS = [
  '/impressum', '/kontakt', '/kontakt.html', '/kontakt.php',
  '/contact', '/contact-us', '/about', '/team',
  '/ueber-uns', '/about-us', '/ansprechpartner',
]

function normalizeUrl(url) {
  if (!url) return null
  url = url.trim().replace(/\/$/, '')
  return url.startsWith('http') ? url : `https://${url}`
}

// ── Firecrawl scrape one page ─────────────────────────────────────────────────

async function scrapePage(url, timeoutMs = 7000) {
  if (!FIRECRAWL_KEY) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${FIRECRAWL_KEY}` },
      body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('application/json')) return null
    const data = await res.json()
    if (!data.success || !data.data?.markdown) return null
    const text = data.data.markdown.slice(0, 2500)
    return text.trim().length > 50 ? { url, text } : null
  } catch {
    clearTimeout(timer)
    return null
  }
}

// ── Scrape company website for contacts ───────────────────────────────────────

async function scrapeWebsiteContacts(baseUrl) {
  const pages = []
  const t0 = Date.now()

  // Try homepage first
  const home = await scrapePage(baseUrl, 6000)
  if (home) pages.push(home)

  // Try contact-specific pages (max 2, within time budget)
  for (const path of CONTACT_PATHS) {
    if (Date.now() - t0 > 10000) break  // 10s budget
    if (pages.length >= 3) break
    const p = await scrapePage(baseUrl + path, 5000)
    if (p) pages.push(p)
  }

  return pages
}

// ── SerpAPI search for company contacts ───────────────────────────────────────

async function serpApiContacts(companyName, city, apiKey) {
  const q   = encodeURIComponent(`"${companyName}" ${city} Ansprechpartner OR Kontakt OR Geschäftsführer`)
  const url = `https://serpapi.com/search.json?engine=google&q=${q}&api_key=${apiKey}&hl=de&gl=de&num=5`
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    const data = await res.json()
    const snippets = (data.organic_results || [])
      .map(r => `${r.title}: ${r.snippet || ''}`)
      .join('\n')
      .slice(0, 1500)
    return snippets || null
  } catch {
    return null
  }
}

// ── Claude contact extraction ─────────────────────────────────────────────────

async function extractContacts(pages, serpSnippets, companyName) {
  const webText = pages.map(p => `### Source: ${p.url}\n${p.text}`).join('\n\n---\n\n')
  const serpText = serpSnippets ? `### Google Search Results:\n${serpSnippets}` : ''
  const combined = `${webText}\n\n${serpText}`.slice(0, 4000)

  const prompt = `Extract REAL contact persons from this German company data.
Company: ${companyName}

STRICT RULES:
- ONLY include contacts where you found an actual name from the source text
- ONLY include emails that appear literally in the text (not guessed)
- DO NOT invent, guess, or construct any names or emails
- If no real person found, return empty contacts array
- generalEmail: only if explicitly found in text (e.g. info@firma.de)
- confidence: HIGH=email+name on website, MEDIUM=name on website no email, LOW=name in Google snippet only

Source text:
${combined}

Return ONLY valid JSON:
{
  "contacts": [
    {
      "name": "Real Name From Text",
      "role": "position if found or null",
      "email": "email@if.found or null",
      "phone": "+49... if found or null",
      "source": "exact URL where found",
      "confidence": "HIGH"
    }
  ],
  "generalEmail": "info@firma.de or null"
}`

  const fetchP = fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
  })
  const timeoutP = new Promise((_, rej) => setTimeout(() => rej(new Error('Claude timeout')), 10000))

  const res  = await Promise.race([fetchP, timeoutP])
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || `Claude ${res.status}`)

  const raw    = (data.content?.[0]?.text || '').trim().replace(/^```json\s*/i,'').replace(/```\s*$/i,'').trim()
  const parsed = JSON.parse(raw)

  // Filter out any contact with null name or obviously fake data
  const contacts = (parsed.contacts || []).filter(c =>
    c.name && c.name.length > 2 && c.source && !c.name.toLowerCase().includes('ansprechpartner')
  )

  return { contacts, generalEmail: parsed.generalEmail || null }
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  let body
  try { body = JSON.parse(event.body || '{}') }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const { companyName, website, city = '', country = 'DE' } = body
  if (!companyName) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'companyName required' }) }

  const t0      = Date.now()
  const baseUrl = normalizeUrl(website)
  console.log(`[find-contacts] START "${companyName}" url=${baseUrl || 'none'}`)

  // Hard 15s timeout on entire operation
  const hardTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error('hard timeout 15s')), 15000))

  async function run() {
    const [pages, serpSnippets] = await Promise.all([
      baseUrl ? scrapeWebsiteContacts(baseUrl) : Promise.resolve([]),
      SERPAPI_KEY ? serpApiContacts(companyName, city, SERPAPI_KEY) : Promise.resolve(null),
    ])

    console.log(`[find-contacts] scraped ${pages.length} pages, serp=${!!serpSnippets}`)

    if (!pages.length && !serpSnippets) {
      return { contacts: [], generalEmail: null, sourceNote: 'Žiadne zdroje dostupné', foundAt: new Date().toISOString() }
    }

    if (!CLAUDE_KEY) {
      return { contacts: [], generalEmail: null, sourceNote: 'Claude nedostupný — manuálne zadanie', foundAt: new Date().toISOString() }
    }

    const result = await extractContacts(pages, serpSnippets, companyName)
    console.log(`[find-contacts] found ${result.contacts.length} contacts in ${Date.now()-t0}ms`)

    return {
      contacts:    result.contacts,
      generalEmail:result.generalEmail,
      sourceNote:  pages.length ? `Firecrawl: ${pages.map(p => p.url).join(', ')}` : 'SerpAPI Google',
      foundAt:     new Date().toISOString(),
    }
  }

  try {
    const result = await Promise.race([run(), hardTimeout])
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, ...result }) }
  } catch (e) {
    console.error(`[find-contacts] failed: ${e.message}`)
    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({ ok: true, contacts: [], generalEmail: null, sourceNote: 'Hľadanie zlyhalo: ' + e.message.slice(0, 80), foundAt: new Date().toISOString() }),
    }
  }
}

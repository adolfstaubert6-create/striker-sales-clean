/**
 * Contact Enrichment Engine v2 — aggressive extraction + structured matching.
 * Extracts emails/phones via regex first, then Claude associates with names.
 * Never invents emails. Marks type: PERSONAL / GENERAL / UNKNOWN.
 */

const CLAUDE_KEY    = process.env.ANTHROPIC_API_KEY
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY
const SERPAPI_KEY   = process.env.SERPAPI_API_KEY
const CLAUDE_MODEL  = 'claude-sonnet-4-6'

const CONTACT_PATHS = [
  '/impressum', '/kontakt', '/kontakt.html', '/kontakt.php',
  '/contact', '/contact-us', '/team', '/ueber-uns',
  '/about', '/about-us', '/ansprechpartner', '/footer',
  '/management', '/karriere', '/datenschutz', '/uber-uns',
]

// ── Pre-extraction: regex before Claude ───────────────────────────────────────

const EMAIL_RE  = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g
const PHONE_RE  = /(?:(?:\+49|0049|0)[0-9\s()\-\/\.]{6,20})/g

const GENERAL_PREFIXES = ['info','kontakt','contact','office','verwaltung','direktion',
  'reception','anfrage','sekretariat','buchung','reservierung','hallo','service',
  'hello','mail','post','hotel','team','support']

function extractEmails(text) {
  const found = text.match(EMAIL_RE) || []
  return [...new Set(found)].filter(e => e.length < 80)
}

function extractPhones(text) {
  const found = text.match(PHONE_RE) || []
  return [...new Set(found.map(p => p.trim().replace(/\s+/g,' ')))]
    .filter(p => p.replace(/\D/g,'').length >= 7)
    .slice(0, 8)
}

function isGeneralEmail(email) {
  const local = email.split('@')[0].toLowerCase()
  return GENERAL_PREFIXES.some(p => local === p || local.startsWith(p + '.') || local.startsWith(p + '-'))
}

function normalizeUrl(url) {
  if (!url) return null
  url = url.trim().replace(/\/$/, '')
  return url.startsWith('http') ? url : `https://${url}`
}

// ── Firecrawl ─────────────────────────────────────────────────────────────────

async function scrapePage(url, ms = 7000) {
  if (!FIRECRAWL_KEY) return null
  const ctrl = new AbortController()
  const t    = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${FIRECRAWL_KEY}` },
      body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: false }),
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('application/json')) return null
    const data = await res.json()
    if (!data.success || !data.data?.markdown) return null
    const text = data.data.markdown.slice(0, 3000)
    return text.trim().length > 30 ? { url, text } : null
  } catch { clearTimeout(t); return null }
}

async function scrapeWebsite(baseUrl) {
  const pages = []
  const t0    = Date.now()
  const home  = await scrapePage(baseUrl, 6000)
  if (home) pages.push(home)

  for (const path of CONTACT_PATHS) {
    if (Date.now() - t0 > 11000 || pages.length >= 4) break
    const p = await scrapePage(baseUrl + path, 5000)
    if (p) pages.push(p)
  }
  return pages
}

// ── Native HTTP scraper (no external API) ─────────────────────────────────────

async function scrapePageNative(url, ms = 5000) {
  const ctrl = new AbortController()
  const to   = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StrikerBot/1.0)', 'Accept': 'text/html,*/*' },
    })
    clearTimeout(to)
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('text/html') && !ct.includes('text/plain')) return null
    const html = await res.text()
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
      .replace(/\s+/g, ' ').trim().slice(0, 3000)
    return text.length > 30 ? { url, text } : null
  } catch { clearTimeout(to); return null }
}

async function scrapeWebsiteNative(baseUrl) {
  const pages = []
  const t0    = Date.now()
  const home  = await scrapePageNative(baseUrl, 6000)
  if (home) pages.push(home)
  for (const path of CONTACT_PATHS) {
    if (Date.now() - t0 > 12000 || pages.length >= 5) break
    const p = await scrapePageNative(baseUrl + path, 4000)
    if (p) pages.push(p)
  }
  return pages
}

// ── SerpAPI ───────────────────────────────────────────────────────────────────

async function serpSearch(companyName, city, apiKey) {
  const q   = encodeURIComponent(`"${companyName}" ${city} Geschäftsführer OR Ansprechpartner OR Kontakt OR Impressum`)
  const url = `https://serpapi.com/search.json?engine=google&q=${q}&api_key=${apiKey}&hl=de&gl=de&num=5`
  try {
    const ctrl = new AbortController()
    const t    = setTimeout(() => ctrl.abort(), 6000)
    const res  = await fetch(url, { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) return null
    const data = await res.json()
    return (data.organic_results || []).map(r => `${r.title}: ${r.snippet || ''}`).join('\n').slice(0, 1500) || null
  } catch { return null }
}

// ── Claude — associate names with pre-extracted emails/phones ─────────────────

async function claudeExtract(pages, serpText, companyName, allEmails, allPhones) {
  const webText   = pages.map(p => `### Source: ${p.url}\n${p.text}`).join('\n\n---\n\n')
  const serpBlock = serpText ? `### Google Snippets:\n${serpText}` : ''
  const combined  = `${webText}\n\n${serpBlock}`.slice(0, 4500)

  const emailList = allEmails.join(', ') || 'none found'
  const phoneList = allPhones.join(', ') || 'none found'

  const prompt = `Contact extraction for German company: "${companyName}"

Pre-extracted from HTML/text (these are REAL, use them):
EMAILS FOUND: ${emailList}
PHONES FOUND: ${phoneList}

Full source text:
${combined}

TASK: Extract real contact persons and match them to the pre-extracted emails/phones above.

STRICT RULES:
1. ONLY use emails from the EMAILS FOUND list — never construct new ones
2. ONLY use phones from the PHONES FOUND list — never construct new ones
3. ONLY include a person if their name appears literally in the text
4. Match person names to nearby emails/phones from the lists above
5. If a name exists but no personal email matches → use closest general email OR leave email null
6. generalEmail: pick best general email (info@, kontakt@, etc.) from the list above

Contact types:
- PERSONAL: specific person name + their personal email clearly found
- GENERAL: general email (info@, kontakt@) associated with a name, or standalone
- UNKNOWN: name found but no email association possible

Return ONLY valid JSON:
{
  "contacts": [
    {
      "name": "Real Name From Text",
      "role": "position or null",
      "email": "email from pre-extracted list or null",
      "emailType": "PERSONAL|GENERAL|null",
      "phone": "phone from pre-extracted list or null",
      "source": "URL where name was found",
      "confidence": "HIGH|MEDIUM|LOW"
    }
  ],
  "generalEmail": "best general email from list or null",
  "allPhones": ["all found phones"],
  "allEmails": ["all found emails"]
}`

  const fetchP   = fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 900, messages: [{ role: 'user', content: prompt }] }),
  })
  const timeoutP = new Promise((_, rej) => setTimeout(() => rej(new Error('Claude timeout')), 12000))

  const res  = await Promise.race([fetchP, timeoutP])
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || `Claude ${res.status}`)

  const raw    = (data.content?.[0]?.text || '').trim().replace(/^```json\s*/i,'').replace(/```\s*$/i,'').trim()
  const parsed = JSON.parse(raw)

  // Filter: must have real name, length > 2, not generic word
  const FAKE_NAMES = ['ansprechpartner','kontakt','contact','impressum','team','management']
  const contacts = (parsed.contacts || []).filter(c =>
    c.name && c.name.length > 2 && c.source &&
    !FAKE_NAMES.some(f => c.name.toLowerCase().includes(f))
  )

  return {
    contacts,
    generalEmail: parsed.generalEmail || null,
    allPhones:    parsed.allPhones    || allPhones,
    allEmails:    parsed.allEmails    || allEmails,
  }
}

// ── Fallback: build structured result from raw regex extraction ───────────────

function buildFallback(allEmails, allPhones, baseUrl) {
  const generalEmails = allEmails.filter(isGeneralEmail)
  const personalEmails = allEmails.filter(e => !isGeneralEmail(e))

  const contacts = []

  // Personal emails → UNKNOWN contacts (no name)
  personalEmails.slice(0, 3).forEach(email => {
    contacts.push({ name: null, role: null, email, emailType: 'PERSONAL', phone: allPhones[0] || null, source: baseUrl || 'web', confidence: 'MEDIUM' })
  })

  return {
    contacts,
    generalEmail: generalEmails[0] || null,
    allPhones,
    allEmails,
  }
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
  console.log(`[find-contacts] START "${companyName}" url=${baseUrl||'none'}`)

  const hardTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error('hard timeout 15s')), 15000))

  async function run() {
    // 1. Scrape + SerpAPI in parallel
    const [pages, serpText] = await Promise.all([
      baseUrl ? (FIRECRAWL_KEY ? scrapeWebsite(baseUrl) : scrapeWebsiteNative(baseUrl)) : Promise.resolve([]),
      SERPAPI_KEY ? serpSearch(companyName, city, SERPAPI_KEY) : Promise.resolve(null),
    ])

    // 2. Pre-extract ALL emails + phones via regex
    const allText    = pages.map(p => p.text).join('\n') + '\n' + (serpText || '')
    const allEmails  = extractEmails(allText)
    const allPhones  = extractPhones(allText)

    console.log(`[find-contacts] pages=${pages.length} emails=${allEmails.length} phones=${allPhones.length}`)

    // 3. Claude extraction (if available)
    let result
    if (CLAUDE_KEY && (pages.length || serpText)) {
      try {
        result = await claudeExtract(pages, serpText, companyName, allEmails, allPhones)
      } catch (e) {
        console.warn(`[find-contacts] Claude failed (${e.message}) — regex fallback`)
        result = buildFallback(allEmails, allPhones, baseUrl)
      }
    } else {
      result = buildFallback(allEmails, allPhones, baseUrl)
    }

    // 4. If no named contacts but emails exist → create GENERAL entries
    if (!result.contacts.length && allEmails.length) {
      const genEmails  = allEmails.filter(isGeneralEmail)
      const persEmails = allEmails.filter(e => !isGeneralEmail(e))

      persEmails.slice(0, 2).forEach(email => {
        result.contacts.push({ name: null, role: null, email, emailType: 'PERSONAL', phone: allPhones[0] || null, source: baseUrl || 'web', confidence: 'MEDIUM' })
      })
      if (!result.generalEmail && genEmails.length) result.generalEmail = genEmails[0]
    }

    console.log(`[find-contacts] DONE ${Date.now()-t0}ms contacts=${result.contacts.length} generalEmail=${result.generalEmail}`)

    return {
      contacts:    result.contacts,
      generalEmail:result.generalEmail,
      allPhones:   result.allPhones   || allPhones,
      allEmails:   result.allEmails   || allEmails,
      sourceNote:  pages.length ? (FIRECRAWL_KEY ? `Firecrawl: ${pages.length} stránok` : `Native: ${pages.length} stránok`) : serpText ? 'SerpAPI' : 'žiadne zdroje',
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
      body: JSON.stringify({ ok: true, contacts: [], generalEmail: null, allPhones: [], allEmails: [], sourceNote: 'Zlyhanie: ' + e.message.slice(0,60), foundAt: new Date().toISOString() }),
    }
  }
}

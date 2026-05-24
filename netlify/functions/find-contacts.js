/**
 * Contact Discovery Engine v3 — regex person+role detection + Claude enrichment.
 * Pipeline: native/firecrawl scrape → regex persons → Claude associate → deduplicate
 */

const CLAUDE_KEY    = process.env.ANTHROPIC_API_KEY
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY
const SERPAPI_KEY   = process.env.SERPAPI_API_KEY
const CLAUDE_MODEL  = 'claude-sonnet-4-6'

const CONTACT_PATHS = [
  '/impressum', '/kontakt', '/kontakt.html', '/kontakt.php',
  '/contact', '/contact-us', '/team', '/ueber-uns',
  '/about', '/about-us', '/ansprechpartner',
  '/management', '/karriere', '/datenschutz', '/uber-uns',
]

// Decision-maker roles we specifically look for
const DECISION_ROLES = [
  'Geschäftsführer(?:in)?(?:\\/in)?', 'Direktor(?:in)?', 'Director',
  'General\\s+Manager', 'Hotel\\s+(?:Manager|Director)', 'Hoteldirektor(?:in)?',
  'Facility\\s+Manager', 'Facility\\s+Management',
  'Technisch(?:er|e)\\s+Leiter(?:in)?', 'Techniker(?:in)?', 'Haustechnik(?:er(?:in)?)?',
  'Energy\\s+Manager', 'Energiemanager(?:in)?',
  'Einkauf(?:sleiter(?:in)?)?', 'Procurement(?:\\s+Manager)?',
  'Operations?\\s+(?:Manager|Director|Leiter(?:in)?)',
  'Betriebsleiter(?:in)?',
  'Kaufmännisch(?:er|e)\\s+Leiter(?:in)?', 'Kaufmännisch(?:er|e)\\s+Geschäftsführer(?:in)?',
  'F&B\\s+Manager', 'Food\\s+(?:and|&)\\s+Beverage\\s+Manager',
  'Sales\\s+(?:Manager|Director|Leiter(?:in)?)',
  'Front\\s+Office\\s+Manager', 'Revenue\\s+Manager',
  'IT\\s+(?:Leiter(?:in)?|Manager)', 'Marketing\\s+(?:Manager|Leiter(?:in)?)',
  'Reservierungsleiter(?:in)?', 'Restaurantleiter(?:in)?', 'Hausleiter(?:in)?',
  'Inhaber(?:in)?', 'Eigentümer(?:in)?', 'Geschäftsinhaber(?:in)?',
]
const ROLE_RE = new RegExp(`(?:${DECISION_ROLES.join('|')})`, 'gi')

// German full name: optional title + Firstname + optional middle + Lastname
const NAME_SRC = '(?:(?:Dr|Prof|Dipl\\.?(?:\\s*\\w+)?|Ing|Mag|MBA|MSc)\\.?\\s+)?[A-ZÄÖÜ][a-zäöüß]{1,20}(?:-[A-ZÄÖÜ][a-zäöüß]{1,20})?\\s+(?:(?:van|von|de|der|den)\\s+)?[A-ZÄÖÜ][a-zäöüß]{1,25}'

const EMAIL_RE = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g
const PHONE_RE = /(?:(?:\+49|0049|0)[0-9\s()\-\/\.]{6,20})/g

const GENERAL_PREFIXES = [
  'info','kontakt','contact','office','verwaltung','direktion',
  'reception','anfrage','sekretariat','buchung','reservierung','hallo','service',
  'hello','mail','post','hotel','team','support','sales','marketing',
]

// Words that should NOT be treated as person names
const FAKE_NAME_WORDS = new Set([
  'ansprechpartner','kontakt','contact','impressum','team','management',
  'hotel','service','info','administration','direktion','reception',
  'gmbh','ag','kg','ohg','inc','ltd','ges','mbh','co',
  'januar','februar','marz','april','juni','juli','august',
  'september','oktober','november','dezember',
  'montag','dienstag','mittwoch','donnerstag','freitag',
  'strasse','straße','platz','weg','allee','gasse',
  'telefon','telefax','fax','email','web','internet',
])

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractEmails(text) {
  const found = text.match(EMAIL_RE) || []
  return [...new Set(found)].filter(e => e.length < 80)
}

function extractPhones(text) {
  const found = text.match(PHONE_RE) || []
  return [...new Set(found.map(p => p.trim().replace(/\s+/g, ' ')))]
    .filter(p => p.replace(/\D/g, '').length >= 7)
    .slice(0, 8)
}

function isGeneralEmail(email) {
  const local = email.split('@')[0].toLowerCase()
  return GENERAL_PREFIXES.some(p =>
    local === p || local.startsWith(p + '.') || local.startsWith(p + '-')
  )
}

function normalizeUrl(url) {
  if (!url) return null
  url = url.trim().replace(/\/$/, '')
  return url.startsWith('http') ? url : `https://${url}`
}

function detectPageType(url) {
  const u = (url || '').toLowerCase()
  if (/impressum/.test(u))                               return 'impressum'
  if (/\/team|ueber-uns|uber-uns|about|ansprechpartner/.test(u)) return 'team'
  if (/management|leitung|direktion/.test(u))            return 'management'
  if (/kontakt|contact/.test(u))                         return 'contact'
  return 'website'
}

function isFakeName(name) {
  if (!name || name.length < 4) return true
  const lower = name.toLowerCase()
  const parts  = name.trim().split(/\s+/)
  if (parts.length < 2) return true
  // Any part is a known non-name word
  for (const p of parts) {
    if (FAKE_NAME_WORDS.has(p.toLowerCase().replace(/[^a-zäöüß]/g, ''))) return true
  }
  // Contains digits
  if (/\d/.test(name)) return true
  // Too short last name
  if (parts[parts.length - 1].length < 2) return true
  return false
}

// ── Regex person+role extractor ───────────────────────────────────────────────

function extractPersonsRegex(text, sourceUrl, pageType) {
  const found = []
  const seen  = new Set()
  const nameRe = new RegExp(NAME_SRC, 'g')

  // Find every role occurrence, then look for a name in surrounding context
  let rm
  ROLE_RE.lastIndex = 0
  while ((rm = ROLE_RE.exec(text)) !== null) {
    const role    = rm[0].replace(/\s+/g, ' ').trim()
    const rolePos = rm.index
    // ±400 chars around the role
    const wStart  = Math.max(0, rolePos - 400)
    const wEnd    = Math.min(text.length, rolePos + 400)
    const window  = text.slice(wStart, wEnd)

    nameRe.lastIndex = 0
    let nm
    while ((nm = nameRe.exec(window)) !== null) {
      const name = nm[0].replace(/\s+/g, ' ').trim()
      if (isFakeName(name)) {
        console.log(`[regex] rejected name "${name}" near role "${role}"`)
        continue
      }

      const key = `${name.toLowerCase()}|${role.toLowerCase().slice(0, 20)}`
      if (seen.has(key)) continue
      seen.add(key)

      // Look for personal email in same window
      const emails  = extractEmails(window)
      const personal = emails.find(e => !isGeneralEmail(e)) || null

      const confidence = personal ? 'HIGH' : 'MEDIUM'
      console.log(`[regex] found: "${name}" — "${role}" [${confidence}] src=${pageType}`)

      found.push({
        name, role, email: personal,
        emailType: personal ? 'PERSONAL' : null,
        phone: null, source: sourceUrl, sourceType: pageType, confidence,
      })
    }
  }

  return found
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function deduplicateContacts(contacts) {
  const merged  = []
  const byEmail = new Map()
  const byName  = new Map()
  const confRank = { HIGH: 3, MEDIUM: 2, LOW: 1 }

  for (const c of contacts) {
    const ek = c.email ? c.email.toLowerCase() : null
    const nk = c.name  ? c.name.toLowerCase().trim() : null

    let idx = ek && byEmail.has(ek) ? byEmail.get(ek)
            : nk && byName.has(nk)  ? byName.get(nk)
            : -1

    if (idx >= 0) {
      const ex = merged[idx]
      if (!ex.email && c.email) { ex.email = c.email; ex.emailType = c.emailType }
      if (!ex.phone && c.phone)  ex.phone = c.phone
      if (!ex.role  && c.role)   ex.role  = c.role
      if (!ex.sourceType && c.sourceType) ex.sourceType = c.sourceType
      if ((confRank[c.confidence] || 0) > (confRank[ex.confidence] || 0))
        ex.confidence = c.confidence
    } else {
      idx = merged.length
      merged.push({ ...c })
      if (ek) byEmail.set(ek, idx)
      if (nk) byName.set(nk, idx)
    }
  }

  return merged
}

// ── Firecrawl scraper ─────────────────────────────────────────────────────────

async function scrapePage(url, ms = 7000) {
  if (!FIRECRAWL_KEY) return null
  const ctrl = new AbortController()
  const to   = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${FIRECRAWL_KEY}` },
      body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: false }),
      signal: ctrl.signal,
    })
    clearTimeout(to)
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('application/json')) return null
    const data = await res.json()
    if (!data.success || !data.data?.markdown) return null
    const text = data.data.markdown.slice(0, 4000)
    return text.trim().length > 30 ? { url, text } : null
  } catch { clearTimeout(to); return null }
}

async function scrapeWebsite(baseUrl) {
  const pages = []
  const t0    = Date.now()
  const home  = await scrapePage(baseUrl, 6000)
  if (home) pages.push(home)
  for (const path of CONTACT_PATHS) {
    if (Date.now() - t0 > 20000 || pages.length >= 6) break
    const p = await scrapePage(baseUrl + path, 5000)
    if (p) pages.push(p)
  }
  return pages
}

// ── Native HTTP scraper ───────────────────────────────────────────────────────

async function scrapePageNative(url, ms = 5000) {
  const ctrl = new AbortController()
  const to   = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StrikerBot/1.0)', Accept: 'text/html,*/*' },
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
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
      .replace(/\s+/g, ' ').trim().slice(0, 4000)
    return text.length > 30 ? { url, text } : null
  } catch { clearTimeout(to); return null }
}

async function scrapeWebsiteNative(baseUrl) {
  const pages = []
  const t0    = Date.now()
  // Prioritize high-value paths first
  const PRIORITY = ['/impressum', '/team', '/management', '/about', '/ueber-uns', '/ansprechpartner', '/kontakt']
  const REST     = CONTACT_PATHS.filter(p => !PRIORITY.includes(p))

  const home = await scrapePageNative(baseUrl, 6000)
  if (home) pages.push(home)

  for (const path of [...PRIORITY, ...REST]) {
    if (Date.now() - t0 > 22000 || pages.length >= 7) break
    const p = await scrapePageNative(baseUrl + path, 4000)
    if (p) pages.push(p)
  }
  return pages
}

// ── SerpAPI ───────────────────────────────────────────────────────────────────

async function serpSearch(companyName, city, apiKey) {
  const q   = encodeURIComponent(`"${companyName}" ${city} Geschäftsführer OR Direktor OR "General Manager" OR Impressum`)
  const url = `https://serpapi.com/search.json?engine=google&q=${q}&api_key=${apiKey}&hl=de&gl=de&num=5`
  try {
    const ctrl = new AbortController()
    const t    = setTimeout(() => ctrl.abort(), 6000)
    const res  = await fetch(url, { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) return null
    const data = await res.json()
    return (data.organic_results || []).map(r => `${r.title}: ${r.snippet || ''}`).join('\n').slice(0, 2000) || null
  } catch { return null }
}

// ── Claude — enrich regex results + find any missed persons ──────────────────

async function claudeExtract(pages, serpText, companyName, allEmails, allPhones) {
  const pageBlocks = pages.map(p => {
    const type = detectPageType(p.url)
    return `### [${type.toUpperCase()}] ${p.url}\n${p.text}`
  }).join('\n\n---\n\n')

  const serpBlock = serpText ? `### [GOOGLE SNIPPETS]\n${serpText}` : ''
  const combined  = `${pageBlocks}\n\n${serpBlock}`.slice(0, 5500)
  const emailList = allEmails.join(', ') || 'none'
  const phoneList = allPhones.join(', ') || 'none'

  const prompt = `Extract REAL person contacts from this German hotel/company: "${companyName}"

PRE-EXTRACTED (verified — ONLY use these):
EMAILS: ${emailList}
PHONES: ${phoneList}

TARGET ROLES (look specifically for people with these roles):
Geschäftsführer, Direktor, General Manager, Facility Manager, Technischer Leiter,
Energy Manager, Einkauf, Procurement, Operations Manager, Betriebsleiter,
Hoteldirektor, Sales Manager, Front Office Manager, Inhaber, Eigentümer

SOURCE PAGES (each tagged with type):
${combined}

STRICT RULES:
1. Only include a person if their FULL NAME (first + last) appears literally in the text
2. Only use emails from the EMAILS list — never construct or guess emails
3. Only use phones from the PHONES list
4. Match names to nearby emails in the same page section
5. CONFIDENCE: HIGH = name+role+personal email; MEDIUM = name+role only; LOW = email only (no real name)
6. sourceType: use the page tag (impressum/team/management/contact/website) where found
7. generalEmail: best info@/kontakt@ style email from the list
8. REJECT: generic words, company names, city names, product names as person names
9. Return empty contacts array if no real persons found — do NOT invent people

Return ONLY valid JSON (no markdown fences):
{
  "contacts": [
    {
      "name": "Full Name or null",
      "role": "exact title from text or null",
      "email": "from EMAILS list or null",
      "emailType": "PERSONAL|GENERAL|null",
      "phone": "from PHONES list or null",
      "source": "page URL",
      "sourceType": "impressum|team|management|contact|website",
      "confidence": "HIGH|MEDIUM|LOW"
    }
  ],
  "generalEmail": "best general email or null",
  "allPhones": ${JSON.stringify(allPhones)},
  "allEmails": ${JSON.stringify(allEmails)}
}`

  const fetchP   = fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01' },
    body:    JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
  })
  const timeoutP = new Promise((_, rej) => setTimeout(() => rej(new Error('Claude timeout')), 14000))

  const res  = await Promise.race([fetchP, timeoutP])
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || `Claude ${res.status}`)

  const raw    = (data.content?.[0]?.text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const parsed = JSON.parse(raw)

  const FAKE_NAMES = ['ansprechpartner', 'kontakt', 'contact', 'impressum', 'team', 'management', 'hotel', 'service']
  const contacts = (parsed.contacts || []).filter(c =>
    (c.name || c.email) &&
    (!c.name || (c.name.length > 3 && !FAKE_NAMES.some(f => c.name.toLowerCase().includes(f))))
  )

  return {
    contacts,
    generalEmail: parsed.generalEmail || null,
    allPhones:    parsed.allPhones    || allPhones,
    allEmails:    parsed.allEmails    || allEmails,
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
  console.log(`[find-contacts] START "${companyName}" url=${baseUrl || 'none'} city=${city}`)

  const hardTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error('hard timeout 25s')), 25000))

  async function run() {
    // 1. Scrape pages
    const rawPages = baseUrl
      ? (FIRECRAWL_KEY ? await scrapeWebsite(baseUrl) : await scrapeWebsiteNative(baseUrl))
      : []

    const pages = rawPages.map(p => ({ ...p, pageType: detectPageType(p.url) }))

    console.log(`[find-contacts] scraped ${pages.length} pages:`)
    pages.forEach(p => console.log(`  [${p.pageType}] ${p.url}`))

    // 2. SerpAPI in parallel with scrape (already done above, add here if needed)
    const serpText = SERPAPI_KEY ? await serpSearch(companyName, city, SERPAPI_KEY) : null
    if (serpText) console.log(`[find-contacts] serpapi: ${serpText.length} chars`)

    // 3. Pre-extract all emails + phones via regex
    const allText   = pages.map(p => p.text).join('\n') + '\n' + (serpText || '')
    const allEmails = extractEmails(allText)
    const allPhones = extractPhones(allText)

    console.log(`[find-contacts] regex: emails=${allEmails.length} phones=${allPhones.length}`)

    // 4. Regex-based person+role extraction (works without Claude)
    const regexPersons = []
    for (const page of pages) {
      const persons = extractPersonsRegex(page.text, page.url, page.pageType)
      if (persons.length) {
        console.log(`[find-contacts] regex persons from [${page.pageType}]: ${persons.map(p => p.name).join(', ')}`)
      }
      regexPersons.push(...persons)
    }
    const regexDeduped = deduplicateContacts(regexPersons)
    console.log(`[find-contacts] regex total (deduped): ${regexDeduped.length}`)

    // 5. Claude extraction — enriches and finds any missed persons
    let result
    if (CLAUDE_KEY && (pages.length || serpText)) {
      try {
        const claudeResult = await claudeExtract(pages, serpText, companyName, allEmails, allPhones)
        console.log(`[find-contacts] Claude found ${claudeResult.contacts.length} contacts`)
        // Merge Claude + regex, deduplicate
        const merged = deduplicateContacts([...claudeResult.contacts, ...regexDeduped])
        console.log(`[find-contacts] merged (Claude+regex): ${merged.length}`)
        result = { ...claudeResult, contacts: merged }
      } catch (e) {
        console.warn(`[find-contacts] Claude failed (${e.message}) — regex only`)
        result = {
          contacts:    regexDeduped,
          generalEmail: allEmails.filter(isGeneralEmail)[0] || null,
          allPhones, allEmails,
        }
      }
    } else {
      console.log(`[find-contacts] no Claude key — regex only`)
      result = {
        contacts:    regexDeduped,
        generalEmail: allEmails.filter(isGeneralEmail)[0] || null,
        allPhones, allEmails,
      }
    }

    // 6. Fallback: if still no named contacts but personal emails exist
    if (!result.contacts.filter(c => c.name).length) {
      const personal = allEmails.filter(e => !isGeneralEmail(e))
      personal.slice(0, 2).forEach(email => {
        const alreadyIn = result.contacts.some(c => c.email === email)
        if (!alreadyIn) {
          result.contacts.push({
            name: null, role: null, email, emailType: 'PERSONAL',
            phone: allPhones[0] || null, source: baseUrl || 'web',
            sourceType: 'website', confidence: 'LOW',
          })
        }
      })
      if (!result.generalEmail) {
        result.generalEmail = allEmails.filter(isGeneralEmail)[0] || null
      }
    }

    // 7. Final debug summary
    const ms = Date.now() - t0
    console.log(`[find-contacts] DONE ${ms}ms — ${result.contacts.length} contacts, generalEmail=${result.generalEmail}`)
    result.contacts.forEach((c, i) => {
      console.log(`  [${i + 1}] [${c.confidence}] name="${c.name || '-'}" role="${c.role || '-'}" email="${c.email || '-'}" src=${c.sourceType || '-'}`)
    })

    const scanned = FIRECRAWL_KEY ? `Firecrawl: ${pages.length}` : `Native: ${pages.length}`
    return {
      contacts:     result.contacts,
      generalEmail: result.generalEmail,
      allPhones:    result.allPhones  || allPhones,
      allEmails:    result.allEmails  || allEmails,
      sourceNote:   pages.length ? scanned : serpText ? 'SerpAPI' : 'žiadne zdroje',
      foundAt:      new Date().toISOString(),
    }
  }

  try {
    const result = await Promise.race([run(), hardTimeout])
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, ...result }) }
  } catch (e) {
    console.error(`[find-contacts] FAILED: ${e.message}`)
    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({
        ok: true, contacts: [], generalEmail: null,
        allPhones: [], allEmails: [],
        sourceNote: 'Zlyhanie: ' + e.message.slice(0, 60),
        foundAt: new Date().toISOString(),
      }),
    }
  }
}

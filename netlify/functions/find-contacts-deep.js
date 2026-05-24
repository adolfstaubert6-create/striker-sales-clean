/**
 * Contact Discovery — Phase 2: SerpAPI + Firecrawl + Claude.
 * Called after find-contacts (phase 1). Receives phase1 email/phone/contact data to merge.
 * Hard cap 23s — stays within Netlify's 26s function limit.
 */

const CLAUDE_KEY    = process.env.ANTHROPIC_API_KEY
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY
const SERPAPI_KEY   = process.env.SERPAPI_API_KEY
const CLAUDE_MODEL  = 'claude-sonnet-4-6'

// ── Role patterns ─────────────────────────────────────────────────────────────

const TECH_ROLE_PATTERNS = [
  'Facility\\s+Manager(?:in)?', 'Facility\\s+Management',
  'Technisch(?:er|e)\\s+Leiter(?:in)?', 'Technical\\s+(?:Manager|Director)',
  'Energy\\s+Manager(?:in)?', 'Energiemanager(?:in)?',
  'Operations?\\s+Manager(?:in)?',
  'Haustechnik(?:er(?:in)?)?', 'Hausleiter(?:in)?',
  'Techniker(?:in)?',
]

const BIZ_ROLE_PATTERNS = [
  'Geschäftsführer(?:in)?(?:\\/in)?',
  'Direktor(?:in)?', 'Director',
  'General\\s+Manager',
  'Hotel\\s+(?:Manager|Director)', 'Hoteldirektor(?:in)?',
  'Operations?\\s+Director',
  'Inhaber(?:in)?', 'Eigentümer(?:in)?', 'Geschäftsinhaber(?:in)?',
  'Kaufmännisch(?:er|e)\\s+(?:Leiter(?:in)?|Geschäftsführer(?:in)?)',
  'Betriebsleiter(?:in)?',
]

const IGNORE_ROLE_PATTERNS = [
  'HR', 'Human\\s+Resources?', 'Personal(?:leiter(?:in)?|abteilung)?',
  'Empfang(?:sleiter(?:in)?)?', 'Rezeptionist(?:in)?', 'Front\\s+Desk',
  'Marketing(?:\\s+(?:Manager|Leiter(?:in)?))?',
  'Sales\\s+(?:Manager|Director|Leiter(?:in)?)',
  'Reservierung(?:sleiter(?:in)?)?',
  'Karriere', 'Bewerbung(?:en)?',
  'Reinigung(?:sleiter(?:in)?)?', 'Housekeeping\\s+Manager',
  'Restaurantleiter(?:in)?', 'F&B\\s+Manager', 'Food(?:\\s+and|&)\\s+Beverage',
  'Revenue\\s+Manager', 'Front\\s+Office\\s+Manager',
  'IT\\s+(?:Leiter(?:in)?|Manager)',
]

const ROLE_RE   = new RegExp(`(?:${[...TECH_ROLE_PATTERNS, ...BIZ_ROLE_PATTERNS].join('|')})`, 'gi')
const IGNORE_RE = new RegExp(`(?:${IGNORE_ROLE_PATTERNS.join('|')})`, 'i')

const NAME_SRC = '(?:(?:Dr|Prof|Dipl\\.?(?:\\s*\\w+)?|Ing|Mag|MBA|MSc)\\.?\\s+)?[A-ZÄÖÜ][a-zäöüß]{1,20}(?:-[A-ZÄÖÜ][a-zäöüß]{1,20})?\\s+(?:(?:van|von|de|der|den)\\s+)?[A-ZÄÖÜ][a-zäöüß]{1,25}'

const EMAIL_RE = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g
const PHONE_RE = /(?:(?:\+49|0049|0)[0-9\s()\-\/\.]{6,20})/g

const GENERAL_PREFIXES = [
  'info','kontakt','contact','office','verwaltung','direktion',
  'reception','anfrage','sekretariat','buchung','reservierung','hallo','service',
  'hello','mail','post','hotel','team','support','sales','marketing',
]

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
  return [...new Set(text.match(EMAIL_RE) || [])].filter(e => e.length < 80)
}

function extractPhones(text) {
  return [...new Set((text.match(PHONE_RE) || []).map(p => p.trim().replace(/\s+/g, ' ')))]
    .filter(p => p.replace(/\D/g, '').length >= 7).slice(0, 8)
}

function isGeneralEmail(email) {
  const local = email.split('@')[0].toLowerCase()
  return GENERAL_PREFIXES.some(p => local === p || local.startsWith(p + '.') || local.startsWith(p + '-'))
}

function normalizeUrl(url) {
  if (!url) return null
  url = url.trim().replace(/\/$/, '')
  const full = url.startsWith('http') ? url : `https://${url}`
  return full.replace(/^(https?:\/\/)www\./, '$1')
}

function extractHostname(url) {
  try { return new URL(url).hostname } catch { return null }
}

function detectPageType(url) {
  const u = (url || '').toLowerCase()
  if (/impressum/.test(u))                                    return 'impressum'
  if (/\/team|ueber-uns|uber-uns|about|ansprechpartner/.test(u)) return 'team'
  if (/management|leitung|direktion/.test(u))                 return 'management'
  if (/kontakt|contact/.test(u))                              return 'contact'
  return 'website'
}

function classifyRole(role) {
  if (!role) return null
  if (new RegExp(TECH_ROLE_PATTERNS.join('|'), 'i').test(role)) return 'technical'
  if (new RegExp(BIZ_ROLE_PATTERNS.join('|'), 'i').test(role))  return 'business'
  return null
}

function isFakeName(name) {
  if (!name || name.length < 4) return true
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return true
  for (const p of parts) {
    if (FAKE_NAME_WORDS.has(p.toLowerCase().replace(/[^a-zäöüß]/g, ''))) return true
  }
  if (/\d/.test(name)) return true
  if (parts[parts.length - 1].length < 2) return true
  return false
}

function extractPersonsRegex(text, sourceUrl, pageType) {
  const found  = []
  const seen   = new Set()
  const nameRe = new RegExp(NAME_SRC, 'g')

  ROLE_RE.lastIndex = 0
  let rm
  while ((rm = ROLE_RE.exec(text)) !== null) {
    const role = rm[0].replace(/\s+/g, ' ').trim()
    if (IGNORE_RE.test(role)) continue
    const category = classifyRole(role)
    if (!category) continue

    const wStart = Math.max(0, rm.index - 400)
    const wEnd   = Math.min(text.length, rm.index + 400)
    const window = text.slice(wStart, wEnd)

    nameRe.lastIndex = 0
    let nm
    while ((nm = nameRe.exec(window)) !== null) {
      const name = nm[0].replace(/\s+/g, ' ').trim()
      if (isFakeName(name)) continue
      const key = `${name.toLowerCase()}|${role.toLowerCase().slice(0, 20)}`
      if (seen.has(key)) continue
      seen.add(key)

      const emails   = extractEmails(window)
      const personal = emails.find(e => !isGeneralEmail(e)) || null
      console.log(`[phase2] found [${category}]: "${name}" — "${role}" src=${pageType}`)
      found.push({
        name, role, contactCategory: category, email: personal,
        emailType: personal ? 'PERSONAL' : null,
        phone: null, source: sourceUrl, sourceType: pageType,
        confidence: personal ? 'HIGH' : 'MEDIUM',
      })
    }
  }
  return found
}

function deduplicateContacts(contacts) {
  const merged   = []
  const byEmail  = new Map()
  const byName   = new Map()
  const confRank = { HIGH: 3, MEDIUM: 2, LOW: 1 }

  for (const c of contacts) {
    const ek = c.email ? c.email.toLowerCase() : null
    const nk = c.name  ? c.name.toLowerCase().trim() : null
    let idx  = ek && byEmail.has(ek) ? byEmail.get(ek)
             : nk && byName.has(nk)  ? byName.get(nk)
             : -1

    if (idx >= 0) {
      const ex = merged[idx]
      if (!ex.email && c.email) { ex.email = c.email; ex.emailType = c.emailType }
      if (!ex.phone && c.phone)  ex.phone = c.phone
      if (!ex.role  && c.role)   ex.role  = c.role
      if (!ex.sourceType && c.sourceType) ex.sourceType = c.sourceType
      if ((confRank[c.confidence] || 0) > (confRank[ex.confidence] || 0)) ex.confidence = c.confidence
    } else {
      idx = merged.length
      merged.push({ ...c })
      if (ek) byEmail.set(ek, idx)
      if (nk) byName.set(nk, idx)
    }
  }
  return merged
}

function selectBestContacts(contacts) {
  const score = c => ({ HIGH: 30, MEDIUM: 20, LOW: 10 }[c.confidence] || 0) + (c.email ? 8 : 0) + (c.name ? 5 : 0)
  const techList = contacts.filter(c => c.contactCategory === 'technical').sort((a, b) => score(b) - score(a))
  const bizList  = contacts.filter(c => c.contactCategory === 'business' ).sort((a, b) => score(b) - score(a))
  const result   = []
  if (techList[0]) result.push(techList[0])
  if (bizList[0])  result.push(bizList[0])
  console.log(`[phase2] selectBest: tech=${techList.length}→${techList[0]?.name || '-'} biz=${bizList.length}→${bizList[0]?.name || '-'}`)
  return result
}

// ── Firecrawl ─────────────────────────────────────────────────────────────────

async function scrapePage(url, ms = 7000) {
  if (!FIRECRAWL_KEY) return null
  const ctrl = new AbortController()
  const to   = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${FIRECRAWL_KEY}` },
      body:    JSON.stringify({ url, formats: ['markdown'], onlyMainContent: false }),
      signal:  ctrl.signal,
    })
    clearTimeout(to)
    if (!res.ok) return null
    if (!(res.headers.get('content-type') || '').includes('application/json')) return null
    const data = await res.json()
    if (!data.success || !data.data?.markdown) return null
    const text = data.data.markdown.slice(0, 4000)
    return text.trim().length > 30 ? { url, text } : null
  } catch { clearTimeout(to); return null }
}

// ── SerpAPI ───────────────────────────────────────────────────────────────────

async function serpSearch(companyName, city, domain) {
  if (!SERPAPI_KEY) return null
  const domainClause = domain ? ` OR site:${domain}` : ''
  const q   = encodeURIComponent(`"${companyName}" ${city} Geschäftsführer OR Direktor OR "General Manager" OR Impressum${domainClause}`)
  const url = `https://serpapi.com/search.json?engine=google&q=${q}&api_key=${SERPAPI_KEY}&hl=de&gl=de&num=5`
  try {
    const ctrl = new AbortController()
    const to   = setTimeout(() => ctrl.abort(), 6000)
    const res  = await fetch(url, { signal: ctrl.signal })
    clearTimeout(to)
    if (!res.ok) return null
    const data = await res.json()
    return (data.organic_results || []).map(r => `${r.title}: ${r.snippet || ''}`).join('\n').slice(0, 2000) || null
  } catch { return null }
}

// ── Claude ────────────────────────────────────────────────────────────────────

async function claudeExtract(pages, serpText, companyName, allEmails, allPhones) {
  if (!CLAUDE_KEY) return null

  const pageBlocks = pages.map(p => `### [${detectPageType(p.url).toUpperCase()}] ${p.url}\n${p.text}`).join('\n\n---\n\n')
  const serpBlock  = serpText ? `### [GOOGLE SNIPPETS]\n${serpText}` : ''
  const combined   = `${pageBlocks}\n\n${serpBlock}`.slice(0, 5500)

  const prompt = `Extract REAL person contacts from this German hotel/company: "${companyName}"

PRE-EXTRACTED (verified — ONLY use these):
EMAILS: ${allEmails.join(', ') || 'none'}
PHONES: ${allPhones.join(', ') || 'none'}

TARGET ROLES — find ONLY people with these roles (two categories):

TECHNICAL (contactCategory: "technical"):
Facility Manager, Facility Managerin, Technischer Leiter, Technische Leiterin,
Energy Manager, Energiemanager, Operations Manager, Haustechniker, Hausleiter,
Technical Manager, Technical Director

BUSINESS (contactCategory: "business"):
Geschäftsführer, Geschäftsführerin, Direktor, Direktorin, Director,
General Manager, Hotel Manager, Hoteldirektor, Operations Director,
Inhaber, Inhaberin, Eigentümer, Eigentümerin, Betriebsleiter, Betriebsleiterin,
Kaufmännischer Leiter, Kaufmännische Leiterin

IGNORE completely: HR, Marketing, Sales Manager, Front Office Manager,
Rezeptionist, Empfang, Reservierung, Revenue Manager, Housekeeping,
Restaurantleiter, F&B Manager, IT Leiter, Karriere

SOURCE PAGES:
${combined}

STRICT RULES:
1. Only include a person if their FULL NAME (first + last) appears literally in the text
2. Only use emails from the EMAILS list above — never construct or guess
3. Only use phones from the PHONES list above
4. CONFIDENCE: HIGH = name+role+personal email; MEDIUM = name+role only; LOW = email only
5. sourceType: impressum|team|management|contact|website
6. generalEmail: best info@/kontakt@ style email from the list
7. Return empty contacts array if no real persons found — do NOT invent people
8. contactCategory MUST be "technical" or "business"

Return ONLY valid JSON (no markdown fences):
{
  "contacts": [
    {
      "name": "Full Name or null",
      "role": "exact title from text or null",
      "contactCategory": "technical|business",
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
  const timeoutP = new Promise((_, rej) => setTimeout(() => rej(new Error('Claude timeout')), 13000))

  try {
    const res  = await Promise.race([fetchP, timeoutP])
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || `Claude ${res.status}`)

    const raw    = (data.content?.[0]?.text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(raw)

    const FAKE_NAMES = ['ansprechpartner','kontakt','contact','impressum','team','management','hotel','service']
    const contacts = (parsed.contacts || []).filter(c =>
      (c.name || c.email) &&
      (!c.name || (c.name.length > 3 && !FAKE_NAMES.some(f => c.name.toLowerCase().includes(f))))
    )
    return { contacts, generalEmail: parsed.generalEmail || null }
  } catch (e) {
    console.warn(`[phase2] Claude failed: ${e.message}`)
    return null
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  let body
  try { body = JSON.parse(event.body || '{}') }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const { companyName, website, city = '', country = 'DE', phase1 = {} } = body
  if (!companyName) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'companyName required' }) }

  const t0      = Date.now()
  const baseUrl = normalizeUrl(website)
  const domain  = baseUrl ? extractHostname(baseUrl) : null
  console.log(`[phase2] START "${companyName}" url=${baseUrl || 'none'} city=${city}`)

  const hardTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error('phase2 timeout 23s')), 23000))

  async function run() {
    // 1. SerpAPI + Firecrawl in parallel
    const FC_PATHS = ['/impressum', '/team', '/management', '/contact', '/kontakt']

    const [serpText, ...fcPages] = await Promise.all([
      serpSearch(companyName, city, domain),
      ...FC_PATHS.map(path => scrapePage(baseUrl ? baseUrl + path : null, 7000)),
    ])

    const pages = fcPages
      .filter(Boolean)
      .map(p => ({ ...p, pageType: detectPageType(p.url), _source: 'firecrawl' }))

    if (serpText) console.log(`[phase2] serpapi: ${serpText.length} chars`)
    console.log(`[phase2] firecrawl: ${pages.length}/${FC_PATHS.length} pages`)

    // 2. Merge emails/phones from phase1 + new pages
    const allText  = pages.map(p => p.text).join('\n') + '\n' + (serpText || '')
    const p1Emails = phase1.allEmails || []
    const p1Phones = phase1.allPhones || []
    const allEmails = [...new Set([...p1Emails, ...extractEmails(allText)])]
    const allPhones = [...new Set([...p1Phones, ...extractPhones(allText)])]
    console.log(`[phase2] merged: emails=${allEmails.length} phones=${allPhones.length}`)

    // 3. Regex on new pages
    const regexPersons = []
    for (const page of pages) {
      regexPersons.push(...extractPersonsRegex(page.text, page.url, page.pageType))
    }
    const regexDeduped = deduplicateContacts(regexPersons)

    // 4. Claude extraction
    const claudeResult = (pages.length || serpText)
      ? await claudeExtract(pages, serpText, companyName, allEmails, allPhones)
      : null

    if (claudeResult) {
      console.log(`[phase2] Claude found ${claudeResult.contacts.length} contacts`)
    }

    // 5. Merge: Claude + phase2 regex + phase1 contacts
    const p1Contacts = (phase1.contacts || [])
    const allFound   = deduplicateContacts([
      ...(claudeResult?.contacts || []),
      ...regexDeduped,
      ...p1Contacts,
    ])

    // 6. Classify and select best
    const classified = allFound
      .map(c => ({ ...c, contactCategory: c.contactCategory || classifyRole(c.role) || null }))
      .filter(c => c.contactCategory)
    const contacts = selectBestContacts(classified)

    const generalEmail = claudeResult?.generalEmail || allEmails.filter(isGeneralEmail)[0] || null

    const ms = Date.now() - t0
    console.log(`[phase2] DONE ${ms}ms — ${contacts.length} contacts`)
    contacts.forEach((c, i) =>
      console.log(`  [${i + 1}] [${c.confidence}] name="${c.name || '-'}" role="${c.role || '-'}" email="${c.email || '-'}"`)
    )

    const nativeCount = p1Contacts.length > 0 ? ` (phase1: ${p1Contacts.length})` : ''
    return {
      contacts,
      generalEmail,
      allPhones,
      allEmails,
      sourceNote: `Native: ${p1Contacts.length > 0 ? 'yes' : 0} + Firecrawl: ${pages.length}${serpText ? ' + SerpAPI' : ''}`,
      phase:      2,
      foundAt:    new Date().toISOString(),
    }
  }

  try {
    const result = await Promise.race([run(), hardTimeout])
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, ...result }) }
  } catch (e) {
    console.error(`[phase2] FAILED: ${e.message}`)
    // Return phase1 data unchanged if phase2 times out
    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({
        ok:           true,
        contacts:     phase1.contacts     || [],
        generalEmail: (phase1.allEmails || []).filter(isGeneralEmail)[0] || null,
        allPhones:    phase1.allPhones    || [],
        allEmails:    phase1.allEmails    || [],
        sourceNote:   'Deep search timeout — phase1 results only',
        phase:        2,
        foundAt:      new Date().toISOString(),
      }),
    }
  }
}

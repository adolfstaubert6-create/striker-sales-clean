/**
 * Contact Discovery — Phase 1: native HTTP scrape only.
 * Hard cap 9s. Returns whatever regex finds from native pages.
 * Frontend should always follow up with find-contacts-deep for SerpAPI + Firecrawl + Claude.
 */

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

      console.log(`[phase1] found [${category}]: "${name}" — "${role}" src=${pageType}`)
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
  const merged  = []
  const byEmail = new Map()
  const byName  = new Map()
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
  return result
}

// ── Native HTTP scraper — tight budget for phase 1 ────────────────────────────

async function scrapePageNative(url, ms) {
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
  const pages    = []
  const t0       = Date.now()
  const BUDGET   = 8000                                                     // 8s total
  const PRIORITY = ['/impressum', '/team', '/management', '/kontakt', '/contact']

  const home = await scrapePageNative(baseUrl, 3000)
  if (home) pages.push(home)

  for (const path of PRIORITY) {
    if (Date.now() - t0 > BUDGET || pages.length >= 5) break
    const p = await scrapePageNative(baseUrl + path, 2500)
    if (p) pages.push(p)
  }
  return pages
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  let body
  try { body = JSON.parse(event.body || '{}') }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const { companyName, website, city = '', country = 'DE' } = body
  if (!companyName) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'companyName required' }) }

  const t0      = Date.now()
  const baseUrl = normalizeUrl(website)
  console.log(`[phase1] START "${companyName}" url=${baseUrl || 'none'} city=${city}`)

  const hardTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error('phase1 timeout 9s')), 9000))

  async function run() {
    const rawPages = baseUrl ? await scrapeWebsiteNative(baseUrl) : []
    const pages    = rawPages.map(p => ({ ...p, pageType: detectPageType(p.url) }))
    console.log(`[phase1] native scraped ${pages.length} pages`)

    const allText  = pages.map(p => p.text).join('\n')
    const allEmails = extractEmails(allText)
    const allPhones = extractPhones(allText)
    console.log(`[phase1] regex: emails=${allEmails.length} phones=${allPhones.length}`)

    const persons = []
    for (const page of pages) {
      persons.push(...extractPersonsRegex(page.text, page.url, page.pageType))
    }
    const deduped  = deduplicateContacts(persons)
    const contacts = selectBestContacts(
      deduped.map(c => ({ ...c, contactCategory: c.contactCategory || classifyRole(c.role) || null }))
             .filter(c => c.contactCategory)
    )

    const ms = Date.now() - t0
    console.log(`[phase1] DONE ${ms}ms — ${contacts.length} contacts pages=${pages.length}`)

    return {
      contacts,
      generalEmail: allEmails.filter(isGeneralEmail)[0] || null,
      allPhones,
      allEmails,
      sourceNote:  pages.length ? `Native: ${pages.length}` : 'no pages',
      phase:       1,
      foundAt:     new Date().toISOString(),
    }
  }

  try {
    const result = await Promise.race([run(), hardTimeout])
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, ...result }) }
  } catch (e) {
    console.warn(`[phase1] timeout/error: ${e.message}`)
    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({
        ok: true, contacts: [], generalEmail: null,
        allPhones: [], allEmails: [],
        sourceNote: 'phase1 timeout', phase: 1,
        foundAt: new Date().toISOString(),
      }),
    }
  }
}

/**
 * Contact email enrichment.
 * Pipeline: SerpAPI Google Search → if no personal email → Apollo people/match.
 * Does NOT write to Firestore — the frontend handles persistence.
 */

const SERPAPI_KEY = process.env.SERPAPI_API_KEY
const APOLLO_KEY  = process.env.APOLLO_API_KEY

const EMAIL_RE   = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g
const PHONE_RE   = /(?:(?:\+49|0049|0)[0-9\s()\-\/\.]{6,20})/g
const LINKEDIN_RE = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]+\/?/g

const GENERAL_PREFIXES = [
  'info','kontakt','contact','office','verwaltung','direktion','reception',
  'anfrage','sekretariat','buchung','reservierung','hallo','service','hello',
  'mail','post','hotel','team','support','sales','marketing','noreply','no-reply',
]

function isGeneralEmail(e) {
  const local = e.split('@')[0].toLowerCase()
  return GENERAL_PREFIXES.some(p => local === p || local.startsWith(p + '.') || local.startsWith(p + '-'))
}

function extractDomain(url) {
  if (!url) return null
  try {
    const u = url.startsWith('http') ? url : `https://${url}`
    return new URL(u).hostname.replace(/^www\./, '')
  } catch { return null }
}

function buildQueries(hotelName, hotelWebsite, name, role) {
  const domain  = extractDomain(hotelWebsite)
  const queries = []
  if (name) {
    queries.push(`"${name}" "${hotelName}" email`)
    if (domain) queries.push(`"${name}" "${domain}"`)
  }
  if (role) {
    queries.push(`"${role}" "${hotelName}" email`)
    if (domain && name) queries.push(`site:${domain} "${name}"`)
    else if (domain)    queries.push(`site:${domain} "${role}"`)
  }
  return queries.slice(0, 4)  // max 4 queries — manage SerpAPI credits
}

async function serpSearch(query) {
  const url  = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${SERPAPI_KEY}&hl=de&gl=de&num=10`
  const ctrl = new AbortController()
  const to   = setTimeout(() => ctrl.abort(), 9000)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(to)
    if (!res.ok) {
      const text = await res.text()
      console.warn(`[enrich-contact] SerpAPI ${res.status}: ${text.slice(0, 120)}`)
      return { results: [], error: `HTTP ${res.status}` }
    }
    const data = await res.json()
    return { results: data.organic_results || [], error: null }
  } catch (e) {
    clearTimeout(to)
    return { results: [], error: e.message }
  }
}

// ── Apollo people/match ───────────────────────────────────────────────────────

function splitName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

async function apolloSearch(contactName, hotelName, domain) {
  if (!APOLLO_KEY || !contactName) return null
  const { firstName, lastName } = splitName(contactName)

  const payload = {
    first_name:             firstName,
    last_name:              lastName,
    organization_name:      hotelName || undefined,
    domain:                 domain    || undefined,
    reveal_personal_emails: true,
  }

  console.log(`[enrich-contact] Apollo search: "${firstName} ${lastName}" @ "${hotelName}" domain=${domain}`)

  const ctrl = new AbortController()
  const to   = setTimeout(() => ctrl.abort(), 9000)
  try {
    const res = await fetch('https://api.apollo.io/v1/people/match', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Cache-Control': 'no-cache',
        'x-api-key':     APOLLO_KEY,
      },
      body:    JSON.stringify(payload),
      signal:  ctrl.signal,
    })
    clearTimeout(to)

    if (!res.ok) {
      const text = await res.text()
      console.warn(`[enrich-contact] Apollo ${res.status}: ${text.slice(0, 200)}`)
      return { error: `Apollo HTTP ${res.status}` }
    }

    const data   = await res.json()
    const person = data.person

    if (!person) {
      console.log(`[enrich-contact] Apollo: no person matched`)
      return { error: 'no match' }
    }

    const email    = person.email || null
    const linkedin = person.linkedin_url || null
    const phone    = person.phone_numbers?.[0]?.sanitized_number || null
    const title    = person.title || null

    console.log(`[enrich-contact] Apollo matched: email=${email || '-'} linkedin=${linkedin ? '✓' : '-'} title="${title}"`)

    return { email, linkedin, phone, title, raw: { id: person.id, name: person.name } }
  } catch (e) {
    clearTimeout(to)
    console.warn(`[enrich-contact] Apollo error: ${e.message}`)
    return { error: e.message }
  }
}

exports.handler = async (event) => {
  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  if (!SERPAPI_KEY && !APOLLO_KEY) {
    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({ ok: false, error: 'Žiadny API kľúč — nastavte SERPAPI_API_KEY alebo APOLLO_API_KEY.' }),
    }
  }

  let body
  try { body = JSON.parse(event.body || '{}') }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const { contactName, contactRole, contactCategory, hotelName, hotelWebsite } = body
  if (!hotelName) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'hotelName required' }) }

  const domain  = extractDomain(hotelWebsite)
  const queries = buildQueries(hotelName, hotelWebsite, contactName, contactRole)
  const t0      = Date.now()

  console.log(`[enrich-contact] START cat=${contactCategory} name="${contactName}" role="${contactRole}" hotel="${hotelName}" domain=${domain}`)
  console.log(`[enrich-contact] queries: ${JSON.stringify(queries)}`)

  // Run SerpAPI queries sequentially (skip if no key)
  const queryLogs  = []
  const allResults = []

  if (SERPAPI_KEY) {
    for (const q of queries) {
      const { results, error } = await serpSearch(q)
      queryLogs.push({ query: q, count: results.length, error: error || null })
      console.log(`[enrich-contact] query="${q}" → ${results.length} results${error ? ' err=' + error : ''}`)
      allResults.push(...results)
    }
  } else {
    console.log(`[enrich-contact] no SERPAPI_KEY — skipping Google search, going straight to Apollo`)
  }

  // Deduplicate results by URL
  const seen   = new Set()
  const unique = allResults.filter(r => {
    if (!r.link || seen.has(r.link)) return false
    seen.add(r.link); return true
  })

  // Parse all results for contact data
  const foundEmails    = new Set()
  const foundLinkedins = new Set()
  const foundPhones    = new Set()
  const matchedPages   = []
  const nameParts      = (contactName || '').toLowerCase().trim().split(/\s+/).filter(p => p.length > 2)

  for (const r of unique) {
    const text      = `${r.title || ''} ${r.snippet || ''}`
    const textFull  = `${text} ${r.link || ''}`
    const textLower = textFull.toLowerCase()

    // Normalize obfuscated emails before extraction: [at] / (at) / " at " → @
    const textNorm = text
      .replace(/\s*\[at\]\s*/gi, '@')
      .replace(/\s*\(at\)\s*/gi, '@')
      .replace(/\s+at\s+(?=[A-Za-z0-9.\-]+\.[A-Za-z]{2,})/g, '@')

    // Extract emails from (normalized) snippet text
    for (const e of (textNorm.match(EMAIL_RE) || [])) {
      console.log(`[enrich-contact] email candidate from snippet: ${e}`)
      foundEmails.add(e.toLowerCase())
    }

    // Extract LinkedIn from link OR snippet
    for (const l of (textFull.match(LINKEDIN_RE) || [])) {
      const clean = l.replace(/\/$/, '').replace(/\?.*$/, '')
      console.log(`[enrich-contact] LinkedIn candidate: ${clean}`)
      foundLinkedins.add(clean)
    }

    // Extract phones from snippet
    for (const p of (text.match(PHONE_RE) || [])) {
      const cleaned = p.trim()
      if (cleaned.replace(/\D/g, '').length >= 7) foundPhones.add(cleaned)
    }

    // Track pages that mention the person by name or role
    const nameHit = nameParts.length > 0 && nameParts.every(p => textLower.includes(p))
    const roleHit = contactRole && textLower.includes((contactRole || '').toLowerCase().slice(0, 12))

    if (nameHit) console.log(`[enrich-contact] name match: "${r.title}" — ${r.link}`)
    if (roleHit) console.log(`[enrich-contact] role match: "${r.title}" — ${r.link}`)

    if (nameHit || roleHit) {
      matchedPages.push({ url: r.link, title: r.title, snippet: (r.snippet || '').slice(0, 200) })
    } else {
      console.log(`[enrich-contact] rejected: "${r.title?.slice(0, 60)}" — no name/role match`)
    }
  }

  // Classify emails
  // "Personal" requires: not a general prefix AND local part contains a name fragment
  function isPersonalEmail(e) {
    if (isGeneralEmail(e)) return false
    if (!nameParts.length) return true  // no name to check against — accept non-general
    const local = e.split('@')[0].toLowerCase()
    return nameParts.some(p => p.length >= 3 && local.includes(p))
  }

  const personalEmails   = [...foundEmails].filter(isPersonalEmail)
  const domainEmails     = domain ? [...foundEmails].filter(e => e.endsWith('@' + domain)) : []
  const personalOnDomain = domain ? personalEmails.filter(e => e.endsWith('@' + domain)) : []

  // Log rejected non-general emails (passed isGeneralEmail but failed name check)
  const nonGeneral = [...foundEmails].filter(e => !isGeneralEmail(e))
  nonGeneral.filter(e => !isPersonalEmail(e)).forEach(e =>
    console.log(`[enrich-contact] rejected non-general email (no name match): ${e}`)
  )

  // Best email pick: personal+on-domain > personal anywhere > domain email
  const bestEmail = personalOnDomain[0] || personalEmails[0] || domainEmails[0] || null

  // Best LinkedIn: prefer slug that contains part of the name
  const bestLinkedin = [...foundLinkedins].find(l => {
    if (!nameParts.length) return true
    const slug = l.toLowerCase()
    return nameParts.some(p => p.length > 3 && slug.includes(p))
  }) || [...foundLinkedins][0] || null

  // Apollo fallback — only when SerpAPI found no personal email
  let apolloResult = null
  let finalEmail    = bestEmail
  let finalLinkedin = bestLinkedin
  let finalPhone    = [...foundPhones][0] || null
  let sourceType    = 'GOOGLE'

  if ((!bestEmail || !isPersonalEmail(bestEmail)) && APOLLO_KEY) {
    apolloResult = await apolloSearch(contactName, hotelName, domain)
    if (apolloResult && !apolloResult.error) {
      if (apolloResult.email)    finalEmail    = apolloResult.email
      if (apolloResult.linkedin) finalLinkedin = apolloResult.linkedin
      if (apolloResult.phone)    finalPhone    = apolloResult.phone
      sourceType = finalEmail ? 'APOLLO' : 'GOOGLE+APOLLO'
    }
  }

  // Confidence scoring — re-evaluate against final merged values
  const hasName = !!(contactName || '').trim()
  const hasRole = !!(contactRole || '').trim()

  function isPersonalFinal(e) {
    if (!e) return false
    if (isGeneralEmail(e)) return false
    if (!nameParts.length) return true
    const local = e.split('@')[0].toLowerCase()
    return nameParts.some(p => p.length >= 3 && local.includes(p))
  }

  let confidence
  if (finalEmail && isPersonalFinal(finalEmail) && hasName)   confidence = 'HIGH'
  else if (finalEmail && hasName)                             confidence = 'MEDIUM'
  else if (finalLinkedin && (hasName || hasRole))             confidence = 'MEDIUM'
  else if (domainEmails.length > 0 || matchedPages.length > 0) confidence = 'LOW'
  else if (apolloResult && !apolloResult.error)               confidence = 'LOW'
  else                                                        confidence = null

  const ms = Date.now() - t0
  console.log(`[enrich-contact] DONE ${ms}ms email=${finalEmail || '-'} src=${sourceType} linkedin=${finalLinkedin ? '✓' : '-'} confidence=${confidence}`)

  return {
    statusCode: 200, headers: CORS,
    body: JSON.stringify({
      ok: true,
      enriched: {
        email:        finalEmail,
        emailType:    finalEmail
                        ? (sourceType === 'APOLLO' ? 'WORK' : isGeneralEmail(finalEmail) ? 'GENERAL' : 'PERSONAL')
                        : null,
        linkedin:     finalLinkedin,
        phone:        finalPhone,
        confidence:   confidence || 'LOW',
        sourceType,
        enrichedAt:   new Date().toISOString(),
        matchedPages: matchedPages.slice(0, 3),
      },
      debug: {
        serpapi: {
          queries:      queryLogs,
          totalResults: unique.length,
          emails:       [...foundEmails],
          linkedins:    [...foundLinkedins],
          matchedPages: matchedPages.length,
        },
        apollo: apolloResult || { skipped: 'SerpAPI found personal/work email — Apollo not needed' },
        ms,
      },
    }),
  }
}

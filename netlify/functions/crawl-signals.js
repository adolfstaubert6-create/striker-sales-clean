/**
 * crawl-signals — Phase 1D
 * Crawls company website pages, extracts readable text, runs keyword-based
 * signal analysis WITH concrete evidence (snippet + URL per keyword hit),
 * and saves results to Firestore.
 *
 * POST /.netlify/functions/crawl-signals
 * Body: { web, name, segment, segmentLabel, city, docId }
 */

const FB_API_KEY = process.env.VITE_FIREBASE_API_KEY
const FB_PROJECT = process.env.VITE_FIREBASE_PROJECT_ID

// ── Firestore REST helpers ─────────────────────────────────────────────────────

const FS_BASE = () => `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents`

function toFsVal(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean')        return { booleanValue: v }
  if (typeof v === 'number')         return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'string')         return { stringValue: v }
  if (Array.isArray(v))              return { arrayValue: { values: v.map(toFsVal) } }
  if (typeof v === 'object')         return { mapValue: { fields: toFsFields(v) } }
  return { stringValue: String(v) }
}
function toFsFields(obj) {
  const f = {}
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) f[k] = toFsVal(v)
  return f
}

async function fsPatch(docId, data) {
  const fields    = toFsFields(data)
  const fieldMask = Object.keys(fields).join(',')
  const url       = `${FS_BASE()}/intelligence_targets/${docId}?key=${FB_API_KEY}&updateMask.fieldPaths=${encodeURIComponent(fieldMask)}`
  const res = await fetch(url, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Firestore PATCH ${res.status}: ${err.error?.message || 'unknown'}`)
  }
  return res.json()
}

// ── Signal keyword groups ──────────────────────────────────────────────────────

const SIGNAL_GROUPS = [
  { id: 'energy_efficiency',      label: 'Energy Efficiency',      weight: 10, keywords: ['energie', 'energieeffizienz', 'energy efficiency', 'energiesparen', 'energieverbrauch', 'stromverbrauch', 'wärmepumpe', 'heat pump', 'energiekosten', 'energy costs', 'energieverantwortlich', 'niedrigenergie', 'low energy', 'energieoptimierung'] },
  { id: 'modernization',          label: 'Modernisierung',          weight: 9,  keywords: ['modernisierung', 'modernization', 'modernisiert', 'sanierung', 'renovierung', 'renovation', 'umbau', 'refurbishment', 'nachrüstung', 'retrofit', 'upgrade', 'erneuerung', 'instandhaltung', 'maintenance', 'haustechnik'] },
  { id: 'sustainability',         label: 'Nachhaltigkeit',          weight: 9,  keywords: ['nachhaltigkeit', 'sustainability', 'nachhaltig', 'sustainable', 'umwelt', 'environment', 'ökologie', 'ecology', 'ressourcenschonung', 'resource', 'klimaschutz', 'climate protection', 'verantwortung', 'responsibility'] },
  { id: 'esg',                    label: 'ESG',                     weight: 8,  keywords: ['esg', 'environmental social governance', 'csr', 'corporate social responsibility', 'nachhaltigkeitsbericht', 'sustainability report', 'non-financial', 'nicht-finanziell', 'klimastrategie', 'klimaziele', 'klimaneutral'] },
  { id: 'co2_reduction',          label: 'CO₂-Reduzierung',         weight: 10, keywords: ['co2', 'co₂', 'carbon', 'treibhausgas', 'greenhouse gas', 'kohlenstoff', 'emissionen', 'emissions', 'dekarbonisierung', 'decarbonization', 'klimaneutral', 'carbon neutral', 'net zero', 'netto null', 'scope 1', 'scope 2', 'scope 3', 'co2-fußabdruck', 'carbon footprint'] },
  { id: 'hvac',                   label: 'HVAC / Klima',            weight: 10, keywords: ['hvac', 'klimaanlage', 'air conditioning', 'lüftung', 'ventilation', 'kältetechnik', 'refrigeration', 'heizung', 'heating', 'klimatisierung', 'gebäudeklimatik', 'raumlufttechnik', 'kühlung', 'cooling', 'heizkessel', 'boiler'] },
  { id: 'heating_modernization',  label: 'Heizungsmodernisierung',  weight: 10, keywords: ['heizungsmodernisierung', 'heating modernization', 'fernwärme', 'district heating', 'wärmenetz', 'heizungsanlage', 'heating system', 'heiztechnik', 'wärmeversorgung', 'heat supply', 'heizkesselersatz', 'brennwert', 'condensing boiler', 'pellets', 'biomasse'] },
  { id: 'renovation',             label: 'Gebäuderenovierung',      weight: 8,  keywords: ['gebäuderenovierung', 'building renovation', 'fassade', 'facade', 'dämmung', 'insulation', 'wärmedämmung', 'thermal insulation', 'fenster', 'windows', 'dach', 'roof', 'gebäudehülle', 'building envelope', 'altbau', 'old building'] },
  { id: 'green_building',         label: 'Green Building',          weight: 8,  keywords: ['green building', 'grünes gebäude', 'leed', 'breeam', 'dgnb', 'energieausweis', 'energy certificate', 'effizienzhaus', 'passivhaus', 'passive house', 'nullenergiehaus', 'zero energy building', 'plusenergiehaus'] },
  { id: 'decarbonization',        label: 'Dekarbonisierung',        weight: 10, keywords: ['dekarbonisierung', 'decarbonization', 'decarbonisation', 'klimaneutralität', 'climate neutrality', 'klimaziele', 'paris agreement', 'pariser abkommen', '1.5 grad', '1.5 degree', 'energiewende', 'energy transition', 'erneuerbare energien', 'renewable energy', 'solarenergie', 'solar', 'photovoltaik', 'windenergie', 'geothermie', 'geothermal'] },
]

// ── Page paths to crawl ────────────────────────────────────────────────────────

const SIGNAL_PATHS = [
  '',
  '/nachhaltigkeit', '/sustainability', '/esg',
  '/energie', '/energy', '/energieeffizienz',
  '/modernisierung', '/renovierung',
  '/umwelt', '/klima', '/co2', '/green',
  '/news', '/presse', '/aktuelles',
]

// ── HTML → plain text ──────────────────────────────────────────────────────────

function extractText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 12000)
}

// ── Fetch one page ─────────────────────────────────────────────────────────────

async function fetchPage(url, timeoutMs = 4000) {
  const ctrl = new AbortController()
  const t    = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal:  ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; STRIKERBot/1.0)' },
      redirect: 'follow',
    })
    clearTimeout(t)
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('html') && !ct.includes('text')) return null
    const html = await res.text()
    return extractText(html)
  } catch {
    clearTimeout(t)
    return null
  }
}

// ── Crawl company website — returns per-page objects ─────────────────────────

async function crawlCompanySignals(web) {
  if (!web) return { pages: [], sources: [] }

  const base = web.startsWith('http') ? web.replace(/\/$/, '') : `https://${web.replace(/\/$/, '')}`

  let domain = ''
  try { domain = new URL(base).hostname } catch { return { pages: [], sources: [] } }

  const pages   = []
  const sources = []
  let   tried   = 0

  for (const path of SIGNAL_PATHS) {
    if (tried >= 6) break
    const url = base + path
    tried++

    const text = await fetchPage(url)
    if (text && text.length > 100) {
      pages.push({ url, text })
      sources.push(url)
    }

    if (pages.reduce((s, p) => s + p.text.length, 0) > 30000) break
  }

  return { pages, sources }
}

// ── Signal analysis WITH evidence extraction ───────────────────────────────────
//
// Returns:
//   detectedSignals — existing format [{ id, label, weight, matches[], hitCount }]
//   signalCount     — number of groups that fired
//   strikerNeedScore — 0–100
//   signalReason    — human-readable summary
//   signalEvidence  — NEW: [{ groupId, groupLabel, keyword, snippet, url }]
//                     max 2 per group, max 30 total

function analyzeSignalsWithEvidence(pages) {
  const detectedMap = {}   // groupId -> aggregated signal entry
  const allEvidence = []
  const seenKwUrl   = new Set()

  for (const { url, text } of pages) {
    const tLow = text.toLowerCase()

    for (const g of SIGNAL_GROUPS) {
      for (const kw of g.keywords) {
        const kwLow = kw.toLowerCase()
        const idx   = tLow.indexOf(kwLow)
        if (idx === -1) continue

        const dedupeKey = `${kwLow}::${url}`
        if (!seenKwUrl.has(dedupeKey)) {
          seenKwUrl.add(dedupeKey)

          // Extract 120-char context window around the keyword
          const start   = Math.max(0, idx - 120)
          const end     = Math.min(text.length, idx + kw.length + 120)
          const raw     = text.slice(start, end).replace(/\s+/g, ' ').trim()
          const snippet = (start > 0 ? '…' : '') + raw + (end < text.length ? '…' : '')

          allEvidence.push({ groupId: g.id, groupLabel: g.label, keyword: kw, snippet, url })
        }

        // Aggregate for detectedSignals (keyword counted once per group across all pages)
        if (!detectedMap[g.id]) {
          detectedMap[g.id] = { id: g.id, label: g.label, weight: g.weight, matches: new Set(), hitCount: 0 }
        }
        if (!detectedMap[g.id].matches.has(kw)) {
          detectedMap[g.id].matches.add(kw)
          detectedMap[g.id].hitCount++
        }
      }
    }
  }

  // Convert Sets to arrays for serialisation
  const detectedSignals = Object.values(detectedMap).map(g => ({
    id:       g.id,
    label:    g.label,
    weight:   g.weight,
    matches:  [...g.matches],
    hitCount: g.hitCount,
  }))

  const total       = detectedSignals.reduce((s, g) => s + g.weight * Math.min(g.hitCount, 3), 0)
  const maxPossible = SIGNAL_GROUPS.reduce((s, g) => s + g.weight * 3, 0)
  const strikerNeedScore = Math.min(100, Math.round((total / maxPossible) * 100))

  const top3 = [...detectedSignals]
    .sort((a, b) => b.weight * b.hitCount - a.weight * a.hitCount)
    .slice(0, 3)
    .map(s => s.label)

  const signalReason = detectedSignals.length > 0
    ? `Detekované oblasti: ${top3.join(', ')}${detectedSignals.length > 3 ? ` a ${detectedSignals.length - 3} ďalšie` : ''}.`
    : 'Web sa nepodarilo analyzovať.'

  // Cap evidence: max 2 entries per group, 30 total
  const byGroup       = {}
  const signalEvidence = []
  for (const ev of allEvidence) {
    byGroup[ev.groupId] = (byGroup[ev.groupId] || 0) + 1
    if (byGroup[ev.groupId] <= 2) signalEvidence.push(ev)
    if (signalEvidence.length >= 30) break
  }

  return { detectedSignals, signalCount: detectedSignals.length, strikerNeedScore, signalReason, signalEvidence }
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  let body
  try { body = JSON.parse(event.body || '{}') }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const { web = '', name = '', segment = '', segmentLabel = '', city = '', docId } = body

  if (!web && !name) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'web or name required' }) }

  console.log(`[crawl-signals] START "${name}" web=${web} docId=${docId}`)
  const t0 = Date.now()

  // Crawl — returns per-page objects with url+text
  const { pages, sources } = await crawlCompanySignals(web)

  // Prepend metadata pseudo-page so name/segment/city contribute to scoring
  const metaText = [name, segment, segmentLabel, city].filter(Boolean).join(' ')
  const allPages = metaText
    ? [{ url: 'meta', text: metaText }, ...pages]
    : pages

  console.log(`[crawl-signals] crawled=${sources.length} pages, chars=${allPages.reduce((s,p) => s+p.text.length, 0)} ${Date.now()-t0}ms`)

  const result = analyzeSignalsWithEvidence(allPages)

  // If crawl failed entirely, override signalReason
  if (sources.length === 0 || allPages.every(p => p.url === 'meta')) {
    result.signalReason = 'Web sa nepodarilo analyzovať.'
  }

  const payload = {
    ...result,
    signalSources: sources,
    analyzedAt:    new Date().toISOString(),
  }

  console.log(`[crawl-signals] score=${result.strikerNeedScore} groups=${result.signalCount} evidence=${result.signalEvidence.length} sources=${sources.length}`)

  // Persist to Firestore
  if (docId && FB_API_KEY && FB_PROJECT) {
    try {
      await fsPatch(docId, payload)
      console.log(`[crawl-signals] Firestore updated ${docId} ${Date.now()-t0}ms`)
    } catch (e) {
      console.warn(`[crawl-signals] Firestore PATCH failed: ${e.message}`)
    }
  }

  console.log(`[crawl-signals] DONE "${name}" ${Date.now()-t0}ms`)
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, name, ...payload }) }
}

/**
 * crawl-signals — Phase 1D
 * Crawls company website pages, extracts readable text, runs keyword-based
 * signal analysis, and saves results to Firestore.
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

// ── Signal keyword groups (mirrors src/utils/signalAnalysis.js) ────────────────

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

function analyzeSignals(text) {
  const t   = (text || '').toLowerCase()
  const detected = []
  let   total    = 0
  for (const g of SIGNAL_GROUPS) {
    const matched = g.keywords.filter(kw => t.includes(kw.toLowerCase()))
    if (matched.length > 0) {
      detected.push({ id: g.id, label: g.label, weight: g.weight, matches: matched, hitCount: matched.length })
      total += g.weight * Math.min(matched.length, 3)
    }
  }
  const maxPossible = SIGNAL_GROUPS.reduce((s, g) => s + g.weight * 3, 0)
  const score       = Math.min(100, Math.round((total / maxPossible) * 100))
  const top3        = detected.sort((a, b) => b.weight * b.hitCount - a.weight * a.hitCount).slice(0, 3).map(s => s.label)
  const reason      = detected.length > 0
    ? `Detekované oblasti: ${top3.join(', ')}${detected.length > 3 ? ` a ${detected.length - 3} ďalšie` : ''}.`
    : 'Web sa nepodarilo analyzovať.'
  return { detectedSignals: detected, signalCount: detected.length, strikerNeedScore: score, signalReason: reason }
}

// ── Page paths to try ──────────────────────────────────────────────────────────

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

// ── Crawl one page ─────────────────────────────────────────────────────────────

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

// ── Main crawl ─────────────────────────────────────────────────────────────────

async function crawlCompanySignals(web, name) {
  if (!web) return { text: '', sources: [] }

  const base = web.startsWith('http') ? web.replace(/\/$/, '') : `https://${web.replace(/\/$/, '')}`

  // Parse domain for same-domain check
  let domain = ''
  try { domain = new URL(base).hostname } catch { return { text: '', sources: [] } }

  const texts   = []
  const sources = []
  let   tried   = 0

  for (const path of SIGNAL_PATHS) {
    if (tried >= 6) break
    const url = base + path
    tried++

    const text = await fetchPage(url)
    if (text && text.length > 100) {
      texts.push(text)
      sources.push(url)
    }

    // Stop early if we already have enough material
    if (texts.join(' ').length > 30000) break
  }

  return {
    text:    texts.join(' ').slice(0, 40000),
    sources,
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

  const { web = '', name = '', segment = '', segmentLabel = '', city = '', docId } = body

  if (!web && !name) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'web or name required' }) }

  console.log(`[crawl-signals] START "${name}" web=${web} docId=${docId}`)
  const t0 = Date.now()

  // Crawl
  const { text, sources } = await crawlCompanySignals(web, name)

  const crawled   = sources.length
  const textLen   = text.length
  console.log(`[crawl-signals] crawled=${crawled} chars=${textLen} ${Date.now()-t0}ms`)

  // Build shallow company object for analyzeSignals (mirrors analyzeCompanySignals input)
  const companyText = [name, segment, segmentLabel, city].join(' ') + ' ' + text
  const signals     = analyzeSignals(companyText)

  const noSignals = crawled === 0 || textLen < 100
  if (noSignals) {
    signals.signalReason = 'Web sa nepodarilo analyzovať.'
  }

  const result = {
    ...signals,
    signalSources: sources,
    analyzedAt:    new Date().toISOString(),
  }

  console.log(`[crawl-signals] score=${result.strikerNeedScore} count=${result.signalCount} sources=${sources.length}`)

  // Persist to Firestore
  if (docId && FB_API_KEY && FB_PROJECT) {
    try {
      await fsPatch(docId, result)
      console.log(`[crawl-signals] Firestore updated ${docId} ${Date.now()-t0}ms`)
    } catch (e) {
      console.warn(`[crawl-signals] Firestore PATCH failed: ${e.message}`)
    }
  }

  console.log(`[crawl-signals] DONE "${name}" ${Date.now()-t0}ms`)
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, name, ...result }) }
}

const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY
const CLAUDE_MODEL = 'claude-sonnet-4-6'

// ── Fallback — segment-based, no Claude needed ────────────────────────────────

function fallback(segment, segmentLabel, companyName) {
  const seg = (segment || '').toLowerCase()
  const isL = seg.includes('waesch') || seg.includes('laund') || seg.includes('textil') || seg.includes('praco')
  const isH = seg.includes('hotel') || seg.includes('gastro') || seg.includes('resort')
  const label = segmentLabel || segment || 'Firma'

  if (isL) return {
    score: 82,
    painPoints: [
      'Sehr hoher Wärme- und Dampfbedarf rund um die Uhr',
      'Energiekosten machen 30–40 % der Betriebskosten aus',
      'Abhängigkeit von teurem Gas- oder Ölkessel'
    ],
    reasoning: `${companyName} ist eine Industriewäscherei mit kontinuierlichem Heizbedarf. STRIKER kann bis zu 70 % der Wärmekosten einsparen — ROI typisch unter 12 Monaten.`,
    mainArgument: '45 kW Strom → 120–160 kW Wärme: Wäschereien sparen im Schnitt 25.000–40.000 EUR jährlich.',
    opportunity: 'Sofortiger Gesprächseinstieg über Energiekosten und Amortisation unter 12 Monaten.',
    draft: `Sehr geehrte Damen und Herren,\n\nmein Name ist Adolf Staubert. Ich entwickle STRIKER — eine patentierte Wärmetechnologie für energieintensive Betriebe wie Industriewäschereien.\n\nBei 45 kW Stromverbrauch erzeugt STRIKER 120–160 kW Wärme. Das bedeutet für Ihren Betrieb eine Einsparung von typischerweise 60–70 % der Heizkosten — bei einem Preis ab 8.000 EUR und einer Amortisation unter 12 Monaten.\n\nDarf ich kurz Ihren Energieverbrauch mit Ihnen durchgehen?\n\nMit freundlichen Grüßen\nAdolf Staubert\nSTRIKER Wärmetechnologie\n+49 171 4758126 · info@striker-energy.de`
  }
  if (isH) return {
    score: 70,
    painPoints: [
      'Hoher Warmwasserverbrauch (Zimmer, Restaurant, Küche)',
      'Steigende Heizkosten belasten Betriebsergebnis',
      'Veraltete Heizanlage mit niedrigem Wirkungsgrad'
    ],
    reasoning: `${companyName} hat als Hotel typisch hohen Wärmebedarf. STRIKER senkt Heizkosten um bis zu 70 % — ideal für Warmwasser und Raumheizung.`,
    mainArgument: 'Hotels sparen mit STRIKER 10.000–20.000 EUR jährlich bei Heizkosten.',
    opportunity: 'Erstkontakt über Energieoptimierung und ROI-Rechnung unter 18 Monaten.',
    draft: `Sehr geehrte Damen und Herren,\n\nmein Name ist Adolf Staubert. Ich stelle Ihnen STRIKER vor — eine patentierte Heiztechnologie speziell für Hotels.\n\nBei 45 kW elektrischer Leistung liefert STRIKER 120–160 kW Wärme. Das bedeutet bis zu 70 % niedrigere Heizkosten — typisch 10.000–20.000 EUR Ersparnis jährlich.\n\nPreis ab 8.000 EUR, Lieferzeit 6–8 Wochen.\n\nDarf ich Ihnen kurz ein konkretes Beispiel für Ihr Haus vorstellen?\n\nMit freundlichen Grüßen\nAdolf Staubert\nSTRIKER Wärmetechnologie\n+49 171 4758126 · info@striker-energy.de`
  }
  return {
    score: 60,
    painPoints: [
      'Steigende Energiekosten belasten den Betrieb',
      'Hoher Wärmebedarf für Produktion oder Betrieb',
      'Potenzial für Energieeinsparung nicht ausgeschöpft'
    ],
    reasoning: `${companyName} (${label}) hat Potenzial für STRIKER-Technologie bei der Wärmeerzeugung.`,
    mainArgument: 'STRIKER: 45 kW → 120 kW Wärme, Einsparung bis 70 %, ROI 6–36 Monate.',
    opportunity: 'Erstgespräch über Energiekosten und Einsparpotenzial.',
    draft: `Sehr geehrte Damen und Herren,\n\nmein Name ist Adolf Staubert. Ich entwickle STRIKER — eine Heiztechnologie mit bis zu 70 % Einsparung bei Wärmekosten.\n\nPreis ab 8.000 EUR. Darf ich kurz mit Ihnen sprechen?\n\nMit freundlichen Grüßen\nAdolf Staubert\n+49 171 4758126 · info@striker-energy.de`
  }
}

// ── Claude analysis ───────────────────────────────────────────────────────────

async function runClaude(companyName, city, segment, segmentLabel, fitScore) {
  const prompt = `STRIKER AI sales analyst. Return ONLY valid JSON, no markdown.
STRIKER: 45kW electric → 120-160kW heat, price 8000-10000 EUR, ROI 6-36 months.
Company: ${companyName} | Segment: ${segmentLabel || segment} | City: ${city} | Fit: ${fitScore}/100
Analyze STRIKER sales potential. All text in German (Deutsch).
{"score":75,"painPoints":["pain 1","pain 2","pain 3"],"reasoning":"2 sentences why STRIKER fit","mainArgument":"strongest single argument","opportunity":"1 sentence business opportunity","draft":"Sehr geehrte Damen und Herren,\\n\\n...professional email draft 80-120 words...\\n\\nMit freundlichen Grüßen\\nAdolf Staubert\\nSTRIKER Wärmetechnologie\\n+49 171 4758126 · info@striker-energy.de"}`

  const fetchP = fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const timeoutP = new Promise((_, rej) =>
    setTimeout(() => rej(new Error('Claude timeout 12s')), 12000)
  )

  const res  = await Promise.race([fetchP, timeoutP])
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || `Claude HTTP ${res.status}`)

  const raw = (data.content?.[0]?.text || '').trim()
    .replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()

  const parsed = JSON.parse(raw)
  if (!parsed.score || !parsed.painPoints || !parsed.draft) throw new Error('Claude: missing fields')
  return parsed
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  let body
  try { body = JSON.parse(event.body || '{}') }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const { companyName, city = '', segment = '', segmentLabel = '', fitScore = 50 } = body
  if (!companyName) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'companyName required' }) }

  console.log(`[ai-analysis] START "${companyName}" segment=${segment} city=${city} fit=${fitScore}`)
  const t0 = Date.now()

  let result, usedFallback = false

  if (CLAUDE_KEY) {
    try {
      result = await runClaude(companyName, city, segment, segmentLabel, fitScore)
      console.log(`[ai-analysis] Claude OK in ${Date.now()-t0}ms score=${result.score}`)
    } catch (e) {
      console.warn(`[ai-analysis] Claude failed (${e.message}) — using fallback`)
      result = fallback(segment, segmentLabel, companyName)
      usedFallback = true
    }
  } else {
    console.warn('[ai-analysis] ANTHROPIC_API_KEY missing — using fallback')
    result = fallback(segment, segmentLabel, companyName)
    usedFallback = true
  }

  console.log(`[ai-analysis] DONE in ${Date.now()-t0}ms usedFallback=${usedFallback}`)

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ ok: true, usedFallback, ...result }),
  }
}

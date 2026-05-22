const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY
const CLAUDE_MODEL = 'claude-sonnet-4-6'

// ── Segment fallback ───────────────────────────────────────────────────────────

const MOD_KEYWORDS = ['renovierung','modernisierung','renovation','umbau','sanierung','modernizácia','rekonštrukcia','veraltet','outdated','alt','upgraded','rebuilt','technical issues']

function buildFallback(companyName, segment, segmentLabel, fitScore, liveSignals) {
  const modDetected = (liveSignals || []).filter(s => MOD_KEYWORDS.some(k => s.toLowerCase().includes(k)))
  const seg = (segment || '').toLowerCase()
  const isL = seg.includes('waesch') || seg.includes('laund') || seg.includes('textil')
  const isH = seg.includes('hotel') || seg.includes('gastro') || seg.includes('resort')
  const label = segmentLabel || segment || 'firma'
  const high  = fitScore >= 70

  return {
    clientProfile: `${companyName} je ${label} s predpokladanou vysokou spotrebou tepelnej energie. AI odhad naznačuje potenciál pre STRIKER na základe typických charakteristík segmentu.`,
    businessPressure: {
      main: isL ? 'Priemyselné práčovne čelia extrémnym nákladom na teplo — energia je ich hlavnou výdavkovou položkou.' : isH ? 'Hotel čelí rastúcim nákladom na vykurovanie a teplú vodu pre hostí.' : 'Firma pravdepodobne eviduje rastúce energetické náklady.',
      items: isL
        ? ['Vysoké náklady na tepelnú energiu', 'Tlak na zníženie prevádzkových nákladov', 'Závislosť od plynového kotla']
        : isH
        ? ['Náklady na teplú vodu pre izby a reštauráciu', 'Sezónny tlak na vykurovanie', 'Požiadavky hostí na komfort']
        : ['Rastúce ceny energií', 'Tlak na úspory v prevádzke', 'Potreba stabilizácie nákladov'],
    },
    technicalProfile: {
      buildingAge:              'AI odhad: pravdepodobne 10–30 rokov',
      heatingType:              'AI odhad: plynový kotol alebo centrálne vykurovanie',
      hotWaterDemand:           isL ? 'Veľmi vysoká — priemyselné procesy' : isH ? 'Vysoká — izby, kuchyňa, wellness' : 'Stredná',
      modernizationLikelihood:  high ? 'vysoká' : 'stredná',
      details: ['Technický profil je AI odhad — bez reálnych dát z webu', 'Overenie odporúčané počas obchodného kontaktu'],
    },
    internetSignals: {
      summary:    null,
      items:      [],
      sourceNote: 'AI odhad — live dáta nedostupné',
    },
    decisionProfile: {
      likelyDecisionMaker: isL ? 'Majiteľ alebo prevádzkový riaditeľ' : isH ? 'Majiteľ alebo Facility Manager' : 'Majiteľ / CEO',
      roles:   isL ? ['Majiteľ/CEO', 'Prevádzkový manažér', 'Facility Manager'] : isH ? ['Majiteľ/CEO', 'Facility Manager', 'Technický riaditeľ'] : ['Majiteľ/CEO', 'CFO', 'Technický riaditeľ'],
      process: 'AI odhad: rozhodovanie trvá 2–8 týždňov, závisí od veľkosti firmy.',
    },
    salesStrategy: {
      tone:      'Odborný a dôveryhodný — zdôrazniť čísla a ROI',
      emphasize: ['Konkrétna úspora v EUR/rok', 'Krátka návratnosť investície', 'Jednoduchá inštalácia bez výpadku prevádzky'],
      avoid:     ['Príliš technické detaily hneď na začiatku', 'Tlak na rýchle rozhodnutie'],
      startWith: 'email',
      nextStep:  'Odoslať personalizovaný email s orientačnou kalkuláciou úspory.',
    },
    risks: [
      'AI odhad: rozhodovanie môže trvať dlhšie bez jasného kontaktu',
      'Konzervatívny manažment môže požadovať referencie a testovacie obdobie',
      'Cenová citlivosť — investícia 8 000+ EUR vyžaduje jasný ROI argument',
    ],
    intelligence: {
      buildingAge: {
        estimate:        isL ? 'stredná až staršia budova' : isH ? 'stredná budova' : 'stredný vek (AI odhad)',
        approximateAge:  '10–30 rokov (AI odhad)',
        confidence:      'LOW',
        reasoning:       'AI odhad na základe segmentu — bez overených dát o budove.',
      },
      technologyState: {
        heatingType:   isL ? 'pravdepodobne plynový kotol alebo centrálny systém' : isH ? 'pravdepodobne plynový kotol' : 'neznámy typ (AI odhad)',
        estimatedAge:  isL ? '10–20 rokov (AI odhad)' : '5–20 rokov (AI odhad)',
        status:        high ? 'pravdepodobne zastarané — vhodné na modernizáciu' : 'stav neznámy',
        hotWater:      isL ? 'veľmi vysoká závislosť' : isH ? 'vysoká závislosť' : 'stredná závislosť',
        wellness:      isH ? 'možná závislosť (wellness, bazén)' : 'pravdepodobne nie',
        confidence:    'LOW',
        reasoning:     'Odhadované na základe segmentu bez technickej dokumentácie.',
      },
      modernizationSignals: {
        detected:        modDetected.slice(0, 5),
        interpretation:  modDetected.length > 2 ? 'Signály z dostupných dát naznačujú záujem o modernizáciu alebo technické problémy.' : high ? 'AI metriky naznačujú pravdepodobnú potrebu modernizácie.' : 'Slabé signály modernizácie — potrebný ďalší prieskum.',
        confidence:      modDetected.length > 2 ? 'HIGH' : high ? 'MEDIUM' : 'LOW',
      },
      investmentProfile: {
        type:            high ? 'aktívne hľadá riešenie' : 'konzervatívny prístup',
        label:           high ? 'Hľadá riešenie' : 'Konzervatívny',
        interpretation:  high ? 'Podľa signálov firma môže aktívne hľadať spôsoby optimalizácie nákladov.' : 'Firma môže byť otvorená riešeniu, ak sa preukáže jasný ROI.',
        confidence:      'LOW',
      },
    },
  }
}

// ── Claude generation ──────────────────────────────────────────────────────────

async function runClaude(company) {
  const { name, segment, segmentLabel, city, country, fitScore, painPoints, aiReasoning, reviewSummary, liveSignals, heatPressure, thermalDependency, operatingCostPressure, modernizationNeed, boilerDependencyProb, willingnessToSolve, reviewsSource } = company

  const hasLive  = reviewsSource === 'serpapi'
  const painStr  = (painPoints || []).slice(0, 5).join('; ') || 'nedostupné'
  const sigStr   = (liveSignals || []).slice(0, 8).join(', ') || 'žiadne'
  const metricStr = `Teplotný tlak: ${heatPressure ?? 'N/A'}, Závislosť od tepla: ${thermalDependency ?? 'N/A'}, Prevádzkové náklady: ${operatingCostPressure ?? 'N/A'}, Modernizácia: ${modernizationNeed ?? 'N/A'}, Kotol: ${boilerDependencyProb ?? 'N/A'}, Ochota riešiť: ${willingnessToSolve ?? 'N/A'}`

  const prompt = `Si STRIKER B2B obchodný analytik. Vytvor inteligentný obchodný profil klienta pre STRIKER heating technology.
STRIKER: 45kW→120-160kW teplo, cena 8000-10000 EUR, ROI 6-36 mesiacov.

FIRMA: ${name} | SEGMENT: ${segmentLabel || segment} | LOKALITA: ${city}, ${country || 'DE'} | FIT: ${fitScore}/100
PAIN POINTS: ${painStr}
AI METRIKY (0-100): ${metricStr}
RECENZIE: ${hasLive ? (reviewSummary || 'dostupné') : 'nedostupné'}
LIVE SIGNÁLY: ${hasLive ? sigStr : 'žiadne (AI odhad)'}
AI KONTEXT: ${aiReasoning ? aiReasoning.slice(0, 200) : 'nedostupný'}

POKYNY:
- Píš po slovensky, konkrétne a stručne
- Keď niečo odhaduješ bez dát, označ: "AI odhad:" alebo "(odhadované)"
- Netvrd fakty, ktoré nemáš potvrdené
- Buď obchodne praktický, nie akademický

Vráť VÝLUČNE valid JSON:
{
  "clientProfile": "2-3 vety čo firmu trápi, prečo je zaujímavá pre STRIKER, čo môže rozhodovať pri kúpe",
  "businessPressure": {
    "main": "1-2 vety hlavný obchodný tlak",
    "items": ["tlak 1 — max 8 slov", "tlak 2", "tlak 3"]
  },
  "technicalProfile": {
    "buildingAge": "odhad veku budovy/prevádzky",
    "heatingType": "pravdepodobný typ kúrenia",
    "hotWaterDemand": "nízka|stredná|vysoká|veľmi vysoká — 1 veta prečo",
    "modernizationLikelihood": "nízka|stredná|vysoká",
    "details": ["detail 1 — max 10 slov", "detail 2"]
  },
  "internetSignals": {
    "summary": "${hasLive ? '1-2 vety z recenzií' : null}",
    "items": ${hasLive ? '["signál 1", "signál 2"]' : '[]'},
    "sourceNote": "${hasLive ? 'Live dáta z Google recenzií' : 'AI odhad — live dáta nedostupné'}"
  },
  "decisionProfile": {
    "likelyDecisionMaker": "kto pravdepodobne rozhoduje — max 5 slov",
    "roles": ["rola 1", "rola 2", "rola 3"],
    "process": "1 veta o rozhodovacím procese"
  },
  "salesStrategy": {
    "tone": "odporúčaný tón — max 6 slov",
    "emphasize": ["zdôrazniť 1 — max 8 slov", "zdôrazniť 2", "zdôrazniť 3"],
    "avoid": ["nespomínať 1 — max 8 slov", "nespomínať 2"],
    "startWith": "email alebo telefonát",
    "nextStep": "konkrétny ďalší krok — max 12 slov"
  },
  "risks": ["riziko 1 — max 10 slov", "riziko 2", "riziko 3"],
  "intelligence": {
    "buildingAge": {
      "estimate": "staršia/stredná/moderná budova",
      "approximateAge": "X–Y rokov alebo 'neznámy'",
      "confidence": "LOW|MEDIUM|HIGH",
      "reasoning": "1 veta prečo — začni 'pravdepodobne' alebo 'podľa signálov'"
    },
    "technologyState": {
      "heatingType": "typ vykurovania — max 6 slov",
      "estimatedAge": "vek technológie — napr. '10–20 rokov'",
      "status": "zastarané|stredný vek|moderné|neznáme",
      "hotWater": "nízka|stredná|vysoká|veľmi vysoká závislosť",
      "wellness": "áno|nie|možné",
      "confidence": "LOW|MEDIUM|HIGH",
      "reasoning": "1 veta — začni 'pravdepodobne' alebo 'môže naznačovať'"
    },
    "modernizationSignals": {
      "detected": ["signál z reviews/webu 1", "signál 2"],
      "interpretation": "1-2 vety čo signály naznačujú",
      "confidence": "LOW|MEDIUM|HIGH"
    },
    "investmentProfile": {
      "type": "aktívne investuje|modernizuje|stagnuje|cost-saving mode|neznáme",
      "label": "krátky label max 3 slová",
      "interpretation": "1-2 vety o investičnom správaní firmy",
      "confidence": "LOW|MEDIUM|HIGH"
    }
  }
}`

  const fetchP   = fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 2200, messages: [{ role: 'user', content: prompt }] }),
  })
  const timeoutP = new Promise((_, rej) => setTimeout(() => rej(new Error('Claude timeout 15s')), 15000))

  const res  = await Promise.race([fetchP, timeoutP])
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || `Claude ${res.status}`)

  const raw    = (data.content?.[0]?.text || '').trim().replace(/^```json\s*/i,'').replace(/```\s*$/i,'').trim()
  const parsed = JSON.parse(raw)

  const required = ['clientProfile', 'businessPressure', 'technicalProfile', 'decisionProfile', 'salesStrategy', 'risks']
  for (const f of required) if (!parsed[f]) throw new Error(`missing field: ${f}`)
  return parsed
}

// ── Handler ────────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  let body
  try { body = JSON.parse(event.body || '{}') }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  if (!body.name) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'name required' }) }

  const t0 = Date.now()
  console.log(`[client-card] START "${body.name}" seg=${body.segment} fit=${body.fitScore}`)

  let result, usedFallback = false

  if (CLAUDE_KEY) {
    try {
      result = await runClaude(body)
      console.log(`[client-card] Claude OK ${Date.now()-t0}ms`)
    } catch (e) {
      console.warn(`[client-card] Claude failed (${e.message}) — fallback`)
      result       = buildFallback(body.name, body.segment, body.segmentLabel, body.fitScore || 50, body.liveSignals)
      usedFallback = true
    }
  } else {
    result       = buildFallback(body.name, body.segment, body.segmentLabel, body.fitScore || 50)
    usedFallback = true
  }

  console.log(`[client-card] DONE ${Date.now()-t0}ms fallback=${usedFallback}`)
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, usedFallback, ...result }) }
}

const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY
const CLAUDE_MODEL = 'claude-sonnet-4-6'

// ── Language config (mirrors /src/locales/) ────────────────────────────────────

const LANG = {
  sk: {
    promptLang: `Write reasoning, painPoints, mainArgument, opportunity in Slovak (Slovenčina).
Email subject and draft body MUST be in German (Deutsch) — sent to a German company.`,
  },
  de: {
    promptLang: 'Write ALL fields in German (Deutsch), including subject and email draft.',
  },
  en: {
    promptLang: 'Write ALL fields in English, including subject and email draft.',
  },
}

function getLang(code) {
  return LANG[code] || LANG.sk
}

// ── Fallback — segment-based, SK + DE variants ────────────────────────────────

const FALLBACKS = {
  laundry: {
    score: 82,
    sk: {
      subject:      'Zníženie nákladov na teplo vo vašej práčovni – STRIKER technológia',
      painPoints:   ['Veľmi vysoká spotreba tepla a pary nepretržite', 'Energetické náklady tvoria 30–40 % prevádzkových nákladov', 'Závislosť od drahého plynového alebo olejového kotla'],
      reasoning:    'Priemyselné práčovne majú nepretržitú potrebu tepla. STRIKER môže ušetriť až 70 % nákladov na teplo — návratnosť typicky pod 12 mesiacov.',
      mainArgument: '45 kW elektrina → 120–160 kW teplo: práčovne ušetria priemerne 25 000–40 000 EUR ročne.',
      opportunity:  'Okamžitý vstup do rozhovoru o energetických nákladoch a amortizácii pod 12 mesiacov.',
    },
    de: {
      subject:      'Senkung Ihrer Heizkosten in der Wäscherei – STRIKER Technologie',
      painPoints:   ['Sehr hoher Wärme- und Dampfbedarf rund um die Uhr', 'Energiekosten machen 30–40 % der Betriebskosten aus', 'Abhängigkeit von teurem Gas- oder Ölkessel'],
      reasoning:    'Industriewäschereien haben kontinuierlichen Wärmebedarf. STRIKER kann bis zu 70 % der Wärmekosten einsparen — ROI typisch unter 12 Monaten.',
      mainArgument: '45 kW Strom → 120–160 kW Wärme: Wäschereien sparen im Schnitt 25.000–40.000 EUR jährlich.',
      opportunity:  'Sofortiger Gesprächseinstieg über Energiekosten und Amortisation unter 12 Monaten.',
    },
    en: {
      subject:      'Reducing Your Laundry Heating Costs – STRIKER Technology',
      painPoints:   ['Very high continuous heat and steam demand', 'Energy costs account for 30–40% of operating expenses', 'Dependency on expensive gas or oil boilers'],
      reasoning:    'Industrial laundries have continuous heat demand. STRIKER can save up to 70% of heating costs — ROI typically under 12 months.',
      mainArgument: '45 kW electricity → 120–160 kW heat: laundries save on average 25,000–40,000 EUR annually.',
      opportunity:  'Immediate conversation opener about energy costs and sub-12-month payback.',
    },
    drafts: {
      de: `Sehr geehrte Damen und Herren,\n\nmein Name ist Adolf Staubert. Ich entwickle STRIKER — eine patentierte Wärmetechnologie für energieintensive Betriebe wie Industriewäschereien.\n\nBei 45 kW Stromverbrauch erzeugt STRIKER 120–160 kW Wärme. Das bedeutet für Ihren Betrieb eine Einsparung von typischerweise 60–70 % der Heizkosten — bei einem Preis ab 8.000 EUR und einer Amortisation unter 12 Monaten.\n\nDarf ich kurz Ihren Energieverbrauch mit Ihnen durchgehen?\n\nMit freundlichen Grüßen\nAdolf Staubert\nSTRIKER Wärmetechnologie\n+49 171 4758126 · info@striker-energy.de`,
      sk: `Vážená pani / Vážený pán,\n\nvolám sa Adolf Staubert a vyvíjam technológiu STRIKER — patentovaný systém výroby tepla pre energeticky náročné prevádzky ako priemyselné práčovne.\n\nPri 45 kW príkonu elektrickej energie STRIKER produkuje 120–160 kW tepla. Pre vašu práčovňu to znamená úsporu 60–70 % nákladov na teplo — cena od 8 000 EUR, návratnosť pod 12 mesiacov.\n\nSmiem sa s vami krátko porozprávať o vašej spotrebe energie?\n\nS pozdravom\nAdolf Staubert\nSTRIKER Wärmetechnologie\n+49 171 4758126 · info@striker-energy.de`,
      en: `Dear Sir or Madam,\n\nMy name is Adolf Staubert and I develop STRIKER — a patented heat generation technology for energy-intensive operations like industrial laundries.\n\nAt 45 kW electrical input, STRIKER produces 120–160 kW of heat. For your laundry, this means savings of 60–70% on heating costs — priced from 8,000 EUR with payback under 12 months.\n\nMay I briefly discuss your energy consumption with you?\n\nKind regards,\nAdolf Staubert\nSTRIKER Wärmetechnologie\n+49 171 4758126 · info@striker-energy.de`,
    },
  },

  hotel: {
    score: 70,
    sk: {
      subject:      'Zníženie nákladov na vykurovanie vo vašom hoteli – STRIKER',
      painPoints:   ['Vysoká spotreba teplej vody (izby, reštaurácia, kuchyňa)', 'Rastúce náklady na vykurovanie zaťažujú hospodársky výsledok', 'Zastaraná vykurovacia technika s nízkym výkonom'],
      reasoning:    'Hotel má typicky vysokú potrebu tepla. STRIKER znižuje náklady na vykurovanie až o 70 % — ideálne pre teplú vodu a vykurovanie priestorov.',
      mainArgument: 'Hotely ušetria s STRIKER 10 000–20 000 EUR ročne na nákladoch na vykurovanie.',
      opportunity:  'Prvý kontakt cez optimalizáciu energie a výpočet návratnosti pod 18 mesiacov.',
    },
    de: {
      subject:      'Reduzierung Ihrer Heizkosten im Hotel – STRIKER Wärmetechnologie',
      painPoints:   ['Hoher Warmwasserverbrauch (Zimmer, Restaurant, Küche)', 'Steigende Heizkosten belasten das Betriebsergebnis', 'Veraltete Heizanlage mit niedrigem Wirkungsgrad'],
      reasoning:    'Das Hotel hat typisch hohen Wärmebedarf. STRIKER senkt Heizkosten um bis zu 70 % — ideal für Warmwasser und Raumheizung.',
      mainArgument: 'Hotels sparen mit STRIKER 10.000–20.000 EUR jährlich bei Heizkosten.',
      opportunity:  'Erstkontakt über Energieoptimierung und ROI-Rechnung unter 18 Monaten.',
    },
    en: {
      subject:      'Reducing Your Hotel Heating Costs – STRIKER Technology',
      painPoints:   ['High hot water consumption (rooms, restaurant, kitchen)', 'Rising heating costs strain operating results', 'Outdated heating system with low efficiency'],
      reasoning:    'Hotels typically have high heat demand. STRIKER reduces heating costs by up to 70% — ideal for hot water and space heating.',
      mainArgument: 'Hotels save 10,000–20,000 EUR annually on heating costs with STRIKER.',
      opportunity:  'First contact through energy optimization and ROI calculation under 18 months.',
    },
    drafts: {
      de: `Sehr geehrte Damen und Herren,\n\nmein Name ist Adolf Staubert. Ich stelle Ihnen STRIKER vor — eine patentierte Heiztechnologie speziell für Hotels.\n\nBei 45 kW elektrischer Leistung liefert STRIKER 120–160 kW Wärme. Das bedeutet bis zu 70 % niedrigere Heizkosten — typisch 10.000–20.000 EUR Ersparnis jährlich.\n\nPreis ab 8.000 EUR, Lieferzeit 6–8 Wochen.\n\nDarf ich Ihnen kurz ein konkretes Beispiel für Ihr Haus vorstellen?\n\nMit freundlichen Grüßen\nAdolf Staubert\nSTRIKER Wärmetechnologie\n+49 171 4758126 · info@striker-energy.de`,
      sk: `Vážená pani / Vážený pán,\n\nvolám sa Adolf Staubert a vyvíjam technológiu STRIKER — patentovaný systém výroby tepla pre hotely.\n\nPri 45 kW elektrickej energie STRIKER produkuje 120–160 kW tepla. Pre váš hotel to znamená úsporu až 70 % nákladov na vykurovanie — typicky 10 000–20 000 EUR ročne.\n\nCena od 8 000 EUR, dodacia lehota 6–8 týždňov.\n\nSmiem vám krátko predstaviť konkrétny príklad pre vaše zariadenie?\n\nS pozdravom\nAdolf Staubert\nSTRIKER Wärmetechnologie\n+49 171 4758126 · info@striker-energy.de`,
      en: `Dear Sir or Madam,\n\nMy name is Adolf Staubert and I present to you STRIKER — a patented heat technology designed for hotels.\n\nAt 45 kW electrical input, STRIKER delivers 120–160 kW of heat. For your hotel, this means up to 70% lower heating costs — typically 10,000–20,000 EUR savings annually.\n\nPrice from 8,000 EUR, delivery 6–8 weeks.\n\nMay I briefly show you a concrete example for your property?\n\nKind regards,\nAdolf Staubert\nSTRIKER Wärmetechnologie\n+49 171 4758126 · info@striker-energy.de`,
    },
  },

  generic: {
    score: 60,
    sk: {
      subject:      'Zníženie nákladov na teplo – STRIKER Wärmetechnologie',
      painPoints:   ['Rastúce energetické náklady zaťažujú prevádzku', 'Vysoká spotreba tepla pre výrobu alebo prevádzku', 'Potenciál úspory energie nie je využitý'],
      reasoning:    'Firma má potenciál pre STRIKER technológiu pri výrobe tepla.',
      mainArgument: 'STRIKER: 45 kW → 120 kW teplo, úspora až 70 %, návratnosť 6–36 mesiacov.',
      opportunity:  'Prvý rozhovor o energetických nákladoch a potenciáli úspory.',
    },
    de: {
      subject:      'Reduzierung Ihrer Heizkosten – STRIKER Wärmetechnologie',
      painPoints:   ['Steigende Energiekosten belasten den Betrieb', 'Hoher Wärmebedarf für Produktion oder Betrieb', 'Einsparpotenzial bei Energie nicht ausgeschöpft'],
      reasoning:    'Das Unternehmen hat Potenzial für STRIKER-Technologie bei der Wärmeerzeugung.',
      mainArgument: 'STRIKER: 45 kW → 120 kW Wärme, Einsparung bis 70 %, ROI 6–36 Monate.',
      opportunity:  'Erstgespräch über Energiekosten und Einsparpotenzial.',
    },
    en: {
      subject:      'Reducing Your Heating Costs – STRIKER Technology',
      painPoints:   ['Rising energy costs burden operations', 'High heat demand for production or operations', 'Energy saving potential not yet utilized'],
      reasoning:    'The company has potential for STRIKER technology in heat generation.',
      mainArgument: 'STRIKER: 45 kW → 120 kW heat, savings up to 70%, ROI 6–36 months.',
      opportunity:  'First conversation about energy costs and saving potential.',
    },
    drafts: {
      de: `Sehr geehrte Damen und Herren,\n\nmein Name ist Adolf Staubert. Ich entwickle STRIKER — eine Heiztechnologie mit bis zu 70 % Einsparung bei Wärmekosten.\n\nPreis ab 8.000 EUR. Darf ich kurz mit Ihnen sprechen?\n\nMit freundlichen Grüßen\nAdolf Staubert\n+49 171 4758126 · info@striker-energy.de`,
      sk: `Vážená pani / Vážený pán,\n\nvolám sa Adolf Staubert a vyvíjam technológiu STRIKER — s úsporou až 70 % nákladov na teplo.\n\nCena od 8 000 EUR. Môžeme sa krátko porozprávať?\n\nS pozdravom\nAdolf Staubert\n+49 171 4758126 · info@striker-energy.de`,
      en: `Dear Sir or Madam,\n\nMy name is Adolf Staubert and I develop STRIKER — heating technology with up to 70% savings on heat costs.\n\nPrice from 8,000 EUR. May we have a brief conversation?\n\nKind regards,\nAdolf Staubert\n+49 171 4758126 · info@striker-energy.de`,
    },
  },
}

function calcPriority(score) {
  if (score >= 86) return 'CRITICAL'
  if (score >= 66) return 'HIGH'
  if (score >= 41) return 'MEDIUM'
  return 'LOW'
}

const NBA_FALLBACKS = {
  laundry: {
    sk: { nextStep: 'Kontaktovať telefonicky do 48 hodín', tone: 'Priamy, technicky kompetentný', risk: 'Dlhý interný schvaľovací proces', opportunity: 'Práčovňa = kritická spotreba tepla 24/7', timing: 'Ihneď — energia je aktuálna priorita' },
    de: { nextStep: 'Telefonisch kontaktieren innerhalb 48h', tone: 'Direkt, technisch kompetent', risk: 'Langer interner Genehmigungsprozess', opportunity: 'Wäscherei = kritischer Wärmebedarf 24/7', timing: 'Sofort — Energie ist aktuell Priorität' },
    en: { nextStep: 'Call within 48 hours', tone: 'Direct, technically competent', risk: 'Long internal approval process', opportunity: 'Laundry = critical heat demand 24/7', timing: 'Now — energy is current priority' },
  },
  hotel: {
    sk: { nextStep: 'Poslať email, potom follow-up hovor', tone: 'Profesionálny, zdôrazniť ROI', risk: 'Sezónne výkyvy ovplyvnia rozhodovanie', opportunity: 'Hotelová prevádzka = stabilná potreba tepla', timing: 'Pred zimnou sezónou — nákupné okno' },
    de: { nextStep: 'E-Mail senden, dann Follow-up-Anruf', tone: 'Professionell, ROI betonen', risk: 'Saisonale Schwankungen beeinflussen Entscheidung', opportunity: 'Hotelbetrieb = stabiler Wärmebedarf', timing: 'Vor der Wintersaison — Einkaufsfenster' },
    en: { nextStep: 'Send email, then follow-up call', tone: 'Professional, emphasize ROI', risk: 'Seasonal fluctuations affect decisions', opportunity: 'Hotel operations = stable heat demand', timing: 'Before winter season — buying window' },
  },
  generic: {
    sk: { nextStep: 'Odoslať úvodný email s kalkuláciou', tone: 'Informačný, bez tlaku', risk: 'Nízka urgentnosť — pasívny záujem', opportunity: 'Energetická efektivita je rastúci trend', timing: 'Flexibilné — reagovať na spätnú väzbu' },
    de: { nextStep: 'Einführungs-E-Mail mit Kalkulation senden', tone: 'Informativ, ohne Druck', risk: 'Geringe Dringlichkeit — passives Interesse', opportunity: 'Energieeffizienz ist wachsender Trend', timing: 'Flexibel — auf Feedback reagieren' },
    en: { nextStep: 'Send introductory email with calculation', tone: 'Informative, no pressure', risk: 'Low urgency — passive interest', opportunity: 'Energy efficiency is a growing trend', timing: 'Flexible — respond to feedback' },
  },
}

function fallback(segment, segmentLabel, companyName, language = 'sk') {
  const seg = (segment || '').toLowerCase()
  const isL = seg.includes('waesch') || seg.includes('laund') || seg.includes('textil') || seg.includes('praco')
  const isH = seg.includes('hotel') || seg.includes('gastro') || seg.includes('resort')

  const base    = isL ? FALLBACKS.laundry : isH ? FALLBACKS.hotel : FALLBACKS.generic
  const nbaBase = isL ? NBA_FALLBACKS.laundry : isH ? NBA_FALLBACKS.hotel : NBA_FALLBACKS.generic
  const loc     = base[language] || base.de
  const nba     = nbaBase[language] || nbaBase.de
  const score   = base.score
  const priority = calcPriority(score)

  return {
    score,
    subject:      loc.subject,
    painPoints:   loc.painPoints,
    reasoning:    loc.reasoning,
    mainArgument: loc.mainArgument,
    opportunity:  loc.opportunity,
    draft:        base.drafts[language] || base.drafts.de,
    nextBestAction: {
      nextStep:    nba.nextStep,
      tone:        nba.tone,
      risk:        nba.risk,
      opportunity: nba.opportunity,
      timing:      nba.timing,
      priority,
    },
  }
}

// ── Claude analysis ───────────────────────────────────────────────────────────

async function runClaude(companyName, city, segment, segmentLabel, fitScore, language) {
  const { promptLang } = getLang(language)

  const prompt = `STRIKER AI sales analyst. Return ONLY valid JSON, no markdown, no text outside JSON.
STRIKER: 45kW electric → 120-160kW heat, price 8000-10000 EUR, ROI 6-36 months.
Company: ${companyName} | Segment: ${segmentLabel || segment} | City: ${city} | Fit: ${fitScore}/100
${promptLang}
Return JSON with exactly these keys (no extras):
{"score":75,"subject":"email subject","painPoints":["pain 1","pain 2","pain 3"],"reasoning":"2 sentences why STRIKER fit","mainArgument":"strongest argument","opportunity":"1 sentence opportunity","draft":"email 80-120 words","nextBestAction":{"nextStep":"specific action in 6-10 words","tone":"recommended tone 5-8 words","risk":"main risk 5-8 words","opportunity":"main opportunity 5-8 words","timing":"when to contact 5-8 words","priority":"HIGH"}}`

  const fetchP = fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 950,
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
  if (!parsed.score || !parsed.painPoints || !parsed.draft) throw new Error('Claude: missing required fields')
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

  const {
    companyName,
    city        = '',
    segment     = '',
    segmentLabel= '',
    fitScore    = 50,
    language    = 'sk',
  } = body

  if (!companyName) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'companyName required' }) }

  const lang = (language === 'de') ? 'de' : 'sk'
  console.log(`[ai-analysis] START "${companyName}" seg=${segment} city=${city} fit=${fitScore} lang=${lang}`)
  const t0 = Date.now()

  let result, usedFallback = false

  if (CLAUDE_KEY) {
    try {
      result = await runClaude(companyName, city, segment, segmentLabel, fitScore, lang)
      console.log(`[ai-analysis] Claude OK ${Date.now()-t0}ms score=${result.score}`)
    } catch (e) {
      console.warn(`[ai-analysis] Claude failed (${e.message}) — using fallback lang=${lang}`)
      result = fallback(segment, segmentLabel, companyName, lang)
      usedFallback = true
    }
  } else {
    console.warn('[ai-analysis] ANTHROPIC_API_KEY missing — using fallback')
    result = fallback(segment, segmentLabel, companyName, lang)
    usedFallback = true
  }

  console.log(`[ai-analysis] DONE ${Date.now()-t0}ms usedFallback=${usedFallback} lang=${lang}`)

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ ok: true, usedFallback, language: lang, ...result }),
  }
}

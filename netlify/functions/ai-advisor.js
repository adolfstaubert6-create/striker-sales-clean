const SYSTEM_PROMPT = `Si STRIKER AI Sales Advisor. Tvoja úloha je analyzovať konkrétnu firmu pre predaj kavitačnej kúriacej technológie STRIKER. 45kW elektrickej energie → 120-160kW tepelného výkonu. Cena: 8000-10000 EUR. Dodacia lehota: 6-8 týždňov. BAFA dotácia možná. Cieľoví klienti: hotely, práčovne, wellness centrá, nemocnice s vysokou spotrebou teplej vody. Si obchodný analytik, sales stratég a technický konzultant v jednom. PRAVIDLO: AI iba navrhuje, človek schvaľuje. Nikdy neodosielaj emaily ani nerob kritické rozhodnutia sám. Odpovedaj vždy v slovenčine, stručne, konkrétne, strategicky. Každá strategická odpoveď musí mať: 1.Verdikt 2.Prečo 3.Obchodný potenciál 4.Riziká 5.Čo chýba 6.Najlepší ďalší krok 7.Odporúčaná akcia 8.Istota (vysoká/stredná/nízka + dôvod)

STATUS SUGGESTION: Ak je zmena statusu jasne odôvodnená, pripoj na KONIEC odpovede (nič za tým):
<SUGGEST_STATUS:new> alebo <SUGGEST_STATUS:contacted> alebo <SUGGEST_STATUS:offer> alebo <SUGGEST_STATUS:closed> alebo <SUGGEST_STATUS:rejected>
Pripoj len ak je skutočne opodstatnené.

OBMEDZENIA: Ak používateľ žiada zakázanú akciu (odoslanie emailu, zmena údajov, mazanie): "Môžem pripraviť návrh, ale túto akciu musíš schváliť ty. [NÁVRH AKCIE: <popis>]"`

const EMAIL_DRAFT_RE  = /vytvor.*email|email.*draft|prvý.*kontakt|generuj.*email|napíš.*email/i
const TRANSLATE_RE    = /prelož|preložiť|translate/i

const DRAFT_BLOCK = `

RESPOND ONLY IN SLOVAK LANGUAGE. DO NOT USE GERMAN. The email will be translated later.
Write a professional first-contact email in Slovak for the company above. Use the STRIKER knowledge base. Max 150 words. Clear next step at the end.
Format EXACTLY (nothing before this):
PREDMET: <Slovak subject>

<Slovak email body>`

const TRANSLATE_BLOCK = `

Translate to professional German B2B email. Sie-form. Max 150 words. NO meta-text, NO [AKTION], NO markdown bold (**), NO internal notes, NO questions to user. Only clean email text.
Format EXACTLY (nothing before this):
BETREFF: <German subject>

<German email body>`

exports.handler = async (event) => {
  const apiKey = process.env.ANTHROPIC_API_KEY
  console.log('[ai-advisor] start | apiKey set:', !!apiKey, '| method:', event.httpMethod)

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  if (!apiKey) {
    console.error('[ai-advisor] ANTHROPIC_API_KEY is not set')
    return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY nie je nastavený v Netlify env vars' }) }
  }

  let body
  try {
    body = JSON.parse(event.body)
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  const { messages: rawMessages, companyContext, knowledgeBase } = body
  if (!rawMessages?.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'messages required' }) }
  }

  const messages = rawMessages.map(({ role, content }) => ({ role, content }))

  const contextBlock = companyContext
    ? `\n\nFIRMA: ${companyContext.name} | ${companyContext.category} | ${companyContext.city} | BPS: ${companyContext.aiScore ?? '–'} | Status: ${companyContext.status}\nEmail: ${companyContext.email || '–'} | Tel: ${companyContext.phone || '–'} | Rating: ${companyContext.rating ?? '–'}\nAI dôvod: ${companyContext.aiReason || '–'}\nBPS faktory: ${(companyContext.aiReasoning || []).slice(0, 5).join(' | ') || '–'}\nPosledné udalosti: ${(companyContext.recentTimeline || []).slice(0, 5).join(' | ')}`
    : ''

  const kbBlock = knowledgeBase?.length
    ? `\n\nSTRIKER KNOWLEDGE BASE:\n${knowledgeBase.map(e => `[${(e.category || '').toUpperCase()}] ${e.title}: ${e.content}`).join('\n\n')}`
    : ''

  const lastUserMsg  = [...messages].reverse().find(m => m.role === 'user')?.content || ''
  const isTranslation = TRANSLATE_RE.test(lastUserMsg)
  const isNewDraft    = !isTranslation && (EMAIL_DRAFT_RE.test(lastUserMsg) || !!knowledgeBase?.length)
  const emailBlock    = isTranslation ? TRANSLATE_BLOCK : isNewDraft ? DRAFT_BLOCK : ''

  try {
    console.log('[ai-advisor] calling Anthropic | company:', companyContext?.name, '| messages:', messages.length, '| mode:', isTranslation ? 'translate' : isNewDraft ? 'draft' : 'chat', '| kb:', knowledgeBase?.length ?? 0)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        system:     SYSTEM_PROMPT + contextBlock + kbBlock + emailBlock,
        messages,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[ai-advisor] API error:', response.status, JSON.stringify(data))
      return { statusCode: 500, body: JSON.stringify({ error: data?.error?.message || `API error ${response.status}` }) }
    }

    const text = data.content?.[0]?.text || ''
    console.log('[ai-advisor] success | chars:', text.length)
    return { statusCode: 200, body: JSON.stringify({ text }) }

  } catch (err) {
    console.error('[ai-advisor] fetch error:', err.message)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}

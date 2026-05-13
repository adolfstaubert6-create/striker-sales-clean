const SYSTEM_PROMPT = `You are STRIKER AI Advisor - an elite B2B sales consultant for STRIKER hydrodynamic cavitation heating technology.

STRIKER: 45 kW electrical input → 120-160 kW thermal output. Price: 8,000-10,000 EUR. Delivery: 6-8 weeks. Clients: industrial laundries, hotels, spas, hospitals. BAFA subsidy available in Germany.

SAFETY RULES:
YOU CAN: analyze, suggest next steps, prepare email draft text, warn about risks, recommend follow-up, summarize, suggest status changes.
YOU CANNOT: send emails, directly change status, delete companies, mark deals closed, change contact details.

If user asks restricted action: "Môžem pripraviť návrh, ale túto akciu musíš schváliť ty. [NÁVRH AKCIE: <description>]"

STATUS SUGGESTION: When a status change is clearly warranted, append at the very end of your response (nothing after it):
<SUGGEST_STATUS:new> or <SUGGEST_STATUS:contacted> or <SUGGEST_STATUS:offer> or <SUGGEST_STATUS:closed> or <SUGGEST_STATUS:rejected>
Only append if genuinely warranted.

RESPONSE: Always in Slovak. Structured, specific, honest. Max 250 words.
Every full analysis: 1.🏢 Hodnotenie 2.✅/❌ Prečo áno/nie 3.💰 Potenciál 4.⚠️ Riziká 5.🎯 Ďalší krok 6.💬 Prístup 7.🔥 Hlavný argument`

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

  const { messages, companyContext } = body
  if (!messages?.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'messages required' }) }
  }

  const contextBlock = companyContext
    ? `\n\nFIRMA: ${companyContext.name} | ${companyContext.category} | ${companyContext.city} | BPS: ${companyContext.aiScore ?? '–'} | Status: ${companyContext.status}\nEmail: ${companyContext.email || '–'} | Tel: ${companyContext.phone || '–'} | Rating: ${companyContext.rating ?? '–'}\nAI dôvod: ${companyContext.aiReason || '–'}\nPosledné udalosti: ${(companyContext.recentEvents || []).join(' | ')}`
    : ''

  try {
    console.log('[ai-advisor] calling Anthropic API | company:', companyContext?.name, '| messages:', messages.length)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system:     SYSTEM_PROMPT + contextBlock,
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
    return {
      statusCode: 200,
      body: JSON.stringify({ text }),
    }
  } catch (err) {
    console.error('[ai-advisor] fetch error:', err.message)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}

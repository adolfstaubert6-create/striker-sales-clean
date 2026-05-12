const Anthropic = require('@anthropic-ai/sdk')

const SYSTEM_PROMPT = `You are STRIKER AI Advisor - an elite B2B sales consultant and technical advisor for STRIKER hydrodynamic cavitation heating technology.

STRIKER specs: 45 kW electrical input → 120-160 kW thermal output. Price: 8,000-10,000 EUR. Delivery: 6-8 weeks. Target clients: industrial laundries, hotels, spas, hospitals, restaurants with high hot water/heating demand. BAFA subsidy available in Germany.

You have full context about the company. Always respond in Slovak language. Always be structured, specific, and honest. Never give generic answers. If a company is low priority, say so clearly.

Every response must cover:
1. 🏢 Hodnotenie firmy (2-3 vety)
2. ✅ Prečo áno / ❌ Prečo nie
3. 💰 Obchodný potenciál (ROI estimate)
4. ⚠️ Riziká
5. 🎯 Najlepší ďalší krok (concrete action)
6. 💬 Odporúčaný prístup (email alebo telefonát + why)
7. 🔥 Najsilnejší argument pre STRIKER

Be concise but powerful. Max 300 words total.`

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { messages, companyContext } = body
  if (!messages?.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'messages required' }) }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }) }
  }

  const contextBlock = companyContext
    ? `\n\nKONTEXT FIRMY:\n${JSON.stringify(companyContext, null, 2)}`
    : ''

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system:     SYSTEM_PROMPT + contextBlock,
      messages,
    })

    const text = response.content[0]?.text || ''
    console.log(`[ai-advisor] ${companyContext?.name} — ${text.slice(0, 80)}...`)
    return {
      statusCode: 200,
      body: JSON.stringify({ text }),
    }
  } catch (err) {
    console.error('[ai-advisor] Error:', err.message)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}

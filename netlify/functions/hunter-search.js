// POST /.netlify/functions/hunter-search
// Body: { domain: string, apiKey: string }
// Proxies Hunter.io domain-search to avoid CORS

const https = require('https')

exports.handler = async (event) => {
  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const { domain, apiKey } = body
  if (!domain || !apiKey) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'domain and apiKey required' }) }

  console.log('[hunter-search] domain:', domain)

  try {
    const result = await new Promise((resolve, reject) => {
      const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${encodeURIComponent(apiKey)}`
      const req = https.request(url, { method: 'GET' }, res => {
        let data = ''
        res.on('data', c => data += c)
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
          catch { reject(new Error('Invalid JSON from Hunter.io')) }
        })
      })
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('Hunter.io timeout')) })
      req.on('error', reject)
      req.end()
    })

    console.log('[hunter-search] status:', result.status, 'emails:', result.body?.data?.emails?.length)

    if (result.status === 401) return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: 'Neplatný Hunter.io API key' }) }
    if (result.status === 429) return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: 'Hunter.io limit vyčerpaný' }) }
    if (result.status !== 200) return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: `Hunter.io chyba: ${result.status}` }) }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ data: result.body.data, ok: true }) }
  } catch (e) {
    console.error('[hunter-search] error:', e.message)
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: e.message }) }
  }
}

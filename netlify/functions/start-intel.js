// Sync entry point — returns 200 immediately, triggers background function
// Background function writes results directly to intelligence_targets/{targetId}

exports.handler = async (event) => {
  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  let body
  try { body = JSON.parse(event.body || '{}') }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const { targetId, companyName } = body
  if (!targetId || !companyName) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'targetId and companyName required' }) }
  }

  const siteUrl = process.env.URL
  console.log(`[start-intel] queuing targetId=${targetId} name="${companyName}"`)

  if (siteUrl) {
    fetch(`${siteUrl}/.netlify/functions/intelligence-gather-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: event.body, // pass through full payload unchanged
    }).catch(err => console.error('[start-intel] bg trigger failed:', err.message))
  } else {
    console.warn('[start-intel] process.env.URL not set — background not triggered')
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ ok: true, queued: true, targetId }),
  }
}

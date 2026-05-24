exports.handler = async (event) => {
  const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) }

  const KEY = process.env.SERPAPI_API_KEY
  if (!KEY) {
    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({ success: false, error: 'SERPAPI_API_KEY nie je nastavený.' }),
    }
  }

  let body
  try { body = JSON.parse(event.body || '{}') }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const { query } = body
  if (!query) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'query required' }) }

  const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${KEY}&hl=de&gl=de&num=10`

  try {
    const ctrl = new AbortController()
    const to   = setTimeout(() => ctrl.abort(), 8000)
    const res  = await fetch(url, { signal: ctrl.signal })
    clearTimeout(to)

    if (!res.ok) {
      const text = await res.text()
      return {
        statusCode: 200, headers: CORS,
        body: JSON.stringify({ success: false, provider: 'SerpAPI', query, error: `HTTP ${res.status}: ${text.slice(0, 200)}` }),
      }
    }

    const data    = await res.json()
    const organic = data.organic_results || []
    const top5    = organic.slice(0, 5).map(r => ({
      title:   r.title   || null,
      link:    r.link    || null,
      snippet: r.snippet || null,
    }))

    console.log(`[serpapi-search-test] query="${query}" results=${organic.length}`)

    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({
        success:  true,
        provider: 'SerpAPI',
        query,
        resultsCount: organic.length,
        results: top5,
      }),
    }
  } catch (e) {
    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({ success: false, provider: 'SerpAPI', query, error: e.message }),
    }
  }
}

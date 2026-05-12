const CATEGORY_QUERIES = {
  hotel:      'hotels',
  laundry:    'laundry service',
  restaurant: 'restaurants',
  hospital:   'hospital',
  spa:        'wellness spa',
}

const COUNTRY_NAMES = { DE: 'Germany', AT: 'Austria', CH: 'Switzerland' }

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.nationalPhoneNumber',
  'places.websiteUri',
].join(',')

exports.handler = async (event) => {
  if (event.httpMethod === 'GET') {
    return { statusCode: 200, body: JSON.stringify({ ok: true, fn: 'search-places', api: 'Places API New' }) }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { city, category, radius = 15, limit = 10, country = 'DE', aiCriteria = 'no_filter' } = body

  if (!city || !category) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Chýba city alebo category' }) }
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GOOGLE_PLACES_API_KEY nie je nastavený v Netlify env vars' }) }
  }

  const maxRes      = Math.min(Math.max(parseInt(limit), 1), 20)
  const countryName = COUNTRY_NAMES[country] || 'Germany'
  const query       = `${CATEGORY_QUERIES[category] || category} in ${city}, ${countryName}`

  console.log(`[search-places] Query: "${query}", limit=${maxRes}`)

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'X-Goog-Api-Key':  apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery:       query,
        maxResultCount:  maxRes,
        languageCode:    'de',
      }),
    })

    const data = await res.json()

    if (!res.ok || data.error) {
      const msg = data.error?.message || `HTTP ${res.status}`
      console.error('[search-places] API error:', msg)
      return { statusCode: 500, body: JSON.stringify({ error: `Google Places: ${msg}` }) }
    }

    let results = (data.places || []).map(p => ({
      place_id: p.id,
      name:     p.displayName?.text || '',
      address:  p.formattedAddress  || '',
      city,
      country,
      rating:   typeof p.rating === 'number' ? p.rating : null,
      phone:    p.nationalPhoneNumber || '',
      website:  p.websiteUri
        ? p.websiteUri.replace(/^https?:\/\//, '').replace(/\/$/, '')
        : '',
    }))

    if (aiCriteria === 'high_rating') {
      results = results.filter(r => r.rating !== null && r.rating >= 4.0)
    }

    console.log(`[search-places] Returning ${results.length} results for "${query}"`)
    return { statusCode: 200, body: JSON.stringify({ results }) }

  } catch (err) {
    console.error('[search-places] Unexpected error:', err.message)
    return { statusCode: 500, body: JSON.stringify({ error: `Neočakávaná chyba: ${err.message}` }) }
  }
}

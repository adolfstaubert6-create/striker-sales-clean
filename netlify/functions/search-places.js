const GOOGLE_TYPE_MAP = {
  hotel:      'lodging',
  laundry:    'laundry',
  restaurant: 'restaurant',
  hospital:   'hospital',
  spa:        'spa',
}

const COUNTRY_NAMES = { DE: 'Germany', AT: 'Austria', CH: 'Switzerland' }

exports.handler = async (event) => {
  // GET — health check
  if (event.httpMethod === 'GET') {
    return { statusCode: 200, body: JSON.stringify({ ok: true, fn: 'search-places' }) }
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
    console.error('[search-places] GOOGLE_PLACES_API_KEY is not set in env vars')
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'GOOGLE_PLACES_API_KEY nie je nastavený v Netlify env vars' })
    }
  }

  const type        = GOOGLE_TYPE_MAP[category] || category
  const radiusM     = Math.min(Math.max(parseInt(radius) * 1000, 1000), 50000)
  const maxRes      = Math.min(Math.max(parseInt(limit), 1), 20)
  const countryName = COUNTRY_NAMES[country] || 'Germany'

  console.log(`[search-places] Request: city=${city}, type=${type}, radius=${radiusM}m, limit=${maxRes}, country=${country}`)

  try {
    // Step 1 — Geocode city
    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city + ', ' + countryName)}&key=${apiKey}`
    const geoRes  = await fetch(geoUrl)
    const geoData = await geoRes.json()

    console.log(`[search-places] Geocode status: ${geoData.status}`)

    if (geoData.status !== 'OK') {
      const msg = geoData.error_message || geoData.status
      console.error('[search-places] Geocode failed:', msg)
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Geocoding zlyhal: ${msg} — skontroluj či má API kľúč povolené Geocoding API` })
      }
    }

    const { lat, lng } = geoData.results[0].geometry.location
    console.log(`[search-places] Geocoded ${city} → lat=${lat}, lng=${lng}`)

    // Step 2 — Nearby search
    const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusM}&type=${type}&key=${apiKey}`
    const placesRes  = await fetch(placesUrl)
    const placesData = await placesRes.json()

    console.log(`[search-places] Places status: ${placesData.status}, count: ${placesData.results?.length ?? 0}`)

    if (placesData.status === 'REQUEST_DENIED') {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Google Places REQUEST_DENIED — ${placesData.error_message || 'skontroluj či má kľúč povolené Places API'}` })
      }
    }

    if (placesData.status !== 'OK' && placesData.status !== 'ZERO_RESULTS') {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Google Places: ${placesData.status} — ${placesData.error_message || ''}` })
      }
    }

    let results = (placesData.results || []).map(p => ({
      place_id: p.place_id,
      name:     p.name,
      address:  p.vicinity || '',
      city,
      country,
      rating:   typeof p.rating === 'number' ? p.rating : null,
      phone:    '',
      website:  '',
    }))

    if (aiCriteria === 'high_rating') {
      results = results.filter(r => r.rating !== null && r.rating >= 4.0)
    }

    results = results.slice(0, maxRes)
    console.log(`[search-places] Returning ${results.length} results`)
    return { statusCode: 200, body: JSON.stringify({ results }) }

  } catch (err) {
    console.error('[search-places] Unexpected error:', err.message)
    return { statusCode: 500, body: JSON.stringify({ error: `Neočakávaná chyba: ${err.message}` }) }
  }
}

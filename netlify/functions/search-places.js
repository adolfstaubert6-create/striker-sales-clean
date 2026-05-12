const GOOGLE_TYPE_MAP = {
  hotel:      'lodging',
  laundry:    'laundry',
  restaurant: 'restaurant',
  hospital:   'hospital',
  spa:        'spa',
}

const COUNTRY_NAMES = { DE: 'Germany', AT: 'Austria', CH: 'Switzerland' }

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { city, category, radius = 15, limit = 10, country = 'DE', aiCriteria = 'no_filter' } = body
  if (!city || !category) {
    return { statusCode: 400, body: JSON.stringify({ error: 'city and category required' }) }
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    console.warn('[search-places] GOOGLE_PLACES_API_KEY not set — returning empty')
    return { statusCode: 200, body: JSON.stringify({ results: [], warning: 'GOOGLE_PLACES_API_KEY not configured' }) }
  }

  try {
    const type      = GOOGLE_TYPE_MAP[category] || category
    const radiusM   = Math.min(Math.max(parseInt(radius) * 1000, 1000), 50000)
    const maxRes    = Math.min(Math.max(parseInt(limit), 1), 20)
    const countryName = COUNTRY_NAMES[country] || 'Germany'

    // Geocode
    const geoRes  = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city + ', ' + countryName)}&key=${apiKey}`)
    const geoData = await geoRes.json()
    if (geoData.status !== 'OK' || !geoData.results?.length) {
      console.warn('[search-places] Geocode status:', geoData.status)
      return { statusCode: 200, body: JSON.stringify({ results: [] }) }
    }
    const { lat, lng } = geoData.results[0].geometry.location

    // Nearby search
    const placesRes  = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusM}&type=${type}&key=${apiKey}`)
    const placesData = await placesRes.json()

    if (placesData.status !== 'OK' && placesData.status !== 'ZERO_RESULTS') {
      return { statusCode: 500, body: JSON.stringify({ error: `Google Places: ${placesData.status}` }) }
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

    // AI criteria filter (client hint — backend enforces)
    if (aiCriteria === 'high_rating') {
      results = results.filter(r => r.rating !== null && r.rating >= 4.0)
    }

    results = results.slice(0, maxRes)
    console.log(`[search-places] ${city}/${type} (${country}): ${results.length} results`)
    return { statusCode: 200, body: JSON.stringify({ results }) }

  } catch (err) {
    console.error('[search-places] Error:', err.message)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}

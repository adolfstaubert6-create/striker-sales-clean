const GOOGLE_TYPE_MAP = {
  hotel:      'lodging',
  laundry:    'laundry',
  restaurant: 'restaurant',
  hospital:   'hospital',
  spa:        'spa',
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { city, category, radius = 10, limit = 10 } = body
  if (!city || !category) {
    return { statusCode: 400, body: JSON.stringify({ error: 'city and category required' }) }
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GOOGLE_PLACES_API_KEY not set' }) }
  }

  try {
    const type = GOOGLE_TYPE_MAP[category] || category
    const radiusM = Math.min(Math.max(parseInt(radius) * 1000, 1000), 50000)
    const maxResults = Math.min(Math.max(parseInt(limit), 1), 20)

    // Geocode city
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city + ', Germany')}&key=${apiKey}`
    )
    const geoData = await geoRes.json()
    if (geoData.status !== 'OK' || !geoData.results?.length) {
      console.warn('[search-places] Geocode failed:', geoData.status)
      return { statusCode: 200, body: JSON.stringify({ results: [] }) }
    }
    const { lat, lng } = geoData.results[0].geometry.location

    // Nearby search
    const placesRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusM}&type=${type}&key=${apiKey}`
    )
    const placesData = await placesRes.json()

    if (placesData.status !== 'OK' && placesData.status !== 'ZERO_RESULTS') {
      console.error('[search-places] Places API error:', placesData.status, placesData.error_message)
      return { statusCode: 500, body: JSON.stringify({ error: `Google Places: ${placesData.status}` }) }
    }

    const results = (placesData.results || []).slice(0, maxResults).map(p => ({
      place_id:  p.place_id,
      name:      p.name,
      address:   p.vicinity || '',
      city,
      rating:    typeof p.rating === 'number' ? p.rating : null,
      phone:     '',
      website:   '',
    }))

    console.log(`[search-places] ${city}/${type}: ${results.length} results (limit ${maxResults})`)
    return { statusCode: 200, body: JSON.stringify({ results }) }

  } catch (err) {
    console.error('[search-places] Error:', err.message)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}

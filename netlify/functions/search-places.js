const CATEGORY_MAP = {
  hotel: 'hotel',
  laundry: 'laundry',
  restaurant: 'restaurant',
  hospital: 'hospital',
  spa: 'spa',
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { city, category, radius = 10 } = body
  if (!city || !category) {
    return { statusCode: 400, body: JSON.stringify({ error: 'city and category required' }) }
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GOOGLE_PLACES_API_KEY not set' }) }
  }

  try {
    const type = CATEGORY_MAP[category] || category
    const radiusM = Math.min(radius * 1000, 50000)

    // 1. Geocode city
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city + ', Germany')}&key=${apiKey}`
    )
    const geoData = await geoRes.json()
    if (!geoData.results?.length) {
      return { statusCode: 200, body: JSON.stringify({ results: [] }) }
    }
    const { lat, lng } = geoData.results[0].geometry.location

    // 2. Nearby search
    const placesRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusM}&type=${type}&key=${apiKey}`
    )
    const placesData = await placesRes.json()

    const results = (placesData.results || []).slice(0, 20).map(p => ({
      place_id: p.place_id,
      name: p.name,
      address: p.vicinity || '',
      city,
      rating: p.rating || null,
      phone: '',
      website: '',
    }))

    console.log(`[search-places] ${city} / ${type}: ${results.length} results`)
    return { statusCode: 200, body: JSON.stringify({ results }) }

  } catch (err) {
    console.error('[search-places] Error:', err.message)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}

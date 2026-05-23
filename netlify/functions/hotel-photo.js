const COUNTRY_NAMES = { DE: 'Germany', AT: 'Austria', CH: 'Switzerland' }

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 }

  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) }
  }

  const { name, city, country = 'DE' } = body
  if (!name) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'name required' }) }

  const KEY = process.env.GOOGLE_PLACES_API_KEY
  if (!KEY) return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'GOOGLE_PLACES_API_KEY not set' }) }

  const countryName = COUNTRY_NAMES[country] || country
  const query = [name, city, countryName].filter(Boolean).join(' ')

  try {
    // Step 1: Text search — request photos field
    const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type':     'application/json',
        'X-Goog-Api-Key':   KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.photos',
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
    })

    const searchData = await searchRes.json()
    if (!searchRes.ok || searchData.error) {
      const msg = searchData.error?.message || `HTTP ${searchRes.status}`
      console.error('[hotel-photo] search error:', msg)
      return { statusCode: 200, body: JSON.stringify({ ok: false, error: msg }) }
    }

    const place     = searchData.places?.[0]
    if (!place) return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'Place not found' }) }

    const photoName = place.photos?.[0]?.name
    if (!photoName) return { statusCode: 200, body: JSON.stringify({ ok: false, placeId: place.id, error: 'No photos' }) }

    // Step 2: Resolve photo to CDN URI
    const mediaUrl  = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=700&skipHttpRedirect=true&key=${KEY}`
    const mediaRes  = await fetch(mediaUrl)
    const mediaData = await mediaRes.json()

    const photoUrl  = mediaData.photoUri
    if (!photoUrl) return { statusCode: 200, body: JSON.stringify({ ok: false, placeId: place.id, error: 'No photoUri in response' }) }

    console.log(`[hotel-photo] OK: ${place.id} → ${photoUrl.slice(0, 60)}...`)
    return { statusCode: 200, body: JSON.stringify({ ok: true, photoUrl, placeId: place.id, photoName }) }

  } catch (e) {
    console.error('[hotel-photo]', e.message)
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: e.message }) }
  }
}

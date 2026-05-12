export async function searchPlaces({ city, category, radius, limit }) {
  const res = await fetch('/.netlify/functions/search-places', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ city, category, radius: parseInt(radius), limit: parseInt(limit) }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Chyba vyhľadávania')
  return data.results || []
}

export async function searchPlaces({ city, category, radius, limit, country, aiCriteria }) {
  const res = await fetch('/.netlify/functions/search-places', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city,
      category,
      radius:     parseInt(radius),
      limit:      parseInt(limit),
      country:    country    || 'DE',
      aiCriteria: aiCriteria || 'no_filter',
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Chyba vyhľadávania')
  if (data.warning) throw new Error(data.warning)
  return data.results || []
}

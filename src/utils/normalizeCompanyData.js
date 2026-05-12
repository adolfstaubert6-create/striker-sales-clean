export function normalizeCompanyData(raw, category, city, country = 'DE') {
  return {
    name:          (raw.name || '').trim(),
    category:      category || '',
    country:       country  || 'DE',
    city:          raw.city || city || '',
    address:       raw.address || raw.vicinity || '',
    website:       raw.website || '',
    email:         raw.email   || '',
    phone:         raw.phone   || '',
    googlePlaceId: raw.place_id || raw.googlePlaceId || '',
    rating:        typeof raw.rating === 'number' ? raw.rating : null,
    aiScore:       typeof raw.score  === 'number' ? raw.score  : null,
    aiReason:      raw.reason   || '',
    aiPositive:    raw.positive || [],
    aiRisks:       raw.risks    || [],
    aiNextStep:    raw.nextStep || '',
    status:        'new',
  }
}

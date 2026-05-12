export function normalizeCompanyData(raw, category, city) {
  return {
    name: (raw.name || '').trim(),
    category: category || '',
    country: 'DE',
    city: raw.city || city || '',
    address: raw.address || raw.vicinity || '',
    website: raw.website || '',
    email: raw.email || '',
    phone: raw.phone || '',
    googlePlaceId: raw.place_id || raw.googlePlaceId || '',
    rating: typeof raw.rating === 'number' ? raw.rating : null,
    aiScore: null,
    aiReason: '',
    aiFactors: null,
    status: 'new',
  }
}

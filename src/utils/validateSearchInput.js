export function validateSearchInput({ city, category, radius, limit }) {
  const errors = {}
  if (!city || city.trim().length < 2) errors.city = 'Zadaj mesto (min. 2 znaky).'
  if (!category) errors.category = 'Vyber kategóriu.'
  if (!radius || isNaN(radius) || radius < 1 || radius > 50) errors.radius = 'Polomer musí byť 1–50 km.'
  if (!limit || isNaN(limit) || limit < 1 || limit > 20) errors.limit = 'Limit musí byť 1–20.'
  return { valid: Object.keys(errors).length === 0, errors }
}

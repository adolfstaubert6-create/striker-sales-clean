export async function scoreCompany(company) {
  const res = await fetch('/.netlify/functions/ai-score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ company }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'AI Score chyba')
  return {
    score: data.score,
    reason: data.reason,
    factors: data.factors || null,
  }
}

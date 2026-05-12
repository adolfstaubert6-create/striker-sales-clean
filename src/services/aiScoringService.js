export async function scoreCompany(company) {
  const res = await fetch('/.netlify/functions/ai-score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ company }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'AI Score chyba')
  return {
    score:    data.score,
    reason:   data.reason   || '',
    positive: data.positive || [],
    risks:    data.risks    || [],
    nextStep: data.nextStep || '',
  }
}

export async function scoreAll(companies, onProgress) {
  const results = await Promise.all(
    companies.map(async (c, i) => {
      try {
        const scored = await scoreCompany(c)
        if (onProgress) onProgress(i + 1, companies.length)
        return { ...c, ...scored, aiScored: true }
      } catch {
        return { ...c, score: null, reason: '', positive: [], risks: [], nextStep: '', aiScored: false }
      }
    })
  )
  return results.sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
}

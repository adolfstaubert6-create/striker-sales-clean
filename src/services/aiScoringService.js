import { calculateBusinessScore } from '../utils/calculateBusinessScore.js'

export function scoreCompany(company) {
  return calculateBusinessScore(company)
}

export function scoreAll(companies) {
  return companies
    .map(c => ({ ...c, ...calculateBusinessScore(c) }))
    .sort((a, b) => b.score - a.score)
}

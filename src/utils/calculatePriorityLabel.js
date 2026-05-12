import { SCORE_THRESHOLDS } from '../constants/scoringCriteria.js'

export function calculatePriorityLabel(score) {
  if (score === null || score === undefined) return null
  if (score >= SCORE_THRESHOLDS.HIGH)   return { label: 'Vysoký', color: '#00cc88' }
  if (score >= SCORE_THRESHOLDS.MEDIUM) return { label: 'Stredný', color: '#ffaa00' }
  return { label: 'Nízky', color: '#ff3333' }
}

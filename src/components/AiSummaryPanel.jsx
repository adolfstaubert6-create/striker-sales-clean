import { useMemo } from 'react'
import { SCORE_THRESHOLDS } from '../constants/scoringCriteria.js'

export default function AiSummaryPanel({ companies }) {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const stats = useMemo(() => {
    const todayCompanies = companies.filter(c => {
      const ts = c.createdAt?.toDate?.() || (c.createdAt ? new Date(c.createdAt) : null)
      return ts && ts >= today
    })
    const highPotential = companies.filter(c =>
      c.aiScore !== null && c.aiScore !== undefined && c.aiScore >= SCORE_THRESHOLDS.HIGH
    )
    const contacted = companies.filter(c => c.status === 'contacted' || c.status === 'offer')
    const scored    = companies.filter(c => c.aiScore !== null && c.aiScore !== undefined)
    const avgScore  = scored.length
      ? Math.round(scored.reduce((a, c) => a + c.aiScore, 0) / scored.length)
      : null

    return {
      todayCount:    todayCompanies.length,
      highPotential: highPotential.length,
      contacted:     contacted.length,
      avgScore,
    }
  }, [companies, today])

  return (
    <div style={css.wrap}>
      <div style={css.header}>
        <span style={css.title}>✦ AI ANALÝZA DNES</span>
        <span style={css.sub}>{new Date().toLocaleDateString('sk-SK')}</span>
      </div>
      <div style={css.grid}>
        <Stat value={stats.todayCount}    label="Pridané dnes"     color="#ff5c00" />
        <Stat value={stats.highPotential} label="Vysoký potenciál" color="#00cc88" />
        <Stat value={stats.contacted}     label="Kontaktovaní"     color="#ffaa00" />
        <Stat value={stats.avgScore !== null ? `${stats.avgScore}` : '–'} label="Priem. AI score" color="#cc00ff" unit={stats.avgScore !== null ? '/100' : ''} />
      </div>
    </div>
  )
}

function Stat({ value, label, color, unit = '' }) {
  return (
    <div style={css.stat}>
      <div style={{ ...css.val, color }}>{value}<span style={css.unit}>{unit}</span></div>
      <div style={css.lbl}>{label}</div>
    </div>
  )
}

const css = {
  wrap: { background: '#111418', border: '1px solid #1e2530', borderLeft: '3px solid #ffaa00', borderRadius: 2, padding: '0.85rem 1rem', marginBottom: '1.25rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' },
  title: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.62rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#ffaa00' },
  sub: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.58rem', color: '#6b7280' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' },
  stat: { textAlign: 'center' },
  val: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 },
  unit: { fontSize: '0.6rem', marginLeft: 2 },
  lbl: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#6b7280', marginTop: '0.25rem' },
}

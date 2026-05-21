// Vizuálny klon AiSummaryPanel.jsx — rovnaké CSS, intelligence obsah
import { useMemo } from 'react'
import { scoreColor } from '../constants/intelMeta.js'

export default function IntelSummaryPanel({ targets }) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])

  const stats = useMemo(() => {
    const todayTargets = targets.filter(t => {
      const ts = t.createdAt?.toDate?.() || (t.createdAt ? new Date(t.createdAt) : null)
      return ts && ts >= today
    })
    const highUrgency  = targets.filter(t => (t.overallScore ?? 0) >= 70)
    const contacted    = targets.filter(t => t.status === 'contacted' || t.status === 'replied')
    const scored       = targets.filter(t => t.overallScore != null)
    const avgFit       = scored.length
      ? Math.round(scored.reduce((a, t) => a + t.overallScore, 0) / scored.length)
      : null
    return { todayCount: todayTargets.length, highUrgency: highUrgency.length, contacted: contacted.length, avgFit }
  }, [targets, today])

  return (
    <div style={css.wrap}>
      <div style={css.header}>
        <span style={css.title}>✦ INTELLIGENCE ANALÝZA DNES</span>
        <span style={css.sub}>{new Date().toLocaleDateString('sk-SK')}</span>
      </div>
      <div style={css.grid}>
        <Stat value={stats.todayCount}                                            label="Pridané dnes"      color="#ff5c00" />
        <Stat value={stats.highUrgency}                                           label="Vysoká urgentnosť" color="#00cc88" />
        <Stat value={stats.contacted}                                             label="Kontaktovaní"      color="#ffaa00" />
        <Stat value={stats.avgFit !== null ? `${stats.avgFit}` : '–'}            label="Priem. STRIKER FIT" color="#cc00ff" unit={stats.avgFit !== null ? '/100' : ''} />
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

// Identické CSS ako AiSummaryPanel
const css = {
  wrap:   { background: '#111418', border: '1px solid #1e2530', borderLeft: '3px solid #ffaa00', borderRadius: 2, padding: '0.85rem 1rem', marginBottom: '1.25rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' },
  title:  { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.62rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#ffaa00' },
  sub:    { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.58rem', color: '#6b7280' },
  grid:   { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' },
  stat:   { textAlign: 'center' },
  val:    { fontFamily: "'IBM Plex Mono',monospace", fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 },
  unit:   { fontSize: '0.6rem', marginLeft: 2 },
  lbl:    { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#6b7280', marginTop: '0.25rem' },
}

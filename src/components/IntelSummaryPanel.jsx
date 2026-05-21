import { useMemo } from 'react'

const mono = "'IBM Plex Mono', monospace"

export default function IntelSummaryPanel({ targets }) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])

  const stats = useMemo(() => {
    const todayNew     = targets.filter(t => {
      const ts = t.createdAt?.toDate?.() || (t.createdAt ? new Date(t.createdAt) : null)
      return ts && ts >= today
    })
    const highUrgency  = targets.filter(t => (t.overallScore ?? 0) >= 70)
    const realPressure = targets.filter(t => t.lastGatherSummary?.isRealPressure === true)
    const withSignals  = targets.filter(t => (t.signals || []).length > 0)
    return { todayNew: todayNew.length, highUrgency: highUrgency.length, realPressure: realPressure.length, withSignals: withSignals.length }
  }, [targets, today])

  return (
    <div style={{ background: '#111418', border: '1px solid #1e2530', borderLeft: '3px solid #ffaa00', borderRadius: 2, padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontFamily: mono, fontSize: '0.62rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#ffaa00' }}>✦ INTELLIGENCE ANALÝZA DNES</span>
        <span style={{ fontFamily: mono, fontSize: '0.58rem', color: '#6b7280' }}>{new Date().toLocaleDateString('sk-SK')}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
        {[
          { value: targets.length,      label: 'Celkom targetov',   color: '#6b7280', unit: '' },
          { value: stats.highUrgency,   label: 'Vysoká urgentnosť', color: '#ff5c00', unit: '' },
          { value: stats.realPressure,  label: 'Reálny tlak',       color: '#00cc88', unit: '' },
          { value: stats.withSignals,   label: 'So signálmi',       color: '#818cf8', unit: '' },
        ].map(({ value, label, color, unit }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: mono, fontSize: '1.5rem', fontWeight: 700, color, lineHeight: 1 }}>
              {value}<span style={{ fontSize: '0.55rem', color: '#6b7280' }}>{unit}</span>
            </div>
            <div style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#6b7280', marginTop: '0.25rem' }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

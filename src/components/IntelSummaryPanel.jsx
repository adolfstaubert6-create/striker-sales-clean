import { useMemo } from 'react'

const mono = "'IBM Plex Mono', monospace"

export default function IntelSummaryPanel({ targets }) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])

  const stats = useMemo(() => {
    const todayTargets = targets.filter(t => {
      const ts = t.createdAt?.toDate?.() || (t.createdAt ? new Date(t.createdAt) : null)
      return ts && ts >= today
    })
    return {
      todayCount: todayTargets.length,
      immediate:  targets.filter(t => t.recommendation === 'immediate').length,
      monitor:    targets.filter(t => t.recommendation === 'monitor').length,
      analyzed:   targets.filter(t => t.lastIntelGatherAt).length,
    }
  }, [targets, today])

  if (targets.length === 0) return null

  return (
    <div style={{ background: '#111418', border: '1px solid #1e2530', borderLeft: '3px solid #ffaa00', borderRadius: 2, padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontFamily: mono, fontSize: '0.62rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#ffaa00' }}>✦ INTELLIGENCE PREHĽAD</span>
        <span style={{ fontFamily: mono, fontSize: '0.58rem', color: '#6b7280' }}>{new Date().toLocaleDateString('sk-SK')}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
        {[
          { value: stats.todayCount, label: 'Pridané dnes',    color: '#ff5c00' },
          { value: stats.immediate,  label: 'Kontaktovať',     color: '#00cc88' },
          { value: stats.monitor,    label: 'Sledovať',        color: '#ffaa00' },
          { value: stats.analyzed,   label: 'So signálmi',     color: '#818cf8' },
        ].map(({ value, label, color }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: mono, fontSize: '1.5rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#6b7280', marginTop: '0.25rem' }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

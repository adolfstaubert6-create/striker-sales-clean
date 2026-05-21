import { useState } from 'react'
import { STATUS_MAP, REC_META, scoreColor } from '../constants/intelMeta.js'

const mono = "'IBM Plex Mono', monospace"
const sans = "'IBM Plex Sans', sans-serif"

function ScoreBar({ score, label }) {
  const color = scoreColor(score ?? 0)
  return (
    <div style={{ marginBottom: '0.28rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.1rem' }}>
        <span style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#6b7280' }}>{label}</span>
        <span style={{ fontFamily: mono, fontSize: '0.62rem', fontWeight: 700, color }}>{score ?? '–'}%</span>
      </div>
      <div style={{ height: 3, background: '#1e2530', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${score ?? 0}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
    </div>
  )
}

export default function IntelTargetCard({ target: t, onOpen, checked, onCheck }) {
  const [hovered, setHovered] = useState(false)

  const rec    = REC_META[t.recommendation] || REC_META.monitor
  const status = STATUS_MAP[t.status]       || { label: 'Nový target', color: '#818cf8', bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.3)' }
  const oc     = scoreColor(t.overallScore ?? 0)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.45rem' }}>
      {/* Checkbox — rovnaký vzor ako v Dashboard */}
      <div style={{ paddingTop: '0.95rem', flexShrink: 0 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onCheck}
          onClick={e => e.stopPropagation()}
          style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#ef4444' }}
        />
      </div>

      {/* Karta */}
      <div
        style={{
          flex: 1,
          background: '#111418',
          border: '1px solid #1e2530',
          borderLeft: `3px solid ${oc}`,
          borderColor: hovered ? '#2d3748' : '#1e2530',
          borderRadius: 2,
          padding: '0.85rem 1rem',
          cursor: 'pointer',
          boxShadow: hovered ? '0 0 12px rgba(255,92,0,0.1)' : undefined,
          transition: 'border-color 0.2s ease',
        }}
        onClick={onOpen}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Riadok 1: meno + overall score */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: sans, fontWeight: 600, fontSize: '0.92rem', color: '#e8eaed', marginBottom: '0.15rem' }}>
              {t.name}
            </div>
            <div style={{ fontFamily: mono, fontSize: '0.6rem', color: '#6b7280' }}>
              {[t.city, t.country].filter(Boolean).join(', ')}
              {t.segmentLabel && <span> · {t.segmentLabel}</span>}
              {t.companySize  && <span> · {t.companySize}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <span style={{ fontFamily: mono, fontSize: '1.05rem', fontWeight: 700, color: oc, border: `1px solid ${oc}66`, borderRadius: 2, padding: '0.08rem 0.4rem', lineHeight: 1.2 }}>
              {t.overallScore ?? '–'}<span style={{ fontSize: '0.52rem' }}>/100</span>
            </span>
            <div style={{ fontFamily: mono, fontSize: '0.42rem', color: '#4b5563', letterSpacing: 1, marginTop: 2, textAlign: 'right' }}>FIT</div>
          </div>
        </div>

        {/* Web / URL */}
        {t.web && (
          <div style={{ fontFamily: mono, fontSize: '0.58rem', color: '#374151', marginBottom: '0.5rem' }}>
            🌐 {t.web}
          </div>
        )}

        {/* Score bary */}
        <div style={{ marginBottom: '0.5rem' }}>
          <ScoreBar score={t.strikerFitScore}    label="Striker Fit"      />
          <ScoreBar score={t.energyPainScore}    label="Energ. problém"   />
          <ScoreBar score={t.buyingIntentScore}  label="Záujem o kúpu"    />
        </div>

        {/* Odporúčanie + stav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid #1e2530' }}>
          <span style={{ fontFamily: mono, fontSize: '0.55rem', color: rec.color }}>
            {rec.icon} {rec.label}
          </span>
          <span style={{
            fontFamily: mono, fontSize: '0.48rem', letterSpacing: '1px', textTransform: 'uppercase',
            padding: '0.1rem 0.38rem', borderRadius: 2,
            color: status.color, background: status.bg, border: `1px solid ${status.border}`,
          }}>
            {status.label}
          </span>
        </div>

        {/* Prvý signál */}
        {(t.signals || [])[0] && (
          <div style={{ fontFamily: mono, fontSize: '0.55rem', color: '#4b5563', marginTop: '0.45rem', display: 'flex', gap: '0.35rem', alignItems: 'flex-start' }}>
            <span style={{ color: '#ff5c00', flexShrink: 0 }}>▸</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.signals[0]}</span>
          </div>
        )}
      </div>
    </div>
  )
}

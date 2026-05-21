import { useState } from 'react'
import { INTEL_STATUSES, REC_META, scoreColor } from '../constants/intelMeta.js'

const mono = "'IBM Plex Mono',monospace"
const sans = "'IBM Plex Sans',sans-serif"

function getPriority(score) {
  if (score >= 80) return { label: 'EXTREME TARGET', color: '#ff5c00', bg: 'rgba(255,92,0,0.1)',   border: '#ff5c0044' }
  if (score >= 70) return { label: 'HIGH TARGET',    color: '#ffaa00', bg: 'rgba(255,170,0,0.1)',  border: '#ffaa0044' }
  if (score >= 55) return { label: 'MEDIUM TARGET',  color: '#818cf8', bg: 'rgba(129,140,248,0.1)',border: '#818cf844' }
  return              { label: 'LOW PRIORITY',    color: '#4b5563', bg: 'rgba(75,85,99,0.1)',    border: '#4b556344' }
}

function getMainProblem(t) {
  if (t.aiAnalysis?.energyProblem) return t.aiAnalysis.energyProblem.split('.')[0].trim()
  if ((t.signals || [])[0])        return t.signals[0]
  const MAP = {
    hotel:      'Vysoká spotreba teplej vody a vykurovania',
    wellness:   'Nepretržitý ohrev vody pre wellness zariadenia',
    laundry:    'Vysoká tepelná spotreba pri priemyselnom praní',
    hospital:   'Nepretržitá potreba tepla a TÚV pre prevádzku',
    food:       'Procesné teplo vo výrobe potravín',
    brewery:    'Vysoká tepelná spotreba pri varení a fermentácii',
    industrial: 'Priemyselný ohrev a procesné teplo',
    restaurant: 'Ohrev vody a gastro prevádzka',
  }
  return MAP[t.segment] || 'Vysoká spotreba energie'
}

function getAiSummary(t) {
  if (t.aiReasoning)           return t.aiReasoning.split('.')[0].trim()
  if (t.businessOpportunity)   return t.businessOpportunity.split('.')[0].trim()
  if (t.whyFound)              return t.whyFound.split('.')[0].trim()
  if (t.aiAnalysis?.mainArgument) return t.aiAnalysis.mainArgument.split('.')[0].trim()
  return null
}

export default function IntelTargetCard({ target: t, onOpen, checked, onCheck }) {
  const [hovered, setHovered] = useState(false)

  const oc       = scoreColor(t.overallScore ?? 0)
  const priority = getPriority(t.overallScore ?? 0)
  const problem  = getMainProblem(t)
  const summary  = getAiSummary(t)
  const status   = INTEL_STATUSES[t.status] || INTEL_STATUSES.new

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.45rem' }}>

      {/* Checkbox */}
      <div style={{ paddingTop: '0.95rem', flexShrink: 0 }}>
        <input type="checkbox" checked={checked} onChange={onCheck} onClick={e => e.stopPropagation()}
          style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#ef4444' }} />
      </div>

      {/* Karta */}
      <div
        style={{
          flex: 1,
          background: '#111418',
          borderTop: '1px solid #1e2530',
          borderRight: '1px solid #1e2530',
          borderBottom: '1px solid #1e2530',
          borderLeft: `3px solid ${hovered ? '#ff5c00' : oc}`,
          borderRadius: 2,
          padding: '0.85rem 1rem',
          cursor: 'pointer',
          boxShadow: hovered ? '0 0 12px rgba(255,92,0,0.12)' : undefined,
          transition: 'box-shadow 0.2s ease',
        }}
        onClick={() => onOpen(t, 'overview')}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Názov firmy */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.65rem' }}>
          <div>
            <div style={{ fontFamily: sans, fontWeight: 700, fontSize: '0.95rem', color: '#e8eaed', marginBottom: '0.1rem' }}>
              {t.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              {t.segmentLabel && (
                <span style={{ fontFamily: mono, fontSize: '0.52rem', color: '#6b7280' }}>🏭 {t.segmentLabel}</span>
              )}
              {(t.city || t.country) && (
                <span style={{ fontFamily: mono, fontSize: '0.52rem', color: '#6b7280' }}>📍 {[t.city, t.country].filter(Boolean).join(', ')}</span>
              )}
              <span style={{
                fontFamily: mono, fontSize: '0.48rem', letterSpacing: '1px', textTransform: 'uppercase',
                padding: '0.08rem 0.38rem', borderRadius: 2,
                color: status.color, background: status.bg,
              }}>{status.label}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: mono, fontSize: '1.6rem', fontWeight: 700, color: oc, lineHeight: 1 }}>
              {t.overallScore ?? '–'}
            </div>
            <div style={{ fontFamily: mono, fontSize: '0.42rem', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '1px' }}>FIT</div>
          </div>
        </div>

        {/* STRIKER FIT bar */}
        <div style={{ marginBottom: '0.6rem' }}>
          <div style={{ height: 4, background: '#1e2530', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${t.overallScore ?? 0}%`, height: '100%', background: oc, borderRadius: 2 }} />
          </div>
        </div>

        {/* Hlavný problém */}
        <div style={{ marginBottom: '0.5rem', padding: '0.4rem 0.6rem', background: '#0d1117', border: '1px solid #1e2530', borderRadius: 2 }}>
          <div style={{ fontFamily: mono, fontSize: '0.45rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#374151', marginBottom: '0.15rem' }}>
            ⚠ Hlavný problém
          </div>
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#ffaa00', lineHeight: 1.4 }}>
            {problem}
          </div>
        </div>

        {/* Priorita */}
        <div style={{ marginBottom: '0.5rem' }}>
          <span style={{
            fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 700,
            padding: '0.15rem 0.5rem', borderRadius: 2,
            color: priority.color, background: priority.bg, border: `1px solid ${priority.border}`,
          }}>
            🎯 {priority.label}
          </span>
        </div>

        {/* AI zhrnutie */}
        {summary && (
          <div style={{ fontFamily: mono, fontSize: '0.58rem', color: '#6b7280', lineHeight: 1.5, marginBottom: '0.65rem', fontStyle: 'italic' }}>
            🤖 {summary.length > 90 ? summary.slice(0, 90) + '…' : summary}
          </div>
        )}

        {/* Akčné tlačidlá */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', paddingTop: '0.55rem', borderTop: '1px solid #1e2530' }}>
          <ActionBtn label="DETAIL"      color="#ff5c00" onClick={e => { e.stopPropagation(); onOpen(t, 'overview') }} />
          <ActionBtn label="ANALYZOVAŤ"  color="#ffaa00" onClick={e => { e.stopPropagation(); onOpen(t, 'ai')       }} />
          <ActionBtn label="CRM"         color="#818cf8" onClick={e => { e.stopPropagation(); onOpen(t, 'crm')      }} />
          <ActionBtn label="✉ EMAIL"     color="#00cc88" onClick={e => { e.stopPropagation(); onOpen(t, 'email')    }} />
        </div>
      </div>
    </div>
  )
}

function ActionBtn({ label, color, onClick }) {
  const [h, setH] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        fontFamily: mono, fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase',
        padding: '0.22rem 0.6rem', border: `1px solid ${color}44`,
        background: h ? `${color}18` : 'transparent',
        color, borderRadius: 2, cursor: 'pointer', transition: 'background 0.15s',
      }}>
      {label}
    </button>
  )
}

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

export default function IntelTargetCard({ target: t, onOpen, checked, onCheck, onGather }) {
  const [hovered, setHovered] = useState(false)
  const [copied, setCopied]   = useState(false)

  const rec    = REC_META[t.recommendation] || REC_META.monitor
  const status = STATUS_MAP[t.status]       || { label: 'Nový target', color: '#818cf8', bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.3)' }
  const oc     = scoreColor(t.overallScore ?? 0)

  function copyUrl(e) {
    e.stopPropagation()
    if (!t.web) return
    navigator.clipboard.writeText(t.web).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.45rem' }}>

      {/* Checkbox */}
      <div style={{ paddingTop: '0.95rem', flexShrink: 0 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onCheck}
          onClick={e => e.stopPropagation()}
          style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#ef4444' }}
        />
      </div>

      {/* Karta — celá je klikateľná */}
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
            <span style={{
              fontFamily: mono, fontSize: '1.05rem', fontWeight: 700, color: oc,
              border: `1px solid ${oc}44`, borderRadius: 2, padding: '0.08rem 0.4rem', lineHeight: 1.2,
            }}>
              {t.overallScore ?? '–'}<span style={{ fontSize: '0.52rem' }}>/100</span>
            </span>
            <div style={{ fontFamily: mono, fontSize: '0.42rem', color: '#4b5563', letterSpacing: 1, marginTop: 2, textAlign: 'right' }}>FIT</div>
          </div>
        </div>

        {/* Web block — rovnaký vzor ako email block v CompanyCard */}
        <div style={{
          background: t.web ? 'rgba(129,140,248,0.05)' : 'rgba(255,170,0,0.05)',
          border: `1px solid ${t.web ? 'rgba(129,140,248,0.2)' : 'rgba(255,170,0,0.2)'}`,
          borderRadius: 2, padding: '0.45rem 0.7rem', marginBottom: '0.55rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
            <span style={{ fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase',
              color: t.web ? '#818cf8' : '#ffaa00',
              background: t.web ? 'rgba(129,140,248,0.12)' : 'rgba(255,170,0,0.1)',
              border: `1px solid ${t.web ? 'rgba(129,140,248,0.3)' : 'rgba(255,170,0,0.3)'}`,
              padding: '0.1rem 0.4rem', borderRadius: 2, whiteSpace: 'nowrap',
            }}>
              {t.web ? '✓ Web' : '⚠ Bez webu'}
            </span>
            {t.web && (
              <span style={{ fontFamily: mono, fontSize: '0.62rem', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.web}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
            {t.web && (
              <button
                style={{ fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.22rem 0.55rem', border: '1px solid rgba(129,140,248,0.4)', background: 'transparent', color: '#818cf8', borderRadius: 2, cursor: 'pointer' }}
                onClick={copyUrl}
                onMouseOver={e => e.currentTarget.style.opacity = '0.75'}
                onMouseOut={e => e.currentTarget.style.opacity = '1'}>
                {copied ? '✓' : '⎘ Kopírovať'}
              </button>
            )}
            {onGather && (
              <button
                style={{ fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.22rem 0.6rem', border: 'none', background: '#ffaa00', color: '#0a0c0f', borderRadius: 2, fontWeight: 700, cursor: 'pointer' }}
                onClick={e => { e.stopPropagation(); onGather(t) }}
                onMouseOver={e => e.currentTarget.style.filter = 'brightness(1.12)'}
                onMouseOut={e => e.currentTarget.style.filter = ''}>
                🔍 Signály
              </button>
            )}
          </div>
        </div>

        {/* Score bary */}
        <div style={{ marginBottom: '0.5rem' }}>
          <ScoreBar score={t.strikerFitScore}   label="Striker Fit"     />
          <ScoreBar score={t.energyPainScore}   label="Energ. problém"  />
          <ScoreBar score={t.buyingIntentScore} label="Záujem o kúpu"   />
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

        {/* Expand hint */}
        <div style={{ fontFamily: mono, fontSize: '0.5rem', color: '#374151', marginTop: '0.5rem', textAlign: 'right' }}>
          ▼ Otvoriť detail
        </div>
      </div>
    </div>
  )
}

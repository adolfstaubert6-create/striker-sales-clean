import { useState } from 'react'
import { STATUS_MAP, REC_META, scoreColor } from '../constants/intelMeta.js'

const mono = "'IBM Plex Mono',monospace"

function Tag({ color, bg, children }) {
  return <span style={{ fontFamily: mono, fontSize: '0.54rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.1rem 0.38rem', borderRadius: 2, border: `1px solid ${color}55`, color, background: bg }}>{children}</span>
}

function DetailRow({ label, value, link }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.35rem', alignItems: 'baseline' }}>
      <span style={{ fontFamily: mono, fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#6b7280', flexShrink: 0, width: 110 }}>{label}</span>
      {link
        ? <a href={link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontFamily: mono, fontSize: '0.68rem', color: '#ff5c00', textDecoration: 'none' }}>{value}</a>
        : <span style={{ fontFamily: mono, fontSize: '0.68rem', color: '#e8eaed' }}>{value}</span>}
    </div>
  )
}

export default function IntelTargetCard({ target: t, onOpen, checked, onCheck, onGather }) {
  const [open,   setOpen]   = useState(false)
  const [copied, setCopied] = useState(false)
  const [hovered,setHovered]= useState(false)

  const status  = STATUS_MAP[t.status] || { label: 'Nový target', color: '#818cf8', bg: 'rgba(129,140,248,0.1)' }
  const rec     = REC_META[t.recommendation] || REC_META.monitor
  const oc      = scoreColor(t.overallScore ?? 0)
  const hasWeb  = !!t.web
  const signals = (t.signals || []).slice(0, 3)

  function copyWeb(e) {
    e.stopPropagation()
    navigator.clipboard.writeText(t.web).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.45rem' }}>

      {/* Checkbox */}
      <div style={{ paddingTop: '0.95rem', flexShrink: 0 }}>
        <input type="checkbox" checked={checked} onChange={onCheck} onClick={e => e.stopPropagation()}
          style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#ef4444' }} />
      </div>

      <div
        style={{
          flex: 1, background: '#111418',
          borderTop: '1px solid #1e2530', borderRight: '1px solid #1e2530',
          borderBottom: '1px solid #1e2530', borderLeft: `3px solid ${oc}`,
          borderRadius: 2, padding: '0.85rem 1rem', cursor: 'pointer',
          boxShadow: hovered ? '0 0 12px rgba(255,92,0,0.15)' : undefined,
          transition: 'border-color 0.2s ease',
        }}
        onClick={onOpen}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >

        {/* Row 1: meno + FIT score — rovnaký ako Row 1 CompanyCard */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.6rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{t.name}</span>
            {t.city && <span style={{ fontFamily: mono, fontSize: '0.62rem', color: '#6b7280' }}> · {t.city}</span>}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <span style={{ fontFamily: mono, fontSize: '1.05rem', fontWeight: 700, color: oc, border: `1px solid ${oc}66`, borderRadius: 2, padding: '0.08rem 0.4rem', lineHeight: 1.2 }}>
              {t.overallScore ?? '–'}<span style={{ fontSize: '0.52rem' }}>/100</span>
            </span>
            <div style={{ fontFamily: mono, fontSize: '0.42rem', color: '#4b5563', letterSpacing: 1, marginTop: 2, textAlign: 'right' }}>FIT</div>
          </div>
        </div>

        {/* Row 2: Web block — rovnaký ako email block CompanyCard */}
        <div style={{
          background: hasWeb ? 'rgba(129,140,248,0.06)' : 'rgba(255,170,0,0.05)',
          border: `1px solid ${hasWeb ? 'rgba(129,140,248,0.25)' : 'rgba(255,170,0,0.2)'}`,
          borderRadius: 2, padding: '0.5rem 0.75rem', marginBottom: '0.55rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap',
              color: hasWeb ? '#818cf8' : '#ffaa00',
              background: hasWeb ? 'rgba(129,140,248,0.12)' : 'rgba(255,170,0,0.1)',
              border: `1px solid ${hasWeb ? 'rgba(129,140,248,0.3)' : 'rgba(255,170,0,0.3)'}`,
              padding: '0.1rem 0.4rem', borderRadius: 2,
            }}>
              {hasWeb ? '✓ Web nájdený' : '⚠ Web chýba'}
            </span>
            {hasWeb && <span style={{ fontFamily: mono, fontSize: '0.68rem', color: '#e8eaed' }}>{t.web}</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
            {hasWeb && (
              <button style={{ fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.25rem 0.6rem', border: '1px solid rgba(129,140,248,0.4)', background: 'transparent', color: '#818cf8', borderRadius: 2, cursor: 'pointer', transition: 'opacity 0.15s' }}
                onClick={copyWeb} onMouseOver={e => e.currentTarget.style.opacity = '0.75'} onMouseOut={e => e.currentTarget.style.opacity = '1'}>
                {copied ? '✓ Skopírované' : '⎘ Kopírovať'}
              </button>
            )}
            {onGather && (
              <button style={{ fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.25rem 0.65rem', border: 'none', background: '#ffaa00', color: '#0a0c0f', borderRadius: 2, fontWeight: 700, cursor: 'pointer', transition: 'filter 0.15s' }}
                onClick={e => { e.stopPropagation(); onGather(t) }}
                onMouseOver={e => e.currentTarget.style.filter = 'brightness(1.12)'}
                onMouseOut={e => e.currentTarget.style.filter = ''}>
                🔍 Signály
              </button>
            )}
          </div>
        </div>

        {/* Row 3: tagy — rovnaký ako Row 3 CompanyCard */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.45rem', alignItems: 'center' }}>
          <Tag color={status.color} bg={status.bg}>{status.label}</Tag>
          {t.segmentLabel && <Tag color="#6b7280" bg="transparent">{t.segmentLabel}</Tag>}
          {t.companySize  && <Tag color="#6b7280" bg="transparent">{t.companySize}</Tag>}
          {t.lastGatherSummary?.isRealPressure && <Tag color="#ff5c00" bg="rgba(255,92,0,0.08)">⚡ Reálny tlak</Tag>}
          <span style={{ fontFamily: mono, fontSize: '0.55rem', color: rec.color }}>{rec.icon} {rec.label}</span>
        </div>

        {/* Row 4: whyFound + signals + striker argument — rovnaký ako reason+keyFactors+aiInsight */}
        {t.whyFound && (
          <div style={{ fontFamily: mono, fontSize: '0.62rem', color: '#9ca3af', fontStyle: 'italic', marginBottom: '0.25rem', lineHeight: 1.5 }}>
            ✦ {t.whyFound.length > 120 ? t.whyFound.slice(0, 120) + '…' : t.whyFound}
          </div>
        )}
        {signals.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.3rem' }}>
            {signals.map((s, i) => (
              <span key={i} style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '0.3px', padding: '0.08rem 0.38rem', border: '1px solid #00cc8830', borderRadius: 2, color: '#00cc88', background: 'rgba(0,204,136,0.07)' }}>
                ▲ {s.length > 45 ? s.slice(0, 45) + '…' : s}
              </span>
            ))}
          </div>
        )}
        {t.lastGatherSummary?.strikerArgument && (
          <div style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: '0.68rem', color: '#6b7280', fontStyle: 'italic', lineHeight: 1.55, marginBottom: '0.3rem' }}>
            💡 {t.lastGatherSummary.strikerArgument}
          </div>
        )}

        {/* Row 5: expand — rovnaký ako CompanyCard */}
        <button
          style={{ fontFamily: mono, fontSize: '0.58rem', letterSpacing: '1px', color: '#4b5563', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.15rem 0', marginTop: '0.1rem', transition: 'color 0.15s' }}
          onClick={e => { e.stopPropagation(); setOpen(o => !o) }}>
          {open ? '▲ Skryť detail' : '▼ Zobraziť detail'}
        </button>

        {/* Row 6: expandable detail — rovnaký ako CompanyCard */}
        {open && (
          <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid #1e2530' }}>
            <DetailRow label="Web"          value={t.web}       link={t.web ? (t.web.startsWith('http') ? t.web : `https://${t.web}`) : null} />
            <DetailRow label="Lokalita"     value={[t.city, t.country].filter(Boolean).join(', ')} />
            <DetailRow label="Segment"      value={t.segmentLabel} />
            <DetailRow label="Veľkosť"      value={t.companySize}  />
            <DetailRow label="Zamestnanci"  value={t.employees}    />
            {t.strikerFitScore    != null && <DetailRow label="Striker Fit"    value={`${t.strikerFitScore}/100`}    />}
            {t.energyPainScore    != null && <DetailRow label="Energ. problém" value={`${t.energyPainScore}/100`}    />}
            {t.urgencyScore       != null && <DetailRow label="Urgentnosť"     value={`${t.urgencyScore}/100`}       />}
            {t.buyingIntentScore  != null && <DetailRow label="Záujem o kúpu"  value={`${t.buyingIntentScore}/100`}  />}
          </div>
        )}

      </div>
    </div>
  )
}

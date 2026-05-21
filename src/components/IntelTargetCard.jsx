// Vizuálny klon CompanyCard.jsx — rovnaké CSS, intelligence obsah
import { useState } from 'react'
import { INTEL_STATUSES, REC_META, scoreColor } from '../constants/intelMeta.js'
import { CONF_COLORS } from '../utils/calculateBusinessScore.js'

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

export default function IntelTargetCard({ target: t, onOpen, checked, onCheck }) {
  const [open,    setOpen]    = useState(false)
  const [copied,  setCopied]  = useState(false)
  const [hovered, setHovered] = useState(false)

  const status = INTEL_STATUSES[t.status] || INTEL_STATUSES.new
  const rec    = REC_META[t.recommendation] || REC_META.monitor
  const oc     = scoreColor(t.overallScore ?? 0)
  const hasWeb = !!t.web
  const signals = (t.signals || []).slice(0, 3)

  function copyWeb(e) {
    e.stopPropagation()
    navigator.clipboard.writeText(t.web).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.45rem' }}>
      {/* Checkbox — identický s Dashboard */}
      <div style={{ paddingTop: '0.95rem', flexShrink: 0 }}>
        <input type="checkbox" checked={checked} onChange={onCheck} onClick={e => e.stopPropagation()}
          style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#ef4444' }} />
      </div>

      {/* Karta — identické CSS ako CompanyCard */}
      <div
        style={{ ...css.card, borderLeftColor: oc, borderColor: hovered ? '#2d3748' : '#1e2530', boxShadow: hovered ? '0 0 12px rgba(255,92,0,0.15)' : undefined, transition: 'border-color 0.2s ease', cursor: 'pointer' }}
        onClick={onOpen}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Row 1: meno + FIT score — klon Row 1 CompanyCard */}
        <div style={css.topRow}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={css.name}>{t.name}</span>
            {t.city && <span style={css.city}> · {t.city}</span>}
          </div>
          <div style={css.scoreWrap}>
            <span style={{ ...css.scoreBadge, color: oc, borderColor: oc + '66' }}>
              {t.overallScore ?? '–'}<span style={css.scoreSlash}>/100</span>
            </span>
            <div style={{ ...css.priLabel, color: oc }}>
              {(t.overallScore ?? 0) >= 70 ? 'Vysoký' : (t.overallScore ?? 0) >= 50 ? 'Stredný' : 'Nízky'}
            </div>
            <div style={css.bpsLabel}>FIT</div>
          </div>
        </div>

        {/* Row 2: Web block — klon email block CompanyCard */}
        <div style={hasWeb ? css.emailBlockFound : css.emailBlockMissing}>
          <div style={css.emailLeft}>
            <span style={hasWeb ? css.emailBadgeFound : css.emailBadgeMissing}>
              {hasWeb ? '✓ Web nájdený' : '⚠ Web chýba'}
            </span>
            {hasWeb && <span style={css.emailAddr}>{t.web}</span>}
          </div>
          <div style={css.emailActions}>
            {hasWeb && (
              <button style={css.copyBtn} onClick={copyWeb}
                onMouseOver={e => e.currentTarget.style.opacity = '0.75'}
                onMouseOut={e => e.currentTarget.style.opacity = '1'}>
                {copied ? '✓ Skopírované' : '⎘ Kopírovať'}
              </button>
            )}
          </div>
        </div>

        {/* Row 3: tagy — klon Row 3 CompanyCard */}
        <div style={css.tags}>
          <Tag color={status.color} bg={status.bg}>{status.label}</Tag>
          {t.segmentLabel && <Tag color="#6b7280" bg="transparent">{t.segmentLabel}</Tag>}
          {t.lastGatherSummary?.isRealPressure && <Tag color="#ff5c00" bg="rgba(255,92,0,0.08)">⚡ Reálny tlak</Tag>}
          <span style={{ fontFamily: mono, fontSize: '0.55rem', color: rec.color }}>{rec.icon} {rec.label}</span>
        </div>

        {/* Row 4: whyFound + signals + striker argument — klon reason+keyFactors+aiInsight */}
        {t.whyFound && (
          <div style={css.reason}>✦ {t.whyFound.length > 120 ? t.whyFound.slice(0, 120) + '…' : t.whyFound}</div>
        )}
        {signals.length > 0 && (
          <div style={css.reasoningRow}>
            {signals.map((s, i) => (
              <span key={i} style={{ ...css.reasoningTag, color: '#00cc88', background: 'rgba(0,204,136,0.07)', borderColor: '#00cc8830' }}>
                ▲ {s.length > 45 ? s.slice(0, 45) + '…' : s}
              </span>
            ))}
          </div>
        )}
        {t.lastGatherSummary?.strikerArgument && (
          <div style={css.aiInsightRow}>💡 {t.lastGatherSummary.strikerArgument}</div>
        )}

        {/* Row 5: expand — identický */}
        <button style={css.expandBtn} onClick={e => { e.stopPropagation(); setOpen(o => !o) }}>
          {open ? '▲ Skryť detail' : '▼ Zobraziť detail'}
        </button>

        {/* Row 6: expandable detail — identický vzor */}
        {open && (
          <div style={css.detail}>
            <DetailRow label="Web"          value={t.web}        link={t.web ? (t.web.startsWith('http') ? t.web : `https://${t.web}`) : null} />
            <DetailRow label="Lokalita"     value={[t.city, t.country].filter(Boolean).join(', ')} />
            <DetailRow label="Segment"      value={t.segmentLabel} />
            <DetailRow label="Veľkosť"      value={t.companySize}  />
            <DetailRow label="Zamestnanci"  value={t.employees}    />
            {t.strikerFitScore   != null && <DetailRow label="Striker FIT"    value={`${t.strikerFitScore}/100`}   />}
            {t.energyPainScore   != null && <DetailRow label="Energ. problém" value={`${t.energyPainScore}/100`}   />}
            {t.urgencyScore      != null && <DetailRow label="Urgentnosť"     value={`${t.urgencyScore}/100`}      />}
            {t.buyingIntentScore != null && <DetailRow label="Záujem o kúpu"  value={`${t.buyingIntentScore}/100`} />}
          </div>
        )}
      </div>
    </div>
  )
}

// Identické CSS ako CompanyCard
const css = {
  card:              { background: '#111418', border: '1px solid #1e2530', borderLeft: '3px solid #1e2530', borderRadius: 2, padding: '0.85rem 1rem', flex: 1 },
  topRow:            { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.6rem' },
  name:              { fontWeight: 600, fontSize: '0.92rem' },
  city:              { fontFamily: mono, fontSize: '0.62rem', color: '#6b7280' },
  scoreWrap:         { textAlign: 'right', flexShrink: 0 },
  scoreBadge:        { fontFamily: mono, fontSize: '1.05rem', fontWeight: 700, border: '1px solid', borderRadius: 2, padding: '0.08rem 0.4rem', lineHeight: 1.2 },
  scoreSlash:        { fontSize: '0.52rem' },
  priLabel:          { fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', marginTop: 2 },
  bpsLabel:          { fontFamily: mono, fontSize: '0.42rem', color: '#4b5563', letterSpacing: 1, marginTop: 1 },
  emailBlockFound:   { background: 'rgba(0,204,136,0.06)', border: '1px solid rgba(0,204,136,0.25)', borderRadius: 2, padding: '0.5rem 0.75rem', marginBottom: '0.55rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' },
  emailBlockMissing: { background: 'rgba(255,170,0,0.05)', border: '1px solid rgba(255,170,0,0.2)', borderRadius: 2, padding: '0.5rem 0.75rem', marginBottom: '0.55rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' },
  emailLeft:         { display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' },
  emailBadgeFound:   { fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#00cc88', background: 'rgba(0,204,136,0.12)', border: '1px solid rgba(0,204,136,0.3)', padding: '0.1rem 0.4rem', borderRadius: 2, whiteSpace: 'nowrap' },
  emailBadgeMissing: { fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#ffaa00', background: 'rgba(255,170,0,0.1)', border: '1px solid rgba(255,170,0,0.3)', padding: '0.1rem 0.4rem', borderRadius: 2, whiteSpace: 'nowrap' },
  emailAddr:         { fontFamily: mono, fontSize: '0.68rem', color: '#e8eaed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  emailActions:      { display: 'flex', gap: '0.4rem', flexShrink: 0 },
  copyBtn:           { fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.25rem 0.6rem', border: '1px solid rgba(0,204,136,0.4)', background: 'transparent', color: '#00cc88', borderRadius: 2, cursor: 'pointer', transition: 'opacity 0.15s' },
  tags:              { display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.45rem', alignItems: 'center' },
  reason:            { fontFamily: mono, fontSize: '0.62rem', color: '#9ca3af', fontStyle: 'italic', marginBottom: '0.25rem', lineHeight: 1.5 },
  reasoningRow:      { display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.3rem' },
  reasoningTag:      { fontFamily: mono, fontSize: '0.5rem', letterSpacing: '0.3px', padding: '0.08rem 0.38rem', border: '1px solid', borderRadius: 2 },
  aiInsightRow:      { fontFamily: "'IBM Plex Sans',sans-serif", fontSize: '0.68rem', color: '#6b7280', fontStyle: 'italic', lineHeight: 1.55, marginBottom: '0.3rem' },
  expandBtn:         { fontFamily: mono, fontSize: '0.58rem', letterSpacing: '1px', color: '#4b5563', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.15rem 0', marginTop: '0.1rem', transition: 'color 0.15s' },
  detail:            { marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid #1e2530' },
}

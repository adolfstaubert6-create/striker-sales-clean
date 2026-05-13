import { useState } from 'react'
import { COMPANY_STATUSES } from '../constants/companyStatuses.js'
import { calculatePriorityLabel } from '../utils/calculatePriorityLabel.js'
import { CONF_COLORS } from '../utils/calculateBusinessScore.js'

const TYPE_LABEL = {
  hotel: '🏨 Hotel', laundry: '🧺 Práčovňa', spa: '💆 Wellness',
  hospital: '🏥 Nemocnica', restaurant: '🍽️ Reštaurácia',
}

export default function CompanyCard({ company, scoring, onDraft, onScore }) {
  const [open, setOpen]       = useState(false)
  const [copied, setCopied]   = useState(false)

  const st  = COMPANY_STATUSES[company.status] || COMPANY_STATUSES.new
  const pri = calculatePriorityLabel(company.aiScore)
  const hasEmail = !!(company.email)

  function copyEmail() {
    if (!company.email) return
    navigator.clipboard.writeText(company.email).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // AI factors may be stored flat (aiPositive/aiRisks/aiNextStep) or nested (aiFactors.*)
  const positive   = company.aiPositive   || company.aiFactors?.positive || []
  const risks      = company.aiRisks      || company.aiFactors?.risks    || []
  const nextStep   = company.aiNextStep   || company.aiFactors?.nextStep || ''
  const reason     = company.aiReason     || ''
  const reasoning  = company.aiReasoning  || []
  const confidence = company.aiConfidence || null

  return (
    <div style={{ ...css.card, borderLeftColor: st.color }}>

      {/* ── Row 1: name + BPS score ── */}
      <div style={css.topRow}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={css.name}>{company.name}</span>
          {company.city && <span style={css.city}> · {company.city}</span>}
        </div>
        <div style={css.scoreWrap}>
          {scoring ? <span style={css.scorePending}>⏳</span> : (
            company.aiScore != null
              ? <span style={{ ...css.scoreBadge, color: pri?.color || '#6b7280', borderColor: (pri?.color || '#6b7280') + '66' }}>
                  {company.aiScore}<span style={css.scoreSlash}>/100</span>
                </span>
              : <span style={css.scoreEmpty}>–</span>
          )}
          {pri && !scoring && <div style={{ ...css.priLabel, color: pri.color }}>{pri.label}</div>}
          <div style={css.bpsLabel}>BPS</div>
          {confidence && !scoring && (
            <div style={{ fontFamily: mono, fontSize: '0.42rem', letterSpacing: '0.5px', color: CONF_COLORS[confidence], marginTop: 1 }}>
              {confidence}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: EMAIL block (prominent) ── */}
      <div style={hasEmail ? css.emailBlockFound : css.emailBlockMissing}>
        <div style={css.emailLeft}>
          <span style={hasEmail ? css.emailBadgeFound : css.emailBadgeMissing}>
            {hasEmail ? '✓ Email nájdený' : '⚠ Email chýba'}
          </span>
          {hasEmail && <span style={css.emailAddr}>{company.email}</span>}
        </div>
        <div style={css.emailActions}>
          {hasEmail && (
            <button style={css.copyBtn} onClick={copyEmail}>
              {copied ? '✓ Skopírované' : '⎘ Kopírovať'}
            </button>
          )}
          <button style={css.draftBtn} onClick={() => onDraft(company)}>
            ✉ Draft email
          </button>
        </div>
      </div>

      {/* ── Row 3: tags ── */}
      <div style={css.tags}>
        <Tag color={st.color} bg={st.bg}>{st.label}</Tag>
        {company.category && <Tag color="#6b7280" bg="transparent">{TYPE_LABEL[company.category] || company.category}</Tag>}
        {company.rating   && <Tag color="#ffaa00" bg="rgba(255,170,0,0.08)">⭐ {company.rating}</Tag>}
        {(company.aiScore === null || company.aiScore === undefined) && (
          <button style={css.scoreBtn} onClick={() => onScore(company)} disabled={scoring}>
            {scoring ? '⏳' : '✦ BPS Skóre'}
          </button>
        )}
      </div>

      {/* ── Row 4: AI reason + next step + reasoning tags ── */}
      {reason   && <div style={css.reason}>✦ {reason}</div>}
      {nextStep && <div style={css.nextStep}>→ {nextStep}</div>}
      {reasoning.slice(0, 3).length > 0 && (
        <div style={css.reasoningRow}>
          {reasoning.slice(0, 3).map((r, i) => (
            <span key={i} style={{ ...css.reasoningTag, color: r.startsWith('-') ? '#ef4444' : '#00cc88', background: r.startsWith('-') ? 'rgba(239,68,68,0.07)' : 'rgba(0,204,136,0.07)', borderColor: r.startsWith('-') ? '#ef444430' : '#00cc8830' }}>
              {r}
            </span>
          ))}
        </div>
      )}

      {/* ── Row 5: expand toggle ── */}
      <button style={css.expandBtn} onClick={() => setOpen(o => !o)}>
        {open ? '▲ Skryť detail' : '▼ Zobraziť detail'}
      </button>

      {/* ── Expandable detail panel ── */}
      {open && (
        <div style={css.detail}>
          <DetailRow label="Email"         value={company.email}         />
          <DetailRow label="Telefón"       value={company.phone}         link={company.phone ? `tel:${company.phone}` : null} />
          <DetailRow label="Web"           value={company.website}       link={company.website ? `https://${company.website}` : null} />
          <DetailRow label="Adresa"        value={company.address}       />
          <DetailRow label="Kontakt. osoba" value={company.contactPerson} />
          <DetailRow label="Hodnotenie"    value={company.rating ? `${company.rating} / 5` : null} />
          <DetailRow label="Posl. kontakt" value={company.lastContact}   />

          {positive.length > 0 && (
            <div style={css.detailSection}>
              <div style={css.detailLabel}>Pozitívne faktory</div>
              {positive.map((f, i) => <div key={i} style={css.factorPos}>✓ {f}</div>)}
            </div>
          )}
          {risks.length > 0 && (
            <div style={css.detailSection}>
              <div style={css.detailLabel}>Riziká</div>
              {risks.map((r, i) => <div key={i} style={css.factorRisk}>⚠ {r}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Tag({ color, bg, children }) {
  return <span style={{ ...css.tag, color, background: bg, borderColor: color + '55' }}>{children}</span>
}

function DetailRow({ label, value, link }) {
  if (!value) return null
  return (
    <div style={css.detailRow}>
      <span style={css.detailLabel}>{label}</span>
      {link
        ? <a href={link} target="_blank" rel="noreferrer" style={css.detailLink}>{value}</a>
        : <span style={css.detailVal}>{value}</span>}
    </div>
  )
}

const mono = "'IBM Plex Mono',monospace"
const css = {
  card:             { background: '#111418', border: '1px solid #1e2530', borderLeft: '3px solid #1e2530', borderRadius: 2, padding: '0.85rem 1rem', marginBottom: '0.45rem' },
  topRow:           { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.6rem' },
  name:             { fontWeight: 600, fontSize: '0.92rem' },
  city:             { fontFamily: mono, fontSize: '0.62rem', color: '#6b7280' },
  scoreWrap:        { textAlign: 'right', flexShrink: 0 },
  scoreBadge:       { fontFamily: mono, fontSize: '1.05rem', fontWeight: 700, border: '1px solid', borderRadius: 2, padding: '0.08rem 0.4rem', lineHeight: 1.2 },
  scoreSlash:       { fontSize: '0.52rem' },
  scorePending:     { fontSize: '1rem' },
  scoreEmpty:       { fontFamily: mono, fontSize: '0.85rem', color: '#6b7280' },
  priLabel:         { fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', marginTop: 2 },
  bpsLabel:         { fontFamily: mono, fontSize: '0.42rem', color: '#4b5563', letterSpacing: 1, marginTop: 1 },

  emailBlockFound:  { background: 'rgba(0,204,136,0.06)', border: '1px solid rgba(0,204,136,0.25)', borderRadius: 2, padding: '0.5rem 0.75rem', marginBottom: '0.55rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' },
  emailBlockMissing:{ background: 'rgba(255,170,0,0.05)', border: '1px solid rgba(255,170,0,0.2)', borderRadius: 2, padding: '0.5rem 0.75rem', marginBottom: '0.55rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' },
  emailLeft:        { display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' },
  emailBadgeFound:  { fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#00cc88', background: 'rgba(0,204,136,0.12)', border: '1px solid rgba(0,204,136,0.3)', padding: '0.1rem 0.4rem', borderRadius: 2, whiteSpace: 'nowrap' },
  emailBadgeMissing:{ fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#ffaa00', background: 'rgba(255,170,0,0.1)', border: '1px solid rgba(255,170,0,0.3)', padding: '0.1rem 0.4rem', borderRadius: 2, whiteSpace: 'nowrap' },
  emailAddr:        { fontFamily: mono, fontSize: '0.68rem', color: '#e8eaed' },
  emailActions:     { display: 'flex', gap: '0.4rem', flexShrink: 0 },
  copyBtn:          { fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.25rem 0.6rem', border: '1px solid rgba(0,204,136,0.4)', background: 'transparent', color: '#00cc88', borderRadius: 2, cursor: 'pointer' },
  draftBtn:         { fontFamily: mono, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.25rem 0.65rem', border: 'none', background: '#00cc88', color: '#0a0c0f', borderRadius: 2, fontWeight: 700, cursor: 'pointer' },

  tags:             { display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.45rem', alignItems: 'center' },
  tag:              { fontFamily: mono, fontSize: '0.54rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.1rem 0.38rem', borderRadius: 2, border: '1px solid transparent' },
  scoreBtn:         { fontFamily: mono, fontSize: '0.56rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.1rem 0.45rem', border: '1px solid rgba(255,170,0,0.5)', background: 'transparent', color: '#ffaa00', borderRadius: 2, cursor: 'pointer' },

  reason:           { fontFamily: mono, fontSize: '0.62rem', color: '#9ca3af', fontStyle: 'italic', marginBottom: '0.25rem', lineHeight: 1.5 },
  nextStep:         { fontFamily: mono, fontSize: '0.6rem', color: '#00cc88', marginBottom: '0.3rem' },
  reasoningRow:     { display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.35rem' },
  reasoningTag:     { fontFamily: mono, fontSize: '0.5rem', letterSpacing: '0.3px', padding: '0.08rem 0.38rem', border: '1px solid', borderRadius: 2 },

  expandBtn:        { fontFamily: mono, fontSize: '0.58rem', letterSpacing: '1px', color: '#4b5563', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.15rem 0', marginTop: '0.1rem' },

  detail:           { marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid #1e2530' },
  detailRow:        { display: 'flex', gap: '0.75rem', marginBottom: '0.35rem', alignItems: 'baseline' },
  detailLabel:      { fontFamily: mono, fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#6b7280', flexShrink: 0, width: 110 },
  detailVal:        { fontFamily: mono, fontSize: '0.68rem', color: '#e8eaed' },
  detailLink:       { fontFamily: mono, fontSize: '0.68rem', color: '#ff5c00', textDecoration: 'none' },
  detailSection:    { marginTop: '0.5rem' },
  factorPos:        { fontFamily: mono, fontSize: '0.6rem', color: '#00cc88', lineHeight: 1.7 },
  factorRisk:       { fontFamily: mono, fontSize: '0.6rem', color: '#ffaa00', lineHeight: 1.7 },
}

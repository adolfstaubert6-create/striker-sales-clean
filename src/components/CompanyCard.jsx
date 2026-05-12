import { COMPANY_STATUSES } from '../constants/companyStatuses.js'
import { calculatePriorityLabel } from '../utils/calculatePriorityLabel.js'

export default function CompanyCard({ company, scoring, onDraft, onScore }) {
  const st   = COMPANY_STATUSES[company.status] || COMPANY_STATUSES.new
  const pri  = calculatePriorityLabel(company.aiScore)
  const type = company.category === 'spa' ? '💆 Wellness' : company.category === 'hotel' ? '🏨 Hotel' : company.category === 'laundry' ? '🧺 Práčovňa' : company.category === 'hospital' ? '🏥 Nemocnica' : '🍽️ Reštaurácia'

  return (
    <div style={{ ...css.card, borderLeftColor: st.color }}>

      {/* Top row */}
      <div style={css.top}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={css.name}>{company.name}</div>
          <div style={css.meta}>
            {company.city && <span>{company.city}</span>}
            {company.address && <span style={css.sep}>{company.address}</span>}
          </div>
        </div>

        {/* Score badge */}
        <div style={css.scoreWrap}>
          {scoring ? (
            <div style={css.scorePending}>⏳</div>
          ) : company.aiScore !== null && company.aiScore !== undefined ? (
            <div style={{ ...css.scoreBadge, color: pri?.color || '#6b7280', borderColor: pri?.color || '#1e2530' }}>
              {company.aiScore}<span style={{ fontSize: '0.55rem' }}>/100</span>
            </div>
          ) : (
            <div style={css.scoreEmpty}>–/100</div>
          )}
          {pri && !scoring && <div style={{ ...css.priLabel, color: pri.color }}>{pri.label}</div>}
        </div>
      </div>

      {/* Detail row */}
      <div style={css.details}>
        <Tag color={st.color} bg={st.bg}>{st.label}</Tag>
        <Tag color="#6b7280" bg="transparent">{type}</Tag>
        {company.rating && <Tag color="#ffaa00" bg="rgba(255,170,0,0.08)">⭐ {company.rating}</Tag>}
        {company.phone   && <Tag color="#6b7280" bg="transparent">{company.phone}</Tag>}
        {company.website && (
          <a href={`https://${company.website}`} target="_blank" rel="noreferrer" style={css.webLink}>
            {company.website}
          </a>
        )}
      </div>

      {/* AI reason */}
      {company.aiReason && (
        <div style={css.aiReason}>✦ {company.aiReason}</div>
      )}

      {/* AI factors */}
      {company.aiFactors?.nextStep && (
        <div style={css.nextStep}>→ {company.aiFactors.nextStep}</div>
      )}

      {/* Last contact */}
      {company.lastContact && (
        <div style={css.lastContact}>Posledný kontakt: {company.lastContact}</div>
      )}

      {/* Actions */}
      <div style={css.actions}>
        <button style={css.aBtn} onClick={() => onDraft(company)}>✉ Draft email</button>
        {(company.aiScore === null || company.aiScore === undefined) && (
          <button style={{ ...css.aBtn, borderColor: '#ffaa00', color: '#ffaa00' }}
            onClick={() => onScore(company)} disabled={scoring}>
            {scoring ? '⏳ Hodnotí...' : '✦ AI Score'}
          </button>
        )}
        {company.aiFactors?.positive?.length > 0 && (
          <span style={css.posTag}>+{company.aiFactors.positive.length} faktory</span>
        )}
      </div>
    </div>
  )
}

function Tag({ color, bg, children }) {
  return (
    <span style={{ ...css.tag, color, background: bg, borderColor: color + '44' }}>
      {children}
    </span>
  )
}

const css = {
  card: { background: '#111418', border: '1px solid #1e2530', borderLeft: '3px solid #1e2530', borderRadius: 2, padding: '0.85rem 1rem', marginBottom: '0.4rem' },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.5rem' },
  name: { fontWeight: 600, fontSize: '0.92rem', marginBottom: '0.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  meta: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.6rem', color: '#6b7280', lineHeight: 1.5 },
  sep: { marginLeft: '0.4rem', paddingLeft: '0.4rem', borderLeft: '1px solid #1e2530' },
  scoreWrap: { textAlign: 'right', flexShrink: 0 },
  scoreBadge: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '1.1rem', fontWeight: 700, border: '1px solid', borderRadius: 2, padding: '0.1rem 0.45rem', lineHeight: 1.2 },
  scorePending: { fontSize: '1.1rem', textAlign: 'center' },
  scoreEmpty: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.9rem', color: '#6b7280' },
  priLabel: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '0.2rem' },
  details: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.45rem', alignItems: 'center' },
  tag: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.1rem 0.38rem', borderRadius: 2, border: '1px solid transparent' },
  webLink: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.58rem', color: '#ff5c00', textDecoration: 'none' },
  aiReason: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.62rem', color: '#9ca3af', fontStyle: 'italic', marginBottom: '0.25rem', lineHeight: 1.5 },
  nextStep: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.6rem', color: '#00cc88', marginBottom: '0.35rem' },
  lastContact: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.58rem', color: '#6b7280', marginBottom: '0.35rem' },
  actions: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.3rem' },
  aBtn: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.22rem 0.55rem', border: '1px solid #1e2530', background: 'transparent', color: '#6b7280', borderRadius: 2 },
  posTag: { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.58rem', color: '#00cc88', marginLeft: '0.25rem' },
}

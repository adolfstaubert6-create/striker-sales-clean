const STATUS_COLORS = {
  new:       { bg: 'rgba(0,102,255,0.1)',   color: '#0066ff' },
  contacted: { bg: 'rgba(255,170,0,0.1)',   color: '#ffaa00' },
  offer:     { bg: 'rgba(204,0,255,0.1)',   color: '#cc00ff' },
  closed:    { bg: 'rgba(0,204,136,0.1)',   color: '#00cc88' },
  rejected:  { bg: 'rgba(255,51,51,0.1)',   color: '#ff3333' },
}

const STATUS_LABELS = {
  new: 'Nový', contacted: 'Kontaktovaný', offer: 'Ponuka', closed: 'Uzavreté', rejected: 'Zamietnutý',
}

const s = {
  card: {
    background: '#111418',
    border: '1px solid #1e2530',
    borderLeft: '3px solid #1e2530',
    borderRadius: '2px',
    padding: '0.85rem 1rem',
    marginBottom: '0.4rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
  },
  name: { fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.15rem' },
  meta: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#6b7280', lineHeight: 1.5 },
  right: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem', flexShrink: 0 },
  badge: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.55rem',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    padding: '0.12rem 0.4rem',
    borderRadius: '2px',
  },
  score: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.72rem',
    fontWeight: 600,
  },
  actions: { display: 'flex', gap: '0.35rem', marginTop: '0.35rem' },
  abtn: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.58rem',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    padding: '0.2rem 0.5rem',
    border: '1px solid #1e2530',
    background: 'transparent',
    color: '#6b7280',
    borderRadius: '2px',
  },
}

function scoreColor(score) {
  if (score === null || score === undefined) return '#6b7280'
  if (score >= 80) return '#00cc88'
  if (score >= 50) return '#ffaa00'
  return '#ff3333'
}

function borderColor(status) {
  return STATUS_COLORS[status]?.color || '#1e2530'
}

export default function CompanyCard({ company, onDraft, onScore }) {
  const st = STATUS_COLORS[company.status] || STATUS_COLORS.new
  const stLabel = STATUS_LABELS[company.status] || company.status

  return (
    <div style={{ ...s.card, borderLeftColor: borderColor(company.status) }}>
      <div style={{ flex: 1 }}>
        <div style={s.name}>{company.name}</div>
        <div style={s.meta}>
          {company.city}{company.address ? ` · ${company.address}` : ''}
          {company.phone ? ` · ${company.phone}` : ''}
          {company.rating ? ` · ⭐ ${company.rating}` : ''}
        </div>
        {company.aiReason && (
          <div style={{ ...s.meta, marginTop: '0.3rem', color: '#9ca3af', fontStyle: 'italic' }}>
            {company.aiReason}
          </div>
        )}
        <div style={s.actions}>
          <button style={s.abtn} onClick={() => onDraft(company)}>✉ Draft</button>
          {company.aiScore === null && (
            <button style={s.abtn} onClick={() => onScore(company)}>✦ AI Score</button>
          )}
        </div>
      </div>
      <div style={s.right}>
        <span style={{ ...s.badge, background: st.bg, color: st.color }}>{stLabel}</span>
        {company.aiScore !== null && company.aiScore !== undefined ? (
          <span style={{ ...s.score, color: scoreColor(company.aiScore) }}>
            {company.aiScore}/100
          </span>
        ) : (
          <span style={{ ...s.score, color: '#6b7280' }}>–/100</span>
        )}
      </div>
    </div>
  )
}

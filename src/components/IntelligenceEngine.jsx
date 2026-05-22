const mono = "'IBM Plex Mono',monospace"
const sans = "'IBM Plex Sans',sans-serif"

// ── Confidence badge ──────────────────────────────────────────────────────────

const CONF = {
  HIGH:   { color: '#00cc88', label: 'HIGH',   bg: 'rgba(0,204,136,0.1)'  },
  MEDIUM: { color: '#ffaa00', label: 'MEDIUM', bg: 'rgba(255,170,0,0.1)'  },
  LOW:    { color: '#6b7280', label: 'LOW',    bg: 'rgba(107,114,128,0.1)' },
}

function ConfBadge({ level }) {
  const c = CONF[level] || CONF.LOW
  return (
    <span style={{
      fontFamily: mono, fontSize: '0.41rem', letterSpacing: '1.5px', textTransform: 'uppercase',
      color: c.color, padding: '0.04rem 0.3rem',
      border: `1px solid ${c.color}44`, borderRadius: 2, background: c.bg,
      flexShrink: 0,
    }}>
      {c.label}
    </span>
  )
}

// ── Intelligence card wrapper ─────────────────────────────────────────────────

function ICard({ icon, title, accent = '#1e2530', confidence, reasoning, children }) {
  return (
    <div style={{
      background: '#0a0c10', border: `1px solid ${accent}`,
      borderRadius: 4, padding: '0.75rem 0.85rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.55rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.85rem', lineHeight: 1 }}>{icon}</span>
        <span style={{ fontFamily: mono, fontSize: '0.43rem', letterSpacing: '2px', textTransform: 'uppercase', color: accent === '#1e2530' ? '#374151' : accent, flex: 1 }}>
          {title}
        </span>
        {confidence && <ConfBadge level={confidence} />}
      </div>

      {/* Content */}
      <div>{children}</div>

      {/* Reasoning */}
      {reasoning && (
        <div style={{ fontFamily: mono, fontSize: '0.5rem', color: '#374151', marginTop: '0.45rem', lineHeight: 1.5, fontStyle: 'italic' }}>
          {reasoning}
        </div>
      )}
    </div>
  )
}

function FieldPair({ label, value, valueColor }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.22rem', alignItems: 'flex-start' }}>
      <span style={{ fontFamily: mono, fontSize: '0.42rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#374151', flexShrink: 0, width: 90 }}>{label}</span>
      <span style={{ fontFamily: mono, fontSize: '0.6rem', color: valueColor || '#9ca3af', lineHeight: 1.45 }}>{value}</span>
    </div>
  )
}

// ── Investment profile metadata ───────────────────────────────────────────────

const INVEST_META = {
  'aktívne investuje':       { icon: '📈', color: '#00cc88' },
  'modernizuje':             { icon: '🔧', color: '#ff5c00' },
  'stagnuje':                { icon: '⏸',  color: '#6b7280' },
  'cost-saving mode':        { icon: '💰', color: '#ffaa00' },
  'aktívne hľadá riešenie':  { icon: '🔍', color: '#00cc88' },
  'konzervatívny prístup':   { icon: '🛡',  color: '#6b7280' },
  'neznáme':                 { icon: '❓', color: '#374151' },
}

function getInvestMeta(type) {
  if (!type) return { icon: '❓', color: '#374151' }
  const key = Object.keys(INVEST_META).find(k => type.toLowerCase().includes(k.toLowerCase()))
  return key ? INVEST_META[key] : { icon: '💼', color: '#818cf8' }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function IntelligenceEngine({ intelligence }) {
  if (!intelligence) return null

  const { buildingAge, technologyState, modernizationSignals, investmentProfile } = intelligence

  return (
    <div style={{ marginTop: '1.1rem' }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.65rem' }}>
        <span style={{ fontFamily: mono, fontSize: '0.43rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#374151' }}>
          CLIENT INTELLIGENCE ENGINE
        </span>
        <div style={{ flex: 1, height: 1, background: '#1e2530' }} />
        <span style={{ fontFamily: mono, fontSize: '0.4rem', color: '#1e2530', letterSpacing: '1px', textTransform: 'uppercase' }}>FÁZA 1</span>
      </div>

      {/* 2×2 grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>

        {/* 1. VEK BUDOVY */}
        {buildingAge && (
          <ICard icon="🏢" title="Vek budovy" accent="#818cf833" confidence={buildingAge.confidence} reasoning={buildingAge.reasoning}>
            <div style={{ fontFamily: sans, fontSize: '0.72rem', color: '#e8eaed', fontWeight: 600, marginBottom: '0.2rem' }}>
              {buildingAge.estimate}
            </div>
            {buildingAge.approximateAge && (
              <div style={{ fontFamily: mono, fontSize: '0.55rem', color: '#6b7280' }}>
                {buildingAge.approximateAge}
              </div>
            )}
          </ICard>
        )}

        {/* 2. STAV TECHNOLÓGIE */}
        {technologyState && (
          <ICard icon="⚙" title="Stav technológie" accent="#ff5c0022" confidence={technologyState.confidence} reasoning={technologyState.reasoning}>
            <FieldPair label="Typ kúrenia" value={technologyState.heatingType} valueColor="#ffaa00" />
            <FieldPair label="Vek techn."  value={technologyState.estimatedAge} />
            <FieldPair label="Stav"        value={technologyState.status}
              valueColor={technologyState.status?.includes('zastar') ? '#ff3333' : technologyState.status?.includes('modern') ? '#00cc88' : '#9ca3af'} />
            <FieldPair label="Teplá voda"  value={technologyState.hotWater}
              valueColor={technologyState.hotWater?.includes('veľmi') ? '#ff5c00' : technologyState.hotWater?.includes('vysoká') ? '#ffaa00' : '#9ca3af'} />
            {technologyState.wellness && technologyState.wellness !== 'nie' && (
              <FieldPair label="Wellness" value={technologyState.wellness} valueColor="#818cf8" />
            )}
          </ICard>
        )}

        {/* 3. MODERNIZAČNÉ SIGNÁLY */}
        {modernizationSignals && (
          <ICard icon="🔧" title="Modernizačné signály" accent="#ffaa0022" confidence={modernizationSignals.confidence}>
            {modernizationSignals.interpretation && (
              <div style={{ fontFamily: sans, fontSize: '0.67rem', color: '#9ca3af', lineHeight: 1.55, marginBottom: '0.35rem' }}>
                {modernizationSignals.interpretation}
              </div>
            )}
            {(modernizationSignals.detected || []).length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                {(modernizationSignals.detected || []).slice(0, 6).map((s, i) => (
                  <span key={i} style={{ fontFamily: mono, fontSize: '0.47rem', padding: '0.04rem 0.3rem',
                    border: '1px solid #ffaa0033', borderRadius: 2, color: '#ffaa00', background: 'rgba(255,170,0,0.07)' }}>
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ fontFamily: mono, fontSize: '0.52rem', color: '#374151', fontStyle: 'italic' }}>
                Zatiaľ žiadne priame signály modernizácie.
              </div>
            )}
          </ICard>
        )}

        {/* 4. INVESTIČNÝ PROFIL */}
        {investmentProfile && (
          <ICard icon="💼" title="Investičný profil" accent="#6366f122" confidence={investmentProfile.confidence}>
            {(() => {
              const meta = getInvestMeta(investmentProfile.type)
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{meta.icon}</span>
                    <span style={{ fontFamily: sans, fontSize: '0.75rem', fontWeight: 700, color: meta.color }}>
                      {investmentProfile.label || investmentProfile.type}
                    </span>
                  </div>
                  {investmentProfile.interpretation && (
                    <div style={{ fontFamily: sans, fontSize: '0.65rem', color: '#9ca3af', lineHeight: 1.55 }}>
                      {investmentProfile.interpretation}
                    </div>
                  )}
                </>
              )
            })()}
          </ICard>
        )}
      </div>
    </div>
  )
}

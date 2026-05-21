import { useState, useEffect } from 'react'
import { getAuth, onAuthStateChanged } from 'firebase/auth'

const mono = "'IBM Plex Mono', monospace"

const s = {
  header: {
    background: '#0a0c0f',
    borderBottom: '1px solid #1e2530',
    padding: '0',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  // ── Module switcher row (top) ──
  moduleRow: {
    display: 'flex',
    alignItems: 'stretch',
    borderBottom: '1px solid #0f1318',
    padding: '0 1.25rem',
  },
  moduleBtn: {
    fontFamily: mono,
    fontSize: '0.6rem',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    padding: '0.5rem 1rem',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  },
  // ── Nav row (bottom) ──
  navRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.7rem 1.25rem',
  },
  logo: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '1.55rem',
    letterSpacing: '3px',
    color: '#ff5c00',
    lineHeight: 1,
  },
  logoSpan: { color: '#ffaa00' },
  sub: {
    fontFamily: mono,
    fontSize: '0.52rem',
    color: '#6b7280',
    letterSpacing: '2px',
    marginTop: '0.1rem',
  },
  nav: { display: 'flex', gap: '0.5rem' },
  btn: {
    fontFamily: mono,
    fontSize: '0.63rem',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    padding: '0.28rem 0.7rem',
    border: '1px solid #1e2530',
    background: 'transparent',
    color: '#6b7280',
    borderRadius: '2px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
}

export default function Header({ view, setView, module, setModule, currentUser, division, setDivision }) {
  const [userEmail, setUserEmail] = useState(null)

  useEffect(() => {
    try {
      const auth = getAuth()
      return onAuthStateChanged(auth, u => setUserEmail(u ? (u.email || u.uid) : 'anonymous / no auth'))
    } catch {
      setUserEmail('auth unavailable')
    }
  }, [])
  const isIntelligence = module === 'intelligence'
  const isSales        = !isIntelligence

  return (
    <header style={s.header}>
      {/* ── Division switcher (Staubert only) ── */}
      {currentUser === 'Staubert' && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 1.25rem', background: '#070a0d', borderBottom: '1px solid #0f1318', gap: '0.25rem' }}>
          {['A', 'B'].map(d => (
            <button key={d} onClick={() => setDivision(d)} style={{
              fontFamily: mono, fontSize: '0.55rem', letterSpacing: '2px', textTransform: 'uppercase',
              padding: '0.3rem 0.75rem', border: 'none', background: 'transparent', cursor: 'pointer',
              borderBottom: division === d ? '2px solid #ff5c00' : '2px solid transparent',
              color: division === d ? '#ff5c00' : '#374151',
            }}>
              ODDELENIE {d}
            </button>
          ))}
        </div>
      )}

      {/* ── Module switcher ── */}
      <div style={s.moduleRow}>
        <button
          style={{
            ...s.moduleBtn,
            color:        isSales ? '#ff5c00' : '#374151',
            borderBottom: isSales ? '2px solid #ff5c00' : '2px solid transparent',
          }}
          onClick={() => setModule('sales')}>
          A — SALES OPS
        </button>
        <button
          style={{
            ...s.moduleBtn,
            color:        isIntelligence ? '#ffaa00' : '#374151',
            borderBottom: isIntelligence ? '2px solid #ffaa00' : '2px solid transparent',
          }}
          onClick={() => setModule('intelligence')}>
          B — INTELLIGENCE
          {isIntelligence && (
            <span style={{ fontFamily: mono, fontSize: '0.42rem', color: '#ff5c00', background: 'rgba(255,92,0,0.12)', border: '1px solid rgba(255,92,0,0.3)', padding: '0.05rem 0.3rem', borderRadius: 2, marginLeft: '0.4rem', letterSpacing: '1px' }}>
              BETA
            </span>
          )}
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: mono, fontSize: '0.48rem', color: '#374151', alignSelf: 'center', letterSpacing: '0.5px' }}>
          Logged in as: <span style={{ color: '#6b7280' }}>{userEmail ?? '…'}</span>
        </div>
      </div>

      {/* ── Logo + nav (only in SALES module) ── */}
      {isSales && (
        <div style={s.navRow}>
          <div>
            <div style={s.logo}>STRIKER <span style={s.logoSpan}>AI</span></div>
            <div style={s.sub}>Sales Intelligence Platform</div>
          </div>
          <nav className="header-nav" style={s.nav}>
            <button
              style={{ ...s.btn, ...(view === 'dashboard' ? { borderColor: '#ff5c00', color: '#ff5c00' } : {}) }}
              onClick={() => setView('dashboard')}>
              Dashboard
            </button>
            <button
              style={{ ...s.btn, ...(view === 'search' ? { borderColor: '#ffaa00', color: '#ffaa00' } : {}) }}
              onClick={() => setView('search')}>
              + Hľadať firmy
            </button>
          </nav>
        </div>
      )}

      {/* ── Intelligence module compact header ── */}
      {isIntelligence && (
        <div style={{ ...s.navRow, paddingTop: '0.55rem', paddingBottom: '0.55rem' }}>
          <div>
            <div style={s.logo}>STRIKER <span style={{ color: '#ffaa00' }}>INTELLIGENCE</span></div>
            <div style={{ ...s.sub, color: '#ff5c0066' }}>AI Lead Scoring · Pain Signal Detection · Intent Engine</div>
          </div>
          <div style={{ fontFamily: mono, fontSize: '0.52rem', color: '#374151', border: '1px solid #1e2530', padding: '0.25rem 0.6rem', borderRadius: 2 }}>
            DEMO MODE · Fáza 1
          </div>
        </div>
      )}
    </header>
  )
}

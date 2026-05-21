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

export default function Header({ view, setView, currentUser, division, setDivision }) {
  const [userEmail, setUserEmail] = useState(null)

  useEffect(() => {
    try {
      const auth = getAuth()
      return onAuthStateChanged(auth, u => setUserEmail(u ? (u.email || u.uid) : null))
    } catch {
      setUserEmail(null)
    }
  }, [])

  const isB = division === 'B'

  function switchDivision(d) {
    setDivision(d)
    setView('dashboard')
  }

  return (
    <header style={s.header}>

      {/* Prepínač oddelení — iba Staubert */}
      {currentUser === 'Staubert' && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 1.25rem', background: '#070a0d', borderBottom: '1px solid #0f1318', gap: '0.25rem' }}>
          {['A', 'B'].map(d => (
            <button key={d} onClick={() => switchDivision(d)} style={{
              fontFamily: mono, fontSize: '0.55rem', letterSpacing: '2px', textTransform: 'uppercase',
              padding: '0.3rem 0.75rem', border: 'none', background: 'transparent', cursor: 'pointer',
              borderBottom: division === d ? '2px solid #ff5c00' : '2px solid transparent',
              color: division === d ? '#ff5c00' : '#374151',
            }}>
              ODDELENIE {d}
            </button>
          ))}
          {userEmail && (
            <div style={{ marginLeft: 'auto', fontFamily: mono, fontSize: '0.46rem', color: '#374151', letterSpacing: '0.5px' }}>
              {userEmail}
            </div>
          )}
        </div>
      )}

      {/* Logo + navigácia podľa aktívneho oddelenia */}
      <div style={s.navRow}>
        <div>
          {isB ? (
            <>
              <div style={{ ...s.logo, fontSize: '1.4rem' }}>
                STRIKER <span style={{ color: '#ffaa00' }}>INTELLIGENCE</span>
              </div>
              <div style={{ ...s.sub, color: '#ff5c0066' }}>Energy Target Acquisition AI</div>
            </>
          ) : (
            <>
              <div style={s.logo}>STRIKER <span style={{ color: '#ffaa00' }}>AI</span></div>
              <div style={s.sub}>Sales Intelligence Platform</div>
            </>
          )}
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
            {isB ? '+ Pridať target' : '+ Hľadať firmy'}
          </button>
        </nav>
      </div>
    </header>
  )
}

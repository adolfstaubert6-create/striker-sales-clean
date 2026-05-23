import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth'
import { useState, useEffect } from 'react'

const mono = "'IBM Plex Mono', monospace"

const btn = {
  fontFamily: mono, fontSize: '0.63rem', letterSpacing: '1px',
  textTransform: 'uppercase', padding: '0.28rem 0.7rem',
  border: '1px solid #1e2530', background: 'transparent',
  borderRadius: '2px', cursor: 'pointer', transition: 'all 0.15s',
}

export default function Header({ view, setView, currentUser, division, setDivision, onBack }) {
  const [userEmail, setUserEmail] = useState(null)

  useEffect(() => {
    try {
      const auth = getAuth()
      return onAuthStateChanged(auth, u => setUserEmail(u ? (u.email || u.uid) : null))
    } catch { setUserEmail(null) }
  }, [])

  return (
    <header style={{ background: '#0a0c0f', borderBottom: '1px solid #1e2530', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 1.25rem' }}>

        {/* Ľavá strana: logo + division switcher (ak Staubert) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.55rem', letterSpacing: '3px', color: '#ff5c00', lineHeight: 1 }}>
              STRIKER <span style={{ color: '#ffaa00' }}>AI</span>
            </div>
            <div style={{ fontFamily: mono, fontSize: '0.52rem', color: '#6b7280', letterSpacing: '2px', marginTop: '0.1rem' }}>
              Sales Intelligence Platform
            </div>
          </div>

          {/* Back to dashboard — B section */}
          {onBack && (
            <button
              onClick={onBack}
              style={{
                fontFamily: mono, fontSize: '0.56rem', letterSpacing: '1.5px',
                textTransform: 'uppercase', padding: '0.3rem 0.9rem',
                border: '1px solid #ff5c0055', background: 'rgba(255,92,0,0.07)',
                color: '#ff5c00', borderRadius: '2px', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,92,0,0.14)'; e.currentTarget.style.boxShadow = '0 0 10px rgba(255,92,0,0.2)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,92,0,0.07)'; e.currentTarget.style.boxShadow = 'none' }}
            >
              ← Späť do Dashboardu
            </button>
          )}

          {/* Prepínač — iba Staubert, inline s logom */}
          {currentUser === 'Staubert' && (
            <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center', borderLeft: '1px solid #1e2530', paddingLeft: '1.25rem' }}>
              {['A', 'B'].map(d => (
                <button key={d} onClick={() => setDivision(d)} style={{
                  fontFamily: mono, fontSize: '0.55rem', letterSpacing: '2px', textTransform: 'uppercase',
                  padding: '0.22rem 0.65rem', border: '1px solid',
                  borderColor: division === d ? '#ff5c00' : '#1e2530',
                  background: division === d ? 'rgba(255,92,0,0.08)' : 'transparent',
                  color: division === d ? '#ff5c00' : '#374151',
                  borderRadius: '2px', cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pravá strana: nav tlačidlá */}
        <nav style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            style={{ ...btn, ...(view === 'dashboard' ? { borderColor: '#ff5c00', color: '#ff5c00' } : { color: '#6b7280' }) }}
            onClick={() => setView('dashboard')}>
            Dashboard
          </button>
          <button
            style={{ ...btn, ...(view === 'search' ? { borderColor: '#ffaa00', color: '#ffaa00' } : { color: '#6b7280' }) }}
            onClick={() => setView('search')}>
            + Hľadať firmy
          </button>
          {userEmail && (
            <span style={{ fontFamily: mono, fontSize: '0.48rem', color: '#374151', marginLeft: '0.5rem' }}>
              {userEmail}
            </span>
          )}
          <button
            onClick={() => signOut(getAuth())}
            style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.22rem 0.6rem', border: '1px solid #1e2530', background: 'transparent', color: '#374151', borderRadius: '2px', cursor: 'pointer', marginLeft: '0.5rem' }}
            title="Odhlásiť sa">
            ⎋ Logout
          </button>
        </nav>
      </div>
    </header>
  )
}

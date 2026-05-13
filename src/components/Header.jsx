const s = {
  header: {
    background: '#0a0c0f',
    borderBottom: '1px solid #1e2530',
    padding: '0.9rem 1.25rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  logo: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '1.6rem',
    letterSpacing: '3px',
    color: '#ff5c00',
    lineHeight: 1,
  },
  logoSpan: { color: '#ffaa00' },
  sub: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.58rem',
    color: '#6b7280',
    letterSpacing: '2px',
    marginTop: '0.1rem',
  },
  nav: { display: 'flex', gap: '0.5rem' },
  btn: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '0.65rem',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    padding: '0.3rem 0.75rem',
    border: '1px solid #1e2530',
    background: 'transparent',
    color: '#6b7280',
    borderRadius: '2px',
    transition: 'all 0.15s',
  },
}

export default function Header({ view, setView }) {
  return (
    <header style={s.header}>
      <div>
        <div style={s.logo}>STRIKER <span style={s.logoSpan}>AI</span></div>
        <div style={s.sub}>Sales Intelligence Platform</div>
      </div>
      <nav className="header-nav" style={s.nav}>
        <button
          style={{ ...s.btn, ...(view === 'dashboard' ? { borderColor: '#ff5c00', color: '#ff5c00' } : {}) }}
          onClick={() => setView('dashboard')}
        >
          Dashboard
        </button>
        <button
          style={{ ...s.btn, ...(view === 'search' ? { borderColor: '#ffaa00', color: '#ffaa00' } : {}) }}
          onClick={() => setView('search')}
        >
          + Hľadať firmy
        </button>
      </nav>
    </header>
  )
}

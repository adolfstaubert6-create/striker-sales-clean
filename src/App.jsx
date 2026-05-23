import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth }        from './firebase.js'
import Header          from './components/Header.jsx'
import SearchPanel     from './components/SearchPanel.jsx'
import Dashboard       from './components/Dashboard.jsx'
import DashboardB      from './components/DashboardB.jsx'
import LoginScreen     from './components/LoginScreen.jsx'
import { seedKnowledgeBase } from './services/firebaseService.js'

// Firebase Auth email → app username
const EMAIL_TO_USER = {
  'adolf@striker.local': 'Staubert',
  'sabo@striker.local':  'Szabo',
}

export default function App() {
  const [view,        setView]      = useState('dashboard')
  const [division,    setDivision]  = useState('A')
  const [currentUser, setCurrentUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [searchResults, setSearchResults] = useState([])
  const [searching,     setSearching]     = useState(false)

  useEffect(() => {
    // Jediný auth guard — Firebase overuje session so serverom
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Mapuj Firebase email na app username
        const username = EMAIL_TO_USER[firebaseUser.email] || firebaseUser.displayName || null
        setCurrentUser(username)
        if (username) {
          seedKnowledgeBase().catch(err => console.warn('[seed]', err.message))
        }
      } else {
        // Žiadna Firebase session → nulový prístup
        setCurrentUser(null)
      }
      setAuthLoading(false)
    })
    return unsub
  }, [])

  // Počas overovania session nezobraz nič (zabráni flash obsahu)
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0c0f' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#374151' }}>
          Overujem session...
        </div>
      </div>
    )
  }

  // Firebase nepotvrdila session → login screen
  if (!currentUser) return <LoginScreen />

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        view={view}
        setView={setView}
        currentUser={currentUser}
        division={division}
        setDivision={d => { setDivision(d); setView('dashboard') }}
      />
      <main className="app-main" style={{ flex: 1 }}>
        {division === 'B' ? (
          <div style={{ padding: '1.25rem', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
            <DashboardB onBack={() => { setDivision('A'); setView('dashboard') }} />
          </div>
        ) : view === 'search' ? (
          <SearchPanel
            onResults={setSearchResults}
            searching={searching}
            setSearching={setSearching}
            division="A"
          />
        ) : (
          <div style={{ padding: '1.25rem', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
            <Dashboard division="A" />
          </div>
        )}
      </main>
    </div>
  )
}

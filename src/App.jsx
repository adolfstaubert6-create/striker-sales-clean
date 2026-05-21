import { useState, useEffect } from 'react'
import Header from './components/Header.jsx'
import SearchPanel from './components/SearchPanel.jsx'
import Dashboard from './components/Dashboard.jsx'
import IntelligenceDashboard from './components/IntelligenceDashboard.jsx'
import EnergyTargetPanel from './components/EnergyTargetPanel.jsx'
import LoginScreen from './components/LoginScreen.jsx'
import { seedKnowledgeBase } from './services/firebaseService.js'

const VALID_USERS = { Staubert: true, Szabo: true }

export default function App() {
  const [module,        setModule]        = useState('sales')
  const [view,          setView]          = useState('dashboard')
  const [searchResults, setSearchResults] = useState([])
  const [searching,     setSearching]     = useState(false)
  const [division,      setDivision]      = useState('A')
  const [currentUser,   setCurrentUser]   = useState(() => {
    const saved = localStorage.getItem('striker-user')
    return (saved && VALID_USERS[saved]) ? saved : null
  })

  useEffect(() => {
    if (currentUser) seedKnowledgeBase().catch(err => console.warn('[seed]', err.message))
  }, [currentUser])

  function handleLogin(name) {
    localStorage.setItem('striker-user', name)
    setCurrentUser(name)
  }

  if (!currentUser) return <LoginScreen onLogin={handleLogin} />

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        view={view}
        setView={setView}
        module={module}
        setModule={setModule}
        currentUser={currentUser}
        division={division}
        setDivision={setDivision}
      />

      <main className="app-main" style={{ flex: 1 }}>
        {module === 'intelligence' ? (
          division === 'B'
            ? <EnergyTargetPanel />
            : <IntelligenceDashboard />
        ) : view === 'search' ? (
          <SearchPanel
            onResults={setSearchResults}
            searching={searching}
            setSearching={setSearching}
            division={division}
            style={{ padding: '1.25rem', maxWidth: 1100, margin: '0 auto', width: '100%' }}
          />
        ) : (
          <div style={{ padding: '1.25rem', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
            <Dashboard division={division} />
          </div>
        )}
      </main>
    </div>
  )
}

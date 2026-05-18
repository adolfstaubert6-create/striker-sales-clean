import { useState, useEffect } from 'react'
import Header from './components/Header.jsx'
import SearchPanel from './components/SearchPanel.jsx'
import Dashboard from './components/Dashboard.jsx'
import IntelligenceDashboard from './components/IntelligenceDashboard.jsx'
import { seedKnowledgeBase } from './services/firebaseService.js'

export default function App() {
  const [module,        setModule]        = useState('sales')       // 'sales' | 'intelligence'
  const [view,          setView]          = useState('dashboard')
  const [searchResults, setSearchResults] = useState([])
  const [searching,     setSearching]     = useState(false)

  useEffect(() => {
    seedKnowledgeBase().catch(err => console.warn('[seed]', err.message))
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        view={view}
        setView={setView}
        module={module}
        setModule={setModule}
      />

      <main className="app-main" style={{ flex: 1 }}>
        {module === 'intelligence' ? (
          <IntelligenceDashboard />
        ) : view === 'search' ? (
          <SearchPanel
            onResults={setSearchResults}
            searching={searching}
            setSearching={setSearching}
            style={{ padding: '1.25rem', maxWidth: 1100, margin: '0 auto', width: '100%' }}
          />
        ) : (
          <div style={{ padding: '1.25rem', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
            <Dashboard />
          </div>
        )}
      </main>
    </div>
  )
}

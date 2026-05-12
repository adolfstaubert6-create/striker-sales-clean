import { useState } from 'react'
import Header from './components/Header.jsx'
import SearchPanel from './components/SearchPanel.jsx'
import Dashboard from './components/Dashboard.jsx'

export default function App() {
  const [view, setView] = useState('dashboard') // 'dashboard' | 'search'
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header view={view} setView={setView} />
      <main style={{ flex: 1, padding: '1.25rem', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        {view === 'search' ? (
          <SearchPanel
            onResults={setSearchResults}
            searching={searching}
            setSearching={setSearching}
          />
        ) : (
          <Dashboard />
        )}
      </main>
    </div>
  )
}

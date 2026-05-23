// Vizuálny klon Dashboard.jsx — rovnaké CSS a layout, B-specific komponenty
import { useState, useEffect } from 'react'
import { db } from '../firebase.js'
import { doc, deleteDoc } from 'firebase/firestore'
import { INTEL_STATUS_LIST } from '../constants/intelMeta.js'
import { subscribeTargets } from '../services/intelTargetService.js'
import IntelSummaryPanel  from './IntelSummaryPanel.jsx'
import IntelAgentPanel    from './IntelAgentPanel.jsx'
import IntelTargetCard    from './IntelTargetCard.jsx'
import IntelCompanyDetail          from './IntelCompanyDetail.jsx'
import ClientIntelligenceDashboard from './ClientIntelligenceDashboard.jsx'

const mono = "'IBM Plex Mono',monospace"

const FILTERS = [{ key: 'all', label: 'Všetky' }, ...INTEL_STATUS_LIST.map(s => ({ key: s.key, label: s.label }))]

export default function DashboardB({ onBack }) {
  const [targets, setTargets]           = useState([])
  const [filter, setFilter]             = useState('all')
  const [search, setSearch]             = useState('')
  const [selected, setSelected]         = useState(null)  // { target, tab }

  function openDetail(target, tab = 'overview') { setSelected({ target, tab }) }
  function closeDetail() { setSelected(null) }
  const [checkedIds, setCheckedIds]     = useState(new Set())
  const [confirmDelete,    setConfirmDelete]    = useState(false)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const [deleting, setDeleting]         = useState(false)

  useEffect(() => subscribeTargets(setTargets), [])

  useEffect(() => {
    if (!selected) return
    const fresh = targets.find(t => t.id === selected.target?.id)
    if (fresh) setSelected(s => ({ ...s, target: fresh }))
  }, [targets])

  const filtered = targets.filter(t => {
    if (filter !== 'all' && t.status !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return t.name?.toLowerCase().includes(q) || t.city?.toLowerCase().includes(q)
    }
    return true
  })

  function toggleCheck(id) {
    setCheckedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleDeleteSelected() {
    setDeleting(true)
    try {
      await Promise.all([...checkedIds].map(id => deleteDoc(doc(db, 'intelligence_targets', id))))
      setCheckedIds(new Set()); setConfirmDelete(false)
    } catch (e) { alert('Chyba: ' + e.message) }
    finally { setDeleting(false) }
  }

  async function handleDeleteAll() {
    setDeleting(true)
    try {
      await Promise.all(filtered.map(t => deleteDoc(doc(db, 'intelligence_targets', t.id))))
      setCheckedIds(new Set()); setConfirmDeleteAll(false)
    } catch (e) { alert('Chyba: ' + e.message) }
    finally { setDeleting(false) }
  }

  return (
    <div>
      {/* Back to main dashboard */}
      {onBack && (
        <button
          onClick={onBack}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
            fontFamily: mono, fontSize: '0.54rem', letterSpacing: '1.5px',
            textTransform: 'uppercase', color: '#6b7280',
            background: 'transparent', border: '1px solid #1a1f2a',
            borderRadius: 3, padding: '0.32rem 0.85rem',
            cursor: 'pointer', marginBottom: '1.1rem',
            transition: 'color 0.15s, border-color 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ff5c00'; e.currentTarget.style.borderColor = '#ff5c0055'; e.currentTarget.style.boxShadow = '0 0 8px #ff5c0022' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = '#1a1f2a'; e.currentTarget.style.boxShadow = 'none' }}
        >
          ← Späť do Dashboardu
        </button>
      )}

      {/* 1. IntelSummaryPanel — rovnaká pozícia ako AiSummaryPanel */}
      <IntelSummaryPanel targets={targets} />

      {/* 2. IntelAgentPanel — rovnaká pozícia ako AgentPanel */}
      <IntelAgentPanel
        onDone={() => {}}
        onAdded={newTarget => openDetail(newTarget, 'overview')}
      />

      {/* 3. Toolbar — identická štruktúra ako Dashboard toolbar */}
      <div className="dashboard-toolbar" style={css.toolbar}>
        {checkedIds.size > 0 && (
          <button style={css.deleteBtn} onClick={() => setConfirmDelete(true)}>
            🗑 Vymazať vybrané ({checkedIds.size})
          </button>
        )}
        {filtered.length > 0 && (
          <button style={css.deleteBtn} onClick={() => setConfirmDeleteAll(true)}>
            🗑 Vymazať všetky ({filtered.length})
          </button>
        )}
        {FILTERS.map(f => (
          <button key={f.key}
            style={{ ...css.fbtn, ...(filter === f.key ? css.fbtnOn : {}) }}
            onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
        <input style={css.search} placeholder="Hľadať firmu alebo mesto..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* 4. Count — identický */}
      {filtered.length > 0 && (
        <div style={css.count}>{filtered.length} targetov</div>
      )}

      {/* 5. Karty — identický layout ako Dashboard (checkbox + karta) */}
      {filtered.length === 0 ? (
        <div style={css.empty}>
          {targets.length === 0
            ? '→ Pridaj firmy cez Intelligence Agent alebo "+ Pridať target" v hlavičke'
            : 'Žiadne výsledky pre daný filter'}
        </div>
      ) : (
        filtered.map(t => (
          <IntelTargetCard
            key={t.id}
            target={t}
            checked={checkedIds.has(t.id)}
            onCheck={() => toggleCheck(t.id)}
            onOpen={(target, tab) => openDetail(target, tab)}
          />
        ))
      )}

      {/* 6. Client Intelligence Dashboard — full-page cockpit */}
      {selected && (
        <ClientIntelligenceDashboard
          target={selected.target}
          onClose={closeDetail}
          onDelete={closeDetail}
        />
      )}

      {/* Confirm vymazať vybrané */}
      {confirmDelete && (
        <div style={css.overlay} onClick={e => e.target === e.currentTarget && setConfirmDelete(false)}>
          <div style={{ ...css.modal, maxWidth: 380 }}>
            <div style={{ ...css.mhead, flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem' }}>
              <span style={css.mtitle}>⚠ Potvrdiť vymazanie</span>
              <span style={{ fontFamily: mono, fontSize: '0.88rem', color: '#e8eaed' }}>Naozaj vymazať {checkedIds.size} target{checkedIds.size > 1 ? 'y' : ''}?</span>
              <span style={{ fontFamily: mono, fontSize: '0.62rem', color: '#ef4444' }}>Táto akcia je nevratná.</span>
            </div>
            <div style={{ ...css.mbtns, marginTop: '1rem' }}>
              <button style={{ ...css.mbtnOk, background: '#ef4444', opacity: deleting ? 0.6 : 1 }} onClick={handleDeleteSelected} disabled={deleting}>
                {deleting ? '⏳ Mažem...' : `🗑 Vymazať (${checkedIds.size})`}
              </button>
              <button style={css.mbtnCancel} onClick={() => setConfirmDelete(false)}>Zrušiť</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm vymazať všetky */}
      {confirmDeleteAll && (
        <div style={css.overlay} onClick={e => e.target === e.currentTarget && setConfirmDeleteAll(false)}>
          <div style={{ ...css.modal, maxWidth: 420 }}>
            <div style={{ ...css.mhead, flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem' }}>
              <span style={css.mtitle}>⚠ Vymazať všetky targety</span>
              <span style={{ fontFamily: mono, fontSize: '0.88rem', color: '#e8eaed' }}>Naozaj vymazať VŠETKÝCH {filtered.length} targetov?</span>
              <span style={{ fontFamily: mono, fontSize: '0.62rem', color: '#ef4444' }}>Táto akcia je nevratná.</span>
            </div>
            <div style={{ ...css.mbtns, marginTop: '1rem' }}>
              <button style={{ ...css.mbtnOk, background: '#ef4444', opacity: deleting ? 0.6 : 1 }} onClick={handleDeleteAll} disabled={deleting}>
                {deleting ? '⏳ Mažem...' : `🗑 Vymazať všetkých (${filtered.length})`}
              </button>
              <button style={css.mbtnCancel} onClick={() => setConfirmDeleteAll(false)}>Zrušiť</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Identické CSS ako Dashboard.jsx
const css = {
  toolbar:    { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'center' },
  deleteBtn:  { fontFamily: mono, fontSize: '0.63rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.75rem', border: '1px solid #ef444466', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 2, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' },
  fbtn:       { fontFamily: mono, fontSize: '0.63rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.65rem', border: '1px solid #1e2530', background: 'transparent', color: '#6b7280', borderRadius: 2, cursor: 'pointer' },
  fbtnOn:     { borderColor: '#ff5c00', color: '#ff5c00' },
  search:     { flex: 1, minWidth: 180, background: '#111418', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: mono, fontSize: '0.72rem', padding: '0.28rem 0.6rem', borderRadius: 2, outline: 'none' },
  count:      { fontFamily: mono, fontSize: '0.58rem', color: '#6b7280', letterSpacing: '1px', marginBottom: '0.6rem' },
  empty:      { textAlign: 'center', padding: '3.5rem', fontFamily: mono, fontSize: '0.75rem', color: '#6b7280', lineHeight: 2 },
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' },
  modal:      { background: '#111418', border: '1px solid #1e2530', borderRadius: 4, padding: '1.5rem', width: '100%', maxHeight: '90vh', overflowY: 'auto' },
  mhead:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  mtitle:     { fontFamily: mono, fontSize: '0.62rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#6b7280' },
  mbtns:      { display: 'flex', gap: '0.5rem' },
  mbtnOk:     { flex: 1, border: 'none', color: 'white', fontFamily: mono, fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.45rem', borderRadius: 2, fontWeight: 700, cursor: 'pointer' },
  mbtnCancel: { background: 'transparent', border: '1px solid #1e2530', color: '#6b7280', fontFamily: mono, fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.45rem 0.9rem', borderRadius: 2, cursor: 'pointer' },
}

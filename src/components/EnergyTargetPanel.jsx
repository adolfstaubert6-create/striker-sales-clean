import { useState, useEffect } from 'react'
import { db } from '../firebase.js'
import { doc, deleteDoc } from 'firebase/firestore'
import { INTEL_STATUSES } from '../constants/intelMeta.js'
import { subscribeTargets } from '../services/intelTargetService.js'
import IntelSummaryPanel  from './IntelSummaryPanel.jsx'
import IntelAgentPanel    from './IntelAgentPanel.jsx'
import IntelTargetCard    from './IntelTargetCard.jsx'
import IntelCompanyDetail from './IntelCompanyDetail.jsx'

const mono = "'IBM Plex Mono', monospace"

export default function EnergyTargetPanel({ view = 'dashboard', setView }) {
  const [targets, setTargets]         = useState([])
  const [filter, setFilter]           = useState('all')      // rovnaký názov ako v Dashboard
  const [search, setSearch]           = useState('')         // rovnaký názov ako v Dashboard
  const [selected, setSelected]       = useState(null)
  const [checkedIds, setCheckedIds]   = useState(new Set())  // rovnaký vzor ako v Dashboard
  const [confirmDelete,    setConfirmDelete]    = useState(false)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const [deleting, setDeleting]       = useState(false)

  useEffect(() => subscribeTargets(setTargets), [])

  // Udržiavaj selected v sync s live dátami
  useEffect(() => {
    if (!selected) return
    const fresh = targets.find(t => t.id === selected.id)
    if (fresh) setSelected(fresh)
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
      setCheckedIds(new Set())
      setConfirmDelete(false)
    } catch (e) {
      alert('Chyba vymazania: ' + e.message)
    } finally {
      setDeleting(false)
    }
  }

  async function handleDeleteAll() {
    setDeleting(true)
    try {
      await Promise.all(filtered.map(t => deleteDoc(doc(db, 'intelligence_targets', t.id))))
      setCheckedIds(new Set())
      setConfirmDeleteAll(false)
    } catch (e) {
      alert('Chyba vymazania: ' + e.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={{ padding: '1.25rem', maxWidth: 1100, margin: '0 auto', width: '100%' }}>

      {/* IntelSummaryPanel — rovnaký vzor ako AiSummaryPanel v Dashboard */}
      <IntelSummaryPanel targets={targets} />

      {/* IntelAgentPanel — rovnaký vzor ako AgentPanel v Dashboard */}
      <IntelAgentPanel
        onDone={() => {}}
        onAdded={newTarget => setSelected(newTarget)}
      />

      {/* Toolbar — rovnaká štruktúra ako Dashboard toolbar */}
      <div className="dashboard-toolbar" style={css.toolbar}>
        <button style={css.addBtn} onClick={() => setView?.('search')}>+ Pridať target</button>

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

        {/* Status filtre */}
        {[{ key: 'all', label: 'Všetky' }, ...INTEL_STATUSES].map(f => (
          <button key={f.key}
            style={{ ...css.fbtn, ...(filter === f.key ? css.fbtnOn : {}) }}
            onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}

        <input
          style={css.search}
          placeholder="Hľadať firmu alebo mesto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Count */}
      {filtered.length > 0 && (
        <div style={css.count}>{filtered.length} targetov</div>
      )}

      {/* Prázdny stav — rovnaký vzor ako Dashboard (dve správy) */}
      {filtered.length === 0 ? (
        <div style={css.empty}>
          {targets.length === 0
            ? '→ Pridaj firmy cez "+ Pridať target" v hlavičke'
            : 'Žiadne výsledky pre daný filter'}
        </div>
      ) : (
        /* Karta list — rovnaký vzor ako Dashboard */
        filtered.map(t => (
          <IntelTargetCard
            key={t.id}
            target={t}
            checked={checkedIds.has(t.id)}
            onCheck={() => toggleCheck(t.id)}
            onOpen={() => setSelected(t)}
            onGather={t.web ? () => setSelected(t) : null}
          />
        ))
      )}

      {/* Detail modal — rovnaký vzor ako CompanyDetailModal v Dashboard */}
      {selected && (
        <IntelCompanyDetail
          target={selected}
          onClose={() => setSelected(null)}
          onDelete={() => setSelected(null)}
        />
      )}

      {/* Confirm: vymazať vybrané */}
      {confirmDelete && (
        <div style={css.overlay} onClick={e => e.target === e.currentTarget && setConfirmDelete(false)}>
          <div style={{ ...css.modal, maxWidth: 380 }}>
            <div style={{ ...css.mhead, flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem' }}>
              <span style={css.mtitle}>⚠ Potvrdiť vymazanie</span>
              <span style={{ fontFamily: mono, fontSize: '0.88rem', color: '#e8eaed' }}>
                Naozaj vymazať {checkedIds.size} target{checkedIds.size > 1 ? 'y' : ''}?
              </span>
              <span style={{ fontFamily: mono, fontSize: '0.62rem', color: '#ef4444' }}>Táto akcia je nevratná.</span>
            </div>
            <div style={{ ...css.mbtns, marginTop: '1rem' }}>
              <button style={{ ...css.mbtnOk, background: '#ef4444', opacity: deleting ? 0.6 : 1 }}
                onClick={handleDeleteSelected} disabled={deleting}>
                {deleting ? '⏳ Mažem...' : `🗑 Vymazať (${checkedIds.size})`}
              </button>
              <button style={css.mbtnCancel} onClick={() => setConfirmDelete(false)}>Zrušiť</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm: vymazať všetky */}
      {confirmDeleteAll && (
        <div style={css.overlay} onClick={e => e.target === e.currentTarget && setConfirmDeleteAll(false)}>
          <div style={{ ...css.modal, maxWidth: 420 }}>
            <div style={{ ...css.mhead, flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem' }}>
              <span style={css.mtitle}>⚠ Vymazať všetky targety</span>
              <span style={{ fontFamily: mono, fontSize: '0.88rem', color: '#e8eaed' }}>
                Naozaj vymazať VŠETKÝCH {filtered.length} targetov?
              </span>
              <span style={{ fontFamily: mono, fontSize: '0.62rem', color: '#ef4444' }}>Táto akcia je nevratná.</span>
            </div>
            <div style={{ ...css.mbtns, marginTop: '1rem' }}>
              <button style={{ ...css.mbtnOk, background: '#ef4444', opacity: deleting ? 0.6 : 1 }}
                onClick={handleDeleteAll} disabled={deleting}>
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

const css = {
  toolbar:    { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'center' },
  addBtn:     { fontFamily: mono, fontSize: '0.63rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.75rem', border: '1px solid #00cc8855', background: 'rgba(0,204,136,0.08)', color: '#00cc88', borderRadius: 2, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' },
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

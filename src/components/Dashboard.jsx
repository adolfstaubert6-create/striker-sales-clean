import { useState, useEffect } from 'react'
import { db } from '../firebase.js'
import { doc, updateDoc, addDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore'
import { subscribeCompanies, updateCompanyScore, saveDraft } from '../services/firebaseService.js'
import { scoreCompany } from '../services/aiScoringService.js'
import { generateEmailDraft } from '../services/emailService.js'
import { STATUS_LIST } from '../constants/companyStatuses.js'
import CompanyCard from './CompanyCard.jsx'
import AiSummaryPanel from './AiSummaryPanel.jsx'
import CompanyDetailModal from './CompanyDetailModal.jsx'
import AgentPanel from './AgentPanel.jsx'

const FILTERS = [{ key: 'all', label: 'Všetky' }, ...STATUS_LIST.map(s => ({ key: s.key, label: s.label }))]

export default function Dashboard() {
  const [companies, setCompanies]   = useState([])
  const [filter, setFilter]         = useState('all')
  const [search, setSearch]         = useState('')
  const [scoring, setScoring]       = useState({})
  const [draft, setDraft]           = useState(null)
  const [saving, setSaving]         = useState(false)
  const [selected, setSelected]     = useState(null)

  useEffect(() => subscribeCompanies(setCompanies), [])

  // Keep selected in sync with live data
  useEffect(() => {
    if (!selected) return
    const fresh = companies.find(c => c.id === selected.id)
    if (fresh) setSelected(fresh)
  }, [companies])

  const filtered = companies.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return c.name?.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q)
    }
    return true
  })

  async function handleScore(company) {
    setScoring(p => ({ ...p, [company.id]: true }))
    try {
      const res = await scoreCompany(company)
      await updateCompanyScore(company.id, res.score, res.reason, res)
    } catch (e) {
      alert('Chyba skórovania: ' + e.message)
    } finally {
      setScoring(p => ({ ...p, [company.id]: false }))
    }
  }

  function openDraft(company) {
    const { subject, body } = generateEmailDraft(company)
    setDraft({ company, subject, body })
  }

  async function handleSaveDraft() {
    setSaving(true)
    try {
      await saveDraft(draft.company.id, draft.company.name, draft.subject, draft.body)
      setDraft(null)
    } catch (e) {
      alert('Chyba: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(companyId, newStatus) {
    try {
      await updateDoc(doc(db, 'companies', companyId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      })
    } catch (e) {
      alert('Chyba zmeny statusu: ' + e.message)
    }
  }

  async function handleSaveNote(companyId, notes) {
    try {
      await updateDoc(doc(db, 'companies', companyId), {
        notes,
        updatedAt: serverTimestamp(),
      })
    } catch (e) {
      alert('Chyba ukladania poznámok: ' + e.message)
    }
  }

  async function handleCreateTask(companyId, title) {
    try {
      const { addDoc, collection } = await import('firebase/firestore')
      await addDoc(collection(db, 'tasks'), {
        companyId,
        title,
        status: 'open',
        createdAt: serverTimestamp(),
      })
    } catch (e) {
      alert('Chyba vytvorenia úlohy: ' + e.message)
    }
  }

  const [checkedIds,       setCheckedIds]       = useState(new Set())
  const [confirmDelete,    setConfirmDelete]    = useState(false)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const [deleting,         setDeleting]         = useState(false)

  function toggleCheck(id) {
    setCheckedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleDeleteAll() {
    setDeleting(true)
    try {
      await Promise.all(filtered.map(c => deleteDoc(doc(db, 'companies', c.id))))
      setCheckedIds(new Set())
      setConfirmDeleteAll(false)
    } catch (e) {
      alert('Chyba vymazania: ' + e.message)
    } finally {
      setDeleting(false)
    }
  }

  async function handleDeleteSelected() {
    setDeleting(true)
    try {
      await Promise.all([...checkedIds].map(id => deleteDoc(doc(db, 'companies', id))))
      setCheckedIds(new Set())
      setConfirmDelete(false)
    } catch (e) {
      alert('Chyba vymazania: ' + e.message)
    } finally {
      setDeleting(false)
    }
  }

  const [gmailChecking, setGmailChecking] = useState(false)
  const [gmailResult,   setGmailResult]   = useState(null)

  async function handleGmailCheck() {
    setGmailChecking(true)
    setGmailResult(null)
    try {
      const res  = await fetch('/.netlify/functions/gmail-check', { method: 'POST' })
      const data = await res.json()
      setGmailResult(data)
    } catch (e) {
      setGmailResult({ ok: false, error: e.message })
    } finally {
      setGmailChecking(false)
    }
  }

  const [addOpen, setAddOpen]   = useState(false)
  const [addForm, setAddForm]   = useState({ name: '', email: '', phone: '', website: '', city: '', category: 'hotel' })
  const [addSaving, setAddSaving] = useState(false)

  function setField(k, v) { setAddForm(f => ({ ...f, [k]: v })) }

  async function handleAddContact() {
    if (!addForm.name.trim()) return
    setAddSaving(true)
    try {
      await addDoc(collection(db, 'companies'), {
        name:      addForm.name.trim(),
        email:     addForm.email.trim(),
        phone:     addForm.phone.trim(),
        website:   addForm.website.trim(),
        city:      addForm.city.trim(),
        category:  addForm.category,
        status:    'new',
        createdAt: serverTimestamp(),
      })
      setAddForm({ name: '', email: '', phone: '', website: '', city: '', category: 'hotel' })
      setAddOpen(false)
    } catch (e) {
      alert('Chyba: ' + e.message)
    } finally {
      setAddSaving(false)
    }
  }

  const [seeded, setSeeded] = useState(false)

  async function handleSeedTestCompany() {
    setSeeded('saving')
    try {
      await addDoc(collection(db, 'companies'), {
        name: 'TEST - Adolf Staubert',
        email: 'adolfstaubert6@gmail.com',
        phone: '+49 171 4758126',
        website: 'striker-energy.de',
        city: 'Biblis',
        address: 'Heinrich-Hertz-Straße 4, 68647 Biblis',
        category: 'hotel',
        status: 'new',
        rating: 5,
        aiScore: 90,
        aiReason: 'Testovací kontakt pre overenie email workflow',
        createdAt: serverTimestamp(),
      })
      setSeeded('done')
    } catch (e) {
      alert('Seed error: ' + e.message)
      setSeeded(false)
    }
  }

  function handleGenerateEmail(company) {
    const { subject, body } = generateEmailDraft(company)
    setDraft({ company, subject, body })
  }

  return (
    <div>
      <AiSummaryPanel companies={companies} />
      <AgentPanel onDone={() => {}} />

      <div className="dashboard-toolbar" style={css.toolbar}>
        <button style={css.addBtn} onClick={() => setAddOpen(true)}>+ Pridať kontakt</button>
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
        <button
          style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.63rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.75rem', border: '1px solid #ff5c0044', background: 'rgba(255,92,0,0.07)', color: '#ff5c00', borderRadius: 2, cursor: 'pointer', opacity: gmailChecking ? 0.6 : 1 }}
          onClick={handleGmailCheck}
          disabled={gmailChecking}
          title="Skontrolovať Gmail schránku">
          {gmailChecking ? '⏳ Kontrolujem...' : '📩 Gmail'}
        </button>
        {gmailResult && (
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.58rem', color: gmailResult.ok ? '#00cc88' : '#ef4444' }}>
            {gmailResult.ok
              ? (gmailResult.newReplies > 0 ? `✓ ${gmailResult.newReplies} nová odpoveď` : '✓ Žiadne nové odpovede')
              : `⚠ ${gmailResult.error}`}
          </span>
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
        {seeded !== 'done' && (
          <button
            style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.55rem', letterSpacing: '1px', padding: '0.25rem 0.5rem', border: '1px solid #1e2530', background: 'transparent', color: '#2d3748', borderRadius: 2, cursor: 'pointer', opacity: 0.4 }}
            onClick={handleSeedTestCompany}
            disabled={seeded === 'saving'}
            title="Seed test company">
            {seeded === 'saving' ? '⏳' : '⊕ test'}
          </button>
        )}
      </div>

      {filtered.length > 0 && (
        <div style={css.count}>{filtered.length} firiem</div>
      )}

      {filtered.length === 0 ? (
        <div style={css.empty}>
          {companies.length === 0
            ? '→ Pridaj firmy cez "+ Hľadať firmy" v hlavičke'
            : 'Žiadne výsledky pre daný filter'}
        </div>
      ) : (
        filtered.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <div style={{ paddingTop: '0.95rem', flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={checkedIds.has(c.id)}
                onChange={() => toggleCheck(c.id)}
                onClick={e => e.stopPropagation()}
                style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#ef4444' }}
              />
            </div>
            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setSelected(c)}>
              <CompanyCard
                company={c}
                scoring={!!scoring[c.id]}
                onDraft={e => { e?.stopPropagation?.(); openDraft(c) }}
                onScore={e => { e?.stopPropagation?.(); handleScore(c) }}
              />
            </div>
          </div>
        ))
      )}

      {/* Detail modal — handles all Firebase ops internally */}
      {selected && (
        <CompanyDetailModal
          company={selected}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Add contact modal */}
      {addOpen && (
        <div style={css.overlay} onClick={e => e.target === e.currentTarget && setAddOpen(false)}>
          <div style={css.modal}>
            <div style={css.mhead}>
              <span style={css.mtitle}>+ Pridať kontakt</span>
              <button style={{ background: 'transparent', border: 'none', color: '#6b7280', fontSize: '1rem', cursor: 'pointer' }} onClick={() => setAddOpen(false)}>✕</button>
            </div>
            <label style={css.mlabel}>Názov firmy *</label>
            <input style={css.minput} placeholder="Firma GmbH" value={addForm.name} onChange={e => setField('name', e.target.value)} autoFocus />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div>
                <label style={css.mlabel}>Email</label>
                <input style={css.minput} placeholder="info@firma.de" value={addForm.email} onChange={e => setField('email', e.target.value)} />
              </div>
              <div>
                <label style={css.mlabel}>Telefón</label>
                <input style={css.minput} placeholder="+49 171 000 0000" value={addForm.phone} onChange={e => setField('phone', e.target.value)} />
              </div>
              <div>
                <label style={css.mlabel}>Web</label>
                <input style={css.minput} placeholder="firma.de" value={addForm.website} onChange={e => setField('website', e.target.value)} />
              </div>
              <div>
                <label style={css.mlabel}>Mesto</label>
                <input style={css.minput} placeholder="Berlin" value={addForm.city} onChange={e => setField('city', e.target.value)} />
              </div>
            </div>
            <label style={css.mlabel}>Kategória</label>
            <select style={{ ...css.minput, cursor: 'pointer' }} value={addForm.category} onChange={e => setField('category', e.target.value)}>
              <option value="hotel">🏨 Hotel</option>
              <option value="laundry">🧺 Práčovňa</option>
              <option value="spa">💆 Wellness / Spa</option>
              <option value="hospital">🏥 Nemocnica</option>
              <option value="restaurant">🍽️ Reštaurácia</option>
            </select>
            <div style={css.mbtns}>
              <button style={{ ...css.mbtnOk, opacity: addSaving || !addForm.name.trim() ? 0.5 : 1 }}
                onClick={handleAddContact} disabled={addSaving || !addForm.name.trim()}>
                {addSaving ? '⏳ Ukladám...' : '✓ Uložiť'}
              </button>
              <button style={css.mbtnCancel} onClick={() => setAddOpen(false)}>Zrušiť</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete ALL confirmation modal */}
      {confirmDeleteAll && (
        <div style={css.overlay} onClick={e => e.target === e.currentTarget && setConfirmDeleteAll(false)}>
          <div style={{ ...css.modal, maxWidth: 420 }}>
            <div style={{ ...css.mhead, flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem' }}>
              <span style={css.mtitle}>⚠ Vymazať všetky kontakty</span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.88rem', color: '#e8eaed' }}>
                Naozaj vymazať VŠETKÝCH {filtered.length} kontaktov?
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.62rem', color: '#ef4444' }}>
                Táto akcia je nevratná.
              </span>
            </div>
            <div style={{ ...css.mbtns, marginTop: '1rem' }}>
              <button
                style={{ ...css.mbtnOk, background: '#ef4444', opacity: deleting ? 0.6 : 1, cursor: deleting ? 'not-allowed' : 'pointer' }}
                onClick={handleDeleteAll}
                disabled={deleting}>
                {deleting ? '⏳ Mažem...' : `🗑 Vymazať všetkých (${filtered.length})`}
              </button>
              <button style={css.mbtnCancel} onClick={() => setConfirmDeleteAll(false)}>Zrušiť</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div style={css.overlay} onClick={e => e.target === e.currentTarget && setConfirmDelete(false)}>
          <div style={{ ...css.modal, maxWidth: 380 }}>
            <div style={{ ...css.mhead, flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem' }}>
              <span style={css.mtitle}>⚠ Potvrdiť vymazanie</span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.88rem', color: '#e8eaed' }}>
                Naozaj vymazať {checkedIds.size} kontakt{checkedIds.size > 1 ? 'y' : ''}?
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.62rem', color: '#ef4444' }}>
                Táto akcia je nevratná.
              </span>
            </div>
            <div style={{ ...css.mbtns, marginTop: '1rem' }}>
              <button
                style={{ ...css.mbtnOk, background: '#ef4444', opacity: deleting ? 0.6 : 1, cursor: deleting ? 'not-allowed' : 'pointer' }}
                onClick={handleDeleteSelected}
                disabled={deleting}>
                {deleting ? '⏳ Mažem...' : `🗑 Vymazať (${checkedIds.size})`}
              </button>
              <button style={css.mbtnCancel} onClick={() => setConfirmDelete(false)}>Zrušiť</button>
            </div>
          </div>
        </div>
      )}

      {/* Draft modal */}
      {draft && (
        <div style={css.overlay} onClick={e => e.target === e.currentTarget && setDraft(null)}>
          <div style={css.modal}>
            <div style={css.mhead}>
              <span style={css.mtitle}>✉ Email draft</span>
              <span style={css.mcompany}>{draft.company.name}</span>
            </div>
            <label style={css.mlabel}>Predmet</label>
            <input style={css.minput}
              value={draft.subject}
              onChange={e => setDraft(d => ({ ...d, subject: e.target.value }))} />
            <label style={css.mlabel}>Text emailu</label>
            <textarea style={css.mtarea}
              value={draft.body}
              onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} />
            <div style={css.mbtns}>
              <button style={css.mbtnOk} onClick={handleSaveDraft} disabled={saving}>
                {saving ? '⏳ Ukladá...' : '✓ Uložiť draft'}
              </button>
              <button style={css.mbtnCancel} onClick={() => setDraft(null)}>Zrušiť</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const css = {
  deleteBtn:  { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.63rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.75rem', border: '1px solid #ef444466', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 2, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' },
  toolbar:    { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'center' },
  addBtn:     { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.63rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.75rem', border: '1px solid #00cc8855', background: 'rgba(0,204,136,0.08)', color: '#00cc88', borderRadius: 2, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' },
  fbtn:       { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.63rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.28rem 0.65rem', border: '1px solid #1e2530', background: 'transparent', color: '#6b7280', borderRadius: 2 },
  fbtnOn:     { borderColor: '#ff5c00', color: '#ff5c00' },
  search:     { flex: 1, minWidth: 180, background: '#111418', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.72rem', padding: '0.28rem 0.6rem', borderRadius: 2, outline: 'none' },
  count:      { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.58rem', color: '#6b7280', letterSpacing: '1px', marginBottom: '0.6rem' },
  empty:      { textAlign: 'center', padding: '3.5rem', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.75rem', color: '#6b7280', lineHeight: 2 },
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' },
  modal:      { background: '#111418', border: '1px solid #1e2530', borderRadius: 4, padding: '1.5rem', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' },
  mhead:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  mtitle:     { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.62rem', letterSpacing: '3px', textTransform: 'uppercase', color: '#6b7280' },
  mcompany:   { fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.7rem', color: '#ffaa00' },
  mlabel:     { display: 'block', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '0.25rem' },
  minput:     { width: '100%', background: '#0a0c0f', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.75rem', padding: '0.45rem 0.7rem', borderRadius: 2, outline: 'none', marginBottom: '0.65rem' },
  mtarea:     { width: '100%', background: '#0a0c0f', border: '1px solid #1e2530', color: '#e8eaed', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.65rem', padding: '0.5rem 0.7rem', borderRadius: 2, outline: 'none', resize: 'vertical', minHeight: 220, lineHeight: 1.7, marginBottom: '0.75rem' },
  mbtns:      { display: 'flex', gap: '0.5rem' },
  mbtnOk:     { flex: 1, background: '#00cc88', border: 'none', color: '#0a0c0f', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.45rem', borderRadius: 2, fontWeight: 700 },
  mbtnCancel: { background: 'transparent', border: '1px solid #1e2530', color: '#6b7280', fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.45rem 0.9rem', borderRadius: 2 },
}

import { useState, useEffect, useMemo } from 'react'
import { db } from '../firebase.js'
import { doc, deleteDoc } from 'firebase/firestore'
import { INTEL_STATUSES, REC_META, scoreColor } from '../constants/intelMeta.js'
import { subscribeTargets } from '../services/intelTargetService.js'
import IntelSummaryPanel  from './IntelSummaryPanel.jsx'
import IntelAgentPanel    from './IntelAgentPanel.jsx'
import IntelTargetCard    from './IntelTargetCard.jsx'
import IntelCompanyDetail from './IntelCompanyDetail.jsx'

const mono = "'IBM Plex Mono', monospace"
const sans = "'IBM Plex Sans', sans-serif"

// ── Pipeline bar — vizuálne štádiá ako v Kanbane ─────────────────────────────

const PIPELINE_STAGES = [
  { key: 'new',        label: 'Nové',         color: '#818cf8' },
  { key: 'analyzed',   label: 'Analyzované',  color: '#00cc88' },
  { key: 'ready',      label: 'Pripravené',   color: '#ffaa00' },
  { key: 'contacted',  label: 'Kontaktované', color: '#ff5c00' },
  { key: 'replied',    label: 'Odpovedali',   color: '#00cc88' },
  { key: 'followup',   label: 'Follow-up',    color: '#ffaa00' },
  { key: 'unsuitable', label: 'Nevhodné',     color: '#374151' },
]

function PipelineBar({ targets, filter, setFilter }) {
  const counts = useMemo(() =>
    Object.fromEntries(PIPELINE_STAGES.map(s => [s.key, targets.filter(t => t.status === s.key).length])),
    [targets]
  )

  return (
    <div style={{ background: '#111418', border: '1px solid #1e2530', borderRadius: 2, marginBottom: '1rem', overflow: 'hidden' }}>
      <div style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#374151', padding: '0.45rem 1rem 0', marginBottom: '0.1rem' }}>
        ◈ INTELLIGENCE PIPELINE
      </div>
      <div style={{ display: 'flex', borderTop: '1px solid #0f1318' }}>
        {PIPELINE_STAGES.map((s, i) => {
          const count    = counts[s.key] || 0
          const isActive = filter === s.key
          return (
            <div
              key={s.key}
              onClick={() => setFilter(isActive ? 'all' : s.key)}
              style={{
                flex: 1, textAlign: 'center', padding: '0.55rem 0.25rem',
                cursor: 'pointer',
                borderLeft: i > 0 ? '1px solid #0f1318' : undefined,
                background: isActive ? `${s.color}14` : 'transparent',
                transition: 'background 0.15s',
              }}>
              <div style={{ fontFamily: mono, fontSize: '1.3rem', fontWeight: 700, color: count > 0 ? s.color : '#1e2530', lineHeight: 1 }}>{count}</div>
              <div style={{ fontFamily: mono, fontSize: '0.42rem', letterSpacing: '0.8px', textTransform: 'uppercase', color: count > 0 ? s.color : '#374151', marginTop: '0.15rem' }}>{s.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── High Urgency Feed — top priority targety ──────────────────────────────────

function UrgencyFeed({ targets, onOpen }) {
  const urgent = useMemo(() =>
    [...targets]
      .filter(t => (t.overallScore ?? 0) >= 70 || t.recommendation === 'immediate')
      .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0))
      .slice(0, 5),
    [targets]
  )

  if (urgent.length === 0) return null

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#ff5c00', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        ⚡ HIGH URGENCY
        <span style={{ fontFamily: mono, fontSize: '0.45rem', color: '#374151', letterSpacing: '1px' }}>TOP PRIORITY TARGETS</span>
      </div>
      <div style={{ display: 'flex', gap: '0.65rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        {urgent.map(t => {
          const rec = REC_META[t.recommendation] || REC_META.monitor
          const oc  = scoreColor(t.overallScore ?? 0)
          return (
            <div
              key={t.id}
              onClick={() => onOpen(t)}
              style={{
                background: '#111418',
                border: '1px solid #1e2530',
                borderTop: `2px solid ${oc}`,
                borderRadius: 2,
                padding: '0.65rem 0.85rem',
                minWidth: 195,
                maxWidth: 220,
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'border-top-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderTopColor = '#ff5c00'}
              onMouseLeave={e => e.currentTarget.style.borderTopColor = oc}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.4rem', marginBottom: '0.3rem' }}>
                <div style={{ fontFamily: sans, fontWeight: 600, fontSize: '0.82rem', color: '#e8eaed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{t.name}</div>
                <span style={{ fontFamily: mono, fontSize: '0.88rem', fontWeight: 700, color: oc, flexShrink: 0 }}>{t.overallScore ?? '–'}</span>
              </div>
              <div style={{ fontFamily: mono, fontSize: '0.52rem', color: '#6b7280', marginBottom: '0.35rem' }}>
                {[t.city, t.country].filter(Boolean).join(', ')}
                {t.segmentLabel && <span> · {t.segmentLabel}</span>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.3rem', borderTop: '1px solid #1e2530' }}>
                <span style={{ fontFamily: mono, fontSize: '0.5rem', color: rec.color }}>{rec.icon} {rec.label}</span>
                {t.lastGatherSummary?.isRealPressure && (
                  <span style={{ fontFamily: mono, fontSize: '0.45rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#ff5c00', background: 'rgba(255,92,0,0.1)', border: '1px solid #ff5c0033', padding: '0.08rem 0.3rem', borderRadius: 2 }}>⚡ TLAK</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Recent Signals Feed — posledná aktivita ───────────────────────────────────

function RecentSignalsFeed({ targets }) {
  const feed = useMemo(() => {
    const items = []
    const sorted = [...targets]
      .filter(t => t.lastIntelGatherAt)
      .sort((a, b) => {
        const ta = a.lastIntelGatherAt?.toDate?.() || new Date(a.lastIntelGatherAt || 0)
        const tb = b.lastIntelGatherAt?.toDate?.() || new Date(b.lastIntelGatherAt || 0)
        return tb - ta
      })
      .slice(0, 6)

    sorted.forEach(t => {
      const signal  = (t.signals || [])[0]
      const ts      = t.lastIntelGatherAt?.toDate?.() || new Date(t.lastIntelGatherAt || 0)
      const elapsed = formatElapsed(ts)
      if (signal) items.push({ name: t.name, signal, elapsed, isReal: t.lastGatherSummary?.isRealPressure })
    })
    return items
  }, [targets])

  if (feed.length === 0) return null

  return (
    <div style={{ background: '#111418', border: '1px solid #1e2530', borderRadius: 2, padding: '0.7rem 1rem', marginBottom: '1rem' }}>
      <div style={{ fontFamily: mono, fontSize: '0.48rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#374151', marginBottom: '0.6rem' }}>
        📡 POSLEDNÉ SIGNÁLY Z INTERNETU
      </div>
      {feed.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', marginBottom: i < feed.length - 1 ? '0.3rem' : 0 }}>
          <span style={{ color: item.isReal ? '#ff5c00' : '#374151', fontFamily: mono, fontSize: '0.6rem', flexShrink: 0, marginTop: '0.08rem' }}>▸</span>
          <span style={{ fontFamily: mono, fontSize: '0.6rem', color: '#9ca3af', lineHeight: 1.45, flex: 1 }}>
            <span style={{ color: '#e8eaed', fontWeight: 600 }}>{item.name}</span>
            <span style={{ color: '#4b5563' }}> · </span>
            {item.signal}
            {item.isReal && <span style={{ color: '#ff5c00', marginLeft: '0.35rem' }}>⚡</span>}
          </span>
          <span style={{ fontFamily: mono, fontSize: '0.5rem', color: '#374151', flexShrink: 0, marginTop: '0.1rem' }}>{item.elapsed}</span>
        </div>
      ))}
    </div>
  )
}

function formatElapsed(date) {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'práve teraz'
  if (mins < 60)  return `pred ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `pred ${hrs}h`
  const days = Math.floor(hrs / 24)
  return `pred ${days}d`
}

// ── Hlavný panel ──────────────────────────────────────────────────────────────

export default function EnergyTargetPanel({ view = 'dashboard', setView }) {
  const [targets, setTargets]         = useState([])
  const [filter, setFilter]           = useState('all')
  const [search, setSearch]           = useState('')
  const [selected, setSelected]       = useState(null)
  const [checkedIds, setCheckedIds]   = useState(new Set())
  const [confirmDelete,    setConfirmDelete]    = useState(false)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const [deleting, setDeleting]       = useState(false)

  useEffect(() => subscribeTargets(setTargets), [])

  useEffect(() => {
    if (!selected) return
    const fresh = targets.find(t => t.id === selected.id)
    if (fresh) setSelected(fresh)
  }, [targets])

  const filtered = useMemo(() => targets.filter(t => {
    if (filter !== 'all' && t.status !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return t.name?.toLowerCase().includes(q) || t.city?.toLowerCase().includes(q)
    }
    return true
  }), [targets, filter, search])

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
    } catch (e) { alert('Chyba vymazania: ' + e.message) }
    finally { setDeleting(false) }
  }

  async function handleDeleteAll() {
    setDeleting(true)
    try {
      await Promise.all(filtered.map(t => deleteDoc(doc(db, 'intelligence_targets', t.id))))
      setCheckedIds(new Set())
      setConfirmDeleteAll(false)
    } catch (e) { alert('Chyba vymazania: ' + e.message) }
    finally { setDeleting(false) }
  }

  return (
    <div style={{ padding: '1.25rem', maxWidth: 1100, margin: '0 auto', width: '100%' }}>

      {/* 1. Intelligence Analýza Dnes — rovnaký feeling ako AiSummaryPanel */}
      <IntelSummaryPanel targets={targets} />

      {/* 2. Intelligence Pipeline — vizuálne štádiá, klikateľné filtre */}
      <PipelineBar targets={targets} filter={filter} setFilter={setFilter} />

      {/* 3. High Urgency Feed — top priority targets */}
      <UrgencyFeed targets={targets} onOpen={setSelected} />

      {/* 4. Recent Signals — live activity feed */}
      <RecentSignalsFeed targets={targets} />

      {/* 5. Intelligence Agent — ako AgentPanel v A (po dátach, nie pred) */}
      <IntelAgentPanel
        onDone={() => {}}
        onAdded={newTarget => setSelected(newTarget)}
      />

      {/* 6. Operations toolbar */}
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
        {[{ key: 'all', label: 'Všetky' }, ...INTEL_STATUSES].map(f => (
          <button key={f.key}
            style={{ ...css.fbtn, ...(filter === f.key ? css.fbtnOn : {}) }}
            onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
        <input style={css.search} placeholder="Hľadať firmu alebo mesto..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length > 0 && (
        <div style={css.count}>{filtered.length} targetov</div>
      )}

      {/* 7. Target cards */}
      {filtered.length === 0 ? (
        <div style={css.empty}>
          {targets.length === 0
            ? '→ Pridaj prvé targety cez "+ Pridať target" alebo cez Intelligence Agent'
            : 'Žiadne výsledky pre daný filter'}
        </div>
      ) : (
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

      {/* Detail modal */}
      {selected && (
        <IntelCompanyDetail
          target={selected}
          onClose={() => setSelected(null)}
          onDelete={() => setSelected(null)}
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

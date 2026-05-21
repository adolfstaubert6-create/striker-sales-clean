import { db } from '../firebase.js'
import {
  collection, addDoc, updateDoc, deleteDoc, getDocs,
  doc, serverTimestamp, query, orderBy, where, onSnapshot, arrayUnion,
} from 'firebase/firestore'

export function subscribeTargets(callback) {
  const q = query(collection(db, 'intelligence_targets'), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.division === 'B')),
    err => console.warn('[intel-targets]', err.message)
  )
}

export async function addTarget(data) {
  // Duplicate check — rovnaký vzor ako saveCompany v firebaseService.js
  if (data.web) {
    const snap = await getDocs(query(collection(db, 'intelligence_targets'), where('web', '==', data.web), where('division', '==', 'B')))
    if (!snap.empty) return { id: snap.docs[0].id, duplicate: true }
  }
  if (data.name) {
    const snap = await getDocs(query(collection(db, 'intelligence_targets'), where('name', '==', data.name), where('division', '==', 'B')))
    if (!snap.empty) return { id: snap.docs[0].id, duplicate: true }
  }

  const ref = await addDoc(collection(db, 'intelligence_targets'), {
    ...data,
    division:  'B',
    sources:   data.sources  || [],
    contacts:  data.contacts || [],
    signals:   data.signals  || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return { id: ref.id, duplicate: false }
}

export async function updateTarget(id, patch) {
  return updateDoc(doc(db, 'intelligence_targets', id), { ...patch, updatedAt: serverTimestamp() })
}

export async function deleteTarget(id) {
  return deleteDoc(doc(db, 'intelligence_targets', id))
}

export async function addSource(id, source) {
  return updateDoc(doc(db, 'intelligence_targets', id), {
    sources:   arrayUnion({ ...source, addedAt: new Date().toISOString() }),
    updatedAt: serverTimestamp(),
  })
}

export async function removeSource(id, sources, idx) {
  return updateDoc(doc(db, 'intelligence_targets', id), {
    sources:   sources.filter((_, i) => i !== idx),
    updatedAt: serverTimestamp(),
  })
}

export async function addContact(id, contact) {
  return updateDoc(doc(db, 'intelligence_targets', id), {
    contacts:  arrayUnion(contact),
    updatedAt: serverTimestamp(),
  })
}

export async function removeContact(id, contacts, idx) {
  return updateDoc(doc(db, 'intelligence_targets', id), {
    contacts:  contacts.filter((_, i) => i !== idx),
    updatedAt: serverTimestamp(),
  })
}

export async function updateIntelligence(id, {
  newSignals, newSources, updatedScores, aiInterpretation,
  jobSignals, keyEvidence, scrapedPages,
  existingSignals, existingSources,
}) {
  // Merge signály — deduplikácia
  const mergedSignals = [...new Set([...(existingSignals || []), ...(newSignals || [])])]

  // Merge zdroje — pridaj len nové URL
  const existingUrls  = new Set((existingSources || []).map(s => s.url))
  const ts            = new Date().toISOString()
  const sourcesToAdd  = (newSources || [])
    .filter(s => s.url && !existingUrls.has(s.url))
    .map(s => ({ ...s, addedAt: ts }))
  const mergedSources = [...(existingSources || []), ...sourcesToAdd]

  return updateDoc(doc(db, 'intelligence_targets', id), {
    signals:    mergedSignals,
    sources:    mergedSources,
    keyEvidence:keyEvidence || [],
    jobSignals: jobSignals  || [],
    scrapedPages: scrapedPages || [],
    lastGatherSummary: {
      isRealPressure:        aiInterpretation?.isRealPressure,
      pressureLevel:         aiInterpretation?.pressureLevel,
      pressureExplanation:   aiInterpretation?.pressureExplanation,
      timingAssessment:      aiInterpretation?.timingAssessment,
      energyFindings:        aiInterpretation?.energyFindings,
      modernizationFindings: aiInterpretation?.modernizationFindings,
      esgFindings:           aiInterpretation?.esgFindings,
      strikerArgument:       aiInterpretation?.strikerArgument,
      detectedJobRoles:      aiInterpretation?.detectedJobRoles || [],
    },
    ...updatedScores,
    lastIntelGatherAt: serverTimestamp(),
    updatedAt:         serverTimestamp(),
  })
}

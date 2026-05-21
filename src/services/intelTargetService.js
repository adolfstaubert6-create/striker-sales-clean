import { db } from '../firebase.js'
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, onSnapshot, arrayUnion,
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
  return addDoc(collection(db, 'intelligence_targets'), {
    ...data,
    division:  'B',
    sources:   data.sources  || [],
    contacts:  data.contacts || [],
    signals:   data.signals  || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
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

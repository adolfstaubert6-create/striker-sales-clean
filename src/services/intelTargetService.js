import { db } from '../firebase.js'
import {
  collection, addDoc, updateDoc, deleteDoc, getDocs,
  doc, serverTimestamp, query, orderBy, where, onSnapshot, arrayUnion,
} from 'firebase/firestore'

const COL = 'intelligence_targets'

export function subscribeTargets(callback) {
  const q = query(collection(db, COL), orderBy('createdAt', 'desc'))
  return onSnapshot(q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.division === 'B')),
    err  => console.warn('[intel]', err.message)
  )
}

export async function addTarget(data) {
  // Duplicate check by web URL
  if (data.web) {
    const snap = await getDocs(query(collection(db, COL), where('web', '==', data.web), where('division', '==', 'B')))
    if (!snap.empty) return { id: snap.docs[0].id, duplicate: true }
  }
  // Duplicate check by name
  if (data.name) {
    const snap = await getDocs(query(collection(db, COL), where('name', '==', data.name), where('division', '==', 'B')))
    if (!snap.empty) return { id: snap.docs[0].id, duplicate: true }
  }
  const ref = await addDoc(collection(db, COL), {
    ...data,
    division:  'B',
    status:    data.status  || 'new',
    signals:   data.signals || [],
    sources:   data.sources || [],
    contacts:  data.contacts|| [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return { id: ref.id, duplicate: false }
}

export async function updateTarget(id, patch) {
  return updateDoc(doc(db, COL, id), { ...patch, updatedAt: serverTimestamp() })
}

export async function deleteTarget(id) {
  return deleteDoc(doc(db, COL, id))
}

export async function addSource(id, source) {
  return updateDoc(doc(db, COL, id), {
    sources:   arrayUnion({ ...source, addedAt: new Date().toISOString() }),
    updatedAt: serverTimestamp(),
  })
}

export async function removeSource(id, sources, idx) {
  return updateDoc(doc(db, COL, id), { sources: sources.filter((_, i) => i !== idx), updatedAt: serverTimestamp() })
}

export async function addContact(id, contact) {
  return updateDoc(doc(db, COL, id), { contacts: arrayUnion(contact), updatedAt: serverTimestamp() })
}

export async function removeContact(id, contacts, idx) {
  return updateDoc(doc(db, COL, id), { contacts: contacts.filter((_, i) => i !== idx), updatedAt: serverTimestamp() })
}

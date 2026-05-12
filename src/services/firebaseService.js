import { db } from '../firebase.js'
import {
  collection, addDoc, getDocs, query, where,
  serverTimestamp, orderBy, onSnapshot, doc, updateDoc
} from 'firebase/firestore'
import { normalizeCompanyData } from '../utils/normalizeCompanyData.js'

export async function saveCompany(raw, category, city) {
  const data = normalizeCompanyData(raw, category, city)

  // Duplicate detection: googlePlaceId → website → name+address
  const ref = collection(db, 'companies')
  if (data.googlePlaceId) {
    const snap = await getDocs(query(ref, where('googlePlaceId', '==', data.googlePlaceId)))
    if (!snap.empty) return { id: snap.docs[0].id, duplicate: true }
  }
  if (data.website) {
    const snap = await getDocs(query(ref, where('website', '==', data.website)))
    if (!snap.empty) return { id: snap.docs[0].id, duplicate: true }
  }
  if (data.name && data.address) {
    const snap = await getDocs(query(ref, where('name', '==', data.name), where('address', '==', data.address)))
    if (!snap.empty) return { id: snap.docs[0].id, duplicate: true }
  }

  const docRef = await addDoc(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  return { id: docRef.id, duplicate: false }
}

export function subscribeCompanies(callback) {
  const q = query(collection(db, 'companies'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
}

export async function updateCompanyScore(id, score, reason, factors) {
  await updateDoc(doc(db, 'companies', id), {
    aiScore: score,
    aiReason: reason,
    aiFactors: factors || null,
    updatedAt: serverTimestamp(),
  })
}

export async function saveDraft(companyId, companyName, subject, body) {
  await addDoc(collection(db, 'emails'), {
    companyId,
    companyName,
    subject,
    body,
    status: 'draft',
    createdAt: serverTimestamp(),
    sentAt: null,
  })
}

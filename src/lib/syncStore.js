import { initializeApp } from 'firebase/app'
import { getFirestore, doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'

const hasFirebaseConfig = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  import.meta.env.VITE_FIREBASE_APP_ID
)

const familyId = import.meta.env.VITE_FAMILY_ID || 'default-family'

let db = null
let familyRef = null

if (hasFirebaseConfig) {
  const app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  })
  db = getFirestore(app)
  familyRef = doc(db, 'families', familyId)
}

export function syncMode() {
  return hasFirebaseConfig ? 'firebase' : 'local'
}

export async function ensureRemoteDocument(defaultDocument) {
  if (!familyRef) return null
  const snap = await getDoc(familyRef)
  if (!snap.exists()) {
    await setDoc(familyRef, { ...defaultDocument, updatedAt: serverTimestamp() })
  }
  return familyRef
}

export function subscribeRemote(onChange, onError) {
  if (!familyRef) return () => {}
  return onSnapshot(familyRef, snap => {
    if (snap.exists()) onChange(snap.data())
  }, onError)
}

export async function saveRemote(documentData) {
  if (!familyRef) return
  await setDoc(familyRef, { ...documentData, updatedAt: serverTimestamp() }, { merge: true })
}

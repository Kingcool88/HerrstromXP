import { defaultFamily } from '../data/defaultFamily.js'

const hasFirebaseConfig = () => Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  import.meta.env.VITE_FIREBASE_APP_ID
)

const todayKey = () => new Date().toLocaleDateString('sv-SE')
const yesterdayOrEmpty = () => ''

const initialProgress = () => ({
  date: todayKey(),
  xpBank: Object.fromEntries(defaultFamily.children.map(c => [c.id, 0])),
  completed: {},
  pending: {},
  purchased: {},
  history: []
})

const normalize = (data) => {
  const merged = { family: defaultFamily, progress: initialProgress(), ...(data || {}) }
  if (!merged.progress || merged.progress.date !== todayKey()) {
    const oldBank = merged.progress?.xpBank || {}
    merged.progress = { ...initialProgress(), xpBank: { ...initialProgress().xpBank, ...oldBank }, history: merged.progress?.history || [] }
  }
  return merged
}

const localKey = 'herrstromxp-v2-data'

export async function createStore(onChange) {
  if (hasFirebaseConfig()) {
    try {
      const { initializeApp } = await import('firebase/app')
      const { getFirestore, doc, onSnapshot, setDoc, getDoc } = await import('firebase/firestore')
      const app = initializeApp({
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID
      })
      const db = getFirestore(app)
      const ref = doc(db, 'families', defaultFamily.familyId)
      const snap = await getDoc(ref)
      if (!snap.exists()) await setDoc(ref, normalize({ family: defaultFamily, progress: initialProgress() }))
      const unsub = onSnapshot(ref, (s) => onChange(normalize(s.data())), (err) => {
        console.error('Firebase sync error', err)
        onChange(normalize(loadLocal()))
      })
      return {
        mode: 'firebase',
        save: async (data) => setDoc(ref, normalize(data)),
        unsubscribe: unsub
      }
    } catch (err) {
      console.error('Firebase init failed, using local mode', err)
    }
  }

  onChange(normalize(loadLocal()))
  return {
    mode: 'local',
    save: async (data) => {
      localStorage.setItem(localKey, JSON.stringify(normalize(data)))
      onChange(normalize(data))
    },
    unsubscribe: () => {}
  }
}

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(localKey)) || { family: defaultFamily, progress: initialProgress() } }
  catch { return { family: defaultFamily, progress: initialProgress() } }
}

export { todayKey }

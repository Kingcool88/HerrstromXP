import { defaultFamily } from '../data/defaultFamily.js'

const hasFirebaseConfig = () => Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  import.meta.env.VITE_FIREBASE_APP_ID
)

const firebaseConfig = () => ({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
})

const todayKey = () => new Date().toLocaleDateString('sv-SE')

const initialProgress = () => ({
  date: todayKey(),
  xpBank: Object.fromEntries(defaultFamily.children.map(c => [c.id, 0])),
  completed: {},
  pending: {},
  purchased: {},
  pushTokens: {},
  history: []
})

const normalize = (data) => {
  const merged = { family: defaultFamily, progress: initialProgress(), ...(data || {}) }
  merged.family = { ...defaultFamily, ...(merged.family || {}) }
  merged.family.children ||= []
  merged.family.tasks ||= []
  merged.family.rewards ||= []
  merged.progress ||= initialProgress()
  merged.progress.xpBank ||= {}
  merged.progress.completed ||= {}
  merged.progress.pending ||= {}
  merged.progress.purchased ||= {}
  merged.progress.pushTokens ||= {}
  merged.progress.history ||= []

  for (const child of merged.family.children) {
    if (merged.progress.xpBank[child.id] === undefined) merged.progress.xpBank[child.id] = 0
  }

  if (merged.progress.date !== todayKey()) {
    const oldBank = merged.progress.xpBank || {}
    const oldPushTokens = merged.progress.pushTokens || {}
    const oldHistory = merged.progress.history || []
    merged.progress = { ...initialProgress(), xpBank: { ...initialProgress().xpBank, ...oldBank }, pushTokens: oldPushTokens, history: oldHistory }
  }
  return merged
}

const localKey = 'herrstromxp-v3-data'
let firebaseApp = null
let firebaseDb = null
let firebaseRef = null

export async function createStore(onChange) {
  if (hasFirebaseConfig()) {
    try {
      const { initializeApp, getApps } = await import('firebase/app')
      const { getFirestore, doc, onSnapshot, setDoc, getDoc } = await import('firebase/firestore')
      firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig())
      firebaseDb = getFirestore(firebaseApp)
      firebaseRef = doc(firebaseDb, 'families', defaultFamily.familyId)
      const snap = await getDoc(firebaseRef)
      if (!snap.exists()) await setDoc(firebaseRef, normalize({ family: defaultFamily, progress: initialProgress() }))
      const unsub = onSnapshot(firebaseRef, (s) => onChange(normalize(s.data())), (err) => {
        console.error('Firebase sync error', err)
        onChange(normalize(loadLocal()))
      })
      return {
        mode: 'firebase',
        save: async (data) => setDoc(firebaseRef, normalize(data)),
        notifyParent: async ({ childName, taskTitle }) => {
          // För riktig push: se firebase-functions/index.js. Här sparas bara händelsen i Firestore.
          try {
            const { collection, addDoc, serverTimestamp } = await import('firebase/firestore')
            await addDoc(collection(firebaseDb, 'families', defaultFamily.familyId, 'notificationRequests'), {
              childName, taskTitle, createdAt: serverTimestamp(), sent: false
            })
          } catch (err) { console.warn('Could not create notification request', err) }
        },
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
    notifyParent: async () => {},
    unsubscribe: () => {}
  }
}

export async function requestPushPermission(store, data) {
  if (store?.mode !== 'firebase') return { ok: false, message: 'Push kräver Firebase-läge, inte lokalt läge.' }
  if (!('Notification' in window)) return { ok: false, message: 'Den här webbläsaren stödjer inte notifieringar.' }
  if (!('serviceWorker' in navigator)) return { ok: false, message: 'Service worker saknas i webbläsaren.' }
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
  if (!vapidKey) return { ok: false, message: 'VITE_FIREBASE_VAPID_KEY saknas. Lägg in Web Push certificate key från Firebase som GitHub secret.' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, message: 'Notifieringar nekades i webbläsaren.' }

  try {
    const { initializeApp, getApps } = await import('firebase/app')
    const { getMessaging, getToken } = await import('firebase/messaging')
    const { setDoc, doc } = await import('firebase/firestore')
    firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig())
    const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}firebase-messaging-sw.js`)
    const messaging = getMessaging(firebaseApp)
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration })
    if (!token) return { ok: false, message: 'Ingen push-token skapades.' }
    await setDoc(doc(firebaseDb, 'families', data.family.familyId, 'pushTokens', token), {
      token,
      createdAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      enabled: true
    })
    return { ok: true, token }
  } catch (err) {
    console.error(err)
    return { ok: false, message: `Push kunde inte aktiveras: ${err.message}` }
  }
}

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(localKey)) || { family: defaultFamily, progress: initialProgress() } }
  catch { return { family: defaultFamily, progress: initialProgress() } }
}

export { todayKey }

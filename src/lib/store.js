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
const yesterdayKey = () => {
  const d = new Date(); d.setDate(d.getDate() - 1); return d.toLocaleDateString('sv-SE')
}

const initialProgress = () => ({
  date: todayKey(),
  xpBank: Object.fromEntries(defaultFamily.children.map(c => [c.id, 0])),
  completed: {},
  pending: {},
  purchased: {},
  achievements: {},
  streaks: Object.fromEntries(defaultFamily.children.map(c => [c.id, { count: 0, lastFullDay: null }])),
  pushTokens: {},
  history: []
})

const mergeFamily = (family = {}) => ({
  ...defaultFamily,
  ...family,
  rules: { ...defaultFamily.rules, ...(family.rules || {}) },
  children: family.children || defaultFamily.children,
  tasks: family.tasks || defaultFamily.tasks,
  rewards: family.rewards || defaultFamily.rewards,
  achievements: family.achievements || defaultFamily.achievements
})

const normalize = (data) => {
  const merged = { family: defaultFamily, progress: initialProgress(), ...(data || {}) }
  merged.family = mergeFamily(merged.family)
  merged.progress ||= initialProgress()
  merged.progress.xpBank ||= {}
  merged.progress.completed ||= {}
  merged.progress.pending ||= {}
  merged.progress.purchased ||= {}
  merged.progress.achievements ||= {}
  merged.progress.streaks ||= {}
  merged.progress.pushTokens ||= {}
  merged.progress.history ||= []

  for (const child of merged.family.children) {
    if (merged.progress.xpBank[child.id] === undefined) merged.progress.xpBank[child.id] = 0
    if (!merged.progress.streaks[child.id]) merged.progress.streaks[child.id] = { count: 0, lastFullDay: null }
  }

  if (merged.progress.date !== todayKey()) {
    const old = merged.progress
    merged.progress = {
      ...initialProgress(),
      xpBank: { ...initialProgress().xpBank, ...old.xpBank },
      pushTokens: old.pushTokens || {},
      achievements: old.achievements || {},
      streaks: old.streaks || {},
      history: old.history || [],
      date: todayKey(),
      lastResetFrom: old.date,
      lastResetAt: new Date().toISOString()
    }
  }
  return merged
}

const localKey = 'herrstromxp-v5-data'
let firebaseApp = null
let firebaseDb = null
let firebaseRef = null

export async function createStore(onChange) {
  if (hasFirebaseConfig()) {
    try {
      const { initializeApp, getApps } = await import('firebase/app')
      const { getFirestore, doc, onSnapshot, setDoc, getDoc, collection, addDoc, serverTimestamp } = await import('firebase/firestore')
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
        statusText: 'Synkad',
        diagnostics: 'Firebase är aktiv. Data synkas via Firestore.',
        save: async (data) => setDoc(firebaseRef, normalize(data)),
        notifyEvent: async (payload) => {
          try {
            await addDoc(collection(firebaseDb, 'families', defaultFamily.familyId, 'notificationRequests'), {
              ...payload,
              createdAt: serverTimestamp(),
              sent: false
            })
          } catch (err) { console.warn('Could not create notification request', err) }
        },
        unsubscribe: unsub
      }
    } catch (err) {
      console.error('Firebase init failed, using local mode', err)
      onChange(normalize(loadLocal()))
      return localStore(`Firebase hittades men kunde inte starta: ${err.message}`)
    }
  }

  onChange(normalize(loadLocal()))
  return localStore('Firebase-secrets saknas i builden. Appen sparar bara i denna webbläsare.')
}

function localStore(reason) {
  return {
    mode: 'local',
    statusText: 'Lokalt',
    diagnostics: reason,
    save: async (data) => {
      localStorage.setItem(localKey, JSON.stringify(normalize(data)))
      return normalize(data)
    },
    notifyEvent: async () => {},
    unsubscribe: () => {}
  }
}

export async function requestPushPermission(store, data) {
  if (store?.mode !== 'firebase') return { ok: false, message: 'Push kräver Firebase-läge, inte lokalt läge.' }
  if (!('Notification' in window)) return { ok: false, message: 'Den här webbläsaren stödjer inte notifieringar.' }
  if (!('serviceWorker' in navigator)) return { ok: false, message: 'Service worker saknas i webbläsaren.' }
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
  if (!vapidKey) return { ok: false, message: 'VITE_FIREBASE_VAPID_KEY saknas. Lägg Web Push certificate key som GitHub secret.' }

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

export { todayKey, yesterdayKey }

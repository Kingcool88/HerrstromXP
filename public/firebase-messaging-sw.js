// Firebase Messaging service worker.
// VIKTIGT: För full push behöver Firebase Cloud Messaging config här om du vill visa bakgrundsnotiser.
// Den här filen gör att webbläsaren kan registrera en service worker. Cloud Function-mallen sköter utskick.
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: 'HerrstromXP', body: 'Nytt godkännande väntar.' } }
  const title = data.notification?.title || data.title || 'HerrstromXP'
  const body = data.notification?.body || data.body || 'Nytt godkännande väntar.'
  event.waitUntil(self.registration.showNotification(title, { body, icon: './vite.svg', badge: './vite.svg' }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow('./'))
})

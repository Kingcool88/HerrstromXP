// Mall för Firebase Cloud Functions v2.
// Deployas separat med Firebase CLI om du vill ha riktiga pushnotiser.
// Funktion: när ett barn skickar en uppgift för godkännande skapas ett dokument i
// families/{familyId}/notificationRequests. Denna function skickar push till registrerade föräldraenheter.

const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const admin = require('firebase-admin')
admin.initializeApp()

exports.sendApprovalPush = onDocumentCreated('families/{familyId}/notificationRequests/{requestId}', async (event) => {
  const familyId = event.params.familyId
  const data = event.data.data()
  const tokensSnap = await admin.firestore().collection('families').doc(familyId).collection('pushTokens').where('enabled', '==', true).get()
  const tokens = tokensSnap.docs.map(d => d.id)
  if (!tokens.length) return
  const title = 'HerrstromXP: godkännande väntar'
  const body = `${data.childName || 'Ett barn'} vill få godkänt: ${data.taskTitle || 'uppdrag'}`
  await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    webpush: { fcmOptions: { link: '/' } }
  })
  await event.data.ref.update({ sent: true, sentAt: admin.firestore.FieldValue.serverTimestamp() })
})

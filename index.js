const functions = require('firebase-functions')
const admin = require('firebase-admin')
admin.initializeApp()

exports.sendParentNotifications = functions.firestore
  .document('families/{familyId}/notificationRequests/{requestId}')
  .onCreate(async (snap, context) => {
    const data = snap.data()
    const db = admin.firestore()
    const tokensSnap = await db.collection('families').doc(context.params.familyId).collection('pushTokens').where('enabled','==',true).get()
    const tokens = tokensSnap.docs.map(d => d.data().token).filter(Boolean)
    if (!tokens.length) return snap.ref.update({ sent: false, reason: 'No push tokens' })

    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: data.title || 'HerrstromXP',
        body: data.body || 'Ny händelse i HerrstromXP'
      },
      webpush: {
        fcmOptions: { link: 'https://kingcool88.github.io/HerrstromXP/' }
      }
    })
    return snap.ref.update({ sent: true, sentAt: admin.firestore.FieldValue.serverTimestamp() })
  })

// Valfri framtida server-reset. Klientappen gör redan reset när den öppnas efter datumbyte.
exports.midnightResetNote = functions.pubsub.schedule('5 0 * * *').timeZone('Europe/Stockholm').onRun(async () => null)

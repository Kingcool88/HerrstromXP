# HerrstromXP V4

Stabil GitHub Pages-app med Firebase/Firestore-synk, barnsystem, smarta regler och statistikpanel.

## Nytt i V4

- Tydligare synkstatus: **Synkad** eller **Lokalt** med förklaring.
- Push-händelser skapas både när barn skickar uppdrag för godkännande och när barn köper belöning.
- XP-bank sparas mellan dagar.
- Dagens klara uppdrag och köpta belöningar nollställs vid nytt datum.
- Barnsystem: nivåer, achievements, streaks och avatar/emoji per barn.
- Smarta regler i GUI:
  - föräldragodkännande av valda uppdrag
  - lås belöningar tills obligatoriska uppdrag är klara
  - minsta antal uppdrag före belöning
  - dagsbonus
  - streakbonus
  - helgbonus
  - minus-XP-regel för framtida funktioner
- Mobil/platta-anpassad layout.
- Statistikpanel för barn och admin.

## Få igång synk

I GitHub repo: Settings → Secrets and variables → Actions. Lägg in dessa som **separata secrets**:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_VAPID_KEY` om du vill aktivera push

Kör sedan om GitHub Actions. När appen är byggd med dessa kommer statusen uppe till höger visa **Synkad**.

## Firestore rules

Klistra in `firestore.rules` i Firebase → Firestore Database → Rules. Reglerna är öppna för enkel familjeapp-test. För riktig publik app bör de låsas med Firebase Auth.

## Pushnotiser

Appen kan registrera en push-token på förälderns enhet och skapa `notificationRequests` i Firestore. För riktiga utskick behövs Cloud Functions. Mall finns i `firebase-functions/index.js`.

## Automatisk midnatt-reset

Den reset som finns i appen sker när appen öppnas efter datumbyte. Det räcker normalt i en familjeapp: XP sparas, men dagens klara uppdrag och köpta belöningar rensas.

Serverstyrd midnatt-reset betyder att en Firebase Cloud Function körs vid midnatt även om ingen öppnar appen. Det är mer avancerat och behövs mest om man vill ha exakt serverlogik, rapporter eller push om missade uppgifter.

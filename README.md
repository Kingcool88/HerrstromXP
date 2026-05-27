# HerrstromXP V3

Stabil GitHub Pages-app för barnens uppdrag, XP och belöningar.

## Nytt i V3

- Riktigt grafiskt adminläge istället för JSON-redigering.
- Lägg till, ändra och ta bort uppdrag via formulär.
- Lägg till, ändra och ta bort belöningar via formulär.
- Lägg till och ändra barn, emoji, färg och XP-bank.
- Godkänn eller neka uppgifter i föräldraläget.
- Olika dagar per uppdrag och belöning.
- XP-bank sparas, men dagens avklarade uppdrag och köpta belöningar nollställs vid ny dag.
- Firebase/Firestore-synkning om secrets finns.
- Lokalt fallback-läge om Firebase saknas.
- Förberedelse för pushnotiser via Firebase Cloud Messaging.

## PIN

Standard PIN är:

```txt
2468
```

Den kan ändras i adminläget under **Inställningar**.

## GitHub Pages

Repo-namn i detta projekt är satt till:

```txt
HerrstromXP
```

Därför finns detta i `vite.config.js`:

```js
base: '/HerrstromXP/'
```

Om ditt repo heter något annat måste du ändra `base`.

## GitHub Secrets

Lägg in dessa under:

**Settings → Secrets and variables → Actions → New repository secret**

```txt
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

För pushnotiser behövs också:

```txt
VITE_FIREBASE_VAPID_KEY
```

Den finns i Firebase:

**Project settings → Cloud Messaging → Web Push certificates → Key pair**

## Pushnotiser

Appen kan registrera föräldraenheten för push och spara token i Firestore.

För att faktiskt skicka push automatiskt när ett barn klickar “klar” på ett uppdrag behövs en liten serverdel. En färdig mall finns i:

```txt
firebase-functions/index.js
```

Körs med Firebase CLI senare:

```bash
cd firebase-functions
npm install
firebase deploy --only functions
```

## Firestore rules

För enkel start finns öppna regler i `firestore.rules`. De är enkla för test hemma, men bör låsas med Firebase Auth om appen ska användas publikt.

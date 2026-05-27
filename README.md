# HerrstromXP V2

Stabil React/Vite-version för GitHub Pages med XP, två barn, belöningar, daglig reset och valfri Firebase/Firestore-synkning.

## Viktigt

`index.html` måste peka på:

```html
<script type="module" src="/src/main.jsx"></script>
```

`vite.config.js` är förinställd för repo-namnet `HerrstromXP`:

```js
base: process.env.VITE_BASE_PATH || '/HerrstromXP/'
```

Byter du repo-namn måste du ändra base path.

## GitHub secrets

Skapa 6 separata secrets i GitHub:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Exempel:

`VITE_FIREBASE_AUTH_DOMAIN` = `tygelvagenxp.firebaseapp.com`

Inte hela raden `authDomain: ...`, bara värdet.

## Firestore rules

För enkel familjeapp/test ligger reglerna öppna i `firestore.rules`. Publicera dem i Firebase Console > Firestore > Rules.

## Ändra barn, uppdrag och belöningar

Öppna:

`src/data/defaultFamily.js`

Där ändrar du:

- barnens namn
- uppdrag
- XP per uppdrag
- belöningar
- kostnad i XP
- vilka veckodagar de gäller
- om uppdrag kräver föräldragodkännande

Veckodagar:

`mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`

## Föräldraläge

Standard-PIN är:

`2468`

Ändras i `src/data/defaultFamily.js`.

## Om GitHub webben inte laddar upp .github-mappen

Skapa filen manuellt i GitHub med namnet:

`.github/workflows/deploy.yml`

Klistra in innehållet från projektets deploy.yml.

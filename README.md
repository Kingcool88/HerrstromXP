# Barnens Uppdrag – GitHub Pages + Firebase Sync

En fristående chore/reward-hemsida för två barn. Den är byggd som en statisk React/Vite-app för GitHub Pages, men kan synka mellan flera mobiler/surfplattor via Firebase Firestore.

## Funktioner

- Två barn med egna färger/avatarer
- Uppgifter per barn och veckodag
- XP per uppgift och dagsbonus när alla uppgifter är klara
- XP-bank som följer barnet över tid
- Mål/belöningar som köps för XP
- Olika mål per veckodag, t.ex. TV-spel på fredag/lördag/söndag
- Dagens köpta mål nollställs automatiskt nästa datum
- Backup/export/import
- JSON-editor direkt i appen
- GitHub Actions-deploy till GitHub Pages
- Fungerar lokalt utan Firebase, men då sparas allt bara i webbläsaren

## Snabbstart lokalt

```bash
npm install
npm run dev
```

## Publicera på GitHub Pages

1. Skapa ett nytt GitHub-repo.
2. Ladda upp alla filer i projektet.
3. Gå till **Settings → Pages**.
4. Välj **Source: GitHub Actions**.
5. Pusha till `main`.

## Aktivera synkning med Firebase

1. Gå till Firebase Console och skapa ett projekt.
2. Skapa en webbapp i Firebase-projektet.
3. Kopiera Firebase Config-värdena.
4. Skapa en fil som heter `.env` i projektets rot.
5. Kopiera innehållet från `.env.example` och fyll i dina värden.
6. Skapa Firestore Database i Firebase.
7. Lägg in reglerna från `firestore.rules` i Firebase → Firestore → Rules.
8. Kör/pusha om sidan.

Exempel:

```env
VITE_FIREBASE_API_KEY=din_api_key
VITE_FIREBASE_AUTH_DOMAIN=ditt-projekt.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ditt-projekt-id
VITE_FIREBASE_STORAGE_BUCKET=ditt-projekt.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
VITE_FAMILY_ID=herrstroms-superhemligt-namn
```

`VITE_FAMILY_ID` styr vilket dokument i Firestore som används. Välj något svårt att gissa om appen ligger publikt.

## Lägga till nya uppgifter

Öppna **Inställningar** i appen och ändra JSON.

Exempel på uppgift:

```js
{
  "id": "brush-teeth",
  "title": "Borsta tänderna",
  "points": 10,
  "icon": "🪥",
  "days": ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
  "childIds": ["annie", "albin"],
  "category": "Kväll"
}
```

## Lägga till mål som köps för XP

Exempel: TV-spel 30 minuter för 100 XP, bara fredag–söndag.

```js
{
  "id": "gaming30",
  "title": "TV-spel 30 minuter",
  "cost": 100,
  "icon": "🎮",
  "days": ["fri", "sat", "sun"],
  "childIds": ["annie", "albin"],
  "resetDaily": true
}
```

Veckodagar:

- `mon` måndag
- `tue` tisdag
- `wed` onsdag
- `thu` torsdag
- `fri` fredag
- `sat` lördag
- `sun` söndag

## Viktigt om säkerhet

Nuvarande Firestore-regler är enkla och öppna för att vara lätt att komma igång med. Det passar bäst för en privat/lågkänslig familjeapp med svårgissad URL och svårgissat `VITE_FAMILY_ID`.

Vill du ha riktig inloggning kan nästa version byggas med Firebase Authentication och låsta regler per familj.

Test

# HerrstromXP V7

Ny version med Google-login, onboarding, tema-växlare, barnprofiler, kompisliga, League Points, dashboard, achievements-grund, smarta regler, belöningar, admin-GUI och tydligare mobil/platta-layout.

## Viktigt
- Lägg in Firebase secrets i GitHub Actions.
- Aktivera Google Login i Firebase Authentication.
- Lägg till `kingcool88.github.io` under Authorized domains.
- Publicera `firestore.rules` i Firebase Firestore.

## GitHub-upload
Om `.github` eller `public` inte följer med i web-upload:
- skapa `.github/workflows/deploy.yml` manuellt i GitHub
- skapa `public/.gitkeep` manuellt

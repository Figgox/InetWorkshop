# InetWorkshop

URL: https://figgox.github.io/InetWorkshop/

## Firebase login

Boards are stored per person in Firebase Realtime Database, gated by a
name + PIN (see `auth.js`). The PIN is only a simple client-side gate, not
real authentication — anyone with the database URL could in theory read or
write if they guess a PIN, so don't put anything sensitive in tickets.

`firebase-config.js` is gitignored so the real Firebase values never end up
in the repo — copy `firebase-config.example.js` to `firebase-config.js` for
local testing.

Before login works:

1. Copy `firebase-config.example.js` to `firebase-config.js` and fill in
   real values (from Firebase Console → Project settings → Your apps).
2. Add the same values as repository secrets (Settings → Secrets and
   variables → Actions → New repository secret), so the deploy workflow can
   generate `firebase-config.js` for the live site:
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_DATABASE_URL`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`
3. Set database rules that allow read/write under `/users` without Firebase
   Auth (otherwise the default test-mode rules lock down after 30 days):

   ```json
   {
     "rules": {
       "users": {
         "$slug": {
           ".read": true,
           ".write": true
         }
       }
     }
   }
   ```
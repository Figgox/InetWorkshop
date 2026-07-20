// Firebase project config template.
// Copy this file to firebase-config.js (gitignored) and fill in real values
// from: Firebase Console -> Project settings (gear icon) -> General tab ->
// "Your apps" -> SDK setup and configuration -> Config.
//
// The deployed site on GitHub Pages does not use this file directly — the
// GitHub Actions workflow generates a real firebase-config.js from repo
// secrets at deploy time (see .github/workflows/static.yml).
const firebaseConfig = {
  apiKey: "TODO",
  authDomain: "TODO.firebaseapp.com",
  databaseURL: "https://TODO-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "TODO",
  storageBucket: "TODO.firebasestorage.app",
  messagingSenderId: "TODO",
  appId: "TODO"
};

firebase.initializeApp(firebaseConfig);

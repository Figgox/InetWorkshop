// Simple name + PIN "login" gate. This is NOT real authentication — it just
// picks which /users/{slug} node in Firebase a person's board is stored
// under, so colleagues don't accidentally edit each other's tickets. Anyone
// who has the database URL and guesses a PIN can still read/write it; the
// database rules must allow public read/write under /users for this to work
// (see README for the rule snippet), since there's no Firebase Auth sign-in
// behind it.
(function(){
  const SESSION_KEY = 'InetWorkshop-session-v1';
  const THEME_KEY = 'InetWorkshop-theme-pref';

  // Applies a theme before login (and before any per-user theme is known)
  // and keeps the toggle button's icon in sync with it.
  function applyPreTheme(theme){
    document.body.setAttribute('data-theme', theme);
    document.getElementById('login-theme-toggle').textContent = theme === 'light' ? '🌙' : '☀️';
  }

  applyPreTheme(localStorage.getItem(THEME_KEY) || 'light');

  document.getElementById('login-theme-toggle').addEventListener('click', () => {
    const next = document.body.getAttribute('data-theme') === 'light' ? 'night-shift' : 'light';
    localStorage.setItem(THEME_KEY, next);
    applyPreTheme(next);
  });

  function slugify(name){
    return name.trim().toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[.#$\[\]/]/g, '_');
  }

  async function sha256Hex(text){
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function showError(msg){
    document.getElementById('login-error').textContent = msg;
  }

  function showApp(displayName){
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-wrap').classList.remove('hidden');
    document.getElementById('logged-in-as').textContent = displayName;
  }

  let resolveReady;
  const readyPromise = new Promise((res) => { resolveReady = res; });

  async function attemptLogin(rawName, rawPin){
    const displayName = rawName.trim();
    const pin = rawPin.trim();
    if(!displayName || !pin){
      showError('Fyll i både namn och PIN-kod.');
      return;
    }
    const slug = slugify(displayName);
    if(!slug){
      showError('Ogiltigt namn.');
      return;
    }

    const submitBtn = document.querySelector('#login-form button[type="submit"]');
    submitBtn.disabled = true;
    try{
      const hash = await sha256Hex(slug + ':' + pin);
      const userRef = firebase.database().ref('users/' + slug);
      const snap = await userRef.once('value');
      const existing = snap.val();

      if(existing && existing.pinHash){
        if(existing.pinHash !== hash){
          showError('Fel PIN-kod.');
          return;
        }
      }else{
        await userRef.update({ pinHash: hash, displayName: displayName });
      }

      localStorage.setItem(SESSION_KEY, JSON.stringify({ slug, displayName }));
      showApp(displayName);
      resolveReady({ slug, displayName });
    }catch(e){
      showError('Kunde inte nå databasen. Kontrollera internetuppkopplingen.');
    }finally{
      submitBtn.disabled = false;
    }
  }

  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    showError('');
    attemptLogin(
      document.getElementById('login-name').value,
      document.getElementById('login-pin').value
    );
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem(SESSION_KEY);
    location.reload();
  });

  // Stay logged in on this device without re-entering the PIN every time.
  const saved = localStorage.getItem(SESSION_KEY);
  if(saved){
    try{
      const { slug, displayName } = JSON.parse(saved);
      showApp(displayName);
      resolveReady({ slug, displayName });
    }catch(e){
      localStorage.removeItem(SESSION_KEY);
    }
  }

  window.Auth = {
    ready: () => readyPromise
  };
})();

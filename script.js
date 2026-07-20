(function(){
  const STORAGE_KEY = 'InetWorkbench-data-v1';
  let state = { short: [], long: [], nextShort: 1, nextLong: 1, theme: 'light' };
  let saveTimer = null;

  function applyTheme(name){
    document.body.setAttribute('data-theme', name);
    document.getElementById('theme-select').value = name;
  }

  function setStatus(text, fade){
    const el = document.getElementById('save-status');
    el.textContent = text;
    if(fade){
      clearTimeout(el._t);
      el._t = setTimeout(()=>{ el.textContent=''; }, 1500);
    }
  }

  async function storageGet(key){
    if(window.storage && typeof window.storage.get === 'function'){
      const res = await window.storage.get(key);
      if(res && typeof res === 'object' && 'value' in res){
        return res.value;
      }
      if(typeof res === 'string'){
        return res;
      }
      return null;
    }
    try{
      return window.localStorage.getItem(key);
    }catch(e){
      return null;
    }
  }

  async function storageSet(key, value){
    if(window.storage && typeof window.storage.set === 'function'){
      return await window.storage.set(key, value);
    }
    try{
      window.localStorage.setItem(key, value);
      return true;
    }catch(e){
      return false;
    }
  }

  async function load(){
    try{
      const saved = await storageGet(STORAGE_KEY);
      if(saved){
        const parsed = JSON.parse(saved);
        state = Object.assign({ short: [], long: [], nextShort: 1, nextLong: 1, theme: 'light' }, parsed);
      }
    }catch(e){
      // no saved data yet, or storage unavailable — start fresh
    }
    applyTheme(state.theme || 'light');
    render();
  }

  async function save(){
    setStatus('Sparar...');
    try{
      const result = await storageSet(STORAGE_KEY, JSON.stringify(state));
      if(result){
        setStatus('Sparad', true);
      }else{
        setStatus('Sparning misslyckades', true);
      }
    }catch(e){
      setStatus('Sparning misslyckades', true);
    }
  }

  function queueSave(){
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 500);
  }

  function newTicket(kind){
    const id = kind === 'short' ? state.nextShort++ : state.nextLong++;
    const prefix = kind === 'short' ? 'T' : 'P';
    return {
      id: prefix + String(id).padStart(3,'0'),
      link: '',
      contact: '',
      notes: '',
      status: 'öppen',
      created: new Date().toISOString()
    };
  }

  function fmtDate(iso){
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {month:'short', day:'numeric'}) + ' · ' +
           d.toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit', hour12:false});
  }

  function looksLikeUrl(str){
    return /^https?:\/\//i.test(str.trim());
  }

  function renderColumn(kind){
    const list = state[kind];
    const container = document.getElementById(kind === 'short' ? 'cards-short' : 'cards-long');
    container.innerHTML = '';

    if(list.length === 0){
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = kind === 'short'
        ? 'Inga efterarbeten i stunden. Lägg till med knappen ovan.'
        : 'Inga projekt spårade ännu. Lägg till ett för att börja följa det här.';
      container.appendChild(empty);
    }

    list.forEach((t) => {
      const card = document.createElement('div');
      card.className = 'ticket' + (t.status === 'färdig' ? ' done' : '');

      const head = document.createElement('div');
      head.className = 'ticket-head';
      head.innerHTML = `
        <span class="ticket-id">${t.id}</span>
      `;
      const headRight = document.createElement('div');
      headRight.className = 'ticket-head-right';

      const select = document.createElement('select');
      select.className = 'status';
      select.dataset.val = t.status;
      ['öppen','väntar','färdig'].forEach(s=>{
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s === 'öppen' ? 'Öppen' : s === 'väntar' ? 'Väntar' : 'Färdig';
        if(s === t.status) opt.selected = true;
        select.appendChild(opt);
      });
      select.addEventListener('change', ()=>{
        t.status = select.value;
        select.dataset.val = select.value;
        card.className = 'ticket' + (t.status === 'färdig' ? ' done' : '');
        queueSave();
      });
      headRight.appendChild(select);

      const del = document.createElement('button');
      del.className = 'del-btn';
      del.innerHTML = '&times;';
      del.title = 'Delete';
      del.addEventListener('click', ()=>{
        const idx = state[kind].indexOf(t);
        if(idx > -1){
          state[kind].splice(idx,1);
          renderColumn(kind);
          updateCount(kind);
          queueSave();
        }
      });
      headRight.appendChild(del);
      head.appendChild(headRight);
      card.appendChild(head);

      const tear = document.createElement('div');
      tear.className = 'tear';
      card.appendChild(tear);

      const body = document.createElement('div');
      body.className = 'ticket-body';

      // link row
      const linkRow = document.createElement('div');
      linkRow.className = 'field-row';
      const linkLabel = document.createElement('span');
      linkLabel.className = 'field-label';
      linkLabel.textContent = 'Länk';
      const linkInput = document.createElement('input');
      linkInput.className = 'link-input';
      linkInput.placeholder = 'C1 länk / Ärende #';
      linkInput.value = t.link;
      linkInput.addEventListener('input', ()=>{ t.link = linkInput.value; queueSave(); refreshOpenLink(); });
      linkInput.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter'){
          e.preventDefault();
          contactInput.focus();
        }
      });
      linkRow.appendChild(linkLabel);
      linkRow.appendChild(linkInput);


      /// Open Link button
      const openLink = document.createElement('a');
      openLink.className = 'open-link';
      openLink.target = '_blank';
      openLink.rel = 'noopener noreferrer';
      function refreshOpenLink(){
        if(looksLikeUrl(t.link)){
          openLink.href = t.link.trim();
          openLink.style.display = 'inline-block';
          openLink.textContent = 'Open ↗';
        } else {
          openLink.style.display = 'none';
        }
      }
      refreshOpenLink();
      linkRow.appendChild(openLink);
      body.appendChild(linkRow);
      

      // contact row
      const contactRow = document.createElement('div');
      contactRow.className = 'field-row';
      const contactLabel = document.createElement('span');
      contactLabel.className = 'field-label';
      contactLabel.textContent = 'Vem?';
      const contactInput = document.createElement('input');
      contactInput.placeholder = 'Kund / Epost / Telefon';
      contactInput.value = t.contact;
      contactInput.addEventListener('input', ()=>{ t.contact = contactInput.value; queueSave(); });
      contactInput.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter'){
          e.preventDefault();
          notes.focus();
        }
      });
      contactRow.appendChild(contactLabel);
      contactRow.appendChild(contactInput);
      body.appendChild(contactRow);

      // notes
      const notes = document.createElement('textarea');
      notes.className = 'notes';
      notes.placeholder = ' Anteckningar / Kommentarer';
      notes.value = t.notes;
      notes.addEventListener('input', ()=>{ t.notes = notes.value; queueSave(); });
      body.appendChild(notes);

      const footer = document.createElement('div');
      footer.className = 'ticket-footer';
      footer.textContent = 'Tillagt ' + fmtDate(t.created);
      body.appendChild(footer);

      card.appendChild(body);
      container.appendChild(card);
    });
  }

  function updateCount(kind){
    const list = state[kind];
    const openCount = list.filter(t => t.status !== 'färdig').length;
    document.getElementById(kind === 'short' ? 'count-short' : 'count-long').textContent =
      openCount + ' Öppna';
  }

  function render(){
    renderColumn('short');
    renderColumn('long');
    updateCount('short');
    updateCount('long');
  }

  document.getElementById('theme-select').addEventListener('change', (e)=>{
    state.theme = e.target.value;
    applyTheme(state.theme);
    queueSave();
  });

  document.getElementById('add-short').addEventListener('click', ()=>{
    state.short.unshift(newTicket('short'));
    renderColumn('short');
    updateCount('short');
    queueSave();
  });
  document.getElementById('add-long').addEventListener('click', ()=>{
    state.long.unshift(newTicket('long'));
    renderColumn('long');
    updateCount('long');
    queueSave();
  });

  document.getElementById('export-btn').addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Inet Workbench-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('import-btn').addEventListener('click', ()=>{
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const parsed = JSON.parse(reader.result);
        state = Object.assign({ short: [], long: [], nextShort: 1, nextLong: 1, theme: 'light' }, parsed);
        applyTheme(state.theme || 'light');
        render();
        queueSave();
      }catch(err){
        alert('Could not read that file — is it an Inet Workbench export?');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  load();
})();

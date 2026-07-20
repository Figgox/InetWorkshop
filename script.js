(function(){
  let state = { short: [], long: [], nextShort: 1, nextLong: 1, theme: 'light' };
  let saveTimer = null;
  let dragState = null; // set while a ticket is being dragged, see initDragDrop()
  let userSlug = null; // set once auth.js resolves the logged-in user, see boot() below

  // Switches the active theme (light/night-shift/terminal) and keeps the
  // dropdown showing the right option.
  function applyTheme(name){
    document.body.setAttribute('data-theme', name);
    document.getElementById('theme-select').value = name;
  }

  // Shows a message in the top-right corner (e.g. "Sparar…"), optionally
  // clearing it again after a short delay.
  function setStatus(text, fade){
    const el = document.getElementById('save-status');
    el.textContent = text;
    if(fade){
      clearTimeout(el._t);
      el._t = setTimeout(()=>{ el.textContent=''; }, 1500);
    }
  }

  // Reads the logged-in user's board from Firebase Realtime Database.
  async function storageGet(){
    const snap = await firebase.database().ref('users/' + userSlug + '/board').once('value');
    return snap.val();
  }

  // Writes the logged-in user's board to Firebase Realtime Database.
  async function storageSet(value){
    await firebase.database().ref('users/' + userSlug + '/board').set(value);
    return true;
  }

  // Loads the logged-in user's saved board, then draws it.
  async function load(){
    try{
      const saved = await storageGet();
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

  // Persists the current state to storage.
  async function save(){
    setStatus('Sparar...');
    try{
      const result = await storageSet(JSON.stringify(state));
      if(result){
        setStatus('Sparad', true);
      }else{
        setStatus('Sparning misslyckades', true);
      }
    }catch(e){
      setStatus('Sparning misslyckades', true);
    }
  }

  // Debounce
  function queueSave(){
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 500);
  }

  // Creates a blank ticket with an auto-incrementing id: T001, T002... for
  // "Idag" tickets, P001, P002... for "Projects".
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

  // Formats a timestamp as e.g. "20 juli · 14:05" (24h clock).
  function fmtDate(iso){
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {month:'short', day:'numeric'}) + ' · ' +
           d.toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit', hour12:false});
  }

  // Checks whether a string looks like a clickable http(s) link.
  function looksLikeUrl(str){
    return /^https?:\/\//i.test(str.trim());
  }

  // Turns a ticket id into a hue (0-360) for its left-edge color strip.
  // Uses the golden angle so sequential ids (T001, T002, T003...) end up
  // spread around the color wheel instead of landing on near-identical hues.
  function hashHue(id){
    const num = parseInt(id.replace(/\D/g, ''), 10) || 0;
    return (num * 137.508) % 360;
  }

  // Rebuilds one column's ticket cards from scratch based on the current
  // state. Called after any change (add/delete/edit/reorder) since the

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

    list.forEach((t, index) => {
      const card = document.createElement('div');
      card.className = 'ticket' + (t.status === 'färdig' ? ' done' : '');
      card.style.setProperty('--ticket-hue', hashHue(t.id));

      // Dragging
      card.addEventListener('dragstart', ()=>{
        dragState = { kind, index };
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', ()=>{
        card.classList.remove('dragging');
        card.draggable = false;
        container.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el=>{
          el.classList.remove('drag-over-top', 'drag-over-bottom');
        });
        dragState = null;
      });

      const head = document.createElement('div');
      head.className = 'ticket-head';
      head.innerHTML = `
        <div class="ticket-head-left">
          <span class="drag-handle" title="Dra för att ändra ordning">⠿</span>
          <span class="ticket-id">${t.id}</span>
        </div>
      `;

      head.querySelector('.drag-handle').addEventListener('mousedown', ()=>{
        card.draggable = true;
      });
      const headRight = document.createElement('div');
      headRight.className = 'ticket-head-right';

      // Status dropdown (öppen / väntar / färdig)
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
      // Enter jumps to the next field instead of doing nothing
      linkInput.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter'){
          e.preventDefault();
          contactInput.focus();
        }
      });
      linkRow.appendChild(linkLabel);
      linkRow.appendChild(linkInput);


      // "Open ↗" button — only shown once the link field looks like a URL
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

  // Sets up drag-and-drop reordering for one column. Listens on the whole
  // document (not just the column) so dropping far above/below the card
  // list still works — the ticket's own kind ('short'/'long') is what
  // decides which column a drop actually belongs to.
  function initDragDrop(kind){
    const container = document.getElementById(kind === 'short' ? 'cards-short' : 'cards-long');

    // Figures out which position in the list a given mouse Y-coordinate
    // corresponds to, by comparing it against each card's vertical middle.
    function dropIndexAt(clientY){
      const cards = Array.from(container.querySelectorAll('.ticket'));
      for(let i = 0; i < cards.length; i++){
        const rect = cards[i].getBoundingClientRect();
        if(clientY < rect.top + rect.height / 2) return i;
      }
      return cards.length;
    }

    // While dragging: highlight where the ticket would land if dropped now.
    document.addEventListener('dragover', (e)=>{
      if(!dragState || dragState.kind !== kind) return;
      e.preventDefault();
      const cards = Array.from(container.querySelectorAll('.ticket'));
      container.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el=>{
        el.classList.remove('drag-over-top', 'drag-over-bottom');
      });
      if(cards.length === 0) return;
      const to = dropIndexAt(e.clientY);
      // Highlight both the bottom of the card above and the top of the
      // card below, so the gap you're targeting is obvious.
      if(to > 0){
        cards[to - 1].classList.add('drag-over-bottom');
      }
      if(to < cards.length){
        cards[to].classList.add('drag-over-top');
      }
    });

    // On drop: move the ticket to its new position in the array and re-render.
    document.addEventListener('drop', (e)=>{
      if(!dragState || dragState.kind !== kind) return;
      e.preventDefault();
      container.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el=>{
        el.classList.remove('drag-over-top', 'drag-over-bottom');
      });
      const from = dragState.index;
      const to = dropIndexAt(e.clientY);
      dragState = null;
      if(to === from || to === from + 1) return; // dropped back where it started
      const list = state[kind];
      const [moved] = list.splice(from, 1);
      list.splice(to > from ? to - 1 : to, 0, moved);
      renderColumn(kind);
      queueSave();
    });
  }

  // Updates the "X Öppna" badge for a column.
  function updateCount(kind){
    const list = state[kind];
    const openCount = list.filter(t => t.status !== 'färdig').length;
    document.getElementById(kind === 'short' ? 'count-short' : 'count-long').textContent =
      openCount + ' Öppna';
  }

  // Draws both columns and refreshes their open-ticket counts.
  function render(){
    renderColumn('short');
    renderColumn('long');
    updateCount('short');
    updateCount('long');
  }

  initDragDrop('short');
  initDragDrop('long');

  // ---- Wire up the top bar and column buttons ----

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

  // Export: download the whole board as a JSON file
  document.getElementById('export-btn').addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Inet Workbench-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  // Import: load a previously exported JSON file back into the board
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

  // Wait for auth.js to resolve the logged-in user before loading their
  // board — userSlug decides which Firebase path storageGet/storageSet use.
  window.Auth.ready().then(({ slug }) => {
    userSlug = slug;
    load();
  });
})();

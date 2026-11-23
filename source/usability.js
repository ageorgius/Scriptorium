/* BEGIN SCRIPTORIUM USABILITY — Go anywhere (Ctrl + K), a start page, previews of Scripture references,
   backup and restore, reading mode, keyboard shortcuts, tidier study tabs and remembered places. */
(() => {
  'use strict';
  const { el, recall, keep, books, bookName, fold, sleep, typing, on, apiUse, watch, ready } = window.Scriptorium;
  const { aliases, pattern: referencePattern, readMatch, parseTyped, label: refLabel, hebrewPsalm } = window.Scriptorium.refs;
  const S = () => window.ScriptoriumStudy, L = () => window.ScriptoriumLiturgy;
  const say = t => { if (typeof toast === 'function') toast(t); };
  const oops = e => { if (typeof fail === 'function') fail(e); else console.error(e); };
  const closeDialogs = () => document.querySelectorAll('dialog[open]').forEach(d => d.close());

  // ======================================================================
  // Previews: point at a reference in a commentary, sermon or homily to read the verse
  // ======================================================================
  const PREVIEW_IN = '#commentary-results, #liturgy-panel, .lit-reading, .lit-dialog-text, .st-results, .st-notes, #word-panel, #bt-detail';
  const SKIP = 'a, button, input, textarea, select, script, style, summary, h1, .st-ref, .ux-card, .bm-saved-card';
  const vulgateHere = node => !!node.closest?.('#commentary-results, #liturgy-panel, .lit-reading, .lit-dialog-text, .st-results');
  function linkify(root) {
    if (!state.meta?.books) return;
    const re = referencePattern();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.data.length > 4 && /\d/.test(n.data) && !n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    const nodes = []; let n; while ((n = walker.nextNode())) nodes.push(n);
    for (const node of nodes) {
      const text = node.data, found = [];
      re.lastIndex = 0; let m;
      while ((m = re.exec(text))) { const r = readMatch(m); if (r) found.push(r); }
      if (!found.length) continue;
      const frag = document.createDocumentFragment(); let at = 0;
      for (const r of found) {
        if (r.start < at) continue;
        frag.append(text.slice(at, r.start));
        const a = el('a', { href: '#', class: 'st-ref', 'data-book': r.code, 'data-chapter': r.chapter, 'data-verse': r.verse, 'data-end': r.endVerse || r.verse, 'data-vulgate': r.code === 'Psa' && vulgateHere(node.parentElement) ? '1' : null }, text.slice(r.start, r.end));
        frag.append(a); at = r.end;
      }
      frag.append(text.slice(at));
      node.replaceWith(frag);
    }
  }
  watch(PREVIEW_IN, roots => { for (const r of roots) if (!r.matches('.st-ref')) linkify(r); });
  // Each Bible keeps its own Psalm numbers: the Douay and the Vulgate count as the Septuagint does, the KJV as the Hebrew.
  const psalmStyle = new Map();
  function readerVersion() { return state.english || (typeof columns === 'function' ? columns()[0] : 'KJV'); }
  async function readsVulgatePsalms(version = readerVersion()) {
    if (!psalmStyle.has(version)) psalmStyle.set(version, api('/api/chapter', { book: 'Psa', chapter: 9, versions: version })
      .then(d => d.rows.filter(r => r.columns.some(c => c.version === version && c.parts?.some(p => p.text))).length > 30).catch(() => false));
    return psalmStyle.get(version);
  }
  // A Psalm numbered as in the Vulgate → the numbers of the Bible being read.
  async function psalmForReader(c, v = 1) { return (await readsVulgatePsalms()) ? [c, v] : hebrewPsalm(c, v); }
  async function linkTarget(a) {
    let c = +a.dataset.chapter, v = +a.dataset.verse, e = +a.dataset.end;
    let note = '';
    if (a.dataset.vulgate === '1' && !a.dataset.literal && !(await readsVulgatePsalms())) {
      const [hc, hv] = hebrewPsalm(c, v), [, he] = hebrewPsalm(c, e);
      if (hc !== c) note = `Psalm ${c} in the Vulgate numbering is Psalm ${hc} in your Bible.`;
      c = hc; v = hv; e = Math.max(hv, he);
    }
    return { book: a.dataset.book, chapter: c, verse: v, end: e, note };
  }
  // The verses, from the English text you read in.
  const chapterCache = new Map();
  async function verses(book, chapter, from, to) {
    const version = state.english || (typeof columns === 'function' ? columns()[0] : 'KJV');
    const key = `${book}/${chapter}/${version}`;
    if (!chapterCache.has(key)) chapterCache.set(key, api('/api/chapter', { book, chapter, versions: version }).catch(e => { chapterCache.delete(key); throw e; }));
    const data = await chapterCache.get(key);
    const rows = data.rows.filter(r => r.verse >= from && r.verse <= Math.min(to, from + 7));
    return { version, more: to > from + 7, rows: rows.map(r => ({ verse: r.verse, text: (r.columns.find(c => c.version === version) || r.columns[0])?.parts?.map(p => p.text).join(' ').trim() || '' })) };
  }
  let card = null, cardFor = null, showTimer = null, hideTimer = null;
  function hideCard() { clearTimeout(showTimer); card?.remove(); card = null; cardFor = null; }
  async function showCard(a) {
    clearTimeout(hideTimer);
    if (cardFor === a) return;
    hideCard(); cardFor = a;
    const t = await linkTarget(a), label = `${bookName(t.book)} ${t.chapter}:${t.verse}${t.end > t.verse ? '–' + t.end : ''}`;
    if (cardFor !== a) return;
    const body = el('div', { class: 'ux-card-text' }, el('p', { class: 'ux-card-wait' }, 'Reading…'));
    const swap = a.dataset.vulgate === '1' && t.note ? el('button', { type: 'button', class: 'quiet', onclick: () => { a.dataset.literal = '1'; hideCard(); showCard(a); } }, `Show Psalm ${a.dataset.chapter} as numbered here`) : null;
    card = el('div', { class: 'ux-card', role: 'dialog', 'aria-label': 'Preview of ' + label },
      el('div', { class: 'ux-card-head' }, el('b', {}, label), el('span', { class: 'ux-card-ver' }, '')),
      t.note ? el('p', { class: 'ux-card-note' }, t.note) : null, body,
      el('div', { class: 'ux-card-actions' }, el('button', { type: 'button', class: 'primary', onclick: () => go(a) }, 'Open in the reader ›'), swap));
    card.onmouseenter = () => clearTimeout(hideTimer);
    card.onmouseleave = () => { hideTimer = setTimeout(hideCard, 250); };
    (a.closest('dialog[open]') || document.body).append(card);
    place(a);
    try {
      const got = await verses(t.book, t.chapter, t.verse, t.end);
      if (cardFor !== a) return;
      card.querySelector('.ux-card-ver').textContent = got.version;
      body.replaceChildren(...(got.rows.length ? got.rows.map(r => el('p', {}, el('sup', {}, r.verse), ' ', r.text)) : [el('p', { class: 'ux-card-wait' }, 'This verse is not in the text you are reading.')]), ...(got.more ? [el('p', { class: 'ux-card-wait' }, '…')] : []));
      place(a);
    } catch (e) { if (cardFor === a) body.replaceChildren(el('p', { class: 'ux-card-wait' }, 'The verse could not be read: ' + e.message)); }
  }
  function place(a) {
    if (!card) return;
    const r = a.getBoundingClientRect(), w = card.offsetWidth, h = card.offsetHeight;
    const below = r.bottom + 8 + h < innerHeight;
    card.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left)) + 'px';
    card.style.top = (below ? r.bottom + 6 : Math.max(8, r.top - h - 6)) + 'px';
  }
  async function go(a) {
    hideCard();
    const t = await linkTarget(a);
    if (a.closest('dialog')) closeDialogs();
    await window.navigate(t.book, t.chapter, t.verse);
    if (t.end > t.verse) document.querySelectorAll('.verse-row').forEach(r => { const v = +r.id.replace('verse-', ''); r.classList.toggle('st-range', v >= t.verse && v <= t.end); });
  }
  document.addEventListener('mouseover', e => {
    const a = e.target.closest?.('a.st-ref');
    if (a) { clearTimeout(hideTimer); clearTimeout(showTimer); showTimer = setTimeout(() => showCard(a), 320); return; }
    if (card && !card.contains(e.target)) { clearTimeout(showTimer); clearTimeout(hideTimer); hideTimer = setTimeout(hideCard, 300); }
  });
  document.addEventListener('focusin', e => { const a = e.target.closest?.('a.st-ref'); if (a) showCard(a); });
  document.addEventListener('click', e => { const a = e.target.closest?.('a.st-ref'); if (!a) return; e.preventDefault(); e.stopPropagation(); go(a); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && card) { hideCard(); } });
  document.addEventListener('scroll', e => { if (card && !card.contains(e.target)) hideCard(); }, true);

  // ======================================================================
  // Remembering: recent passages and recently written notes
  // ======================================================================
  on('navigate', ({ to }) => {
    if (!to) return;
    const list = recall('scriptorium-recent-passages', []).filter(p => !(p.book === to.book && p.chapter === to.chapter));
    list.unshift(to); keep('scriptorium-recent-passages', list.slice(0, 12));
  });
  apiUse(async (path, query, body, next) => {
    const r = await next();
    if (path === '/api/note' && body && body.ref && !String(body.ref).startsWith('scriptorium:')) {
      const list = recall('scriptorium-recent-notes', []).filter(n => n.ref !== body.ref);
      if (body.body) list.unshift({ ref: body.ref, at: Date.now() });
      keep('scriptorium-recent-notes', list.slice(0, 20));
    }
    return r;
  });

  // ======================================================================
  // Backup and restore of every note, bookmark and highlight
  // ======================================================================
  async function noteRefs() {
    const text = await (await fetch('/api/export-notes')).text();
    const refs = [], re = /(?:^|\n\n)## (.+)\n/g; let m;
    while ((m = re.exec(text))) refs.push(m[1].trim());
    return [...new Set(refs)];
  }
  function download(name, text, type) {
    const a = el('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  async function backup() {
    say('Gathering your notes and bookmarks…');
    try {
      const refs = await noteRefs(), notes = [];
      for (let i = 0; i < refs.length; i += 20) {
        const got = await Promise.all(refs.slice(i, i + 20).map(ref => api('/api/note', { ref }).then(r => ({ ref, body: r.body || '', updated: r.updated || null })).catch(() => null)));
        for (const n of got) if (n && n.body) notes.push(n);   // a heading inside a note is not a note of its own
      }
      const settings = {};
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('scriptorium-') && !/recent|last-backup/.test(k)) settings[k] = localStorage.getItem(k); } } catch {}
      const day = new Date().toISOString().slice(0, 10);
      const bookmarks = notes.filter(n => n.ref.startsWith('scriptorium:bookmarks')).reduce((t, n) => { try { return t + JSON.parse(n.body).length; } catch { return t; } }, 0);
      download(`Scriptorium backup ${day}.json`, JSON.stringify({ app: 'Scriptorium', kind: 'notes-backup', version: 1, created: new Date().toISOString(), notes, settings }, null, 1), 'application/json');
      keep('scriptorium-last-backup', Date.now());
      say(`Backup saved: ${notes.filter(n => !n.ref.startsWith('scriptorium:')).length} notes and ${bookmarks} bookmarks. Keep the file somewhere safe, e.g. OneDrive.`);
      home?.refresh?.();
    } catch (e) { oops(e); }
  }
  function restore() {
    const input = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
    document.body.append(input);
    input.onchange = async () => {
      const file = input.files[0]; input.remove(); if (!file) return;
      let data;
      try { data = JSON.parse(await file.text()); } catch { say('That file is not a Scriptorium backup.'); return; }
      if (data?.kind !== 'notes-backup' || !Array.isArray(data.notes)) { say('That file is not a Scriptorium backup.'); return; }
      const plain = data.notes.filter(n => !n.ref.startsWith('scriptorium:'));
      let marks = []; for (const n of data.notes) if (n.ref.startsWith('scriptorium:bookmarks')) try { marks.push(...JSON.parse(n.body)); } catch {}
      let cols = []; const c = data.notes.find(n => n.ref === 'scriptorium:collections'); if (c) try { cols = JSON.parse(c.body); } catch {}
      const withSettings = el('input', { type: 'checkbox' });
      const dlg = el('dialog', { class: 'ux-dialog ux-restore', 'aria-label': 'Restore from a backup' },
        el('h2', {}, 'Restore from a backup'),
        el('p', {}, `This backup was made on ${new Date(data.created).toLocaleString()}. It holds ${plain.length} notes and ${marks.length} bookmarks and highlights.`),
        el('p', { class: 'ux-hint' }, 'Nothing you have now is deleted. Notes and bookmarks you no longer have are brought back; where a note differs from yours, the backup’s text is added below yours.'),
        Object.keys(data.settings || {}).length ? el('label', { class: 'ux-check' }, withSettings, ' Also bring back the layout and display settings') : null,
        el('div', { class: 'ux-actions' },
          el('button', { type: 'button', class: 'quiet', onclick: () => dlg.close() }, 'Cancel'),
          el('button', { type: 'button', class: 'primary', onclick: async e => { e.target.disabled = true; e.target.textContent = 'Restoring…'; await apply(); dlg.close(); } }, 'Restore')));
      dlg.addEventListener('close', () => dlg.remove());
      document.body.append(dlg); dlg.showModal();
      async function apply() {
        let added = 0, merged = 0, same = 0, tooLong = 0;
        try {
          for (const n of plain) {
            const cur = (await api('/api/note', { ref: n.ref })).body || '';
            if (!cur.trim()) { await api('/api/note', {}, { ref: n.ref, body: n.body }); added++; continue; }
            if (cur.trim() === n.body.trim() || cur.includes(n.body.trim())) { same++; continue; }
            const both = `${cur}\n\n— From the backup of ${String(data.created).slice(0, 10)} —\n${n.body}`;
            if (both.length > 100000) { tooLong++; continue; }
            await api('/api/note', {}, { ref: n.ref, body: both }); merged++;
          }
          const back = await S()?.mergeMarks(marks, cols) || 0;
          if (withSettings.checked) for (const [k, v] of Object.entries(data.settings || {})) try { localStorage.setItem(k, v); } catch {}
          say(`Restored: ${added} notes brought back, ${merged} combined with yours, ${same} already the same; ${back} bookmarks brought back.${tooLong ? ` ${tooLong} notes were too long to combine.` : ''}${withSettings.checked ? ' Restart Scriptorium for the settings.' : ''}`);
          S()?.redraw(); home?.refresh?.();
        } catch (e) { oops(e); }
      }
    };
    input.click();
  }

  // ======================================================================
  // Go anywhere (Ctrl + K)
  // ======================================================================
  const ICONS = { catena: '☩', go: '↦', tool: '◇', day: '✠', sermon: '❧', homily: '❧', mark: '★', note: '✎', time: '⏳', map: '⌖', search: '⌕', place: '⌖' };
  function commands() {
    const tab = id => () => { closeDialogs(); typeof studyTab === 'function' && studyTab(id); };
    const click = id => () => { closeDialogs(); document.getElementById(id)?.click(); };
    return [
      ['Start page', 'Continue reading, today’s Mass, recent bookmarks', () => { closeDialogs(); openHome(); }],
      ['Today’s Mass', '1962 Missal', () => massOf(new Date())],
      ['Next Sunday’s Mass', '1962 Missal', () => massOf(nextSunday())],
      ['Atlas', 'The Bible map, places and journeys', click('bible-map-open')], ['Maps', 'All prepared maps (Atlas)', () => { closeDialogs(); window.ScriptoriumMedia?.openView('maps'); }],
      ['Timeline', 'Bible and world history', click('timeline-open')], ['My study', 'Everything you saved: bookmarks, highlights and notes', () => { closeDialogs(); S()?.openStudy('saved'); }],
      ['My notes', 'Every note you have written', () => { closeDialogs(); S()?.openStudy('notes'); }], ['Search the Fathers', 'Sermons, Catena Aurea, homilies, Missal, Boylan, notes', () => { closeDialogs(); S()?.openStudy('search'); }],
      ['Liturgy', 'The 1962 calendar', tab('liturgy')], ['Commentary', 'On the verse you are reading', tab('commentary')], ['Word study', 'Dictionaries for the word you select', tab('word')],
      ['Reading mode', 'Only the text (F11)', () => { closeDialogs(); readingMode(); }], ['Display settings', 'Bibles shown, layout, text size, verse alignment, dark mode', () => { closeDialogs(); document.getElementById('sx-display')?.click(); }], ['Dark mode / light mode', '', click('theme-toggle')],
      ['Show or hide the library', '', click('library-toggle')], ['Show or hide the study panel', '', click('study-toggle')],
      ['More search options', 'Words, lemmas, Strong’s numbers, morphology', click('search-open')], ['Keyboard shortcuts', 'Press ? at any time', () => { closeDialogs(); shortcuts(); }],
      ['Back up notes and bookmarks', 'Save everything to one file', () => { closeDialogs(); backup(); }], ['Restore from a backup', '', () => { closeDialogs(); restore(); }],
      ['Next chapter', ']', () => typeof stepChapter === 'function' && stepChapter(1)], ['Previous chapter', '[', () => typeof stepChapter === 'function' && stepChapter(-1)],
      ['Sources & help', '', click('about')]
    ].map(([title, sub, run]) => ({ kind: 'tool', group: 'Tools', title, sub, run }));
  }
  let sourcesCache = null;
  async function gatherSources(update) {
    const out = { Tools: commands(), Bookmarks: [], Notes: [], Liturgy: [], Sermons: [], Catena: [], Timeline: [], Maps: [] };
    const set = (group, items) => { out[group] = items; update(out); };
    update(out);
    const jobs = [];
    jobs.push((async () => { const marks = S() ? await S().loadMarks() : []; set('Bookmarks', marks.map(m => ({ kind: 'mark', group: 'Bookmarks', title: m.label, sub: [m.sub, ...(m.tags || []).map(t => '#' + t), ...(m.collections || [])].filter(Boolean).join(' · '), extra: m.note || m.quote || '', run: () => S().openMark(m) }))); })());
    jobs.push((async () => { if (!S()) return; const notes = await S().allNotes(); const items = []; for (const n of notes) { const d = await S().describeNote(n); items.push({ kind: 'note', group: 'Notes', title: d.label, sub: n.body.slice(0, 90), extra: n.body, run: () => d.open?.() }); } set('Notes', items); })());
    jobs.push((async () => {
      if (!L()) return;
      const { data, sermons } = await L().load();
      set('Liturgy', data.days.map(d => ({ kind: 'day', group: 'Liturgy', title: d.title, sub: [d.subtitle, d.group, d.note].filter(Boolean).join(' · '), extra: [...(d.gospels || []).map(g => g.text), ...(d.epistles || []).map(e => e.text)].join(' '), refs: [...(d.gospels || []), ...(d.epistles || [])].flatMap(x => x.refs || []), run: () => { closeDialogs(); L().showDay(d); } })));
      const ser = [...sermons.values()].map(s => ({ kind: 'sermon', group: 'Sermons', title: `${s.father} — ${s.title}`, sub: s.work, extra: s.ref ? refLabel({ code: s.ref.book, chapter: s.ref.chapter, verse: s.ref.verse }) : '', run: () => { closeDialogs(); L().openSermon(s.id); } }));
      for (const [id, h] of Object.entries(data.homilies || {})) ser.push({ kind: 'homily', group: 'Sermons', title: `${(h.father || h.author || 'Homily').replace(/^(Homily|Sermon|Exposition)\s+(by|of|from)\s+/i, '')} — ${h.ref}`, sub: 'Matins homily' + (h.title ? ' · ' + h.title : ''), run: () => { closeDialogs(); L().openHomily(id); } });
      set('Sermons', ser);
    })());
    jobs.push((async () => { const T = window.ScriptoriumTimeline; if (!T?.entries) return; set('Timeline', T.entries().filter(e => e.title && e.kind !== 'note').map(e => ({ kind: 'time', group: 'Timeline', title: e.title, sub: T.dateText ? T.dateText(e) : '', run: () => { closeDialogs(); T.open(e.id); } }))); })());
    jobs.push((async () => {
      const items = [];
      try { const ev = await window.ScriptoriumScriptureMap?.list(); for (const e of ev || []) items.push({ kind: 'map', group: 'Maps', title: e.title, sub: 'On the study map', run: () => { closeDialogs(); window.ScriptoriumScriptureMap.openEvent(e.id); } }); } catch {}
      try {
        const nav = await window.ScriptoriumAtlas?.load();
        for (const i of nav?.items || []) if (/map|plan|reconstruction/i.test(i.type)) items.push({ kind: 'map', group: 'Maps', title: i.title, sub: i.type, run: () => { closeDialogs(); window.ScriptoriumMedia?.openMap(i.id); } });
        for (const p of nav?.places || []) items.push({ kind: 'place', group: 'Maps', title: p.name, sub: 'Plans and pictures of this place', run: () => { closeDialogs(); window.ScriptoriumMedia?.openPhotosOf(p); } });
      } catch {}
      set('Maps', items);
    })());
    jobs.push((async () => { const C = window.ScriptoriumCatena; if (!C) return; set('Catena', (await C.list()).map(p => ({ kind: 'catena', group: 'Catena', title: p.title, sub: p.sub, extra: p.fathers.join(' '), run: () => { closeDialogs(); C.open(p.id); } }))); })());
    await Promise.allSettled(jobs);
    return out;
  }
  function score(item, words) {
    const t = fold(item.title), hay = t + ' ' + fold(item.sub) + ' ' + fold(item.extra);
    let s = 0;
    for (const w of words) {
      if (!hay.includes(w)) return 0;
      s += t.startsWith(w) ? 40 : new RegExp('(^|[^a-z])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(t) ? 25 : t.includes(w) ? 12 : 3;
    }
    if (t === words.join(' ')) s += 60;
    return s - t.length / 200;
  }
  const LIMITS = { Tools: 5, Bookmarks: 6, Liturgy: 6, Sermons: 6, Catena: 4, Notes: 5, Timeline: 5, Maps: 6 };
  let palette = null;
  // Where to look: everything, or only one kind of thing.
  const SCOPES = [['all', 'Everything'], ['bible', 'Bible text'], ['fathers', 'Fathers & commentaries'], ['liturgy', 'Liturgy'], ['mine', 'My notes & bookmarks']];
  const SCOPE_GROUPS = { all: null, bible: [], fathers: ['Catena', 'Sermons'], liturgy: ['Liturgy', 'Sermons'], mine: ['Bookmarks', 'Notes'] };
  function openPalette(initial = '', scope = 'all') {
    hideCard();
    if (palette?.open) { palette.querySelector('input').select(); return; }
    const input = el('input', { type: 'search', placeholder: 'Search or go to: John 3:16 · Christmas · Augustine · Galilee · a word…', 'aria-label': 'Search or go to', autocomplete: 'off', spellcheck: 'false' });
    const scopeBar = el('div', { class: 'ga-scopes', role: 'group', 'aria-label': 'Search in' }, ...SCOPES.map(([v, t]) => el('button', { type: 'button', class: 'ga-scope' + (v === scope ? ' active' : ''), 'aria-pressed': String(v === scope), onclick: () => { scope = v; scopeBar.querySelectorAll('button').forEach((b, i) => { const on = SCOPES[i][0] === v; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); }); draw(); input.focus(); } }, t)));
    const list = el('div', { class: 'ga-list', role: 'listbox', 'aria-label': 'Results' });
    const foot = el('p', { class: 'ga-foot' }, el('span', {}, '↑ ↓ to choose · Enter to open · Esc to close'), el('span', { class: 'ga-status' }, ''));
    palette = el('dialog', { class: 'ga-dialog', 'aria-label': 'Search or go to' }, el('div', { class: 'ga-box' }, el('span', { class: 'ga-icon', 'aria-hidden': 'true' }, '⌕'), input), scopeBar, list, foot);
    palette.addEventListener('click', e => { if (e.target === palette) palette.close(); });
    palette.addEventListener('close', () => { palette.remove(); palette = null; });
    document.body.append(palette); palette.showModal();
    let sources = sourcesCache || { Tools: commands() }, rows = [], active = 0;
    const draw = () => {
      const q = input.value.trim(), words = fold(q).replace(/[.,:;]/g, ' ').split(/\s+/).filter(Boolean);
      const groups = [];
      if (q) {
        const r = parseTyped(q);
        const top = [];
        if (r && (scope === 'all' || scope === 'bible')) top.push({ kind: 'go', title: 'Go to ' + refLabel(r), sub: 'Open in the reader', run: () => { closeDialogs(); window.navigate(r.code, r.chapter, r.verse); } });
        const bibleSearch = { kind: 'search', title: `Search the Bible for “${q}”`, sub: 'Every verse with these words, in ' + (state.english || 'your text'), run: () => { closeDialogs(); typeof startSearch === 'function' && startSearch(q, 'text', state.english); } };
        const fathersSearch = { kind: 'search', title: `Search the Fathers for “${q}”`, sub: 'Sermons, Catena Aurea, Matins homilies, Missal readings, Boylan', run: () => { closeDialogs(); S()?.openStudy('search', { query: q }); } };
        const moreOptions = { kind: 'search', title: 'More search options…', sub: 'Exact lemma, Strong’s number or morphology, in a chosen Bible', run: () => { closeDialogs(); document.getElementById('search-open')?.click(); const box = document.getElementById('query'); if (box) { box.value = q; box.focus(); } } };
        if (scope === 'bible') top.push(bibleSearch, moreOptions);
        if (scope === 'fathers') top.push(fathersSearch);
        if (top.length) groups.push([scope === 'bible' ? 'Bible' : scope === 'fathers' ? 'Search' : 'Passage', top]);
        const allowed = SCOPE_GROUPS[scope];
        for (const [g, items] of Object.entries(sources)) {
          if (allowed && !allowed.includes(g)) continue;
          const seen = new Set();
          // A typed passage finds the days whose Epistle or Gospel contains it, not days that merely share a number.
          const covers = it => r && it.refs?.some(x => x.book === r.code && (x.chapter < r.chapter || (x.chapter === r.chapter && x.verse <= (r.verse || 1))) && (x.endChapter > r.chapter || (x.endChapter === r.chapter && x.endVerse >= (r.verse || 1))));
          const rank = it => g === 'Liturgy' && r ? (covers(it) ? 100 : 0) : score(it, words);
          const hits = items.map(it => [it, rank(it)]).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1])
            .filter(([it]) => { const k = it.title + '|' + it.sub; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, LIMITS[g] || 5).map(([it]) => it);
          if (hits.length) groups.push([g, hits]);
        }
        if (scope === 'all') groups.push(['Search', [bibleSearch, fathersSearch]]);
        if (scope === 'liturgy') groups.push(['Search', [fathersSearch]]);
        if (scope === 'mine') groups.push(['Search', [{ kind: 'search', title: `Search all my notes for “${q}”`, sub: 'My study', run: () => { closeDialogs(); S()?.openStudy('saved'); } }]]);
      } else {
        const recent = recall('scriptorium-recent-passages', []).slice(0, 6).map(p => ({ kind: 'go', title: `${bookName(p.book)} ${p.chapter}`, sub: 'Recently read', run: () => { closeDialogs(); window.navigate(p.book, p.chapter, p.verse || 1); } }));
        if (recent.length && (scope === 'all' || scope === 'bible')) groups.push(['Recently read', recent]);
        if (scope === 'all') groups.push(['Tools', (sources.Tools || commands()).slice(0, 12)]);
      }
      list.replaceChildren(); rows = [];
      for (const [name, items] of groups) {
        list.append(el('div', { class: 'ga-group' }, name));
        for (const it of items) {
          const i = rows.length;
          const row = el('button', { type: 'button', class: 'ga-row', role: 'option', id: 'ga-' + i, onclick: () => run(i), onmousemove: () => { if (active !== i) { active = i; mark(); } } },
            el('span', { class: 'ga-kind', 'aria-hidden': 'true' }, ICONS[it.kind] || '•'), el('span', { class: 'ga-text' }, el('b', {}, it.title), it.sub ? el('small', {}, it.sub) : null));
          rows.push({ row, it }); list.append(row);
        }
      }
      active = 0; mark();
    };
    const mark = () => { rows.forEach(({ row }, i) => { row.classList.toggle('active', i === active); row.setAttribute('aria-selected', String(i === active)); }); rows[active]?.row.scrollIntoView({ block: 'nearest' }); if (rows[active]) input.setAttribute('aria-activedescendant', rows[active].row.id); };
    const run = i => { const r = rows[i]; if (!r) return; const recent = recall('scriptorium-palette-recent', []); keep('scriptorium-palette-recent', [r.it.title, ...recent.filter(t => t !== r.it.title)].slice(0, 20)); palette?.close(); Promise.resolve(r.it.run()).catch(oops); };
    input.oninput = draw;
    input.onkeydown = e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(rows.length - 1, active + 1); mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); run(active); }
      else if (e.key === 'PageDown') { e.preventDefault(); active = Math.min(rows.length - 1, active + 8); mark(); }
      else if (e.key === 'PageUp') { e.preventDefault(); active = Math.max(0, active - 8); mark(); }
      else if (e.key === 'Escape') { e.preventDefault(); palette?.close(); }
    };
    input.value = initial; draw(); input.focus();
    const status = foot.querySelector('.ga-status');
    if (!sourcesCache) {
      status.textContent = 'Gathering…';
      gatherSources(s => { sources = s; if (palette) draw(); }).then(s => { sourcesCache = s; if (palette) status.textContent = ''; setTimeout(() => { sourcesCache = null; }, 60000); });
    }
  }
  document.addEventListener('scriptorium:bookmarks', () => { sourcesCache = null; });

  // ======================================================================
  // The Mass of a day
  // ======================================================================
  function nextSunday() { const d = new Date(); d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7)); return d; }
  async function ordo(date) {
    if (!L() || !window.ScriptoriumOrdo) return null;
    const data = await L().calendar();
    const o = window.ScriptoriumOrdo.forDate(data, date);
    return o ? { o, data } : null;
  }
  async function massOf(date) {
    closeDialogs();
    const got = await ordo(date); const d = got?.o.celebrated?.day || got?.o.temporal?.day;
    if (d) L().showDay(d); else { typeof studyTab === 'function' && studyTab('liturgy'); }
  }

  // ======================================================================
  // The start page
  // ======================================================================
  let home = null;
  async function openHome() {
    hideCard();
    if (home?.open) return;
    const dlg = el('dialog', { class: 'ux-dialog ux-home', 'aria-label': 'Start page' });
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => { dlg.remove(); if (home === dlg) home = null; });
    home = dlg; document.body.append(dlg);
    dlg.refresh = () => draw();
    const done = fn => () => { dlg.close(); fn(); };
    async function draw() {
      const hour = new Date().getHours();
      const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
      const search = el('input', { type: 'search', placeholder: 'Go anywhere — a passage, feast, Father, place or note…', 'aria-label': 'Go anywhere' });
      search.onkeydown = e => { if (e.key === 'Enter' || (e.key.length === 1 && !e.ctrlKey && !e.metaKey)) { const v = e.key === 'Enter' ? search.value : search.value + e.key; e.preventDefault(); dlg.close(); openPalette(v); } };
      const showAtStart = el('input', { type: 'checkbox', checked: recall('scriptorium-home-at-start', true) });
      showAtStart.onchange = () => keep('scriptorium-home-at-start', showAtStart.checked);
      const grid = el('div', { class: 'ux-home-grid' });
      dlg.replaceChildren(
        el('header', { class: 'ux-home-head' }, el('div', {}, el('p', { class: 'ux-kicker' }, new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })), el('h2', {}, greet)),
          el('button', { type: 'button', class: 'quiet ux-x', 'aria-label': 'Close the start page', onclick: () => dlg.close() }, '×')),
        el('div', { class: 'ux-home-search' }, el('span', { 'aria-hidden': 'true' }, '⌕'), search, el('kbd', {}, 'Ctrl K')),
        grid,
        el('footer', { class: 'ux-home-foot' }, el('label', { class: 'ux-check' }, showAtStart, ' Show this page when Scriptorium opens'),
          el('span', {}, el('button', { type: 'button', class: 'quiet', onclick: done(shortcuts) }, 'Keyboard shortcuts'), ' · ', el('button', { type: 'button', class: 'quiet', onclick: done(readingMode) }, 'Reading mode'))));
      // Continue reading
      const recent = recall('scriptorium-recent-passages', []);
      const cur = state.book ? { book: state.book, chapter: state.chapter, verse: state.verse || 1 } : recent[0];
      const cont = el('section', { class: 'ux-tile ux-continue' }, el('h3', {}, 'Continue reading'));
      if (cur) cont.append(el('button', { type: 'button', class: 'ux-big', onclick: done(() => window.navigate(cur.book, cur.chapter, cur.verse)) }, el('b', {}, `${bookName(cur.book)} ${cur.chapter}`), el('small', {}, cur.verse > 1 ? `at verse ${cur.verse}` : 'where you left off')));
      const others = recent.filter(p => !(cur && p.book === cur.book && p.chapter === cur.chapter)).slice(0, 5);
      if (others.length) cont.append(el('p', { class: 'ux-small' }, 'Also read lately'), el('div', { class: 'ux-chips' }, ...others.map(p => el('button', { type: 'button', class: 'ux-chip', onclick: done(() => window.navigate(p.book, p.chapter, p.verse || 1)) }, `${bookName(p.book)} ${p.chapter}`))));
      grid.append(cont);
      // Today and next Sunday
      const massTile = (title, date) => {
        const tile = el('section', { class: 'ux-tile ux-mass' }, el('h3', {}, title), el('p', { class: 'ux-small' }, 'Reading the calendar…'));
        ordo(date).then(async got => {
          tile.replaceChildren(el('h3', {}, title));
          if (!got) { tile.append(el('p', { class: 'ux-small' }, 'The 1962 calendar is not available.')); return; }
          const { o } = got, c = o.celebrated, d = c.day || o.temporal?.day;
          tile.append(el('p', { class: 'ux-kicker' }, date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) + (o.className ? ' · ' + o.className : '')));
          tile.append(el('button', { type: 'button', class: 'ux-big', disabled: !d, onclick: done(() => L().showDay(d)) }, el('b', {}, c.feria ? c.title : (d?.title || c.title)), el('small', {}, o.label || '')));
          if (o.commemorations?.length) tile.append(el('p', { class: 'ux-small' }, 'Commemoration: ' + o.commemorations.map(x => x.title).join('; ')));
          if (d) {
            const reads = el('div', { class: 'ux-reads' });
            const ep = d.epistles?.[0], gp = d.gospels?.[0], gt = d.gospel_texts?.[0];
            const goRef = r => { const n = r?.nav || r; return n ? () => window.navigate(n.book, n.chapter, n.verse) : null; };
            if (ep) reads.append(el('button', { type: 'button', class: 'ux-chip', disabled: !ep.refs?.[0], onclick: done(goRef(ep.refs?.[0]) || (() => {})) }, 'Epistle · ' + ep.text.replace(/\.$/, '')));
            if (gp || gt) reads.append(el('button', { type: 'button', class: 'ux-chip', disabled: !gp?.refs?.[0], onclick: done(goRef(gp?.refs?.[0]) || (() => {})) }, 'Gospel · ' + (gt?.text || gp.text).replace(/\.$/, '')));
            const n = (d.sermons || []).length + (d.homilies || []).length;
            if (n) reads.append(el('button', { type: 'button', class: 'ux-chip', onclick: done(() => L().showDay(d)) }, `${n} sermon${n === 1 ? '' : 's'} & homil${n === 1 ? 'y' : 'ies'}`));
            // The Catena covers all four Gospels, so the button can be shown without reading its index first.
            const g0 = gp?.refs?.[0], C = window.ScriptoriumCatena;
            if (g0 && C && ['Mat', 'Mar', 'Luk', 'Joh'].includes(g0.book)) reads.append(el('button', { type: 'button', class: 'ux-chip', title: 'St. Thomas gathers the Fathers on this Gospel', onclick: done(async () => { const found = await C.forRange(g0.book, g0.chapter, g0.verse, g0.endChapter, g0.endVerse, true); if (found.length) C.open(found[0].id, { day: d.title }); }) }, 'Catena Aurea on the Gospel'));
            tile.append(reads);
            // Counted only when the full liturgy is already open, so the start page stays light.
            const onIt = L().loaded?.() ? (S()?.marks() || []).filter(m => (S().daysOf?.(m) || []).some(x => x.id === d.id)).length : 0;
            if (onIt) tile.append(el('button', { type: 'button', class: 'quiet ux-link', onclick: done(() => S().openStudy('bookmarks', { collection: date === todayDate ? '@today' : '@sunday' })) }, `★ ${onIt} of your bookmarks are on these readings`));
          }
        }).catch(e => { tile.replaceChildren(el('h3', {}, title), el('p', { class: 'ux-small' }, 'The calendar could not be read: ' + e.message)); });
        return tile;
      };
      const todayDate = new Date();
      grid.append(massTile('Today’s Mass', todayDate));
      // Everything else waits behind "More".
      const more = el('div', { class: 'ux-home-grid ux-more', hidden: !recall('scriptorium-home-more', false) });
      const moreBtn = el('button', { type: 'button', class: 'quiet ux-more-btn', 'aria-expanded': String(!more.hidden), onclick: () => { more.hidden = !more.hidden; keep('scriptorium-home-more', !more.hidden); moreBtn.setAttribute('aria-expanded', String(!more.hidden)); moreBtn.textContent = more.hidden ? 'More: next Sunday, recent bookmarks and notes ▾' : 'Less ▴'; } }, more.hidden ? 'More: next Sunday, recent bookmarks and notes ▾' : 'Less ▴');
      grid.after(moreBtn, more);
      more.append(massTile('Next Sunday', nextSunday()));
      // Bookmarks
      const bm = el('section', { class: 'ux-tile' }, el('h3', {}, 'Recent bookmarks'));
      more.append(bm);
      (S() ? S().loadMarks() : Promise.resolve([])).then(async marks => {
        if (!marks.length) { bm.append(el('p', { class: 'ux-small' }, 'None yet. Use ☆ Bookmark beside the chapter title, or select words in a commentary or sermon.')); return; }
        const ul = el('ul', { class: 'ux-list' });
        for (const m of marks.slice(0, 6)) ul.append(el('li', {}, el('button', { type: 'button', onclick: done(() => S().openMark(m)) }, el('b', { class: m.type === 'highlight' ? 'ux-quote' : '' }, m.label), el('small', {}, [m.sub, ...(m.tags || []).map(t => '#' + t)].filter(Boolean).join(' · ')))));
        bm.append(ul, el('button', { type: 'button', class: 'quiet ux-link', onclick: done(() => S().openStudy('bookmarks')) }, `All ${marks.length} bookmarks ›`));
      });
      // Notes
      const nt = el('section', { class: 'ux-tile' }, el('h3', {}, 'Recent notes'));
      more.append(nt);
      (async () => {
        const list = recall('scriptorium-recent-notes', []).slice(0, 5);
        if (!list.length) { nt.append(el('p', { class: 'ux-small' }, 'Notes you write will appear here.'), el('button', { type: 'button', class: 'quiet ux-link', onclick: done(() => S()?.openStudy('notes')) }, 'All notes ›')); return; }
        const ul = el('ul', { class: 'ux-list' });
        for (const r of list) {
          const body = await S()?.readNote(r.ref) || ''; if (!body) continue;
          const d = await S()?.describeNote({ ref: r.ref, body });
          ul.append(el('li', {}, el('button', { type: 'button', onclick: done(() => d?.open?.()) }, el('b', {}, d?.label || r.ref), el('small', {}, body.replace(/\s+/g, ' ').slice(0, 110)))));
        }
        nt.append(ul, el('button', { type: 'button', class: 'quiet ux-link', onclick: done(() => S()?.openStudy('notes')) }, 'All notes ›'));
      })();
      // Backup
      const last = recall('scriptorium-last-backup', 0);
      const days = last ? Math.floor((Date.now() - last) / 864e5) : null;
      // Only a gentle line, and only when a backup is due.
      if (days == null || days > 30) more.before(el('p', { class: 'ux-backup-line' }, days == null ? 'You have not backed up your notes and bookmarks yet. ' : `Your last backup was ${days} days ago. `,
        el('button', { type: 'button', class: 'quiet ux-link', onclick: () => backup() }, 'Back up now')));
      setTimeout(() => search.focus(), 30);
    }
    await draw();
    dlg.showModal();
  }

  // ======================================================================
  // Reading mode, keyboard shortcuts, chapter keys
  // ======================================================================
  let exitButton = null;
  function readingMode(on = !document.body.classList.contains('ux-reading')) {
    document.body.classList.toggle('ux-reading', on);
    if (on) {
      exitButton = el('button', { type: 'button', class: 'ux-exit-reading', title: 'Leave reading mode (Esc or F11)', onclick: () => readingMode(false) }, '✕ Leave reading mode');
      document.body.append(exitButton);
      say('Reading mode. Esc or F11 to come back.');
    } else { exitButton?.remove(); exitButton = null; }
    const b = document.getElementById('ux-reading-button'); if (b) b.setAttribute('aria-pressed', String(on));
  }
  const SHORTCUTS = [
    ['Finding your way', [['`Ctrl` + `K`', 'Search or go to: a passage, feast, Father, place, word, bookmark or note'], ['`Ctrl` + `Shift` + `F`', 'Search the Fathers (sermons, Catena, homilies, Missal, Boylan)'], ['`Alt` + `←`  /  `Alt` + `→`', 'Back / Forward through the passages you have read'], ['`[`  /  `]`', 'Previous / next chapter'], ['Type “John 3:16” in the library box, then `Enter`', 'Go to a verse'], ['Click the Scriptorium name', 'The start page']]],
    ['Reading', [['`F11`', 'Reading mode: only the text'], ['`Esc`', 'Leave reading mode, or close a window'], ['`Shift` + click a verse', 'Select several verses (then ☆ Bookmark)'], ['Point at a reference', 'In commentaries and sermons, see the verse; click to open it']]],
    ['Notes and bookmarks', [['`Ctrl` + `S`', 'Save the note you are writing'], ['Select words', 'In a commentary or sermon: 🖍 Highlight & bookmark'], ['`Enter`', 'In the tag box after bookmarking: save the tags']]],
    ['Maps, photos and timeline', [['`F`', 'Full screen map or photo'], ['`+`  `−`  `0`', 'Zoom in / out / reset an image'], ['Drag · `Ctrl` + scroll', 'Move through the years / zoom the timeline']]],
    ['This sheet', [['`?`', 'Show the keyboard shortcuts']]]
  ];
  const keysOf = text => text.split(/(`[^`]+`)/).filter(Boolean).map(p => p.startsWith('`') ? el('kbd', {}, p.slice(1, -1)) : p);
  function shortcuts() {
    const dlg = el('dialog', { class: 'ux-dialog ux-keys', 'aria-label': 'Keyboard shortcuts' },
      el('header', { class: 'ux-home-head' }, el('h2', {}, 'Keyboard shortcuts'), el('button', { type: 'button', class: 'quiet ux-x', 'aria-label': 'Close', onclick: () => dlg.close() }, '×')),
      el('div', { class: 'ux-keys-grid' }, ...SHORTCUTS.map(([title, rows]) => el('section', {}, el('h3', {}, title), el('dl', {}, ...rows.flatMap(([k, what]) => [el('dt', {}, ...keysOf(k)), el('dd', {}, what)]))))));
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => dlg.remove());
    document.body.append(dlg); dlg.showModal();
  }
  window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); e.stopImmediatePropagation(); openPalette(); return; }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) { e.preventDefault(); e.stopImmediatePropagation(); openPalette('', 'fathers'); return; }
    if (e.key === 'F11') { e.preventDefault(); readingMode(); return; }
    if (e.key === 'Escape' && document.body.classList.contains('ux-reading') && !document.querySelector('dialog[open]') && !typing(e)) { readingMode(false); return; }
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
    if (e.key === '?') { e.preventDefault(); shortcuts(); }
    else if (e.key === '[' && typeof stepChapter === 'function') { e.preventDefault(); stepChapter(-1); }
    else if (e.key === ']' && typeof stepChapter === 'function') { e.preventDefault(); stepChapter(1); }
  }, true);

  // ======================================================================
  // The header button, the reading-mode button, the brand as "home"
  // ======================================================================
  function addButtons() {
    const bar = document.querySelector('.topbar');
    if (bar && !document.getElementById('ux-go')) {
      const go = el('button', { id: 'ux-go', type: 'button', class: 'ux-go', title: 'Search or go to anything (Ctrl + K)', onclick: () => openPalette() }, el('span', { 'aria-hidden': 'true' }, '⌕'), el('span', { class: 'ux-go-text' }, 'Search or go to…'), el('kbd', {}, 'Ctrl K'));
      const anchor = document.getElementById('study-tabs') || document.getElementById('theme-toggle');
      anchor ? anchor.before(go) : bar.append(go);
      const brand = bar.querySelector('.brand');
      if (brand) { brand.title = 'Start page'; brand.addEventListener('click', e => { e.preventDefault(); openHome(); }); }
    }
    const group = document.querySelector('.st-history');
    if (group && !document.getElementById('ux-reading-button')) group.append(el('button', { id: 'ux-reading-button', type: 'button', class: 'st-hist', 'aria-pressed': 'false', title: 'Reading mode — only the text (F11)', 'aria-label': 'Reading mode', onclick: () => readingMode() }, '📖'));
  }

  // ======================================================================
  // Study companion tabs: short names on one line, and the last one remembered
  // ======================================================================
  const SHORT = { 'word-tab': 'Words', 'lemma-tab': 'Lemma', 'commentary-tab': 'Commentary', 'books-tab': 'Books', 'note-tab': 'Notes', 'map-tab': 'Map', 'liturgy-tab': 'Liturgy' };
  const LONGNAME = { 'word-tab': 'Word study', 'lemma-tab': 'Lemma study', 'commentary-tab': 'Commentary', 'books-tab': 'Books', 'note-tab': 'My notes on this verse', 'map-tab': 'Map of this chapter', 'liturgy-tab': 'The 1962 Liturgy' };
  function tidyTabs() {
    for (const [id, label] of Object.entries(SHORT)) {
      const b = document.getElementById(id); if (!b || b.dataset.ux) continue;
      b.dataset.ux = '1'; b.title = LONGNAME[id];
      const text = [...b.childNodes].find(n => n.nodeType === 3 && n.data.trim());
      if (text) text.data = label + (b.querySelector('span') ? ' ' : ''); else if (!b.children.length) b.textContent = label;
    }
  }
  let restored = false;
  on('study-tab', tab => { if (restored) keep('scriptorium-study-tab', tab); });
  async function restoreStudyTab() {
    await ready;
    const tab = recall('scriptorium-study-tab', 'word');
    try { if (tab && tab !== 'word' && localStorage.getItem('scriptorium-study-hidden') !== 'true' && document.getElementById(tab + '-tab') && typeof studyTab === 'function') window.studyTab(tab); } catch {}
    restored = true;
  }

  // ======================================================================
  // Start
  // ======================================================================
  function start() {
    addButtons(); tidyTabs();
    on('navigate', () => { addButtons(); tidyTabs(); });
    restoreStudyTab();
    (async () => {
      await ready; addButtons(); tidyTabs();
      if (recall('scriptorium-home-at-start', true) && !document.querySelector('dialog[open]')) openHome().catch(oops);
    })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.ScriptoriumUsability = { psalmForReader, readsVulgatePsalms, openPalette, openHome, backup, restore, readingMode, shortcuts, parseTyped, linkify, hebrewPsalm };
})();
/* END SCRIPTORIUM USABILITY */


/* BEGIN SCRIPTORIUM STUDY EXTRAS — Back/Forward through the passages you visit, bookmarks, notes on days and sermons,
   and one search across the sermons, Matins homilies, Missal readings, Boylan and your notes. */
(() => {
  'use strict';
  const { el, bookName, typing, hash, fold, on, watch, ready } = window.Scriptorium;
  const hebrewPsalm = v => window.Scriptorium.refs.hebrewPsalm(v, 1)[0];
  const placeText = p => `${bookName(p.book)} ${p.chapter}:${p.verse}`;

  // ---------- Back / Forward through the passages visited ----------
  const back = [], forward = [];
  let replaying = false;
  on('navigate', ({ from, to }) => {
    const moved = from && to && (from.book !== to.book || from.chapter !== to.chapter || from.verse !== to.verse);
    if (moved && !replaying) { back.push(from); if (back.length > 200) back.shift(); forward.length = 0; }
    rangeEnd = null; updateHistory();
  });
  async function step(dir) {
    const from = dir < 0 ? back : forward, to = dir < 0 ? forward : back;
    const target = from.pop();
    if (!target) return;
    to.push({ book: state.book, chapter: state.chapter, verse: state.verse || 1 });
    replaying = true;
    try { await window.navigate(target.book, target.chapter, target.verse); } finally { replaying = false; updateHistory(); }
  }
  let backButton, forwardButton, starButton;
  function updateHistory() {
    if (!backButton) return;
    backButton.disabled = !back.length; forwardButton.disabled = !forward.length;
    backButton.title = back.length ? `Back to ${placeText(back[back.length - 1])} (Alt + ←)` : 'Back (Alt + ←)';
    forwardButton.title = forward.length ? `Forward to ${placeText(forward[forward.length - 1])} (Alt + →)` : 'Forward (Alt + →)';
    updateStar();
  }
  // Caught before the reader's own arrow-key handling, which would also turn the chapter.
  window.addEventListener('keydown', e => {
    if (!e.altKey || e.ctrlKey || e.metaKey || typing(e) || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    step(e.key === 'ArrowLeft' ? -1 : 1);
  }, true);

  // ---------- Notes stored by Scriptorium on this computer (any short key) ----------
  const BOOKMARKS = 'scriptorium:bookmarks', COLLECTIONS = 'scriptorium:collections';
  async function readNote(ref) { try { return (await api('/api/note', { ref })).body || ''; } catch { return ''; } }
  async function writeNote(ref, body) { await api('/api/note', {}, { ref, body }); }

  // ---------- Bookmarks ----------
  let marks = null;
  // A note holds at most 100,000 characters, so a long list continues in "scriptorium:bookmarks:2", ":3", …
  const part = i => i ? `${BOOKMARKS}:${i + 1}` : BOOKMARKS;
  let parts = 1, collections = [], loading = null;
  async function loadMarks() {
    if (marks) return marks;
    return loading ||= (async () => {
      const all = [];
      for (let i = 0; i < 200; i++) {
        const text = await readNote(part(i));
        if (!text) break;
        try { const got = JSON.parse(text); if (Array.isArray(got)) all.push(...got); } catch { break; }
        parts = i + 1;
      }
      try { const c = JSON.parse(await readNote(COLLECTIONS) || '[]'); collections = Array.isArray(c) ? c : []; } catch { collections = []; }
      for (const m of all) for (const c of m.collections || []) if (!collections.includes(c)) collections.push(c);
      marks = all; return marks;
    })();
  }
  async function saveMarks() {
    const chunks = [[]]; let size = 2;
    for (const m of marks) {
      const len = JSON.stringify(m).length + 1;
      if (size + len > 90000 && chunks[chunks.length - 1].length) { chunks.push([]); size = 2; }
      chunks[chunks.length - 1].push(m); size += len;
    }
    for (let i = 0; i < chunks.length; i++) await writeNote(part(i), JSON.stringify(chunks[i]));
    for (let i = chunks.length; i < parts; i++) await writeNote(part(i), '');
    parts = chunks.length;
    document.dispatchEvent(new Event('scriptorium:bookmarks'));
  }
  async function saveCollections() { await writeNote(COLLECTIONS, JSON.stringify(collections)); }
  const isMarked = key => !!marks?.some(m => m.key === key);
  // ---------- Undo: a short notice with an Undo button, instead of asking first ----------
  const snapshot = () => ({ marks: JSON.parse(JSON.stringify(marks || [])), collections: [...collections] });
  async function restore(snap) {
    marks = snap.marks; collections = snap.collections;
    await saveCollections(); await saveMarks();
    paintAll(); if (dialog?.open && view === 'saved') drawDialog();
  }
  let undoBar = null, undoTimer = null;
  function undoToast(message, undo) {
    undoBar?.remove(); clearTimeout(undoTimer);
    const bar = el('div', { class: 'st-undo', role: 'status' }, el('span', {}, message),
      el('button', { type: 'button', onclick: async () => { bar.remove(); clearTimeout(undoTimer); try { await undo(); if (typeof toast === 'function') toast('Undone.'); } catch (e) { if (typeof fail === 'function') fail(e); } } }, 'Undo'),
      el('button', { type: 'button', class: 'st-undo-x', 'aria-label': 'Dismiss', onclick: () => bar.remove() }, '×'));
    (document.querySelector('dialog[open]') || document.body).append(bar);
    undoBar = bar; undoTimer = setTimeout(() => bar.remove(), 8000);
  }
  async function withUndo(message, change) {
    await loadMarks();
    const snap = snapshot();
    await change();
    undoToast(message, () => restore(snap));
  }
  async function toggleMark(item) {
    await loadMarks();
    const i = marks.findIndex(m => m.key === item.key);
    if (i >= 0) { try { await withUndo('Bookmark removed: ' + marks[i].label, async () => { marks.splice(i, 1); await saveMarks(); }); } catch (e) { if (typeof fail === 'function') fail(e); } return; }
    marks.unshift({ ...item, added: new Date().toISOString().slice(0, 10) });
    try { await saveMarks(); if (typeof toast === 'function') toast('Bookmarked: ' + item.label); } catch (e) { if (typeof fail === 'function') fail(e); }
  }
  function bookmarkButton(item) {
    const b = el('button', { type: 'button', class: 'quiet st-star', 'aria-pressed': 'false' });
    const paint = () => { const on = isMarked(item.key); b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '★ Bookmarked' : '☆ Bookmark'; b.title = on ? 'Remove this bookmark' : 'Bookmark this'; };
    b.onclick = async () => { await toggleMark(item); paint(); };
    loadMarks().then(paint); paint();
    document.addEventListener('scriptorium:bookmarks', paint);
    return b;
  }
  // Shift + click a second verse (or select words across verses) to take a range.
  let rangeEnd = null;
  const passageItem = (book, chapter, a, b) => {
    const v1 = Math.min(a, b ?? a), v2 = Math.max(a, b ?? a), span = v2 > v1 ? `${v1}–${v2}` : `${v1}`;
    return { key: `bib:${book} ${chapter}:${v2 > v1 ? v1 + '-' + v2 : v1}`, type: 'passage', label: `${bookName(book)} ${chapter}:${span}`, book, chapter, verse: v1, ...(v2 > v1 ? { endVerse: v2 } : {}) };
  };
  const verseItem = () => passageItem(state.book, state.chapter, state.verse || 1, rangeEnd);
  function showRange(a, b) {
    const v1 = Math.min(a, b ?? a), v2 = Math.max(a, b ?? a);
    document.querySelectorAll('.verse-row').forEach(r => { const v = +r.id.replace('verse-', ''); r.classList.toggle('st-range', b != null && v >= v1 && v <= v2); });
  }
  function setRange(end) { rangeEnd = end != null && end !== state.verse ? end : null; showRange(state.verse || 1, rangeEnd); updateStar(); }
  document.addEventListener('click', e => {
    if (!e.shiftKey) return;
    const row = e.target.closest?.('.verse-row'); if (!row || !state.verse) return;
    e.preventDefault(); e.stopImmediatePropagation(); getSelection().removeAllRanges();
    setRange(+row.id.replace('verse-', ''));
    if (typeof toast === 'function' && rangeEnd) toast(`Verses ${Math.min(state.verse, rangeEnd)}–${Math.max(state.verse, rangeEnd)} selected. ☆ Bookmark keeps them together.`);
  }, true);
  function updateStar() {
    if (!starButton || !state.book) return;
    const on = isMarked(verseItem().key);
    const span = rangeEnd ? ` ${Math.min(state.verse, rangeEnd)}–${Math.max(state.verse, rangeEnd)}` : '';
    starButton.textContent = (on ? '★ Bookmarked' : '☆ Bookmark') + span;
    starButton.setAttribute('aria-pressed', String(on));
    starButton.title = (on ? 'Remove the bookmark on ' : 'Bookmark ') + verseItem().label;
  }
  document.addEventListener('scriptorium:bookmarks', updateStar);
  on('verse-select', () => { rangeEnd = null; showRange(0); updateStar(); });
  function openMark(m) {
    if (m.type === 'passage') { closeDialog(); window.navigate(m.book, m.chapter, m.verse).then(() => { if (m.endVerse) { rangeEnd = m.endVerse; showRange(m.verse, m.endVerse); updateStar(); } }); return; }
    if (m.type === 'commentary') { openCommentary(m); return; }
    if (m.type === 'highlight') { openHighlight(m); return; }
    if (m.type === 'catena') { closeDialog(); window.ScriptoriumCatena?.open(m.catena); return; }
    window.ScriptoriumLiturgy?.load().then(() => { const d = window.ScriptoriumLiturgy.describe(m.key); if (d) { closeDialog(); d.open(); } else if (typeof toast === 'function') toast('This item is no longer in the liturgy list.'); });
  }

  // ---------- Bookmarks on commentary entries ----------
  function commentaryItem(details) {
    const d = details.dataset, place = JSON.parse(d.place || '{}');
    return { key: `com:${d.work}:${d.entryId}`, type: 'commentary', label: `${d.workTitle} — ${d.entryTitle}`, sub: `${bookName(place.book)} ${place.book === 'Psa' && place.cchapter ? place.cchapter + ' (Vulgate)' : place.chapter}`, work: d.work, entryId: d.entryId, ...place };
  }
  function decorateCommentary() {
    const results = document.getElementById('commentary-results');
    if (!results) return;
    for (const details of results.querySelectorAll('.commentary-entry[data-entry-id]')) {
      const summary = details.querySelector(':scope > summary');
      if (!summary || summary.querySelector('.st-com-star')) continue;
      const item = commentaryItem(details);
      const b = el('button', { type: 'button', class: 'quiet st-com-star', title: 'Bookmark this commentary' });
      const paint = () => { const on = isMarked(item.key); b.textContent = on ? '★' : '☆'; b.setAttribute('aria-pressed', String(on)); b.title = on ? 'Remove this bookmark' : 'Bookmark this commentary'; b.setAttribute('aria-label', (on ? 'Remove bookmark: ' : 'Bookmark: ') + item.label); };
      b.onclick = async e => { e.preventDefault(); e.stopPropagation(); const was = isMarked(item.key); await toggleMark(item); paint(); if (!was) { const r = b.getBoundingClientRect(); quickFile(item.key, r.left - 120, r.bottom + 70); } };
      summary.append(b); paint();
    }
  }
  loadMarks().then(decorateCommentary);
  document.addEventListener('scriptorium:bookmarks', () => document.querySelectorAll('.st-com-star').forEach(b => b.remove()) || decorateCommentary());
  async function openCommentary(m) {
    closeDialog();
    await window.navigate(m.book, m.chapter, m.verse || 1);
    if (typeof studyTab === 'function') studyTab('commentary');
    const work = document.getElementById('commentary-work'), ps = document.getElementById('commentary-psalm');
    if (work && [...work.options].some(o => o.value === m.work)) work.value = m.work;
    if (m.book === 'Psa' && ps && m.cchapter) ps.value = String(m.cchapter);
    if (typeof loadCommentary === 'function') loadCommentary();
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 150));
      const found = document.querySelector(`#commentary-results .commentary-entry[data-work="${CSS.escape(m.work)}"][data-entry-id="${CSS.escape(String(m.entryId))}"]`);
      if (found) { found.open = true; found.scrollIntoView({ block: 'start' }); found.classList.add('st-flash'); setTimeout(() => found.classList.remove('st-flash'), 1600); return; }
    }
    if (typeof toast === 'function') toast('That commentary entry was not found for this passage.');
  }

  // ---------- A note box for a liturgical day or a sermon ----------
  function noteBox(ref, label) {
    const area = el('textarea', { class: 'st-note', rows: '4', placeholder: 'Your observations — saved on this computer', 'aria-label': 'My notes on ' + label });
    const status = el('span', { class: 'st-note-status', role: 'status' });
    let timer = null, dirty = false, loaded = false;
    readNote(ref).then(body => { if (!dirty) area.value = body; loaded = true; });
    const save = async () => {
      if (!dirty || !loaded) return;
      dirty = false; status.textContent = 'Saving…';
      try { await writeNote(ref, area.value); status.textContent = 'Saved'; } catch (e) { dirty = true; status.textContent = 'Not saved — ' + e.message; }
    };
    area.oninput = () => { dirty = true; status.textContent = ''; clearTimeout(timer); timer = setTimeout(save, 900); };
    area.onblur = save;
    return el('div', { class: 'st-notebox' }, area, status);
  }

  // ---------- The study window: bookmarks, notes and search ----------
  let dialog = null, view = 'saved', pendingQuery = '';
  try { view = localStorage.getItem('scriptorium-study-view') === 'search' ? 'search' : 'saved'; } catch {}
  function closeDialog() { if (dialog?.open) dialog.close(); }
  function openStudy(which, opts = {}) {
    // Bookmarks, highlights and notes are one list now ("Saved"); "notes" shows that list with only notes.
    if (which === 'notes') { which = 'saved'; bmView.show = 'note'; }
    else if (which === 'bookmarks' || which === 'saved') { which = 'saved'; if (!opts.keepShow) bmView.show = bmView.show === 'note' ? 'all' : bmView.show || 'all'; }
    if (which) view = which;
    if (opts.query) { view = 'search'; pendingQuery = opts.query; }
    if (opts.collection != null) { view = 'saved'; bmView.collection = opts.collection; bmView.tag = ''; bmView.show = 'all'; }
    try { localStorage.setItem('scriptorium-study-view', view); } catch {}
    if (!dialog) {
      dialog = el('dialog', { id: 'study-dialog', class: 'st-dialog', 'aria-label': 'My study' });
      dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
      document.body.append(dialog);
    }
    drawDialog();
    if (!dialog.open) dialog.showModal();
    if (view === 'search') setTimeout(() => dialog.querySelector('.st-search input')?.focus(), 30);
  }
  function drawDialog() {
    const tabs = el('div', { class: 'st-tabs', role: 'tablist' });
    for (const [id, label] of [['saved', 'Saved'], ['search', 'Search the Fathers']]) {
      tabs.append(el('button', { type: 'button', role: 'tab', 'aria-selected': String(id === view), class: id === view ? 'active' : '', onclick: () => { view = id; try { localStorage.setItem('scriptorium-study-view', view); } catch {} drawDialog(); if (id === 'search') dialog.querySelector('.st-search input')?.focus(); } }, label));
    }
    const body = el('div', { class: 'st-body' });
    dialog.replaceChildren(el('header', { class: 'st-head' }, el('h2', {}, 'My study'), tabs, el('button', { type: 'button', class: 'quiet st-close', 'aria-label': 'Close', onclick: () => dialog.close() }, '×')), body);
    if (view === 'search') drawSearch(body); else drawBookmarks(body);
    markActive();
  }
  // ---------- The Bookmarks tab: collections, tags, notes, grouping and export ----------
  const KINDS = { passage: 'Passage', day: 'Liturgical day', sermon: 'Sermon', commentary: 'Commentary', highlight: 'Highlight', catena: 'Catena Aurea', homily: 'Matins homily', note: 'Note' };
  let bmView = { group: 'none', collection: '', tag: '', query: '', show: 'all' };
  try { Object.assign(bmView, JSON.parse(localStorage.getItem('scriptorium-bookmark-view') || '{}'), { query: '' }); } catch {}
  const rememberView = () => { try { localStorage.setItem('scriptorium-bookmark-view', JSON.stringify({ group: bmView.group, collection: bmView.collection, tag: bmView.tag })); } catch {} };
  let lit = null;   // the liturgy data, for grouping by book, source and day
  async function liturgy() { if (!lit && window.ScriptoriumLiturgy) { try { lit = await window.ScriptoriumLiturgy.load(); } catch { lit = null; } } return lit; }
  const bookIndex = code => { const i = state.meta?.books?.findIndex(b => b.code === code); return i == null || i < 0 ? 9999 : i; };
  function sermonOf(m) {
    if (!lit) return null;
    if (m.sermonId) return lit.sermons.get(m.sermonId) || null;
    const k = m.type === 'sermon' ? m.key : m.forKey?.startsWith('ser:') ? m.forKey : null;
    if (k) return [...lit.sermons.values()].find(x => window.ScriptoriumLiturgy.sermonKey(x) === k) || null;
    return null;
  }
  const dayOf = m => { const k = m.type === 'day' ? m.key : m.forKey?.startsWith('lit:') ? m.forKey : null; return k && lit ? lit.data.days.find(d => window.ScriptoriumLiturgy.dayKey(d) === k) || null : null; };
  // The place in Scripture a bookmark is about, if any.
  function placeOf(m) {
    if (m.book) return { book: m.book, chapter: m.chapter, verse: m.verse || 1, endVerse: m.endVerse || m.verse || 1 };
    const s = sermonOf(m); if (s?.ref) return { book: s.ref.book, chapter: s.ref.chapter, verse: s.ref.verse, endVerse: s.ref.endChapter === s.ref.chapter ? s.ref.endVerse : 999 };
    const d = dayOf(m); const r = d?.gospels?.[0]?.refs?.[0]; if (r) { const n = r.nav || r; return { book: n.book, chapter: n.chapter, verse: n.verse, endVerse: n.endVerse }; }
    return null;
  }
  function sourceOf(m) {
    if (m.type === 'note') { if (m.sub === 'Sermon') return sermonOf(m)?.father || 'Sermons'; return { Passage: 'Scripture', 'Liturgical day': 'The 1962 Missal', 'Catena Aurea': 'Catena Aurea (St. Thomas)', Homily: 'Matins homilies' }[m.sub] || 'Other notes'; }
    if (m.type === 'passage') return 'Scripture';
    if (m.type === 'day') return 'The 1962 Missal';
    if (m.type === 'catena' || m.kind === 'catena') return 'Catena Aurea (St. Thomas)';
    if (m.type === 'commentary') return m.label.split(' — ')[0];
    if (m.type === 'highlight' && m.kind === 'commentary') return (m.sub || '').split(' — ')[0];
    const s = sermonOf(m); if (s) return s.father;
    return (m.sub || m.label).split(/[,·]/)[0].trim();
  }
  const covers = (r, p) => { const n = r.nav || r; if (n.book !== p.book) return false; const a = n.chapter * 1000 + n.verse, b = (n.endChapter || n.chapter) * 1000 + (n.endVerse || n.verse); return a <= p.chapter * 1000 + p.endVerse && b >= p.chapter * 1000 + p.verse; };
  // The days of the 1962 Missal whose Epistle or Gospel this bookmark belongs to.
  function daysOf(m) {
    if (!lit) return [];
    const d = dayOf(m); if (d) return [d];
    const s = sermonOf(m); if (s) { const own = lit.data.days.filter(x => (x.sermons || []).some(y => y.id === s.id)); if (own.length) return own; }
    const p = placeOf(m); if (!p) return [];
    return lit.data.days.filter(x => [...(x.gospels || []), ...(x.epistles || [])].some(g => g.refs.some(r => covers(r, p))));
  }
  const dayName = d => d.title + (d.cycle === 'sanctoral' && d.subtitle ? ` (${d.subtitle})` : '');
  function liturgicalDay(date) {
    const o = lit && window.ScriptoriumOrdo ? window.ScriptoriumOrdo.forDate(lit.data, date) : null;
    return o ? [o.celebrated?.day, o.temporal?.day].filter(Boolean) : [];
  }
  function nextSunday() { const d = new Date(); d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7)); return d; }
  const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Your notes, as items of the same "Saved" list.
  async function noteItems() {
    let notes = [];
    try { notes = await allNotes(); } catch { return []; }
    return Promise.all(notes.map(async n => {
      const d = await describeNote(n), p = n.ref.match(/^(\S+) (\d+):(\d+)$/);
      return { key: 'note:' + n.ref, type: 'note', forKey: n.ref, label: d.label, sub: d.kind, note: n.body, open: d.open, ...(p ? { book: p[1], chapter: +p[2], verse: +p[3] } : {}) };
    }));
  }
  async function drawBookmarks(body) {
    await loadMarks(); await liturgy();
    let pool = [...marks, ...await noteItems()];
    const SHOW = [['all', 'All'], ['marks', 'Bookmarks'], ['highlight', 'Highlights'], ['note', 'Notes']];
    const shows = m => bmView.show === 'all' || !bmView.show || (bmView.show === 'marks' ? m.type !== 'note' && m.type !== 'highlight' : m.type === bmView.show);
    const top = el('div', { class: 'st-bm-top' });
    const filter = el('input', { type: 'search', class: 'st-filter', placeholder: 'Filter by words, tag, note…', 'aria-label': 'Filter what you saved', value: bmView.query });
    const showBar = el('div', { class: 'st-show', role: 'group', 'aria-label': 'Show' }, ...SHOW.map(([v, t]) => el('button', { type: 'button', class: 'st-chip' + ((bmView.show || 'all') === v ? ' active' : ''), 'aria-pressed': String((bmView.show || 'all') === v), onclick: () => { bmView.show = v; showBar.querySelectorAll('button').forEach((b, i) => { const on = SHOW[i][0] === v; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); }); drawList(); } }, t, el('small', {}, String(pool.filter(m => v === 'all' || (v === 'marks' ? m.type !== 'note' && m.type !== 'highlight' : m.type === v)).length)))));
    const group = el('select', { 'aria-label': 'Group bookmarks by' }, ...[['none', 'Newest first'], ['collection', 'Collection'], ['tag', 'Tag'], ['book', 'Book of the Bible'], ['source', 'Source'], ['day', 'Liturgical day']].map(([v, t]) => el('option', { value: v, selected: v === bmView.group }, t)));
    top.append(filter, el('label', { class: 'st-groupby' }, 'Group by ', group));
    const shelf = el('div', { class: 'st-shelf' }), tagbar = el('div', { class: 'st-tagbar' }), actions = el('div', { class: 'st-bm-actions' });
    const list = el('div', { class: 'st-bm-list' });
    body.append(top, showBar, shelf, tagbar, actions, list);
    filter.oninput = () => { bmView.query = filter.value; drawList(); };
    group.onchange = () => { bmView.group = group.value; rememberView(); drawList(); };

    const special = { today: { label: 'Today’s Mass', days: () => liturgicalDay(new Date()) }, sunday: { label: 'Next Sunday', days: () => liturgicalDay(nextSunday()) } };
    function drawShelf() {
      shelf.replaceChildren(el('span', { class: 'st-shelf-label' }, 'Collections'));
      const chip = (value, text, count, title) => el('button', { type: 'button', class: 'st-chip' + (bmView.collection === value ? ' active' : ''), 'aria-pressed': String(bmView.collection === value), title: title || '', onclick: () => { bmView.collection = bmView.collection === value && value ? '' : value; rememberView(); drawShelf(); drawList(); } }, text, count != null ? el('small', {}, String(count)) : null);
      shelf.append(chip('', 'All', null));
      for (const c of collections) shelf.append(chip(c, c, marks.filter(m => (m.collections || []).includes(c)).length));
      if (lit) for (const [k, v] of Object.entries(special)) { const ds = v.days(); shelf.append(chip('@' + k, '⛪ ' + v.label, null, ds.length ? 'Bookmarks on the readings of ' + ds.map(dayName).join(' / ') : '')); }
      const addBtn = el('button', { type: 'button', class: 'st-chip st-chip-new', onclick: () => askName(addBtn, '', 'e.g. Lent 2027', async name => {
        if (!collections.includes(name)) { collections.push(name); await saveCollections(); }
        bmView.collection = name; rememberView(); drawShelf(); drawList();
      }) }, '+ New collection');
      shelf.append(addBtn);
      tagbar.replaceChildren();
      const tags = allTags();
      if (tags.length) {
        tagbar.append(el('span', { class: 'st-shelf-label' }, 'Tags'));
        for (const t of tags) tagbar.append(el('button', { type: 'button', class: 'st-tag' + (bmView.tag === t ? ' active' : ''), 'aria-pressed': String(bmView.tag === t), onclick: () => { bmView.tag = bmView.tag === t ? '' : t; rememberView(); drawShelf(); drawList(); } }, '#' + t, el('small', {}, String(marks.filter(m => (m.tags || []).includes(t)).length))));
      }
      actions.replaceChildren();
      const c = bmView.collection;
      const shown = () => visible();
      actions.append(el('span', { class: 'st-count' }, ''));
      actions.append(el('button', { type: 'button', class: 'quiet', title: 'Save what is shown as a document you can open in Word or a browser, print, or keep', onclick: () => exportDoc(shown(), heading()) }, '⇩ Export as a document'));
      const U = window.ScriptoriumUsability;
      if (U) actions.append(el('button', { type: 'button', class: 'quiet', title: 'Save every note, bookmark and highlight in one file', onclick: () => U.backup() }, 'Back up…'), el('button', { type: 'button', class: 'quiet', title: 'Bring back notes and bookmarks from a backup file', onclick: () => U.restore() }, 'Restore…'));
      if (c && !c.startsWith('@')) {
        const ren = el('button', { type: 'button', class: 'quiet', onclick: () => askName(ren, c, 'New name', async name => { if (name === c) return;
          collections = collections.map(x => x === c ? name : x).filter((x, i, a) => a.indexOf(x) === i);
          for (const m of marks) if (m.collections) m.collections = [...new Set(m.collections.map(x => x === c ? name : x))];
          bmView.collection = name; rememberView(); await saveCollections(); await saveMarks(); drawShelf(); drawList();
        }) }, 'Rename collection');
        actions.append(ren, el('button', { type: 'button', class: 'quiet', onclick: () => withUndo(`Collection “${c}” deleted. Its bookmarks are kept.`, async () => {
          collections = collections.filter(x => x !== c);
          for (const m of marks) if (m.collections) m.collections = m.collections.filter(x => x !== c);
          bmView.collection = ''; rememberView(); await saveCollections(); await saveMarks(); drawShelf(); drawList();
        }) }, 'Delete collection'));
      }
    }
    const heading = () => bmView.collection.startsWith('@') ? special[bmView.collection.slice(1)].label + ': ' + special[bmView.collection.slice(1)].days().map(dayName).join(' / ') : bmView.collection || (bmView.tag ? '#' + bmView.tag : 'Bookmarks');
    function visible() {
      const q = bmView.query.trim().toLowerCase(), c = bmView.collection;
      const sp = c.startsWith('@') ? new Set(special[c.slice(1)].days()) : null;
      return pool.filter(m => {
        if (!shows(m)) return false;
        if (sp) { if (!daysOf(m).some(d => sp.has(d))) return false; }
        else if (c && !(m.collections || []).includes(c)) return false;
        if (bmView.tag && !(m.tags || []).includes(bmView.tag)) return false;
        return !q || [m.label, m.sub, m.note, m.quote, ...(m.tags || []), ...(m.collections || [])].join(' ').toLowerCase().includes(q);
      });
    }
    function groups(items) {
      const g = bmView.group, out = new Map(), add = (k, m, order) => { if (!out.has(k)) out.set(k, { order, items: [] }); out.get(k).items.push(m); };
      for (const m of items) {
        if (g === 'none') add('', m, 0);
        else if (g === 'collection') { const cs = m.collections?.length ? m.collections : ['Not in a collection']; cs.forEach(c => add(c, m, collections.includes(c) ? collections.indexOf(c) : 1e6)); }
        else if (g === 'tag') { const ts = m.tags?.length ? m.tags : ['(no tag)']; ts.forEach(t => add(t === '(no tag)' ? 'No tag' : '#' + t, m, t === '(no tag)' ? 'zzz' : t)); }
        else if (g === 'book') { const p = placeOf(m); add(p ? bookName(p.book) : 'Not tied to a passage', m, p ? bookIndex(p.book) : 1e6); }
        else if (g === 'source') { const s = sourceOf(m); add(s, m, s === 'Scripture' ? ' ' : s); }
        else if (g === 'day') { const ds = daysOf(m); if (!ds.length) add('Not read in the 1962 Missal', m, 1e7); ds.slice(0, 4).forEach(d => add(dayName(d), m, lit.data.days.indexOf(d))); }
      }
      const sorted = [...out.entries()].sort((a, b) => a[1].order < b[1].order ? -1 : a[1].order > b[1].order ? 1 : 0);
      if (g === 'book') for (const [, v] of sorted) v.items.sort((a, b) => { const p = placeOf(a), q = placeOf(b); return p && q ? (p.chapter - q.chapter) || (p.verse - q.verse) : 0; });
      return sorted;
    }
    function drawList() {
      list.replaceChildren();
      const items = visible();
      actions.querySelector('.st-count').textContent = `${items.length} of ${pool.length}`;
      if (!pool.length) { list.append(el('p', { class: 'st-empty' }, 'Nothing saved yet.'), hint()); return; }
      if (!items.length) { list.append(el('p', { class: 'st-empty' }, bmView.collection.startsWith('@') ? 'None of your bookmarks is on these readings.' : 'Nothing here yet. Add bookmarks to this collection with ✎ Edit, or choose it when you bookmark.')); return; }
      for (const [name, v] of groups(items)) {
        if (name) list.append(el('h3', { class: 'st-group' }, name, el('small', {}, ' ' + v.items.length)));
        const ul = el('ul', { class: 'st-list' }); list.append(ul);
        for (const m of v.items) ul.append(row(m));
      }
      list.append(hint());
    }
    const hint = () => el('p', { class: 'st-hint st-bm-hint' }, 'To bookmark: ☆ Bookmark beside the chapter title (Shift + click a second verse, or select words across verses, for several verses together); the ☆ on a commentary heading; select words in a commentary or sermon for 🖍 Highlight & bookmark; or ☆ Bookmark on a liturgical day or sermon.');
    function row(m) {
      const li = el('li', { class: 'st-bm' + (m.type === 'note' ? ' st-bm-noteitem' : '') });
      if (m.type === 'note') {
        // A note: open it where it was written; remove clears its text (with Undo).
        li.append(el('div', { class: 'st-bm-main' },
          el('button', { type: 'button', class: 'st-item', onclick: () => { closeDialog(); m.open?.(); } }, el('b', {}, m.label), el('small', {}, 'Note · ' + m.sub)),
          el('div', { class: 'st-bm-meta' }, el('p', { class: 'st-bm-note' }, m.note.length > 600 ? m.note.slice(0, 600) + '…' : m.note))),
          el('div', { class: 'st-bm-btns' }, el('button', { type: 'button', class: 'quiet st-edit', disabled: !m.open, onclick: () => { closeDialog(); m.open?.(); } }, '✎ Edit'),
            el('button', { type: 'button', class: 'quiet st-remove', onclick: async () => {
              const body = m.note; await writeNote(m.forKey, ''); pool = pool.filter(x => x !== m); drawList();
              undoToast('Note deleted: ' + m.label, async () => { await writeNote(m.forKey, body); pool.push(m); drawList(); });
            } }, 'Delete')));
        return li;
      }
      const main = el('button', { type: 'button', class: 'st-item', onclick: () => openMark(m) },
        el('b', { class: m.type === 'highlight' ? 'st-quote' : '' }, m.type === 'highlight' ? m.label : m.label),
        el('small', {}, [KINDS[m.type] || '', m.sub || '', 'added ' + (m.added || '')].filter(Boolean).join(' · ')));
      const meta = el('div', { class: 'st-bm-meta' });
      for (const c of m.collections || []) meta.append(el('span', { class: 'st-coll' }, c));
      for (const t of m.tags || []) meta.append(el('span', { class: 'st-tag st-tag-small' }, '#' + t));
      if (m.note) meta.append(el('p', { class: 'st-bm-note' }, m.note));
      const edit = el('button', { type: 'button', class: 'quiet st-edit', 'aria-expanded': 'false', 'aria-label': 'Edit tags, collections and note for ' + m.label }, '✎ Edit');
      const remove = el('button', { type: 'button', class: 'quiet st-remove', 'aria-label': 'Remove bookmark ' + m.label, onclick: () => withUndo('Removed: ' + m.label, async () => { marks = marks.filter(x => x.key !== m.key); pool = pool.filter(x => x.key !== m.key); if (m.type === 'highlight') unwrap(m.key); await saveMarks(); drawShelf(); drawList(); }) }, 'Remove');
      const left = el('div', { class: 'st-bm-main' }, main, meta);
      li.append(left, el('div', { class: 'st-bm-btns' }, edit, remove));
      edit.onclick = () => {
        const open = li.querySelector('.st-bm-edit'); if (open) { open.remove(); edit.setAttribute('aria-expanded', 'false'); return; }
        edit.setAttribute('aria-expanded', 'true');
        const tags = el('input', { type: 'text', value: (m.tags || []).join(', '), placeholder: 'grace, prayer, Our Lady', list: 'st-tag-list2' });
        const dl = el('datalist', { id: 'st-tag-list2' }, ...allTags().map(t => el('option', { value: t })));
        const boxes = el('div', { class: 'st-colls' }, ...collections.map(c => el('label', {}, el('input', { type: 'checkbox', value: c, checked: (m.collections || []).includes(c) }), ' ' + c)));
        const newc = el('input', { type: 'text', placeholder: 'New collection…', 'aria-label': 'Add to a new collection' });
        const note = el('textarea', { rows: '3', placeholder: 'Why you marked this…' }); note.value = m.note || '';
        const save = async () => {
          m.tags = parseTags(tags.value); m.note = note.value.trim() || undefined;
          const chosen = [...boxes.querySelectorAll('input:checked')].map(i => i.value), extra = newc.value.trim();
          if (extra) { chosen.push(extra); if (!collections.includes(extra)) { collections.push(extra); await saveCollections(); } }
          m.collections = [...new Set(chosen)];
          await saveMarks(); drawShelf(); drawList();
        };
        li.append(el('div', { class: 'st-bm-edit' },
          el('label', {}, 'Tags ', tags, dl), el('div', {}, el('span', { class: 'st-edit-label' }, 'Collections'), boxes, newc), el('label', {}, 'Note ', note),
          el('div', { class: 'st-edit-btns' }, el('button', { type: 'button', class: 'primary', onclick: save }, 'Save'), el('button', { type: 'button', class: 'quiet', onclick: () => { li.querySelector('.st-bm-edit')?.remove(); edit.setAttribute('aria-expanded', 'false'); } }, 'Cancel'))));
        tags.focus();
      };
      return li;
    }
    drawShelf(); drawList();
  }

  // Small in-place prompts (the app's window may not show browser pop-ups).
  function twice(btn, ask, action) {
    if (btn.dataset.armed) { action(); return; }
    const was = btn.textContent; btn.dataset.armed = '1'; btn.textContent = ask; btn.classList.add('st-armed');
    setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = was; btn.classList.remove('st-armed'); } }, 3500);
  }
  function askName(btn, value, placeholder, done) {
    const input = el('input', { type: 'text', class: 'st-name', value, placeholder, 'aria-label': 'Collection name' });
    let over = false;
    const finish = ok => { if (over) return; over = true; const name = input.value.trim(); if (input.isConnected) input.replaceWith(btn); if (ok && name) done(name); };
    input.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); } };
    input.onblur = () => finish(true);
    btn.replaceWith(input); input.focus(); input.select();
  }
  // A document of bookmarks: opens in Word or any browser, prints, or can be saved as PDF.
  function exportDoc(items, title) {
    const parts = [];
    for (const [name, v] of (() => { const g = bmView.group; const m = new Map(); for (const it of items) { const k = g === 'book' ? (placeOf(it) ? bookName(placeOf(it).book) : 'Other') : g === 'source' ? sourceOf(it) : g === 'tag' ? ((it.tags || [])[0] ? '#' + it.tags[0] : 'No tag') : g === 'collection' ? ((it.collections || [])[0] || 'Not in a collection') : g === 'day' ? (daysOf(it)[0] ? dayName(daysOf(it)[0]) : 'Not read in the 1962 Missal') : ''; if (!m.has(k)) m.set(k, { items: [] }); m.get(k).items.push(it); } return m; })()) {
      if (name) parts.push(`<h2>${esc(name)}</h2>`);
      for (const m of v.items) {
        const where = m.type === 'highlight' ? m.sub : m.sub;
        parts.push('<div class="item">' + (m.type === 'highlight' ? `<blockquote>${esc(m.quote || m.label)}</blockquote><p class="src">— ${esc(where || '')}</p>` : `<h3>${esc(m.label)}</h3>${where ? `<p class="src">${esc(KINDS[m.type] || '')} · ${esc(where)}</p>` : `<p class="src">${esc(KINDS[m.type] || '')}</p>`}`)
          + (m.note ? `<p class="note">${esc(m.note).replace(/\n/g, '<br>')}</p>` : '')
          + ((m.tags || []).length ? `<p class="tags">${m.tags.map(t => '#' + esc(t)).join(' ')}</p>` : '') + '</div>');
      }
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:16px/1.6 Georgia,serif;color:#25352f;max-width:46em;margin:2em auto;padding:0 1em}h1{font-weight:normal;font-size:28px;border-bottom:1px solid #b18c50;padding-bottom:.3em}h2{font:600 13px 'Segoe UI',Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:#284b3c;margin-top:2em}h3{font-size:18px;margin:.2em 0}.item{margin:1.1em 0;page-break-inside:avoid}blockquote{margin:0;padding-left:1em;border-left:3px solid #b18c50;font-style:italic}.src{margin:.2em 0;font:12px 'Segoe UI',Arial,sans-serif;color:#788078}.note{margin:.4em 0;background:#f4f1e8;padding:.5em .8em;border-radius:4px}.tags{font:12px 'Segoe UI',Arial,sans-serif;color:#b18c50;margin:.2em 0}footer{margin-top:3em;font:11px 'Segoe UI',Arial,sans-serif;color:#788078}</style></head><body><h1>${esc(title)}</h1>${parts.join('\n')}<footer>From Scriptorium · ${new Date().toLocaleDateString()} · ${items.length} bookmark${items.length === 1 ? '' : 's'}</footer></body></html>`;
    const a = el('a', { href: URL.createObjectURL(new Blob([html], { type: 'text/html' })), download: (title.replace(/[^\w\- ]+/g, '').trim() || 'Bookmarks') + '.html' });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    if (typeof toast === 'function') toast('Saved “' + a.download + '”. It opens in Word or your browser, and prints or saves as PDF from there.');
  }

  // All notes, from Scriptorium's own export (each note is "## ref" then its text).
  async function allNotes() {
    const r = await fetch('/api/export-notes'); const text = await r.text();
    const out = [];
    for (const chunk of text.split(/^## /m).slice(1)) {
      const nl = chunk.indexOf('\n'); const ref = chunk.slice(0, nl).trim(), body = chunk.slice(nl).trim();
      if (ref && body && !ref.startsWith('scriptorium:')) out.push({ ref, body });
    }
    return out;
  }
  async function describeNote(n) {
    const m = n.ref.match(/^(\S+) (\d+):(\d+)$/);
    if (m) return { kind: 'Passage', label: `${bookName(m[1])} ${m[2]}:${m[3]}`, open: () => { closeDialog(); window.navigate(m[1], Number(m[2]), Number(m[3])).then(() => typeof studyTab === 'function' && studyTab('note')); } };
    if (n.ref.startsWith('cat:') && window.ScriptoriumCatena) { await window.ScriptoriumCatena.load(); const id = n.ref.slice(4); const p = (await window.ScriptoriumCatena.list()).find(x => x.id === id); if (p) return { kind: 'Catena Aurea', label: p.title, open: () => { closeDialog(); window.ScriptoriumCatena.open(id); } }; }
    if (/^(lit|ser|hom):/.test(n.ref) && window.ScriptoriumLiturgy) { await window.ScriptoriumLiturgy.load(); const d = window.ScriptoriumLiturgy.describe(n.ref); if (d) return { ...d, open: () => { closeDialog(); d.open(); } }; }
    return { kind: 'Other', label: n.ref, open: null };
  }
  async function drawNotes(body) {
    body.append(el('p', { class: 'st-empty' }, 'Loading your notes…'));
    let notes;
    try { notes = await allNotes(); } catch (e) { body.replaceChildren(el('p', { class: 'st-empty' }, 'Your notes could not be read: ' + e.message)); return; }
    const described = await Promise.all(notes.map(async n => ({ ...n, ...(await describeNote(n)) })));
    body.replaceChildren();
    const filter = el('input', { type: 'search', class: 'st-filter', placeholder: 'Filter notes…', 'aria-label': 'Filter notes' });
    const exportButton = el('button', { type: 'button', onclick: () => exportNotes(described) }, 'Export all ↓');
    const U = window.ScriptoriumUsability;
    body.append(el('div', { class: 'st-row' }, filter, exportButton,
      U ? el('button', { type: 'button', title: 'Save every note, bookmark and highlight in one file', onclick: () => U.backup() }, 'Back up…') : null,
      U ? el('button', { type: 'button', title: 'Bring back notes and bookmarks from a backup file', onclick: () => U.restore() }, 'Restore…') : null));
    if (!described.length) { body.append(el('p', { class: 'st-empty' }, 'No notes yet. Write them in the My notes tab beside a verse, or under a liturgical day or a sermon.')); return; }
    const list = el('div', { class: 'st-notes' });
    const order = ['Passage', 'Liturgical day', 'Sermon', 'Catena Aurea', 'Other'];
    const draw = () => {
      list.replaceChildren();
      const q = filter.value.trim().toLowerCase();
      for (const kind of order) {
        const group = described.filter(n => n.kind === kind && (!q || (n.label + ' ' + n.body).toLowerCase().includes(q)));
        if (!group.length) continue;
        list.append(el('h3', {}, { Passage: 'Notes on passages', 'Liturgical day': 'Notes on liturgical days', Sermon: 'Notes on sermons', 'Catena Aurea': 'Notes on the Catena Aurea', Other: 'Other notes' }[kind] + ` (${group.length})`));
        for (const n of group) list.append(el('article', { class: 'st-note-card' }, el('button', { type: 'button', class: 'st-item', disabled: !n.open, onclick: () => n.open?.() }, el('b', {}, n.label)), el('p', {}, n.body.length > 400 ? n.body.slice(0, 400) + '…' : n.body)));
      }
    };
    filter.oninput = draw; draw();
    body.append(list);
  }
  async function exportNotes(described) {
    await loadMarks();
    const lines = ['# Scriptorium — my study notes', '', `Exported ${new Date().toLocaleString()}`, ''];
    if (marks.length) { lines.push('## Bookmarks', ''); for (const m of marks) lines.push(`- ${m.label}`); lines.push(''); }
    for (const kind of ['Passage', 'Liturgical day', 'Sermon', 'Catena Aurea', 'Other']) {
      const group = described.filter(n => n.kind === kind);
      if (!group.length) continue;
      lines.push(`## ${{ Passage: 'Notes on passages', 'Liturgical day': 'Notes on liturgical days', Sermon: 'Notes on sermons', 'Catena Aurea': 'Notes on the Catena Aurea', Other: 'Other notes' }[kind]}`, '');
      for (const n of group) lines.push(`### ${n.label}`, '', n.body, '');
    }
    const a = el('a', { href: URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/markdown' })), download: 'Scriptorium study notes.md' });
    document.body.append(a); a.click(); a.remove();
  }

  // ---------- Search everything ----------
  let corpus = null;
  // One prepared file holds every searchable passage (made when Scriptorium is built), read once per session.
  async function buildCorpus(progress) {
    if (corpus) return corpus;
    progress('Opening the library of the Fathers…');
    const ix = await (await fetch('/atlas/search-fathers.json')).json();
    // The sermons and the Catena are not copied into the search file: their passages point into the packs Scriptorium
    // already has, which are read here (in parallel) the first time you search.
    const packs = new Map();
    for (const [, t] of ix.paras) if (Array.isArray(t)) packs.set(t[0] + ':' + t[1], null);
    let got = 0;
    await Promise.all([...packs.keys()].map(async key => {
      const [kind, name] = key.split(':');
      const r = await fetch(kind === 's' ? `/atlas/liturgy-sermons-${name}.json` : `/atlas/${name}.json`);
      packs.set(key, r.ok ? await r.json() : {});
      progress(`Opening the library of the Fathers… ${++got} of ${packs.size}`);
    }));
    const textOf = t => {
      if (!Array.isArray(t)) return t;
      const pack = packs.get(t[0] + ':' + t[1]) || {};
      if (t[0] === 's') return pack[t[2]]?.paragraphs?.[t[3]] || '';
      const p = pack[t[2]]; if (!p) return '';
      if (t[3] < 0) return p.lemma;
      return (p.segs[t[3]]?.t || '').split('\n\n').filter(y => y.trim())[t[4]] || '';
    };
    const L = () => window.ScriptoriumLiturgy, C = () => window.ScriptoriumCatena;
    const opener = (o, p) => {
      if (o[0] === 'h') return () => L().load().then(() => L().openHomily(o[1]));
      if (o[0] === 'd') return () => L().showDay(o[1]);
      if (o[0] === 's') return () => L().load().then(() => L().openSermon(o[1], { paragraph: p }));
      if (o[0] === 'c') return () => C()?.open(o[1], { paragraph: p });
      if (o[0] === 'b') return () => openBoylan(o[1], o[2]);
      return null;
    };
    corpus = ix.paras.map(([di, t, p]) => { const [k, title, sub, o] = ix.docs[di]; return { kind: ix.kinds[k], title, sub, text: textOf(t), f: null, open: opener(o, p) }; }).filter(x => x.text);
    return corpus;
  }
  async function openBoylan(psalm, verse) {
    closeDialog();
    const [pc] = window.ScriptoriumUsability ? await window.ScriptoriumUsability.psalmForReader(psalm, 1) : [hebrewPsalm(psalm)];
    await window.navigate('Psa', pc, 1);
    if (typeof studyTab === 'function') studyTab('commentary');
    const work = document.getElementById('commentary-work'), ps = document.getElementById('commentary-psalm');
    if (work && [...work.options].some(o => o.value === 'boylan-psalms')) work.value = 'boylan-psalms';
    if (ps) ps.value = String(psalm);
    if (typeof loadCommentary === 'function') loadCommentary();
  }
  function drawSearch(body) {
    const input = el('input', { type: 'search', placeholder: 'A word, a phrase in "quotes", or a theme — e.g. "bread of life" humility', 'aria-label': 'Search everything' });
    const scopes = ['Sermons of the Fathers', 'Catena Aurea', 'Matins homilies', 'Missal readings', 'Boylan on the Psalms', 'My notes'];
    const boxes = scopes.map(s => el('label', {}, el('input', { type: 'checkbox', checked: true, value: s }), ' ' + s));
    const status = el('p', { class: 'st-hint', role: 'status' }), results = el('div', { class: 'st-results' });
    const form = el('form', { class: 'st-search' }, input, el('button', { type: 'submit', class: 'primary' }, 'Search'));
    body.append(form, el('div', { class: 'st-scopes' }, ...boxes), status, results);
    let lastSearch = {}; try { lastSearch = JSON.parse(localStorage.getItem('scriptorium-search-everything') || '{}'); } catch {}
    if (Array.isArray(lastSearch.off)) boxes.forEach(b => { if (lastSearch.off.includes(b.firstChild.value)) b.firstChild.checked = false; });
    input.value = pendingQuery || lastSearch.q || '';
    if (pendingQuery) { pendingQuery = ''; setTimeout(() => form.requestSubmit(), 0); }
    form.onsubmit = async e => {
      e.preventDefault();
      const raw = input.value.trim(); if (!raw) return;
      try { localStorage.setItem('scriptorium-search-everything', JSON.stringify({ q: raw, off: boxes.map(b => b.firstChild).filter(b => !b.checked).map(b => b.value) })); } catch {}
      const phrases = [...raw.matchAll(/"([^"]+)"/g)].map(m => fold(m[1]));
      const words = fold(raw.replace(/"[^"]+"/g, ' ')).split(/\s+/).filter(w => w.length > 1);
      const terms = [...phrases, ...words];
      if (!terms.length) return;
      const on = new Set(boxes.map(b => b.firstChild).filter(b => b.checked).map(b => b.value));
      results.replaceChildren();
      try {
        const items = on.size === 1 && on.has('My notes') ? [] : await buildCorpus(t => { status.textContent = t; });
        let pool = items.filter(it => on.has(it.kind));
        if (on.has('My notes')) {
          status.textContent = 'Reading your notes…';
          for (const n of await allNotes()) { const d = await describeNote(n); pool.push({ kind: 'My notes', title: d.label, sub: d.kind, text: n.body, open: d.open }); }
        }
        const hits = [];
        for (const it of pool) {
          const t = it.f ??= fold(it.text);
          if (!terms.every(w => t.includes(w))) continue;
          let score = 0; for (const w of terms) { let i = -1; while ((i = t.indexOf(w, i + 1)) >= 0 && score < 50) score++; }
          hits.push({ it, score, at: t.indexOf(terms[0]) });
        }
        status.textContent = hits.length ? `${hits.length} passages found${hits.length > 300 ? ' — showing the best 300' : ''}.` : 'Nothing found. Try fewer or different words.';
        hits.sort((a, b) => b.score - a.score);
        for (const kind of scopes) {
          const group = hits.filter(h => h.it.kind === kind).slice(0, ['Sermons of the Fathers', 'Catena Aurea'].includes(kind) ? 150 : 60);
          if (!group.length) continue;
          results.append(el('h3', {}, `${kind} (${hits.filter(h => h.it.kind === kind).length})`));
          for (const { it, at } of group) results.append(el('button', { type: 'button', class: 'st-hit', onclick: () => { closeDialog(); it.open?.(); } }, el('b', {}, it.title), it.sub ? el('small', {}, it.sub) : null, snippet(it.text, at, terms)));
        }
      } catch (err) { status.textContent = 'The search could not finish: ' + err.message; }
    };
  }
  function snippet(text, at, terms) {
    const plain = fold(text), start = Math.max(0, at - 120), end = Math.min(text.length, at + 220);
    const piece = (start ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : ''), foldedPiece = (start ? '…' : '') + plain.slice(start, end);
    const p = el('span', { class: 'st-snip' });
    let i = 0;
    const marksAt = [];
    for (const w of terms) { let k = -1; while ((k = foldedPiece.indexOf(w, k + 1)) >= 0) marksAt.push([k, k + w.length]); }
    marksAt.sort((a, b) => a[0] - b[0]);
    for (const [a, b] of marksAt) { if (a < i) continue; p.append(piece.slice(i, a), el('mark', {}, piece.slice(a, b))); i = b; }
    p.append(piece.slice(i));
    return p;
  }

  // ---------- Highlights: select text in a commentary or sermon, highlight it, and keep it as a bookmark ----------
  // Where highlights can be made: each source names its paragraphs and how to find it again.
  function hlSource(node) {
    const e = node?.nodeType === 1 ? node : node?.parentElement;
    const entry = e?.closest('.commentary-entry[data-entry-id]');
    if (entry && e.closest('.commentary-body')) {
      const item = commentaryItem(entry);
      return { root: entry.querySelector('.commentary-body'), paras: r => [...r.querySelectorAll('.commentary-paragraph')], ctx: (({ key, type, label, sub, ...rest }) => ({ kind: 'commentary', ...rest }))(item), id: item.key, label: item.label, sub: item.sub };
    }
    const reading = e?.closest('.lit-reading[data-st-key]');
    if (reading && reading.dataset.stKind === 'catena') return { root: reading, paras: r => [...r.querySelectorAll(':scope > p')], ctx: { kind: 'catena', catena: reading.dataset.stId }, id: reading.dataset.stKey, label: reading.dataset.stLabel, sub: 'Catena Aurea' };
    if (reading) return { root: reading, paras: r => [...r.querySelectorAll(':scope > p')], ctx: { kind: 'sermon', sermonId: reading.dataset.stSermon }, id: reading.dataset.stKey, label: reading.dataset.stLabel, sub: 'Sermon' };
    return null;
  }
  const textBefore = (para, node, offset) => { const r = document.createRange(); r.setStart(para, 0); r.setEnd(node, offset); return r.toString().length; };
  function wrap(para, start, end, key) {
    const walker = document.createTreeWalker(para, NodeFilter.SHOW_TEXT);
    const pieces = []; let pos = 0, n;
    while ((n = walker.nextNode())) {
      const len = n.data.length, a = Math.max(start, pos), b = Math.min(end, pos + len);
      if (a < b) pieces.push([n, a - pos, b - pos]);
      pos += len; if (pos >= end) break;
    }
    for (const [node, a, b] of pieces) {
      let t = node; if (a > 0) t = t.splitText(a); if (b - a < t.data.length) t.splitText(b - a);
      const m = el('mark', { class: 'st-hl', 'data-hl': key, title: 'Highlighted — click to remove or open your bookmarks' });
      t.replaceWith(m); m.append(t);
    }
  }
  function unwrap(key) {
    for (const m of document.querySelectorAll(`mark.st-hl[data-hl="${CSS.escape(key)}"]`)) { const p = m.parentNode; m.replaceWith(...m.childNodes); p.normalize(); }
  }
  function paint(src) {
    if (!src || !marks) return;
    const paras = src.paras(src.root);
    for (const h of marks) {
      if (h.type !== 'highlight' || h.of !== src.id || src.root.querySelector(`mark.st-hl[data-hl="${CSS.escape(h.key)}"]`)) continue;
      for (const seg of h.segments || []) {
        let p = paras[seg.para], start = seg.start;
        // If the paragraph moved, find the words again.
        if (!p || p.textContent.slice(seg.start, seg.end) !== seg.text) {
          p = paras.find(x => x.textContent.includes(seg.text)); if (!p) continue;
          start = p.textContent.indexOf(seg.text);
        }
        wrap(p, start, start + seg.text.length, h.key);
      }
    }
  }
  function paintAll() {
    if (!marks) return;
    for (const body of document.querySelectorAll('#commentary-results .commentary-body')) if (body.querySelector('.commentary-paragraph')) paint(hlSource(body));
    for (const r of document.querySelectorAll('.lit-reading[data-st-key]')) paint(hlSource(r));
  }
  let pop = null;
  function hidePop() { pop?.remove(); pop = null; }
  function showPop(x, y, ...buttons) {
    hidePop();
    pop = el('div', { class: 'st-hl-pop', role: 'toolbar' }, ...buttons);
    (document.querySelector('dialog[open]') || document.body).append(pop);
    const w = pop.offsetWidth;
    pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, x - w / 2)) + 'px';
    pop.style.top = Math.min(innerHeight - pop.offsetHeight - 8, Math.max(8, y - pop.offsetHeight - 8)) + 'px';
  }
  async function addHighlight(range, src) {
    const paras = src.paras(src.root), segments = [];
    paras.forEach((p, i) => {
      if (!range.intersectsNode(p)) return;
      const start = p.contains(range.startContainer) ? textBefore(p, range.startContainer, range.startOffset) : 0;
      const end = p.contains(range.endContainer) ? textBefore(p, range.endContainer, range.endOffset) : p.textContent.length;
      const text = p.textContent.slice(start, end);
      if (text.trim()) segments.push({ para: i, start, end, text });
    });
    if (!segments.length) return;
    const quote = segments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim();
    const key = 'hl:' + hash(src.id + '|' + segments.map(s => s.para + ':' + s.start).join(',') + '|' + quote);
    await loadMarks();
    marks.unshift({ key, type: 'highlight', label: '“' + (quote.length > 140 ? quote.slice(0, 140) + '…' : quote) + '”', sub: src.label, of: src.id, quote, segments, ...src.ctx, added: new Date().toISOString().slice(0, 10) });
    getSelection().removeAllRanges();
    segments.forEach(s => wrap(src.paras(src.root)[s.para], s.start, s.end, key));
    try { await saveMarks(); } catch (e) { if (typeof fail === 'function') fail(e); return; }
    const r = src.root.querySelector(`mark.st-hl[data-hl="${CSS.escape(key)}"]`)?.getBoundingClientRect();
    if (r) quickFile(key, r.left + r.width / 2, r.top); else if (typeof toast === 'function') toast('Highlighted and bookmarked.');
  }
  // Straight after bookmarking: a tag or two and a collection, or just carry on reading.
  let lastCollection = '';
  try { lastCollection = localStorage.getItem('scriptorium-last-collection') || ''; } catch {}
  function quickFile(key, x, y) {
    const m = marks.find(b => b.key === key); if (!m) return;
    const tags = el('input', { type: 'text', class: 'st-quick-tags', placeholder: 'Tags, e.g. grace, prayer', 'aria-label': 'Tags for this bookmark', list: 'st-tag-list' });
    const list = el('datalist', { id: 'st-tag-list' }, ...allTags().map(t => el('option', { value: t })));
    const coll = el('select', { 'aria-label': 'Collection' }, el('option', { value: '' }, 'No collection'), ...collections.map(c => el('option', { value: c, selected: c === lastCollection }, c)));
    const done = async () => {
      hidePop();
      m.tags = parseTags(tags.value); m.collections = coll.value ? [coll.value] : [];
      lastCollection = coll.value; try { localStorage.setItem('scriptorium-last-collection', lastCollection); } catch {}
      if (m.tags.length || m.collections.length) await saveMarks();
      if (typeof toast === 'function') toast('Bookmarked' + (m.collections.length ? ' in “' + m.collections[0] + '”' : '') + '. Find it under Bookmarks at the top.');
    };
    tags.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); done(); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hidePop(); } };
    showPop(x, y, el('span', { class: 'st-pop-label' }, '✓ Saved'), tags, list, coll, el('button', { type: 'button', onclick: done }, 'Done'));
    pop.classList.add('st-hl-pop-file'); pop.onmouseup = e => e.stopPropagation();
    setTimeout(() => tags.focus(), 20);
  }
  const parseTags = text => [...new Set(text.split(/[,;#]+/).map(t => t.trim().toLowerCase()).filter(Boolean))];
  const allTags = () => [...new Set((marks || []).flatMap(m => m.tags || []))].sort();
  async function removeHighlight(key) {
    try { await withUndo('Highlight removed.', async () => { marks = (marks || []).filter(m => m.key !== key); unwrap(key); await saveMarks(); }); } catch (e) { if (typeof fail === 'function') fail(e); }
  }
  document.addEventListener('mouseup', e => {
    if (pop?.contains(e.target)) return;
    setTimeout(() => {
      const mark = e.target.closest?.('mark.st-hl');
      const sel = getSelection();
      if (sel.isCollapsed && mark) {
        const key = mark.dataset.hl, r = mark.getBoundingClientRect();
        showPop(r.left + r.width / 2, r.top,
          el('button', { type: 'button', onclick: () => { hidePop(); removeHighlight(key); } }, 'Remove highlight'),
          el('button', { type: 'button', onclick: () => { hidePop(); openStudy('bookmarks'); } }, 'All bookmarks'));
        return;
      }
      if (sel.isCollapsed || !sel.rangeCount) { hidePop(); return; }
      const range = sel.getRangeAt(0), src = hlSource(range.commonAncestorContainer) || hlSource(range.startContainer);
      // Words selected across several verses of the reader: offer to bookmark those verses.
      const rowOf = n => (n.nodeType === 1 ? n : n.parentElement)?.closest?.('.verse-row');
      const r1 = rowOf(range.startContainer), r2 = rowOf(range.endContainer);
      if (!src && r1 && r2 && r1 !== r2 && state.book) {
        const a = +r1.id.replace('verse-', ''), b = +r2.id.replace('verse-', ''), item = passageItem(state.book, state.chapter, a, b), r = range.getBoundingClientRect();
        showPop(r.left + r.width / 2, Math.max(r.top, 60), el('button', { type: 'button', class: 'st-hl-add', onclick: async () => { hidePop(); getSelection().removeAllRanges(); if (!isMarked(item.key)) { await toggleMark(item); quickFile(item.key, r.left + r.width / 2, Math.max(r.top, 60)); } else if (typeof toast === 'function') toast('Already bookmarked: ' + item.label); } }, '☆ Bookmark ' + item.label));
        return;
      }
      if (!src || !src.root.contains(range.endContainer) || !sel.toString().trim()) { hidePop(); return; }
      const r = range.getBoundingClientRect();
      showPop(r.left + r.width / 2, r.top, el('button', { type: 'button', class: 'st-hl-add', onclick: () => { hidePop(); addHighlight(range, src); } }, '🖍 Highlight & bookmark'));
    }, 0);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hidePop(); });
  document.addEventListener('scroll', e => { if (!pop?.classList.contains('st-hl-pop-file') && !pop?.contains(e.target)) hidePop(); }, true);
  // New commentary entries get their ☆ and highlights; reading windows get their highlights.
  loadMarks().then(() => {
    watch('#commentary-results', () => { decorateCommentary(); paintAll(); });
    watch('.lit-reading', () => paintAll());
    paintAll();
  });
  async function openHighlight(m) {
    closeDialog();
    if (m.kind === 'commentary') await openCommentary(m);
    else if (m.kind === 'sermon') { await window.ScriptoriumLiturgy?.load(); window.ScriptoriumLiturgy?.openSermon(m.sermonId); }
    else if (m.kind === 'catena') await window.ScriptoriumCatena?.open(m.catena);
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 150));
      paintAll();
      const found = document.querySelector(`mark.st-hl[data-hl="${CSS.escape(m.key)}"]`);
      if (found) { found.scrollIntoView({ block: 'center' }); found.classList.add('st-hl-flash'); setTimeout(() => found.classList.remove('st-hl-flash'), 1800); return; }
    }
  }

  // ---------- Buttons in the reader and the Study tools menu ----------
  function addButtons() {
    const actions = document.querySelector('.chapter-actions');
    if (actions && !document.getElementById('history-back')) {
      backButton = el('button', { id: 'history-back', type: 'button', class: 'st-hist', disabled: true, onclick: () => step(-1) }, '‹ Back');
      forwardButton = el('button', { id: 'history-forward', type: 'button', class: 'st-hist', disabled: true, onclick: () => step(1) }, 'Forward ›');
      starButton = el('button', { id: 'bookmark-verse', type: 'button', class: 'st-hist st-verse-star', 'aria-pressed': 'false', onclick: async () => { const it = verseItem(), was = isMarked(it.key); await toggleMark(it); if (!was) { const r = starButton.getBoundingClientRect(); quickFile(it.key, r.left + r.width / 2, r.bottom + 70); } } }, '☆');
      const group = el('div', { class: 'st-history', role: 'group', 'aria-label': 'Go back or forward through the passages you have visited' }, backButton, forwardButton, starButton);
      actions.parentElement.insertBefore(group, actions);
      updateHistory();
    }
    topTabs();
    loadMarks().then(updateStar);
  }
  // ---------- Study tools as a row of tabs along the top, instead of a drop-down menu ----------
  const ICON = {
    bookmarks: '<path d="M6 3h12v18l-6-4-6 4Z"/>',
    notes: '<path d="M5 3h10l4 4v14H5Z"/><path d="M14 3v5h5M8 12h8M8 16h6"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>'
  };
  function topTabs() {
    const menu = document.getElementById('study-tools-menu'), old = menu?.closest('.study-tools-control');
    if (!menu || !old) return;
    let nav = document.getElementById('study-tabs');
    if (!nav) {
      nav = el('nav', { id: 'study-tabs', class: 'study-tools-control st-topnav', 'aria-label': 'Study tools' });
      old.before(nav); old.classList.add('st-old-tools');
      const b = el('button', { id: 'study-my', type: 'button', class: 'st-toptab', title: 'Everything you saved — bookmarks, highlights and notes — and the full-text search of the Fathers', onclick: () => openStudy('saved') });
      b.innerHTML = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">${ICON.bookmarks}</svg><span>My study</span>`;
      nav.append(b);
    }
    // Move the menu's own tools (map, maps, photos, timeline) to the front of the row, keeping their behaviour.
    const mine = nav.querySelector('#study-my');
    for (const item of [...menu.querySelectorAll('.study-tools-item')]) {
      item.classList.remove('study-tools-item'); item.classList.add('st-toptab');
      item.removeAttribute('role'); item.removeAttribute('tabindex');
      const note = item.querySelector('small'); if (note) note.remove();
      // Maps and Photos are views inside the Atlas window, so they need no tab of their own.
      if (item.id === 'maps-open' || item.id === 'photos-open') { item.hidden = true; item.classList.add('st-hidden-tab'); }
      if (item.id === 'bible-map-open') { item.title = 'Atlas: the Bible map, prepared maps and photographs'; const label = [...item.childNodes].find(n => n.nodeType === 1 && n.tagName === 'SPAN') || null; if (label) label.textContent = 'Atlas'; }
      nav.insertBefore(item, mine);
    }
    markActive();
  }
  // The tab whose window is open stays lit.
  function markActive() {
    const nav = document.getElementById('study-tabs'); if (!nav) return;
    const open = id => document.getElementById(id)?.open;
    const mapView = document.getElementById('bible-map-dialog')?.open ? 'bible-map-open' : '';
    const timeline = document.querySelector('dialog#bible-timeline-dialog[open]') ? 'timeline-open' : '';
    const study = open('study-dialog') ? 'study-my' : '';
    const active = study || timeline || mapView;
    for (const b of nav.querySelectorAll('.st-toptab')) { const on = b.id === active; b.classList.toggle('active', on); if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); }
  }
  document.addEventListener('close', () => setTimeout(markActive, 0), true);
  document.addEventListener('click', e => { if (e.target.closest?.('.st-toptab, [role=tab], dialog')) setTimeout(markActive, 60); }, true);
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) { e.preventDefault(); openStudy('search'); } });
  addButtons();
  ready.then(addButtons);
  on('navigate', addButtons);
  window.ScriptoriumStudy = {
    bookmarkButton, noteBox, openStudy, toggleMark, paintHighlights: paintAll, openMark, closeDialog, undoToast,
    loadMarks, marks: () => marks || [], allNotes, describeNote, readNote, writeNote, placeOf, daysOf, liturgy,
    // For a backup being restored: merge bookmarks by key and collections by name.
    async mergeMarks(items, cols) {
      await loadMarks();
      const have = new Set(marks.map(m => m.key)); let added = 0;
      for (const m of items || []) if (m && m.key && !have.has(m.key)) { marks.push(m); have.add(m.key); added++; }
      for (const c of cols || []) if (!collections.includes(c)) collections.push(c);
      await saveCollections(); await saveMarks(); paintAll();
      return added;
    },
    redraw() { if (dialog?.open) drawDialog(); }
  };
})();
/* END SCRIPTORIUM STUDY EXTRAS */

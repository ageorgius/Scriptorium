/* BEGIN SCRIPTORIUM CATENA AUREA — St. Thomas Aquinas, the Fathers on the four Gospels (Oxford translation ed. J. H. Newman).
   It appears as one more English commentary in the Commentary tab, beside each day's Gospel in the Liturgy tab,
   in Search everything and in Go anywhere. */
(() => {
  'use strict';
  const { el, apiUse } = window.Scriptorium;
  const WORK = 'catena-newman', TITLE = 'Catena Aurea — St. Thomas Aquinas';
  const GOSPELS = { Mat: 'Matthew', Mar: 'Mark', Luk: 'Luke', Joh: 'John' };
  const EDITION = 'Catena Aurea: Commentary on the Four Gospels, collected out of the works of the Fathers, by St. Thomas Aquinas. Oxford translation, ed. John Henry Newman (London: J. G. F. and J. Rivington, 1841–45). Public domain; text from the verbatim Catena corpus (github.com/AlvaroBalbin/catena).';
  let index = null, indexPromise = null;
  const packs = new Map();
  function load() {
    if (index) return Promise.resolve(index);
    return indexPromise ||= fetch('/atlas/catena-index.json').then(r => { if (!r.ok) throw Error('The Catena Aurea could not be loaded.'); return r.json(); })
      .then(d => { index = d.passages; index.byId = new Map(index.map(p => [p.id, p])); return index; }).catch(e => { indexPromise = null; throw e; });
  }
  function pack(name) {
    if (!packs.has(name)) packs.set(name, fetch(`/atlas/${name}.json`).then(r => { if (!r.ok) throw Error('The Catena Aurea could not be loaded.'); return r.json(); }).catch(e => { packs.delete(name); throw e; }));
    return packs.get(name);
  }
  async function passage(id) { await load(); const p = index.byId.get(id); if (!p) throw Error('This passage of the Catena is not available.'); const text = (await pack(p.pack))[id]; return { ...p, ...text }; }
  const span = p => `${p.c}:${p.v}${p.c2 !== p.c ? `–${p.c2}:${p.v2}` : p.v2 !== p.v ? `–${p.v2}` : ''}`;
  const label = (p, reader) => `${GOSPELS[p.b]} ${reader && p.nav ? span({ c: p.nav.c, v: p.nav.v, c2: p.nav.c2, v2: p.nav.v2 }) : span(p)}`;
  const at = (c, v) => c * 1000 + v;
  // Passages on a stretch of a Gospel. vulgate: true when the numbers are the Missal's, false for the reader's.
  async function forRange(book, c, v, c2, v2, vulgate = true) {
    if (!GOSPELS[book]) return [];
    await load();
    const a = at(c, v), b = at(c2 ?? c, v2 ?? v);
    return index.filter(p => {
      if (p.b !== book) return false;
      const q = vulgate || !p.nav ? p : { c: p.nav.c, v: p.nav.v, c2: p.nav.c2, v2: p.nav.v2 };
      return at(q.c, q.v) <= b && at(q.c2, q.v2) >= a;
    });
  }

  // ---------- In the Commentary tab: one more English commentary on the Gospels ----------
  const asEntry = (p, matched) => ({ id: p.id, work: WORK, work_title: TITLE, title: label(p, true) + ' · ' + p.fathers.slice(0, 4).join(', ') + (p.fathers.length > 4 ? '…' : ''), scope: matched ? 'verse' : 'nearby', matched: matched ? 1 : 0, first_verse: p.nav ? p.nav.v : p.v, last_verse: p.nav ? p.nav.v2 : p.v2, language: 'English' });
  function reading(t) {
    const paragraphs = [{ text: t.lemma, heading: 'The Gospel — ' + label(t, true), basis: 'The words of the Gospel on which the Fathers comment' }];
    for (const s of t.segs) s.t.split(/\n\n+/).forEach((x, i) => paragraphs.push(i ? { text: x } : { text: x, heading: s.f || 'St. Thomas', basis: s.f ? 'Quoted by St. Thomas in the Catena Aurea' : '' }));
    return { id: t.id, title: label(t, true), body: paragraphs.map(p => p.text).join('\n\n'), paragraphs, author: 'St. Thomas Aquinas, gathering the Fathers', edition: EDITION, reference_note: '', notice: t.nav ? 'Verse numbers here follow your Bible; the Catena itself follows the Vulgate (' + label(t) + ').' : '', language: 'English', source_href: 'https://www.ccel.org/ccel/aquinas/catena1.html' };
  }
  apiUse(async (path, query, body, next) => {
    if (path === '/api/commentary' && String(query?.id || '').startsWith('catena.')) return reading(await passage(query.id));
    if (path !== '/api/commentaries' || !GOSPELS[query?.book] || (query.language && query.language !== 'English')) return next();
    const mine = query.work === WORK;
    const { work: _w, ...rest } = query;
    const data = await next(mine ? rest : query);
    try {
      await load();
      const chapters = index.filter(p => p.b === query.book).map(p => p.nav ? [p.nav.c, p.nav.c2] : [p.c, p.c2]).flat();
      const works = [...(data.works || []).filter(w => w.id !== WORK), { id: WORK, title: TITLE + ' (Newman tr.)', language: 'English', first_chapter: Math.min(...chapters), last_chapter: Math.max(...chapters) }];
      if (query.work && !mine) return { ...data, works };
      const ch = Number(query.chapter), v = Number(query.verse) || 1;
      let hits = (await forRange(query.book, ch, v, ch, v, false)).map(p => asEntry(p, true));
      if (!hits.length) { const near = (await forRange(query.book, ch, 1, ch, 999, false))[0]; if (near) hits = [asEntry(near, false)]; }
      if (mine) return { ...data, works, entries: hits, notice: '', general_count: 0 };
      const entries = [...(data.entries || [])], firstContext = entries.findIndex(e => !e.matched);
      entries.splice(firstContext < 0 ? entries.length : firstContext, 0, ...hits.filter(h => h.matched));
      if (!hits.some(h => h.matched)) entries.push(...hits);
      return { ...data, works, entries };
    } catch (e) { console.warn(e); return data; }
  });

  // ---------- A reading window ----------
  let dialog = null, size = 19;
  try { size = Number(localStorage.getItem('scriptorium-catena-size')) || 19; } catch {}
  async function open(id, opts = {}) {
    await load();
    const p = index.byId.get(id); if (!p) return;
    const same = index.filter(x => x.b === p.b), i = same.indexOf(p);
    if (!dialog) { dialog = el('dialog', { class: 'lit-dialog cat-dialog', 'aria-label': 'Catena Aurea' }); dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); }); document.body.append(dialog); }
    const S = window.ScriptoriumStudy, key = 'cat:' + id;
    const text = el('div', { class: 'lit-dialog-text lit-reading cat-reading', style: `font-size:${size}px`, 'data-st-key': key, 'data-st-kind': 'catena', 'data-st-id': id, 'data-st-label': 'Catena Aurea · ' + label(p, true) }, el('p', { class: 'lit-empty' }, 'Loading…'));
    const resize = step => { size = Math.max(16, Math.min(26, size + step)); text.style.fontSize = size + 'px'; try { localStorage.setItem('scriptorium-catena-size', size); } catch {} };
    const head = el('div', { class: 'lit-dialog-head' },
      el('div', {}, el('p', { class: 'lit-kicker' }, (opts.day ? opts.day + ' · ' : '') + 'Catena Aurea · St. Thomas Aquinas'), el('h2', {}, 'On ' + label(p, true)),
        el('p', { class: 'lit-hint' }, 'The Fathers quoted: ' + p.fathers.join(', '), ' ', el('button', { type: 'button', class: 'quiet lit-open-passage', onclick: () => { dialog.close(); window.navigate(p.b, p.nav ? p.nav.c : p.c, p.nav ? p.nav.v : p.v); } }, 'Open the passage →'))),
      el('div', { class: 'lit-dialog-tools' },
        el('button', { type: 'button', class: 'quiet', 'aria-label': 'Smaller text', onclick: () => resize(-2) }, 'A−'),
        el('button', { type: 'button', class: 'quiet', 'aria-label': 'Larger text', onclick: () => resize(2) }, 'A+'),
        S?.bookmarkButton({ key, type: 'catena', label: 'Catena Aurea · ' + label(p, true), sub: p.fathers.slice(0, 5).join(', '), catena: id, book: p.b, chapter: p.nav ? p.nav.c : p.c, verse: p.nav ? p.nav.v : p.v }) || null,
        el('button', { type: 'button', disabled: i <= 0, title: i > 0 ? label(same[i - 1], true) : '', onclick: () => open(same[i - 1].id, opts) }, '‹ Previous'),
        el('button', { type: 'button', disabled: i >= same.length - 1, title: i < same.length - 1 ? label(same[i + 1], true) : '', onclick: () => open(same[i + 1].id, opts) }, 'Next ›'),
        el('button', { type: 'button', class: 'quiet', 'aria-label': 'Close', onclick: () => dialog.close() }, '×')));
    dialog.replaceChildren(head, text, el('p', { class: 'lit-source' }, EDITION));
    if (!dialog.open) dialog.showModal();
    try {
      const t = await passage(id);
      if (!dialog.contains(text)) return;
      const kids = [el('p', { class: 'cat-lemma' }, t.lemma)];
      for (const s of t.segs) { kids.push(el('h5', { class: 'cat-father' }, s.f || 'St. Thomas')); for (const x of s.t.split(/\n\n+/)) kids.push(el('p', {}, x)); }
      text.replaceChildren(...kids);
      if (S) text.append(el('section', { class: 'lit-sermon-notes' }, el('h6', {}, 'My notes on this passage'), S.noteBox(key, 'Catena Aurea · ' + label(p, true))));
      S?.paintHighlights?.();
      if (opts.paragraph != null) { const q = text.querySelectorAll(':scope > p')[opts.paragraph]; if (q) { q.classList.add('lit-hit'); q.scrollIntoView({ block: 'center' }); } }
      else text.scrollTop = 0;
    } catch (e) { text.replaceChildren(el('p', { class: 'lit-empty' }, e.message)); }
  }

  // ---------- Beside a day's Gospel in the Liturgy tab ----------
  function dayBox(d) {
    const box = el('section', { class: 'lit-section cat-day' }, el('h4', {}, 'Catena Aurea — the Fathers on this Gospel'));
    const list = el('div', { class: 'cat-list' }, el('p', { class: 'lit-hint' }, 'Finding the passages…'));
    box.append(list);
    (async () => {
      const seen = new Set(), found = [];
      for (const g of d.gospels || []) for (const r of g.refs || []) for (const p of await forRange(r.book, r.chapter, r.verse, r.endChapter, r.endVerse, true)) if (!seen.has(p.id)) { seen.add(p.id); found.push(p); }
      list.replaceChildren();
      if (!found.length) { list.append(el('p', { class: 'lit-hint' }, d.gospels?.length ? 'St. Thomas gathered the Fathers on the four Gospels only; nothing for this reading.' : 'No Gospel is listed for this day.')); return; }
      for (const p of found) list.append(el('button', { type: 'button', class: 'cat-card', onclick: () => open(p.id, { day: d.title }) },
        el('b', {}, label(p, true)), el('span', { class: 'cat-lemma-short' }, p.lemma), el('small', {}, p.fathers.slice(0, 6).join(' · ') + (p.fathers.length > 6 ? ` · +${p.fathers.length - 6}` : '') + ` · about ${Math.max(1, Math.round(p.n / 1100))} min`)));
      list.append(el('p', { class: 'lit-hint' }, 'Oxford translation, ed. J. H. Newman (1841–45).'));
    })().catch(e => list.replaceChildren(el('p', { class: 'lit-hint' }, e.message)));
    return box;
  }

  // ---------- For Search everything and Go anywhere ----------
  async function corpus(progress) {
    progress?.('Reading the Catena Aurea…');
    await load();
    const items = [];
    for (const name of [...new Set(index.map(p => p.pack))]) {
      const texts = await pack(name);
      for (const p of index.filter(x => x.pack === name)) {
        const t = texts[p.id]; let n = 0;
        items.push({ kind: 'Catena Aurea', title: 'Catena Aurea — ' + label(p, true), sub: t.lemma.slice(0, 120), text: t.lemma, open: () => open(p.id, { paragraph: 0 }) });
        for (const s of t.segs) for (const x of s.t.split(/\n\n+/)) { n++; const k = n; items.push({ kind: 'Catena Aurea', title: `${s.f || 'St. Thomas'} — Catena on ${label(p, true)}`, sub: t.lemma.slice(0, 100), text: x, open: () => open(p.id, { paragraph: k }) }); }
      }
    }
    return items;
  }
  async function list() { await load(); return index.map(p => ({ id: p.id, title: 'Catena Aurea — ' + label(p, true), sub: p.lemma, fathers: p.fathers })); }

  window.ScriptoriumCatena = { load, forRange, open, dayBox, corpus, list, label, WORK };
})();
/* END SCRIPTORIUM CATENA AUREA */

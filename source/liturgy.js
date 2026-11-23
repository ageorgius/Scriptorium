
/* BEGIN SCRIPTORIUM 1962 LITURGY — the Epistles and Gospels of the 1962 Missal by temporal and sanctoral cycle,
   with complete sermons of the Fathers and Doctors on them and the Breviary's Matins homilies. */
(() => {
  'use strict';
  const panel = document.getElementById('liturgy-panel');
  if (!panel) return;
  const CYCLES = [['temporal', 'Temporal'], ['sanctoral', 'Sanctoral'], ['common', 'Commons & Votive']];
  const GOSPELS = new Set(['Mat', 'Mar', 'Luk', 'Joh']);
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const ON = { Gospel: 'On the Gospel', Epistle: 'On the Epistle', Feast: 'For the feast', Parallel: 'On the same event in another Gospel' };
  let data = null, sermons = null, loading = null, cycle = 'temporal', query = '', current = null, failed = '';
  let ordoDate = new Date(), todayContext = null, sessionStarted = false;
  // Stable keys for notes and bookmarks (day and sermon ids change when the data is rebuilt; titles do not).
  const hash = s => window.Scriptorium.hash(s);
  const slug = s => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const dayKey = d => `lit:${slug(d.title).slice(0, 22)}-${hash(d.cycle + '|' + d.title + '|' + (d.subtitle || ''))}`;
  const sermonKey = s => `ser:${hash(s.father + '|' + s.work + '|' + s.title)}`;
  const ordoFor = date => window.ScriptoriumOrdo && data ? window.ScriptoriumOrdo.forDate(data, date) : null;
  const opened = new Set(), textCache = new Map();
  const saved = (() => { try { return JSON.parse(localStorage.getItem('scriptorium-liturgy') || '{}'); } catch { return {}; } })();
  let readerSize = [16, 18, 20, 22, 24].includes(saved.size) ? saved.size : 19;
  if (CYCLES.some(c => c[0] === saved.cycle)) cycle = saved.cycle;
  const remember = () => { try { localStorage.setItem('scriptorium-liturgy', JSON.stringify({ cycle, day: current?.id || null, size: readerSize })); } catch {} };

  function el(...args) { return window.Scriptorium.el(...args); }
  // References carry Vulgate numbers (as in the Missal); `nav` holds the reader's numbering where it differs.
  const at = r => r.nav ? { book: r.book, ...r.nav } : r;
  const bookInfoFor = code => (typeof state !== 'undefined' && state.meta?.books?.find(b => b.code === code)) || null;
  const bookName = code => bookInfoFor(code)?.name || { Wis: 'Wisdom', Sir: 'Sirach (Ecclesiasticus)', Jdt: 'Judith', Tob: 'Tobias', '1Ma': '1 Machabees', '2Ma': '2 Machabees', Bar: 'Baruch' }[code] || code;
  function refText(r) {
    const open = r.endVerse >= 199;   // "to the end of the chapter"
    if (open && r.verse === 1) return `${bookName(r.book)} ${r.chapter}${r.endChapter !== r.chapter ? '-' + r.endChapter : ''}`;
    const end = r.endChapter === r.chapter ? (r.endVerse === r.verse ? '' : open ? ' ff.' : `-${r.endVerse}`) : `-${r.endChapter}${open ? '' : ':' + r.endVerse}`;
    return `${bookName(r.book)} ${r.chapter}:${r.verse}${end}`;
  }
  const inside = (r, book, chapter, verse) => { r = at(r); return r.book === book && (chapter > r.chapter || (chapter === r.chapter && (verse == null || verse >= r.verse))) && (chapter < r.endChapter || (chapter === r.endChapter && (verse == null || verse <= r.endVerse))); };
  const touches = (r, book, chapter) => { r = at(r); return r.book === book && chapter >= r.chapter && chapter <= r.endChapter; };

  function load() {
    if (data) return Promise.resolve(data);
    if (!loading) loading = Promise.all([
      fetch('/atlas/liturgy-1962.json').then(r => { if (!r.ok) throw Error('The liturgy data could not be loaded.'); return r.json(); }),
      fetch('/atlas/liturgy-sermons.json').then(r => r.ok ? r.json() : { sermons: [] }).catch(() => ({ sermons: [] }))
    ]).then(([d, s]) => {
      data = d; data.byId = new Map(d.days.map(x => [x.id, x])); data.eventById = new Map(d.events.map(e => [e.id, e]));
      sermons = new Map(s.sermons.map(x => [x.id, x]));
      if (saved.day && data.byId.has(saved.day)) { current = data.byId.get(saved.day); cycle = current.cycle; }
      return d;
    }).catch(e => { failed = e.message; loading = null; throw e; });
    return loading;
  }
  const visible = () => !panel.classList.contains('hidden');
  async function show() {
    if (!data) { panel.replaceChildren(el('p', { class: 'lit-empty' }, failed || 'Loading the 1962 liturgy…')); try { await load(); } catch { panel.replaceChildren(el('p', { class: 'lit-empty' }, failed)); return; } }
    // The first time the tab is opened in a session, it opens on today's Mass.
    if (!sessionStarted) {
      sessionStarted = true;
      const o = ordoFor(new Date());
      if (o?.celebrated.day) { current = o.celebrated.day; cycle = current.cycle; todayContext = o; }
    }
    render();
  }
  function chapterChanged() { if (data && visible()) render(true); }

  async function go(r) {
    const p = at(r);
    try { await navigate(p.book, p.chapter, p.verse); } catch (e) { if (typeof toast === 'function') toast(e.message); }
  }
  function refLink(r, label) {
    const text = label || refText(r);
    if (typeof state !== 'undefined' && state.meta?.books && !bookInfoFor(r.book)) return el('span', { class: 'lit-ref lit-ref-off', title: 'This book is not in the Bibles installed in Scriptorium' }, text);
    const here = typeof state !== 'undefined' && touches(r, state.book, state.chapter);
    const note = r.nav ? ` (verse numbers differ: ${r.nav.chapter}:${r.nav.verse}${r.nav.endVerse !== r.nav.verse || r.nav.endChapter !== r.nav.chapter ? '-' + (r.nav.endChapter !== r.nav.chapter ? r.nav.endChapter + ':' : '') + r.nav.endVerse : ''} in the reader)` : '';
    return el('button', { type: 'button', class: 'lit-ref' + (here ? ' lit-ref-here' : ''), title: 'Open ' + text + ' in the reader' + note, onclick: () => go(r) }, text, r.nav ? el('sup', {}, '*') : null);
  }
  const homilyOf = id => data.homilies[id];

  // ---------- List of days ----------
  function render(keepScroll) {
    const top = panel.scrollTop;
    panel.replaceChildren();
    if (current) renderDay(current); else renderList();
    if (keepScroll) panel.scrollTop = top;
  }
  function hereBox() {
    if (typeof state === 'undefined' || !state.book) return null;
    const hits = [];
    for (const d of data.days) {
      for (const g of d.gospels) for (const r of g.refs) if (touches(r, state.book, state.chapter)) hits.push({ d, label: g.part, r, exact: inside(r, state.book, state.chapter, state.verse) });
      for (const e of d.epistles || []) for (const r of e.refs) if (touches(r, state.book, state.chapter)) hits.push({ d, label: 'Epistle', r, exact: inside(r, state.book, state.chapter, state.verse) });
    }
    if (!hits.length && !GOSPELS.has(state.book)) return null;
    const box = el('section', { class: 'lit-here', 'aria-label': 'This chapter in the liturgy' });
    box.append(el('h4', {}, `${bookName(state.book)} ${state.chapter} in the 1962 Missal`));
    if (!hits.length) { box.append(el('p', { class: 'lit-hint' }, 'This chapter is not read as an Epistle or Gospel in this list.')); return box; }
    hits.sort((a, b) => b.exact - a.exact || at(a.r).verse - at(b.r).verse);
    const seen = new Set(), total = new Set(hits.map(x => x.d.id)).size;
    for (const h of hits) {
      if (seen.has(h.d.id)) continue; seen.add(h.d.id);
      box.append(el('button', { type: 'button', class: 'lit-here-item' + (h.exact ? ' lit-exact' : ''), onclick: () => openDay(h.d) },
        el('b', {}, h.d.title), el('small', {}, [h.d.cycle === 'sanctoral' ? h.d.subtitle : h.d.group, refText(h.r) + (h.label ? ' · ' + h.label : '')].join(' · '))));
      if (seen.size >= 8 && total > 8) { box.append(el('p', { class: 'lit-hint' }, `and ${total - 8} more.`)); break; }
    }
    return box;
  }
  function matches(d) {
    if (!query) return true;
    const q = query.toLowerCase();
    const text = [d.title, d.subtitle, d.group, d.note, ...d.gospels.map(g => g.text), ...(d.epistles || []).map(e => e.text),
      ...d.homilies.map(h => homilyOf(h.id)?.father || ''), ...(d.sermons || []).map(s => sermons.get(s.id)?.father || '')].join(' ').toLowerCase();
    return q.split(/\s+/).every(w => text.includes(w));
  }
  function renderList() {
    panel.append(el('div', { class: 'lit-head' }, el('h3', {}, '1962 Liturgy'),
      el('p', { class: 'lit-hint' }, 'The Epistles and Gospels of the 1962 Missal with complete sermons of the Fathers and Doctors on them, and the homilies read at Matins.')));
    const todayCard = todayBox(); if (todayCard) panel.append(todayCard);
    const here = hereBox(); if (here) panel.append(here);
    const tabs = el('div', { class: 'lit-cycles', role: 'tablist', 'aria-label': 'Liturgical cycle' });
    for (const [id, label] of CYCLES) tabs.append(el('button', { type: 'button', role: 'tab', 'aria-selected': String(id === cycle), class: id === cycle ? 'active' : '', onclick: () => { cycle = id; remember(); render(); } }, label));
    panel.append(tabs);
    const search = el('input', { type: 'search', class: 'lit-search', placeholder: cycle === 'sanctoral' ? 'Saint, feast, date, reading, Father…' : 'Day, reading, Father…', value: query, 'aria-label': 'Search the liturgical days' });
    search.oninput = () => { query = search.value.trim(); const pos = search.selectionStart; render(); const again = panel.querySelector('.lit-search'); again.focus(); again.setSelectionRange(pos, pos); };
    panel.append(search);
    const days = data.days.filter(d => d.cycle === cycle && matches(d));
    if (!days.length) { panel.append(el('p', { class: 'lit-empty' }, 'No days match.')); return; }
    const today = new Date(), todayMonth = MONTHS[today.getMonth()];
    const groups = new Map(); for (const d of days) { if (!groups.has(d.group)) groups.set(d.group, []); groups.get(d.group).push(d); }
    for (const [name, list] of groups) {
      const key = cycle + ':' + name;
      const open = query || opened.has(key) || (![...opened].some(k => k.startsWith(cycle + ':')) && (cycle === 'sanctoral' ? name === todayMonth : groups.size <= 4 || name === [...groups.keys()][0]));
      const box = el('details', { class: 'lit-group', open });
      box.ontoggle = () => { if (box.open) opened.add(key); else opened.delete(key); };
      box.append(el('summary', {}, name, el('small', {}, ` ${list.length}`)));
      for (const d of list) {
        const n = (d.sermons || []).length;
        const isToday = d.cycle === 'sanctoral' && d.sort[0] === today.getMonth() + 1 && d.sort[1] === today.getDate();
        const readings = [...new Set(d.gospels.map(g => g.text))].join('; ') || 'Chants only';
        box.append(el('button', { type: 'button', class: 'lit-day' + (isToday ? ' lit-today' : ''), onclick: () => openDay(d) },
          el('span', { class: 'lit-day-title' }, (d.cycle === 'sanctoral' ? d.subtitle.replace(/ \w+$/, '') + ' · ' : '') + d.title),
          el('small', {}, [readings, n ? `${n} ${n === 1 ? 'sermon' : 'sermons'}` : ''].filter(Boolean).join(' · '))));
      }
      panel.append(box);
    }
  }

  // ---------- Today: the Mass of a given date in the 1962 calendar ----------
  const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function todayBox() {
    const o = ordoFor(ordoDate);
    if (!o) return null;
    const isToday = isoDate(ordoDate) === isoDate(new Date());
    const box = el('section', { class: 'lit-todaybox', 'aria-label': 'The Mass of the day' });
    const picker = el('input', { type: 'date', value: isoDate(ordoDate), 'aria-label': 'Choose a date' });
    picker.onchange = () => { if (picker.value) { const [y, m, d] = picker.value.split('-').map(Number); ordoDate = new Date(y, m - 1, d); render(true); } };
    const step = n => { ordoDate = new Date(ordoDate.getFullYear(), ordoDate.getMonth(), ordoDate.getDate() + n); render(true); };
    box.append(el('div', { class: 'lit-todaybar' },
      el('h4', {}, isToday ? 'Today' : 'On this date'),
      el('span', {}, el('button', { type: 'button', class: 'quiet', 'aria-label': 'Previous day', onclick: () => step(-1) }, '‹'), picker,
        el('button', { type: 'button', class: 'quiet', 'aria-label': 'Next day', onclick: () => step(1) }, '›'),
        isToday ? null : el('button', { type: 'button', class: 'quiet', onclick: () => { ordoDate = new Date(); render(true); } }, 'Today'))));
    box.append(el('p', { class: 'lit-hint' }, o.label));
    const c = o.celebrated;
    const main = c.day
      ? el('button', { type: 'button', class: 'lit-todaymass', onclick: () => openDay(c.day, o) }, el('b', {}, c.feria ? c.title : c.day.title), el('small', {}, [o.className, c.feria ? 'Mass of ' + c.day.title : ''].filter(Boolean).join(' · ')))
      : el('div', { class: 'lit-todaymass lit-todaymass-off' }, el('b', {}, c.title), el('small', {}, [o.className, 'not in your table'].filter(Boolean).join(' · ')));
    box.append(main);
    if (o.note) box.append(el('p', { class: 'lit-hint' }, o.note));
    if (o.commemorations.length) box.append(el('p', { class: 'lit-hint lit-comm' }, 'Commemoration: ', ...o.commemorations.map((x, i) => [i ? '; ' : '', x.day ? el('button', { type: 'button', class: 'quiet', onclick: () => openDay(x.day, o) }, x.title) : x.title])));
    if (o.local.length) box.append(el('p', { class: 'lit-hint lit-comm' }, 'Also kept on this day (commemorations and local calendars): ', ...o.local.map((x, i) => [i ? '; ' : '', el('button', { type: 'button', class: 'quiet', onclick: () => openDay(x.day, o) }, x.title)])));
    return box;
  }

  // ---------- One day ----------
  function openDay(d, ctx = null) { current = d; cycle = d.cycle; todayContext = ctx; remember(); render(); panel.scrollTop = 0; }
  function renderDay(d) {
    const same = data.days.filter(x => x.cycle === d.cycle), i = same.indexOf(d);
    panel.append(el('div', { class: 'lit-nav' },
      el('button', { type: 'button', class: 'quiet', onclick: () => { current = null; remember(); render(); } }, '← ' + CYCLES.find(c => c[0] === d.cycle)[1]),
      el('span', {}, el('button', { type: 'button', class: 'quiet lit-today-btn', title: 'The Mass of today', onclick: () => { ordoDate = new Date(); const o = ordoFor(ordoDate); if (o?.celebrated.day) openDay(o.celebrated.day, o); else { current = null; render(); } } }, 'Today'),
        el('button', { type: 'button', class: 'quiet', disabled: i <= 0, 'aria-label': 'Previous day', title: i > 0 ? same[i - 1].title : '', onclick: () => openDay(same[i - 1]) }, '‹'),
        el('button', { type: 'button', class: 'quiet', disabled: i >= same.length - 1, 'aria-label': 'Next day', title: i < same.length - 1 ? same[i + 1].title : '', onclick: () => openDay(same[i + 1]) }, '›'))));
    panel.append(el('p', { class: 'lit-kicker' }, [d.group, d.cycle === 'sanctoral' ? d.subtitle : ''].filter(Boolean).join(' · ')), el('h3', { class: 'lit-title' }, d.title));
    if (d.note) panel.append(el('p', { class: 'lit-hint lit-note' }, d.note));
    const ctx = todayContext && (todayContext.celebrated.day === d || todayContext.commemorations.some(x => x.day === d) || todayContext.local.some(x => x.day === d)) ? todayContext : null;
    if (ctx) {
      const c = ctx.celebrated, own = c.day === d;
      panel.append(el('div', { class: 'lit-todaynote' }, el('b', {}, ctx.label), ' — ',
        own ? (c.feria ? `${c.title}: the Mass of ${d.title} is said.` : `the Mass of the day (${ctx.className}).`) : `commemorated; the Mass of the day is ${c.feria ? c.day?.title || c.title : c.title}.`,
        ctx.note && own && !c.feria ? el('span', { class: 'lit-hint' }, ' ' + ctx.note) : null));
    }
    const study = window.ScriptoriumStudy;
    if (study) panel.append(el('div', { class: 'lit-daytools' }, study.bookmarkButton({ key: dayKey(d), type: 'day', label: d.title + (d.cycle === 'sanctoral' ? ` (${d.subtitle})` : '') })));
    panel.append(properBox(d));

    const readings = el('section', { class: 'lit-section' });
    if (d.epistles?.length) {
      readings.append(el('h4', {}, d.epistles.length > 1 ? 'Epistles' : 'Epistle'));
      for (const e of d.epistles) {
        readings.append(el('div', { class: 'lit-gospel-line lit-epistle' }, ...(e.refs.length ? e.refs.map(r => refLink(r)) : [el('span', { class: 'lit-ref lit-ref-off' }, e.text)]),
          e.common ? el('small', {}, 'from the Common') : null, d.epistles.length > 1 && e.with ? el('small', {}, 'with Gospel ' + e.with) : null));
        // The lesson as printed in the Missal — the only way to read books such as Sirach that the installed Bibles lack.
        if (e.body) {
          const missing = e.refs.some(r => typeof state !== 'undefined' && state.meta?.books && !bookInfoFor(r.book));
          readings.append(el('details', { class: 'lit-lesson', open: missing }, el('summary', {}, missing ? 'Read the lesson (this book is not in your installed Bibles)' : 'Read the lesson as printed in the Missal'),
            el('p', {}, e.heading ? el('i', {}, e.heading + '. ') : null, e.body)));
        }
      }
    }
    if (d.gospels.length) {
      readings.append(el('h4', {}, d.gospels.length > 1 ? 'Gospels' : 'Gospel'));
      for (const g of d.gospels) {
        const ev = data.eventById.get(g.event);
        const card = el('div', { class: 'lit-gospel' });
        card.append(el('div', { class: 'lit-gospel-line' }, ...g.refs.map(r => refLink(r)), g.part ? el('small', {}, g.part) : null));
        if (ev) {
          card.append(el('p', { class: 'lit-event' }, el('span', {}, 'In the harmony: '), el('b', {}, ev.event), ev.place ? ` — ${ev.place}` : '', ev.date ? ` (${ev.date})` : ''));
          const others = ev.passages.filter(p => !g.refs.some(r => r.book === p.book));
          if (others.length) card.append(el('div', { class: 'lit-parallels' }, el('small', {}, 'Parallels: '), ...others.map(p => refLink(p))));
        }
        readings.append(card);
      }
      for (const g of d.gospel_texts || []) readings.append(el('details', { class: 'lit-lesson' }, el('summary', {}, 'Read the Gospel as printed in the Missal' + ((d.gospel_texts.length > 1) ? ` (${g.text})` : '')),
        el('p', {}, g.heading ? el('i', {}, g.heading.replace(/\s*\+\s*/g, ' ') + '. ') : null, g.body)));
      if ([...d.gospels, ...(d.epistles || [])].some(g => g.refs.some(r => r.nav))) readings.append(el('p', { class: 'lit-hint' }, '* Verse numbers follow the Missal (Vulgate); the link opens the matching verses in the reader.'));
    }
    if (readings.childNodes.length) panel.append(readings);

    // Complete sermons and commentaries, grouped by the reading they expound.
    const list = (d.sermons || []).map(s => ({ ...s, info: sermons.get(s.id) })).filter(s => s.info);
    const sec = el('section', { class: 'lit-section' }, el('h4', {}, 'Sermons of the Fathers & Doctors'));
    if (!list.length) sec.append(el('p', { class: 'lit-hint' }, 'No complete sermon on this day’s readings is in the collection yet (only human translations are included). The Matins homily below and the Catena Aurea gather the Fathers on this passage.'));
    for (const on of ['Gospel', 'Epistle', 'Feast', 'Parallel']) {
      const group = list.filter(s => s.on === on);
      if (!group.length) continue;
      sec.append(el('h5', { class: 'lit-subhead' }, ON[on]));
      for (const s of group) sec.append(sermonCard(s.info, d, list));
    }
    panel.append(sec);
    if (window.ScriptoriumCatena && d.gospels.length) panel.append(window.ScriptoriumCatena.dayBox(d));

    if (d.homilies.length) {
      const m = el('section', { class: 'lit-section' }, el('h4', {}, 'Matins homily (Breviary)'));
      for (const h of d.homilies.filter((h, n) => h.own || n < 2)) m.append(homilyCard(homilyOf(h.id), h.own, d));
      panel.append(m);
    }
    if (window.ScriptoriumBenedict) panel.append(window.ScriptoriumBenedict.dayBox(d));
    if (d.propers.length) {
      const p = el('section', { class: 'lit-section' }, el('h4', {}, 'Other Gospel texts in this Mass'));
      const ul = el('ul', { class: 'lit-propers' });
      for (const x of d.propers) ul.append(el('li', {}, el('span', {}, x.part || 'Proper'), ' ', ...x.refs.map(r => refLink(r)), x.refs.length ? null : el('small', {}, x.text)));
      p.append(ul); panel.append(p);
    }
    if (study) panel.append(el('section', { class: 'lit-section' }, el('h4', {}, 'My notes on this day'), study.noteBox(dayKey(d), d.title)));
    panel.append(el('p', { class: 'lit-source' }, 'Sermons: public-domain translations (chiefly the Nicene and Post-Nicene Fathers) from the Writings-Database of HistoricalChristianFaith. Readings and Matins lessons: Divinum Officium. Day list and harmony: your 1962 usage table.'));
  }
  // ---------- The Proper of the Mass (Divinum Officium): Introit, Collect … Postcommunion, Latin and English ----------
  let propersPromise = null;
  const loadPropers = () => propersPromise ||= fetch('/atlas/liturgy-propers.json').then(r => { if (!r.ok) throw Error('The Proper of the Mass could not be loaded.'); return r.json(); }).catch(e => { propersPromise = null; throw e; });
  const lineText = l => l.cite ? null : l.text;
  function properBox(d) {
    const box = el('section', { class: 'lit-section lit-proper' });
    loadPropers().then(all => {
      const pr = all[d.id];
      if (!pr) { box.remove(); return; }
      const collect = pr.parts.find(p => p.key === 'Oratio');
      const en = collect?.en?.map(lineText).filter(Boolean) || [];
      box.append(el('h4', {}, 'The Proper of the Mass'));
      if (pr.note) box.append(el('p', { class: 'lit-proper-note' }, pr.note));
      if (en.length) box.append(el('p', { class: 'lit-collect-label' }, 'Collect'), el('p', { class: 'lit-collect' }, en.filter(t => !/^℟/.test(t)).join(' ')));
      box.append(el('div', { class: 'lit-tools' }, el('button', { type: 'button', onclick: () => readProper(d, pr, all) }, 'Read the whole Proper — English & Latin'),
        el('small', { class: 'lit-hint' }, ' ' + pr.parts.map(p => p.title).join(' · '))));
    }).catch(() => {});
    return box;
  }
  function readProper(d, pr, all = {}) {
    const dlg = ensureDialog();
    const same = data.days.filter(x => x.cycle === d.cycle && all[x.id]), pi = same.indexOf(d), prevDay = same[pi - 1], nextDay = pi >= 0 ? same[pi + 1] : null;
    let mode = 'both';
    try { mode = localStorage.getItem('scriptorium-proper-mode') || 'both'; } catch {}
    const lines = (list, lang) => (list || []).map(l => l.cite ? el('p', { class: 'lit-proper-cite' }, l.cite) : el('p', { class: /^[℣℟]/.test(l.text) ? 'lit-proper-vr' : '', lang }, l.text));
    const draw = () => {
      const head = el('div', { class: 'lit-dialog-head' },
        el('div', {}, el('p', { class: 'lit-kicker' }, 'The Proper of the Mass · Missale Romanum 1962'), el('h2', {}, d.title), el('p', { class: 'lit-hint' }, [d.cycle === 'sanctoral' ? d.subtitle : d.group, pr.file.startsWith('Commune') ? 'from the Common' : ''].filter(Boolean).join(' · '))),
        readerTools({ modes: [['en', 'English'], ['both', 'Both'], ['la', 'Latin']], mode, onMode: m => { mode = m; try { localStorage.setItem('scriptorium-proper-mode', m); } catch {} draw(); },
          resize: step => { readerSize = Math.max(16, Math.min(24, readerSize + step)); text.style.fontSize = readerSize + 'px'; remember(); },
          bookmark: { key: dayKey(d), type: 'day', label: d.title + (d.cycle === 'sanctoral' ? ` (${d.subtitle})` : '') },
          prev: prevDay ? { title: prevDay.title, go: () => readProper(prevDay, all[prevDay.id], all) } : null,
          next: nextDay ? { title: nextDay.title, go: () => readProper(nextDay, all[nextDay.id], all) } : null,
          close: () => dlg.close() }));
      const text = el('div', { class: 'lit-dialog-text lit-proper-text' + (mode === 'both' ? ' lit-both' : ''), style: `font-size:${readerSize}px` });
      if (pr.note) text.append(el('p', { class: 'lit-proper-note' }, pr.note));
      for (const part of pr.parts) {
        const sec = el('section', { class: 'lit-proper-part' }, el('h5', {}, part.title, part.ref ? el('span', { class: 'lit-proper-ref' }, ' · ' + part.ref) : null));
        const row = el('div', { class: 'lit-row' });
        if (mode !== 'la') row.append(el('div', {}, ...lines(part.en?.length ? part.en : part.la, 'en')));
        if (mode !== 'en') row.append(el('div', { class: 'lit-latin' }, ...lines(part.la, 'la')));
        sec.append(row); text.append(sec);
      }
      dlg.replaceChildren(head, text, el('p', { class: 'lit-source' }, 'Latin and English: Divinum Officium (divinumofficium.com), Missale Romanum, rubrics of 1960.'));
    };
    draw();
    if (!dlg.open) dlg.showModal();
  }
  const minutes = words => Math.max(1, Math.round(words / 200));
  function sermonCard(s, day, all) {
    const card = el('article', { class: 'lit-homily lit-sermon' });
    card.append(el('h5', {}, s.father, s.doctor ? el('span', { class: 'lit-doctor', title: 'Doctor of the Church' }, 'Doctor') : null));
    card.append(el('p', { class: 'lit-sermon-work' }, s.work, ' · ', s.title.replace(/^(Homily|Tractate|Sermon) (\d+)$/, '$1 $2')));
    card.append(el('p', { class: 'lit-hint' }, [s.ref ? 'On ' + refText(s.ref) : '', `about ${minutes(s.words)} min`].filter(Boolean).join(' · ')));
    card.append(el('div', { class: 'lit-tools' }, el('button', { type: 'button', onclick: () => readSermon(s, day, all.map(x => x.info)) }, 'Read sermon')));
    return card;
  }

  // ---------- One toolbar for every reading window, always in the same order ----------
  // [English · Both · Latin]  [A− A+]  [☆ Bookmark]  [‹ Previous] [Next ›]  [×]
  function readerTools({ modes, mode, onMode, resize, bookmark, prev, next, close }) {
    const t = el('div', { class: 'lit-dialog-tools rd-tools' });
    if (modes?.length > 1) t.append(el('span', { class: 'rd-group', role: 'group', 'aria-label': 'Language' }, ...modes.map(([m, label]) => el('button', { type: 'button', class: m === mode ? 'active' : '', 'aria-pressed': String(m === mode), onclick: () => onMode(m) }, label))));
    if (resize) t.append(el('span', { class: 'rd-group', role: 'group', 'aria-label': 'Text size' }, el('button', { type: 'button', class: 'quiet', 'aria-label': 'Smaller text', onclick: () => resize(-2) }, 'A−'), el('button', { type: 'button', class: 'quiet', 'aria-label': 'Larger text', onclick: () => resize(2) }, 'A+')));
    if (bookmark && window.ScriptoriumStudy) t.append(window.ScriptoriumStudy.bookmarkButton(bookmark));
    if (prev || next) t.append(el('span', { class: 'rd-group' },
      el('button', { type: 'button', disabled: !prev, title: prev?.title || '', onclick: () => prev?.go() }, '‹ Previous'),
      el('button', { type: 'button', disabled: !next, title: next?.title || '', onclick: () => next?.go() }, 'Next ›')));
    t.append(el('button', { type: 'button', class: 'quiet rd-close', 'aria-label': 'Close', onclick: close }, '×'));
    return t;
  }
  const homilyKey = id => 'hom:' + id.replace(/[^\w#-]/g, '').slice(-34);

  // ---------- Reading view for complete sermons ----------
  let dialog;
  function ensureDialog() {
    if (dialog) return dialog;
    dialog = el('dialog', { class: 'lit-dialog', 'aria-label': 'Reading' });
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    document.body.append(dialog);
    return dialog;
  }
  async function sermonText(id) {
    const pack = sermons.get(id)?.pack;
    if (!textCache.has(pack)) textCache.set(pack, fetch(`/atlas/liturgy-sermons-${pack}.json`).then(r => { if (!r.ok) throw Error('This sermon could not be loaded.'); return r.json(); }).catch(e => { textCache.delete(pack); throw e; }));
    const texts = await textCache.get(pack);
    if (!texts[id]) throw Error('This sermon could not be found.');
    return texts[id];
  }
  async function readSermon(s, day, list, opts = {}) {
    const dlg = ensureDialog(), index = list.findIndex(x => x.id === s.id);
    const tools = readerTools({ resize: step => size(step), bookmark: { key: sermonKey(s), type: 'sermon', label: `${s.father}, ${s.work} · ${s.title}` },
      prev: index > 0 ? { title: list[index - 1].father + ' · ' + list[index - 1].title, go: () => readSermon(list[index - 1], day, list) } : null,
      next: index < list.length - 1 ? { title: list[index + 1].father + ' · ' + list[index + 1].title, go: () => readSermon(list[index + 1], day, list) } : null,
      close: () => dlg.close() });
    const head = el('div', { class: 'lit-dialog-head' },
      el('div', {}, el('p', { class: 'lit-kicker' }, day.title + (day.cycle === 'sanctoral' ? ' · ' + day.subtitle : '') + (list.length > 1 ? ` · ${index + 1} of ${list.length}` : '')),
        el('h2', {}, s.father), el('p', { class: 'lit-sermon-work' }, s.work + ' · ' + s.title),
        el('p', { class: 'lit-hint' }, [s.ref ? 'On ' + refText(s.ref) : '', s.source].filter(Boolean).join(' · '), ' ', s.ref ? el('button', { type: 'button', class: 'quiet lit-open-passage', onclick: () => { dlg.close(); go(s.ref); } }, 'Open the passage →') : null)),
      tools);
    const text = el('div', { class: 'lit-dialog-text lit-reading', style: `font-size:${readerSize}px`, 'data-st-key': sermonKey(s), 'data-st-sermon': s.id, 'data-st-label': `${s.father} · ${s.title}` }, el('p', { class: 'lit-empty' }, 'Loading…'));
    function size(step) { readerSize = Math.max(16, Math.min(24, readerSize + step)); text.style.fontSize = readerSize + 'px'; remember(); }
    dlg.replaceChildren(head, text, el('p', { class: 'lit-source' }, 'Footnote numbers are omitted from the text; the notes are at the end. ' + (s.source || '')));
    if (!dlg.open) dlg.showModal();
    try {
      const body = await sermonText(s.id);
      if (!dlg.contains(text)) return;
      text.replaceChildren(...body.paragraphs.slice(1).map(p => el('p', {}, p)));
      if (body.notes?.length) text.append(el('details', { class: 'lit-notes' }, el('summary', {}, `Translator’s notes (${body.notes.length})`), ...body.notes.map(n => el('p', {}, n))));
      if (window.ScriptoriumStudy) text.append(el('section', { class: 'lit-sermon-notes' }, el('h6', {}, 'My notes on this sermon'), window.ScriptoriumStudy.noteBox(sermonKey(s), `${s.father} · ${s.title}`)));
      window.ScriptoriumStudy?.paintHighlights?.();
      if (opts.paragraph != null) { const p = text.querySelectorAll(':scope > p')[Math.max(0, opts.paragraph - 1)]; if (p) { p.classList.add('lit-hit'); p.scrollIntoView({ block: 'center' }); } }
      else text.scrollTop = 0;
    } catch (e) { text.replaceChildren(el('p', { class: 'lit-empty' }, e.message)); }
  }

  // ---------- Matins homilies (Breviary): English and Latin ----------
  function officesOf(h) { return [{ office: h.office, title: h.title, date: h.date }, ...(h.also || [])]; }
  function officeName(o) { return o.title + (o.date ? ` (${o.date})` : ''); }
  function homilyCard(h, own, day) {
    if (!h) return null;
    const card = el('article', { class: 'lit-homily' + (own ? ' lit-own' : '') });
    card.append(el('p', { class: 'lit-homily-tag' }, own ? `Matins of this day · Lessons ${h.nocturn === 3 ? 'VII–IX' : 'I–III'}` : 'On the same Gospel at Matins'));
    card.append(el('h5', {}, h.father, h.doctor ? el('span', { class: 'lit-doctor', title: 'Doctor of the Church' }, 'Doctor') : null));
    card.append(el('p', { class: 'lit-hint' }, h.author + (h.source ? ' · ' + h.source : '')));
    card.append(el('p', { class: 'lit-hint' }, 'Read at Matins: ' + officesOf(h).map(officeName).join('; ')));
    card.append(el('div', { class: 'lit-tools' }, el('button', { type: 'button', onclick: () => readLessons(h, day) }, h.latin ? 'Read (English & Latin)' : 'Read')));
    return card;
  }
  function readLessons(h, day) {
    const dlg = ensureDialog();
    let mode = h.latin ? 'both' : 'en';
    const siblings = (day.homilies || []).map(x => homilyOf(x.id)).filter(Boolean), hi = siblings.findIndex(x => x.id === h.id);
    const draw = () => {
      const head = el('div', { class: 'lit-dialog-head' },
        el('div', {}, el('p', { class: 'lit-kicker' }, day.title + (day.cycle === 'sanctoral' ? ' · ' + day.subtitle : '') + ' · Matins'), el('h2', {}, h.father), el('p', { class: 'lit-hint' }, h.author + (h.source ? ' · ' + h.source : ''))),
        readerTools({ modes: h.latin ? [['en', 'English'], ['both', 'Both'], ['la', 'Latin']] : null, mode, onMode: m => { mode = m; draw(); },
          resize: step => { readerSize = Math.max(16, Math.min(24, readerSize + step)); text.style.fontSize = readerSize + 'px'; remember(); },
          bookmark: { key: homilyKey(h.id), type: 'homily', label: `${h.father} · Matins homily on ${h.ref}`, homily: h.id },
          prev: hi > 0 ? { title: siblings[hi - 1].father, go: () => readLessons(siblings[hi - 1], day) } : null,
          next: hi >= 0 && hi < siblings.length - 1 ? { title: siblings[hi + 1].father, go: () => readLessons(siblings[hi + 1], day) } : null,
          close: () => dlg.close() }));
      const text = el('div', { class: 'lit-dialog-text' + (mode === 'both' ? ' lit-both' : ''), style: `font-size:${readerSize}px` });
      const cols = mode === 'both' ? [h, h.latin] : [mode === 'la' ? h.latin : h];
      const row = (...cells) => { const r = el('div', { class: 'lit-row' }); cells.forEach(c => r.append(c)); text.append(r); };
      row(...cols.map(src => el('p', { class: 'lit-pericope' }, el('b', {}, h.ref), ' ', src.incipit || '')));
      const count = Math.max(...cols.map(c => c.lessons.length));
      for (let n = 0; n < count; n++) row(...cols.map(src => el('div', {}, el('h6', {}, `Lesson ${ROMAN[(h.nocturn === 3 ? 6 : 0) + n]}`), ...(src.lessons[n] || '').split('\n\n').map(p => el('p', {}, p)))));
      dlg.replaceChildren(head, text, el('p', { class: 'lit-source' }, 'Read at Matins: ' + officesOf(h).map(officeName).join('; ') + ' · Text: Divinum Officium.'));
    };
    draw();
    if (!dlg.open) dlg.showModal();
  }

  // Where a key, a sermon or a homily lives, for bookmarks, notes and search.
  function dayForSermon(id) { return data.days.find(d => (d.sermons || []).some(s => s.id === id)) || null; }
  function sermonListFor(day) { return (day?.sermons || []).map(s => sermons.get(s.id)).filter(Boolean); }
  function describe(key) {
    if (key.startsWith('lit:')) { const d = data.days.find(x => dayKey(x) === key); return d ? { label: d.title + (d.cycle === 'sanctoral' ? ` (${d.subtitle})` : ''), kind: 'Liturgical day', open: () => showDay(d) } : null; }
    if (key.startsWith('hom:')) { const h = Object.values(data.homilies).find(x => homilyKey(x.id) === key); return h ? { label: `${h.father} · Matins homily on ${h.ref}`, kind: 'Homily', open: () => openHomily(h.id) } : null; }
    if (key.startsWith('ser:')) { const s = [...sermons.values()].find(x => sermonKey(x) === key); return s ? { label: `${s.father} · ${s.work} · ${s.title}`, kind: 'Sermon', open: () => openSermon(s.id) } : null; }
    return null;
  }
  // A day from the full data or from the small calendar (matched by id).
  async function showDay(d) { await load(); const day = data.byId.get(d?.id ?? d) || d; if (typeof studyTab === 'function') studyTab('liturgy'); openDay(day); }
  // The small calendar (about 240 KB) for the start page; the full liturgy when it is already loaded.
  let calendarPromise = null;
  const calendar = () => data ? Promise.resolve(data) : (calendarPromise ||= fetch('/atlas/liturgy-calendar.json').then(r => { if (!r.ok) throw Error('The calendar could not be loaded.'); return r.json(); }).catch(e => { calendarPromise = null; throw e; }));
  function openSermon(id, opts) { const s = sermons.get(id), day = dayForSermon(id); if (!s) return; readSermon(s, day || { title: s.work, cycle: '' }, day ? sermonListFor(day) : [s], opts); }
  function openHomily(id) { const h = data.homilies[id], day = data.days.find(d => d.homilies.some(x => x.id === id)); if (h) readLessons(h, day || { title: h.title, cycle: '' }); }
  window.ScriptoriumLiturgy = {
    show, chapterChanged, load: () => load().then(() => ({ data, sermons, sermonText })), calendar, loaded: () => !!data, describe, dayKey, sermonKey, openSermon, openHomily, showDay,
    open: id => load().then(() => { const d = data.byId.get(id); if (d) openDay(d); })
  };
})();
/* END SCRIPTORIUM 1962 LITURGY */

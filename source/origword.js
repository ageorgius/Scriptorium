/* BEGIN SCRIPTORIUM ORIGINAL WORD — when a word of a translation (the Vulgate, the Douay–Rheims or any other) is chosen,
   the Word tab also shows the verse in the language it was translated from, with the matching word picked out and its
   dictionary entry below:
     New Testament                      → the Greek (Nestle–Aland 27); for the Vulgate, PROIEL's word-by-word matching
                                          (atlas/vulgate-greek-<book>.json) gives the exact Greek word;
     Psalms in the Vulgate numbering    → the Septuagint, from which St Jerome revised the Gallican Psalter, then the Hebrew;
     Tobit … Maccabees, Baruch, the Greek parts of Daniel → the Septuagint (Theodotion for Daniel);
     the rest of the Old Testament      → the Hebrew (Westminster), then the Septuagint.
   Where no exact match is known, words whose dictionary meaning matches the chosen word are marked as likely. */
(() => {
  'use strict';
  const { el } = window.Scriptorium;
  const GREEK_BOOKS = new Set(['Tob', 'Jdt', 'Wis', 'Sir', 'Bar', '1Ma', '2Ma']);
  const LATIN_VULGATE = /^(VUC|VUL|NOV|VulgConte|VulgHetzenauer|VulgSistine)$/;
  const SOURCES = {
    BNT: { language: 'Greek', label: 'Greek', name: 'Nestle–Aland 27' },
    LXT: { language: 'Greek', label: 'Septuagint', name: 'Rahlfs' },
    WTT: { language: 'Hebrew', label: 'Hebrew', name: 'Westminster Hebrew Bible' }
  };
  const chapters = new Map(), matchFiles = new Map(), psalmStyle = new Map();

  const fold = s => String(s || '').normalize('NFD').replace(/[̀-֑ͯ-ׇ]/g, '').toLowerCase();
  const latinKey = s => fold(s).replace(/æ/g, 'ae').replace(/œ/g, 'oe').replace(/j/g, 'i').replace(/v/g, 'u').replace(/[^a-z]/g, '');
  const greekKey = s => fold(s).replace(/ς/g, 'σ').replace(/[^Ͱ-Ͽἀ-῿]/g, '');
  const glossOf = t => String(t?.hoverGloss || '').replace(/^Dictionary meaning:\s*/, '').replace(/^Short meaning:\s*/, '').replace(/\s*\([^()]*\)\s*$/, '');

  function chapter(book, ch, version) {
    const key = `${version} ${book} ${ch}`;
    if (!chapters.has(key)) chapters.set(key, api('/api/chapter', { book, chapter: ch, versions: version }).catch(e => { chapters.delete(key); throw e; }));
    return chapters.get(key);
  }
  // native: find the verse by the Bible's own verse numbers (the Hebrew Psalms count their titles as the Vulgate does).
  async function verseOf(book, ch, v, version, native = false) {
    const data = await chapter(book, ch, version);
    const parts = data.rows.flatMap(r => (r.columns.find(c => c.version === version)?.parts || []).filter(p => p.tokens?.length).map(p => [r.verse, p]));
    const own = native ? parts.filter(([, p]) => p.chapter === ch) : parts;
    const hit = own.find(([r, p]) => (native ? p.verse : r) === v);
    const last = Math.max(0, ...own.map(([r, p]) => native ? p.verse : r));
    return { part: hit ? hit[1] : null, last };
  }
  function matches(book) {
    if (!matchFiles.has(book)) matchFiles.set(book, fetch(`/atlas/vulgate-greek-${book}.json`).then(r => r.ok ? r.json() : {}).catch(() => ({})));
    return matchFiles.get(book);
  }
  // Does this Bible count the Psalms as the Septuagint and the Vulgate do? (Psalm 9 then has 39 verses.)
  function vulgatePsalms(version) {
    if (!psalmStyle.has(version)) psalmStyle.set(version, chapter('Psa', 9, version)
      .then(d => d.rows.filter(r => r.columns.some(c => c.parts?.some(p => p.text))).length > 30).catch(() => false));
    return psalmStyle.get(version);
  }
  const hebrewPsalm = (c, v) => window.Scriptorium?.refs?.hebrewPsalm ? window.Scriptorium.refs.hebrewPsalm(c, v) : [c, v];

  // Where the text of this verse was translated from: a list of [version, book, chapter, verse, note].
  async function sourcesFor(part, version) {
    const { book, chapter: c, verse: v } = part;
    const nt = state.meta.books.find(b => b.code === book)?.testament === 'NT';
    if (nt) return [['BNT', book, c, v]];
    if (book === 'Psa') {
      if (await vulgatePsalms(version)) {
        const [hc, hv] = hebrewPsalm(c, v);
        return [['LXT', book, c, v, 'St Jerome revised the Psalter of the Vulgate (the Gallican Psalter) from this Greek text.'], ['WTT', book, hc, hv, hc !== c ? `Psalm ${hc} in the Hebrew numbering.` : '']];
      }
      return [['WTT', book, c, v], ['LXT', book, c, v]];
    }
    if (GREEK_BOOKS.has(book)) return [['LXT', book, c, v, 'This book has come down to us in Greek.']];
    if (book === 'Dan' && c === 13) return [['LXT', 'Sut', 1, v, 'Susanna survives in Greek; the Vulgate follows Theodotion’s text.']];
    if (book === 'Dan' && c === 14) return [['LXT', 'Bet', 1, v, 'Bel and the Dragon survive in Greek; the Vulgate follows Theodotion’s text.']];
    if (book === 'Dan' && c === 3 && v >= 24 && v <= 90) return [['LXT', 'Dat', 3, v, 'The Song of the Three Children survives in Greek (Theodotion).']];
    if (book === 'Est' && (c > 10 || (c === 10 && v > 3))) return [['LXT', 'Est', c, v, 'The additions to Esther survive in Greek; the Septuagint numbers them differently, so use ‹ › to find the verse.']];
    return [['WTT', book, c, v], ['LXT', book === 'Dan' ? 'Dat' : book, c, v]];
  }

  // Which words of the original verse stand for the chosen word.
  async function exactMatch(token, part, version, source, original) {
    if (source !== 'BNT' || !LATIN_VULGATE.test(version)) return null;
    const pairs = (await matches(part.book))[`${part.chapter}:${part.verse}`];
    if (!pairs) return null;
    const key = latinKey(token.text);
    const before = part.tokens.slice(0, part.tokens.indexOf(token)).filter(t => latinKey(t.text) === key).length;
    const hits = pairs.split(' ').map(p => p.split('=')).filter(([l]) => l === key);
    const hit = hits[Math.min(before, hits.length - 1)];
    if (!hit) return null;
    const lemma = greekKey(hit[1]);
    const words = original.tokens.filter(t => t.analysis?.some(a => greekKey(a.lemma) === lemma));
    return words.length ? { words, lemma: hit[1], how: 'Matched word by word (PROIEL)' } : null;
  }
  const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'and', 'or', 'is', 'be', 'it']);
  const stem = w => w.replace(/(eth|est|ing|edst|ed|es|s|th)$/, '');
  function glossMatch(token, version, original) {
    const language = versionInfo(version)?.language;
    const asked = (language === 'English' ? token.text : glossOf(token)).toLowerCase().match(/[a-z]+/g) || [];
    const wanted = asked.filter(w => !STOP.has(w));
    if (!wanted.length) return null;
    const scored = original.tokens.map(t => {
      const gloss = glossOf(t).toLowerCase().match(/[a-z]+/g) || [];
      let s = 0;
      for (const w of wanted) for (const g of gloss) {
        if (STOP.has(g)) continue;
        if (g === w) s = Math.max(s, 2);
        else if (w.length > 3 && g.length > 3 && stem(g) === stem(w)) s = Math.max(s, 1.5);
        else if (w.length > 4 && g.length > 4 && (g.startsWith(w.slice(0, 5)) || w.startsWith(g.slice(0, 5)))) s = Math.max(s, 1);
      }
      return [t, s];
    }).filter(([, s]) => s > 0);
    if (!scored.length) return null;
    const best = Math.max(...scored.map(([, s]) => s));
    return { words: scored.filter(([, s]) => s === best).map(([t]) => t), how: 'Likely match, from the dictionary meanings' };
  }
  // The dictionary headword of an original word (for Hebrew, the main word rather than a prefixed particle).
  function lemmaOf(t) {
    const parts = t.analysis || [];
    const main = parts.filter(a => !/^(Preposition|Conjunction|Article|Particle)/.test(a.description || ''));
    return ((main.length ? main : parts).at(-1)?.lemma || t.text).replace(/[.,;:·]/g, '');
  }

  async function show(token, part, version) {
    const language = versionInfo(version)?.language;
    if (!language || ['Greek', 'Hebrew'].includes(language)) return;
    const panel = document.getElementById('word-panel'); if (!panel) return;
    const request = inspectRequest;
    let sources;
    try { sources = await sourcesFor(part, version); } catch { return; }
    if (request !== inspectRequest || !sources.length) return;
    const box = el('section', { class: 'ow-box' });
    const tabs = el('div', { class: 'ow-tabs', role: 'tablist' });
    const body = el('div', { class: 'ow-body' });
    box.append(el('div', { class: 'section-label' }, 'IN THE ORIGINAL'), tabs, body);
    panel.append(box);
    const open = async (i, verse) => {
      const [src, book, ch, v0, note] = sources[i], v = verse ?? v0, info = SOURCES[src];
      for (const b of tabs.children) b.setAttribute('aria-selected', String(+b.dataset.i === i));
      body.replaceChildren(el('p', { class: 'hint' }, 'Loading…'));
      let found;
      try { found = await verseOf(book, ch, v, src, src === 'WTT' && book === 'Psa'); } catch (e) { body.replaceChildren(el('p', { class: 'hint' }, 'The original text could not be read: ' + e.message)); return; }
      if (request !== inspectRequest) return;
      const bookName = state.meta.books.find(b => b.code === book)?.name || book;
      const head = el('div', { class: 'ow-head' });
      const prev = el('button', { type: 'button', class: 'ow-step', title: 'Previous verse', 'aria-label': 'Previous verse' }, '‹');
      const next = el('button', { type: 'button', class: 'ow-step', title: 'Next verse', 'aria-label': 'Next verse' }, '›');
      prev.disabled = v <= 1; next.disabled = v >= found.last;
      prev.onclick = () => open(i, v - 1); next.onclick = () => open(i, v + 1);
      head.append(prev, el('span', {}, `${bookName} ${ch}:${v}`), next, el('small', {}, info.name));
      body.replaceChildren(head);
      if (note) body.append(el('p', { class: 'hint ow-note' }, note));
      if (!found.part) { body.append(el('p', { class: 'hint' }, `${info.name} has no text at this verse. Try ‹ › or the other tab.`)); return; }
      const original = found.part;
      const match = verse === undefined ? (await exactMatch(token, part, version, src, original)) || glossMatch(token, version, original) : null;
      if (request !== inspectRequest) return;
      const words = el('div', { class: 'ow-words ' + info.language, dir: info.language === 'Hebrew' ? 'rtl' : 'ltr' });
      const dict = el('div', { class: 'ow-dict' });
      const choose = (t, b) => {
        for (const x of words.querySelectorAll('.ow-word.chosen')) x.classList.remove('chosen');
        b.classList.add('chosen'); dict.replaceChildren();
        const lemma = lemmaOf(t), described = t.analysis?.map(a => a.description).filter(Boolean)[0];
        dict.append(el('div', { class: 'ow-lemma', dir: info.language === 'Hebrew' ? 'rtl' : 'ltr' }, lemma));
        if (described) dict.append(el('p', { class: 'hint' }, `${t.text} · ${described}`));
        const panelBox = el('div'); dict.append(panelBox);
        window.ScriptoriumDefineHint = { word: lemma, pos: (t.analysis || []).find(a => String(a.lemma).replace(/[.,;:·]/g, '') === lemma)?.description || '' };
        dictionaryPanel(panelBox, info.language, lemma);
      };
      let first = null;
      for (const t of original.tokens) {
        const b = el('button', { type: 'button', class: 'ow-word', title: glossOf(t) || 'Look up' });
        b.append(el('span', { class: 'ow-w' }, t.text), el('small', { dir: 'ltr' }, glossOf(t).split(' / ')[0] || ''));
        if (match?.words.includes(t)) { b.classList.add('match'); first ||= [t, b]; }
        b.onclick = () => choose(t, b);
        words.append(b);
      }
      body.append(el('p', { class: 'hint' }, match ? `${match.how}. Choose another word to see its entry.` : 'Choose a word to see its dictionary entry.'), words, dict);
      if (first) choose(...first);
    };
    sources.forEach(([src], i) => {
      const b = el('button', { type: 'button', role: 'tab', 'data-i': i, class: 'ow-tab' }, SOURCES[src].label);
      b.onclick = () => open(i); tabs.append(b);
    });
    if (sources.length < 2) tabs.hidden = true;
    open(0);
  }
  window.ScriptoriumOriginal = { show };
})();

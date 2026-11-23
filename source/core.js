/* BEGIN SCRIPTORIUM CORE — what every addition shares: small helpers, one reader of Scripture references,
   and single connections to the program (passage changes, study tabs, verse selection, the server, the page),
   announced as events so each feature listens instead of wrapping the program again. */
(() => {
  'use strict';
  // ---------- Small helpers ----------
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k === 'class') n.className = v; else if (k === 'style') n.style.cssText = v; else if (k.startsWith('on')) n[k] = v; else n.setAttribute(k, v === true ? '' : v); }
    for (const kid of kids.flat()) if (kid != null && kid !== false) n.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    return n;
  };
  // The same short fingerprint the bookmarks have always used, so saved keys keep matching.
  const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  const fold = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const recall = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const keep = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const books = () => (typeof state !== 'undefined' && state.meta?.books) || [];
  const bookName = code => books().find(b => b.code === code)?.name || { Wis: 'Wisdom', Sir: 'Sirach (Ecclesiasticus)', Jdt: 'Judith', Tob: 'Tobias', '1Ma': '1 Machabees', '2Ma': '2 Machabees', Bar: 'Baruch' }[code] || code;
  const typing = e => ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) || e.target?.isContentEditable;

  // ---------- Events ----------
  const listeners = new Map();
  const on = (name, fn) => { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); };
  const emit = (name, detail) => { for (const fn of listeners.get(name) || []) { try { fn(detail); } catch (e) { console.warn('[Scriptorium]', name, e); } } };

  // ======================================================================
  // Scripture references: names and abbreviations in English, Douay and Latin
  // ======================================================================
  const ALIASES = {
    Gen: 'gen gn genesis', Exo: 'ex exo exod exodus', Lev: 'lev lv levit leviticus', Num: 'num numb nm numbers numeri', Deu: 'deut dt deu deuter deuteronomy',
    Jos: 'josh jos joshua josue', Jdg: 'judg jdg judges judic', Rut: 'ruth rut ru', '1Sa': '1 sam 1 sa 1 samuel 1 reg 1 regum', '2Sa': '2 sam 2 sa 2 samuel 2 reg 2 regum',
    '1Ki': '1 kings 1 kgs 1 ki 3 kings 3 kgs 3 reg', '2Ki': '2 kings 2 kgs 2 ki 4 kings 4 kgs 4 reg', '1Ch': '1 chron 1 chr 1 ch 1 chronicles 1 par 1 paral 1 paralipomenon',
    '2Ch': '2 chron 2 chr 2 ch 2 chronicles 2 par 2 paral 2 paralipomenon', Ezr: 'ezra ezr 1 esdras 1 esd', Neh: 'neh nehemiah nehemias 2 esdras 2 esd', Est: 'esth est esther',
    Job: 'job jb', Psa: 'ps psa pss psal psalm psalms psalmi', Pro: 'prov pro prv pr proverbs', Ecc: 'eccl eccles ecc ecclesiastes qoh qoheleth',
    Sol: 'song cant canticle canticles cantic sol song of songs song of solomon canticle of canticles', Wis: 'wis wisd wisdom sap sapientia', Sir: 'sir sirach ecclus eccli ecclesiasticus',
    Isa: 'isa is isai isaiah isaias esa', Jer: 'jer jerem jeremiah jeremias', Lam: 'lam lamentations', Bar: 'bar baruch', Eze: 'ezek eze ezech ezekiel ezechiel ez',
    Dan: 'dan dn daniel', Hos: 'hos hosea osee os', Joe: 'joel jl', Amo: 'amos am', Oba: 'obad ob obadiah abdias abd', Jon: 'jonah jonas jon',
    Mic: 'mic micah micheas mich', Nah: 'nah nahum', Hab: 'hab habac habakkuk habacuc', Zep: 'zeph zep zephaniah sophonias soph', Hag: 'hag haggai aggeus agg',
    Zec: 'zech zec zechariah zacharias zach', Mal: 'mal malachi malachias', Tob: 'tob tobit tobias', Jdt: 'jdt judith', '1Ma': '1 macc 1 mac 1 mach 1 maccabees 1 machabees',
    '2Ma': '2 macc 2 mac 2 mach 2 maccabees 2 machabees', Mat: 'matt mt mat matth matthew', Mar: 'mark mk mar marc mr', Luk: 'luke lk luk luc lu',
    Joh: 'john jn joh joann joan', Act: 'acts act ac', Rom: 'rom ro romans', '1Co': '1 cor 1 co 1 corinthians', '2Co': '2 cor 2 co 2 corinthians',
    Gal: 'gal galat galatians', Eph: 'eph ephes ephesians', Phi: 'phil php philip philipp philippians', Col: 'col coloss colossians', '1Th': '1 thess 1 thes 1 th 1 thessalonians',
    '2Th': '2 thess 2 thes 2 th 2 thessalonians', '1Ti': '1 tim 1 ti 1 timoth 1 timothy', '2Ti': '2 tim 2 ti 2 timoth 2 timothy', Tit: 'tit titus', Phm: 'philem phm philemon',
    Heb: 'heb hebr hebrews', Jam: 'jas jam jac james', '1Pe': '1 pet 1 pe 1 pt 1 peter', '2Pe': '2 pet 2 pe 2 pt 2 peter', '1Jo': '1 john 1 jn 1 jo 1 joann',
    '2Jo': '2 john 2 jn 2 jo', '3Jo': '3 john 3 jn 3 jo', Jud: 'jude jud', Rev: 'rev apoc apocalypse revelation'
  };
  // A multi-word name is split on spaces in the table above only where a numeral leads; the longer names are listed separately.
  const LONG = { Sol: ['song of songs', 'song of solomon', 'canticle of canticles'] };
  let aliasMap = null, refRe = null;
  function aliases() {
    if (aliasMap) return aliasMap;
    if (!books().length) return new Map();   // not until the library has been read
    const have = new Set(books().map(b => b.code)), map = new Map();
    const add = (name, code) => { const k = fold(name).replace(/\./g, '').replace(/\s+/g, ' ').trim(); if (k && have.has(code) && !map.has(k)) map.set(k, code); };
    for (const b of books()) { add(b.name, b.code); add(b.code, b.code); }
    for (const [code, list] of Object.entries(ALIASES)) {
      for (const n of LONG[code] || []) add(n, code);
      const words = list.split(' ');
      for (let i = 0; i < words.length; i++) {
        if (/^\d$/.test(words[i])) { add(words[i] + ' ' + words[i + 1], code); i++; }
        else if (!['of', 'songs', 'solomon', 'canticles'].includes(words[i]) || code !== 'Sol') add(words[i], code);
      }
    }
    aliasMap = map; return map;
  }
  const roman = s => { const v = { i: 1, v: 5, x: 10, l: 50, c: 100 }; let n = 0; s = s.toLowerCase(); for (let i = 0; i < s.length; i++) { const a = v[s[i]], b = v[s[i + 1]] || 0; n += a < b ? -a : a; } return n; };
  const num = s => /^\d+$/.test(s) ? +s : roman(s);
  // Vulgate (and Septuagint) Psalm numbers to the Hebrew numbering of the reader.
  function hebrewPsalm(c, v) {
    if (c <= 8 || c >= 148) return [c, v];
    if (c === 9) return v >= 22 ? [10, v - 21] : [9, v];
    if (c <= 112) return [c + 1, v];
    if (c === 113) return v >= 9 ? [115, v - 8] : [114, v];
    if (c === 114) return [116, v];
    if (c === 115) return [116, v + 9];
    if (c <= 145) return [c + 1, v];
    if (c === 146) return [147, v];
    return [147, v + 11];
  }
  // The pattern that finds references in running text, built from the books of this library.
  function referencePattern() {
    if (refRe) return refRe;
    if (!aliases().size) return /$^/g;
    const names = [...new Set([...aliases().keys()].map(k => k.replace(/^\d /, '')))].sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'));
    refRe = new RegExp(`(?<![\\w])(?:([1-4]|I{1,3}|IV)\\s?)?(${names.join('|')})(?:\\.\\s*|\\s+)(\\d{1,3}|[ivxlc]{1,8})(?:(?:\\s*[:,]\\s*|\\.\\s?)(\\d{1,3})(?:\\s*[-–]\\s*(\\d{1,3}))?)?(?![\\w])`, 'gi');
    return refRe;
  }
  // One match → { code, chapter, verse, endVerse, start, end } or null.
  function readMatch(m) {
    const prefix = m[1], name = m[2];
    if (!/^[A-Z]/.test(name)) return null;                       // "Matt." yes, "matt" in a sentence no
    const key = fold(name).replace(/\s+/g, ' ');
    const romanPrefix = { I: '1', II: '2', III: '3', IV: '4' }[prefix?.toUpperCase()] || prefix;
    let code = prefix ? aliases().get(romanPrefix + ' ' + key) : null, start = m.index;
    if (!code) { code = aliases().get(key); if (prefix) start = m.index + m[0].indexOf(name); }
    if (!code) return null;
    const ch = num(m[3]); if (!ch || ch > 150) return null;
    if (/[ivxlc]/i.test(m[3]) && !m[4]) return null;              // "Job iv" alone is too uncertain
    if (!m[4] && code !== 'Psa') return null;                    // a chapter alone only for a Psalm
    const book = books().find(b => b.code === code);
    if (book && ch > book.verses.length && code !== 'Psa') return null;
    return { code, chapter: ch, verse: m[4] ? +m[4] : 1, endVerse: m[5] ? +m[5] : (m[4] ? +m[4] : null), start, end: m.index + m[0].length };
  }
  // A typed reference ("jn 3:16", "1 Cor 13", "Ps 22") for Go anywhere.
  function parseTyped(text) {
    const t = text.trim().replace(/\s+/g, ' ');
    const m = t.match(/^((?:[1-4]|i{1,3}|iv)\s?)?([a-zA-Z][a-zA-Z .]*?)\.?\s*(\d{1,3})(?:\s*[:.,]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?)?$/i);
    if (!m) return null;
    const key = fold((m[1] ? ({ i: '1', ii: '2', iii: '3', iv: '4' }[m[1].trim().toLowerCase()] || m[1].trim()) + ' ' : '') + m[2]).replace(/\./g, '').replace(/\s+/g, ' ').trim();
    let code = aliases().get(key);
    if (!code) { const c = books().filter(b => fold(b.name).replace(/\s/g, '').startsWith(key.replace(/\s/g, ''))); if (c.length === 1) code = c[0].code; }
    if (!code) return null;
    const book = books().find(b => b.code === code), ch = +m[3];
    if (book && ch > book.verses.length) return null;
    return { code, chapter: ch, verse: m[4] ? +m[4] : 1, endVerse: m[5] ? +m[5] : null, hasVerse: !!m[4] };
  }
  const refLabel = r => `${bookName(r.code)} ${r.chapter}${r.hasVerse === false ? '' : ':' + r.verse}${r.endVerse && r.endVerse !== r.verse ? '–' + r.endVerse : ''}`;


  // ---------- Single connections to the program ----------
  const pos = () => state.book ? { book: state.book, chapter: state.chapter, verse: state.verse || 1 } : null;
  let readyResolve; const ready = new Promise(r => { readyResolve = r; });
  const nav0 = window.navigate;
  if (typeof nav0 === 'function') window.navigate = async function (...args) {
    const from = pos();
    const result = await nav0.apply(this, args);
    if (state.data) readyResolve();
    emit('navigate', { from, to: pos() });
    return result;
  };
  const tab0 = window.studyTab;
  if (typeof tab0 === 'function') window.studyTab = function (tab, ...rest) { const r = tab0.call(this, tab, ...rest); emit('study-tab', tab); return r; };
  const select0 = window.selectVerse;
  if (typeof select0 === 'function') window.selectVerse = function (...args) { const r = select0.apply(this, args); emit('verse-select', pos()); return r; };
  // The server: additions can answer a request themselves or look at the answer.
  const middleware = [];
  const api0 = window.api;
  if (typeof api0 === 'function') window.api = function (path, query = {}, body) {
    const run = i => i < middleware.length ? middleware[i](path, query, body, (q = query) => { query = q; return run(i + 1); }) : api0.call(this, path, query, body);
    return run(0);
  };
  const apiUse = fn => middleware.push(fn);
  // Ready once the first chapter has been read, however the program got there.
  apiUse(async (path, query, body, next) => { const r = await next(); if (path === '/api/chapter') setTimeout(() => { if (state.data) readyResolve(); }, 0); return r; });

  // ---------- One page watcher ----------
  // Each feature names the part of the page it cares about; new content there is handed over once per frame.
  const watchers = [];
  let added = new Set(), queued = false;
  function flush() {
    queued = false;
    const nodes = [...added]; added = new Set();
    for (const w of watchers) {
      const roots = new Set();
      for (const n of nodes) {
        if (!n.isConnected) continue;
        if (n.closest(w.selector)) roots.add(n);
        else if (n.querySelector?.(w.selector)) n.querySelectorAll(w.selector).forEach(x => roots.add(x));
      }
      if (roots.size) { try { w.fn([...roots]); } catch (e) { console.warn('[Scriptorium] watch', w.selector, e); } }
    }
  }
  new MutationObserver(muts => {
    for (const m of muts) for (const n of m.addedNodes) { const host = n.nodeType === 1 ? n : n.parentElement; if (host && !host.closest('.ux-card, .st-hl-pop')) added.add(host); }
    if (added.size && !queued) { queued = true; requestAnimationFrame(flush); }
  }).observe(document.body, { childList: true, subtree: true });
  const watch = (selector, fn) => watchers.push({ selector, fn });

  window.Scriptorium = { el, hash, fold, sleep, recall, keep, books, bookName, typing, on, emit, ready, apiUse, watch,
    refs: { aliases, pattern: referencePattern, readMatch, parseTyped, label: refLabel, hebrewPsalm } };
})();
/* END SCRIPTORIUM CORE */

/* BEGIN SCRIPTORIUM LEXICON RANK — a Hebrew word looked up in Brown–Driver–Briggs brings back every entry spelt with the
   same consonants: the root, its derivatives and unrelated homographs. The entry that fits is put first for each
   dictionary (same vowels, then the same part of speech as the word in the verse, then the commonest), and the rest
   are folded under "Other entries". Nothing is removed. */
(() => {
  'use strict';
  const { apiUse } = window.Scriptorium;
  // Vowel points kept; cantillation, meteg and maqqef dropped.
  const pointed = s => String(s || '').normalize('NFD').replace(/[֑-ֽ֯־׀׃]/g, '').replace(/[\[\]\s]/g, '');
  const consonants = s => String(s || '').replace(/[^א-ת]/g, '');
  function partOf(e) {
    const after = e.body.slice(Math.max(0, e.body.indexOf(e.headword)) + e.headword.length, e.body.indexOf(e.headword) + e.headword.length + 120);
    if (e.dictionary === 'BDB') {
      const m = after.match(/^\]?\s*(\d+)?\s*(vb|n|adj|adv|prep|conj|interj|pr|subst|part)\b/);
      return { pos: m?.[2] || '', count: +(m?.[1] || 0) };
    }
    const m = after.match(/\n\s*(v|n|adj|adv|prep|conj|pron|prt|inj)\b/);
    return { pos: m?.[1] === 'v' ? 'vb' : m?.[1] || '', count: 0 };
  }
  const wanted = d => /^Verb/i.test(d) ? 'vb' : /^Noun/i.test(d) ? 'n' : /^Adjective/i.test(d) ? 'adj' : /^Adverb/i.test(d) ? 'adv' : '';
  apiUse(async (path, query, body, next) => {
    const r = await next();
    if (path !== '/api/define' || query.language !== 'Hebrew' || !(r?.entries?.length > 2)) return r;
    try {
    const hint = window.ScriptoriumDefineHint;
    const pos = hint && consonants(hint.word) === consonants(query.word) ? wanted(hint.pos || '') : '';
    const word = pointed(query.word), plain = consonants(query.word) === query.word.replace(/\s/g, '');
    const scored = r.entries.map((e, i) => {
      const p = partOf(e);
      let s = 0;
      if (!plain && pointed(e.headword) === word) s += 3;
      if (pos && p.pos === pos) s += 2;
      if (pos === 'n' && p.pos === 'pr') s -= 1;
      return { e, i, s, count: p.count };
    });
    const best = new Map();
    for (const x of scored) {
      const b = best.get(x.e.dictionary);
      if (!b || x.s > b.s || (x.s === b.s && x.count > b.count)) best.set(x.e.dictionary, x);
    }
    const first = [...best.values()].sort((a, b) => a.i - b.i);
    r.entries = [...first.map(x => x.e), ...scored.filter(x => !first.includes(x)).map(x => x.e)];
    r.primary = first.length;
    } catch (e) { console.warn('lexicon rank', e); }
    return r;
  });
})();

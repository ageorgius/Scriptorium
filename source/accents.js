/* BEGIN SCRIPTORIUM ANTONIADES ACCENTS — the Antoniades Patriarchal Text is in the library without accents (so is its
   only free digital edition). Each word is shown with the accents of the same word in the same verse of the
   Robinson–Pierpont Byzantine text, which agrees with the Patriarchal text almost everywhere (accents/build_accents.py;
   atlas/antoniades-<book>.json). The library itself is not changed. */
(() => {
  'use strict';
  const { apiUse } = window.Scriptorium;
  const files = new Map();
  const bare = w => String(w || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^Ͱ-Ͽἀ-῿]/g, '').toLowerCase().replace(/ς/g, 'σ');
  const load = book => {
    if (!files.has(book)) files.set(book, fetch(`/atlas/antoniades-${book}.json`).then(r => r.ok ? r.json() : null).catch(() => null));
    return files.get(book);
  };
  const pools = new WeakMap();
  function chapterWords(verses, chapter) {
    if (!pools.has(verses)) pools.set(verses, new Map());
    const byChapter = pools.get(verses);
    if (!byChapter.has(chapter)) {
      const words = new Map();
      for (const [ref, list] of Object.entries(verses)) if (ref.startsWith(chapter + ':')) for (const w of list.split(' ')) if (!words.has(bare(w))) words.set(bare(w), w);
      byChapter.set(chapter, words);
    }
    return byChapter.get(chapter);
  }
  function accent(part, verses) {
    if (!verses || !part.tokens?.length) return;
    const list = verses[`${part.chapter}:${part.verse}`] || '';
    const acc = list ? list.split(' ') : [], used = new Set();
    let j = 0;
    for (const t of part.tokens) {
      const m = String(t.text).match(/^([^Ͱ-Ͽἀ-῿]*)(.*?)([^Ͱ-Ͽἀ-῿̀-ͯ]*)$/u);
      if (!m || !bare(m[2])) continue;
      const want = bare(m[2]);
      let k = acc[j] !== undefined && bare(acc[j]) === want ? j : acc.findIndex((a, i) => !used.has(i) && bare(a) === want);
      if (k < 0) {                                   // a verse numbered differently: any word of the same chapter will do
        const other = chapterWords(verses, part.chapter).get(want);
        if (other) t.text = m[1] + other + m[3];
        continue;
      }
      used.add(k); j = k + 1;
      t.text = m[1] + acc[k] + m[3];
    }
    part.text = part.tokens.map((t, i) => t.text + (t.after ?? (i < part.tokens.length - 1 ? ' ' : ''))).join('');
  }
  apiUse(async (path, query, body, next) => {
    const r = await next();
    if (path !== '/api/chapter' || !r?.rows || !String(query.versions || '').split(',').includes('Antoniades')) return r;
    const parts = r.rows.flatMap(row => row.columns.filter(c => c.version === 'Antoniades').flatMap(c => c.parts || []));
    const books = await Promise.all([...new Set(parts.map(p => p.book))].map(async b => [b, await load(b)]));
    const byBook = new Map(books);
    for (const p of parts) accent(p, byBook.get(p.book));
    return r;
  });
})();

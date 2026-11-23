
/* BEGIN SCRIPTORIUM BREVIARY DIVISIONS — read Psalm commentary by the divisions of the 1962 Roman Breviary. */
(() => {
  'use strict';
  const DATA = __BREVIARY_DATA__;
  const field = document.getElementById('commentary-breviary-field'), select = document.getElementById('commentary-breviary'), note = document.getElementById('commentary-breviary-note');
  if (!field || !select || !note) return;
  let shownPsalm = null;
  const range = d => d.label || (d.first === d.last ? String(d.first) : `${d.first}–${d.last}`);
  const roman = n => ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi'][n] || String(n + 1);
  function divisionsOf(psalm) { return DATA.psalms[psalm] || []; }
  function describe(psalm, d, index, parts) {
    const name = d.name ? `${d.name} · ` : parts > 1 ? `${roman(index)} · ` : '';
    return `${name}vv. ${range(d)} · ${d.uses[0]}${d.uses.length > 1 ? ' …' : ''}`;
  }
  // Rebuild the menu when the commentary psalm changes; keep the choice while it stays the same.
  function sync(book, psalm) {
    const visible = book === 'Psa' && psalm >= 1 && psalm <= 150;
    field.classList.toggle('hidden', !visible);
    if (!visible) { note.classList.add('hidden'); shownPsalm = null; return; }
    if (psalm !== shownPsalm) {
      shownPsalm = psalm;
      const all = divisionsOf(psalm), parts = all.filter(d => d.first).length;
      select.replaceChildren(new Option('Whole psalm', ''));
      all.forEach((d, i) => { if (d.first) select.add(new Option(describe(psalm, d, all.filter(x => x.first).indexOf(d), parts), String(i))); });
      select.disabled = !parts;
      select.title = parts ? 'Gather the verse notes for one division of the psalm as it is prayed in the 1962 Breviary' : 'This psalm is prayed whole in the 1962 Breviary';
    }
    renderNote(psalm);
  }
  function current(book, psalm) {
    if (book !== 'Psa' || psalm !== shownPsalm || select.value === '') return null;
    const d = divisionsOf(psalm)[Number(select.value)];
    return d?.first ? { first: d.first, last: d.last, key: `${psalm}:${d.first}-${d.last}`, label: range(d), name: d.name, uses: d.uses } : null;
  }
  function renderNote(psalm) {
    const all = divisionsOf(psalm), chosen = current('Psa', psalm);
    note.replaceChildren();
    if (!all.length) { note.classList.add('hidden'); return; }
    const head = document.createElement('b'); head.textContent = 'Breviary (1962): ';
    note.append(head);
    if (chosen) {
      note.append(document.createTextNode(`Psalm ${psalm}${chosen.name ? ' (' + chosen.name + ')' : ''}, vv. ${chosen.label} — ${chosen.uses.join('; ')}. Verse notes for every verse in this division are gathered below; commentaries on the whole psalm stay under Chapter context.`));
    } else {
      const whole = all.find(d => !d.first), parts = all.filter(d => d.first);
      const lines = [];
      if (whole) lines.push(`said whole — ${whole.uses.join('; ')}`);
      if (parts.length) lines.push(`divided into ${parts.length} parts — choose one above`);
      note.append(document.createTextNode(`Psalm ${psalm} is ${lines.join('; also ')}.`));
    }
    note.classList.remove('hidden');
  }
  // Mark an entry as matching the division if it matches any verse in it.
  async function gather(entries, query, division) {
    const verses = []; for (let v = division.first + 1; v <= division.last; v++) verses.push(v);
    const key = e => JSON.stringify([e.work, e.id]);
    const byKey = new Map(entries.map(e => [key(e), e]));
    const replies = await Promise.all(verses.map(verse => api('/api/commentaries', { ...query, verse }).catch(() => null)));
    for (const reply of replies) for (const e of reply?.entries || []) {
      if (!e.matched) continue;
      const known = byKey.get(key(e));
      if (known) known.matched = true; else { byKey.set(key(e), e); entries.push(e); }
    }
    const order = new Map(entries.map((e, i) => [e, i]));
    return entries.sort((a, b) => (b.matched - a.matched) || (a.matched && b.matched ? (a.first_verse || 0) - (b.first_verse || 0) : 0) || order.get(a) - order.get(b));
  }
  select.onchange = () => { renderNote(shownPsalm); if (typeof loadCommentary === 'function') loadCommentary(); };
  window.ScriptoriumBreviary = { sync, current, gather };
})();
/* END SCRIPTORIUM BREVIARY DIVISIONS */

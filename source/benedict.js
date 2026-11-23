/* BEGIN SCRIPTORIUM BENEDICT XVI — his Wednesday talks on the saints and his feast-day homilies, filed under the days of the
   1962 calendar. Only titles and links are kept here: the texts are © Libreria Editrice Vaticana and open on vatican.va
   (in your web browser). */
(() => {
  'use strict';
  const { el } = window.Scriptorium;
  let data = null, dataPromise = null, dialog = null;
  const load = () => data ? Promise.resolve(data) : dataPromise ||= fetch('/atlas/benedict-links.json')
    .then(r => { if (!r.ok) throw Error('The list of Benedict XVI’s texts could not be loaded.'); return r.json(); })
    .then(d => (data = d)).catch(e => { dataPromise = null; throw e; });

  const when = it => {
    const [y, m, d] = it.d.split('-').map(Number);
    return `${d} ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]} ${y}`;
  };
  // A link that opens the official text in the web browser (Scriptorium's window hands new windows to the browser).
  const link = (it, showDay) => el('a', { class: 'bx-link', href: it.u, target: '_blank', rel: 'noopener', title: 'Opens the official text on vatican.va in your web browser' },
    el('b', {}, it.t), el('small', {}, [it.k === 'homily' ? 'Homily' : 'General audience', when(it), showDay && it.day ? 'for ' + it.day : ''].filter(Boolean).join(' · ') + ' ↗'));

  function dayBox(d) {
    const box = el('section', { class: 'lit-section bx-day', hidden: true }, el('h4', {}, 'Pope Benedict XVI'));
    load().then(({ items, days }) => {
      const mine = (days[d.id] || []).map(i => items[i]);
      if (!mine.length) return;
      const talks = mine.filter(x => x.k === 'audience'), homilies = mine.filter(x => x.k === 'homily');
      if (talks.length) { box.append(el('h5', { class: 'lit-subhead' }, talks.some(x => x.s) ? 'His talks on this saint or feast' : 'His talks')); for (const it of talks) box.append(link(it)); }
      if (homilies.length) { box.append(el('h5', { class: 'lit-subhead' }, homilies.length > 1 ? `His homilies on this day (${homilies.length})` : 'His homily on this day')); for (const it of homilies.reverse()) box.append(link(it)); }
      box.append(el('p', { class: 'lit-hint bx-foot' }, 'The texts open on vatican.va in your web browser. ',
        el('button', { type: 'button', class: 'quiet', onclick: () => open() }, 'All his talks on the saints…')));
      box.hidden = false;
    }).catch(() => {});
    return box;
  }

  // The whole list: every talk in his great series on the saints, including those whose saint has no day in the calendar.
  async function open(query = '') {
    const { items } = await load();
    if (!dialog) { dialog = el('dialog', { class: 'lit-dialog bx-dialog', 'aria-label': 'Pope Benedict XVI on the saints' }); dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); }); document.body.append(dialog); }
    const input = el('input', { type: 'search', class: 'bx-search', placeholder: 'Find a saint or a feast…', value: query, 'aria-label': 'Find a saint or a feast' });
    const show = el('select', { 'aria-label': 'Show' }, el('option', { value: 'saints' }, 'Talks on the saints'), el('option', { value: 'homilies' }, 'Feast-day homilies'), el('option', { value: 'all' }, 'Everything'));
    const list = el('div', { class: 'lit-dialog-text bx-list' });
    const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const draw = () => {
      const q = fold(input.value.trim()), which = show.value;
      const pick = items.filter(it => (which === 'all' || (which === 'saints' ? it.s : it.k === 'homily')) && (!q || fold(it.t + ' ' + (it.day || '') + ' ' + (it.s || '')).includes(q)));
      const groups = new Map();
      for (const it of pick) { const g = it.s || (it.k === 'homily' ? 'Feast-day homilies' : 'Other talks'); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(it); }
      list.replaceChildren(...(pick.length ? [] : [el('p', { class: 'lit-empty' }, 'Nothing matches.')]));
      for (const [g, its] of groups) { list.append(el('h5', { class: 'lit-subhead' }, `${g} (${its.length})`)); for (const it of its) list.append(link(it, true)); }
    };
    input.addEventListener('input', draw); show.addEventListener('change', draw);
    dialog.replaceChildren(
      el('div', { class: 'lit-dialog-head' },
        el('div', {}, el('p', { class: 'lit-kicker' }, 'Pope Benedict XVI · 2005–2013'), el('h2', {}, 'His talks on the saints'),
          el('p', { class: 'lit-hint' }, 'From 2006 to 2011 his Wednesday audiences went through the Apostles, the Fathers, the writers of the Middle Ages and the holy women and Doctors of the Church. Each one opens on vatican.va in your web browser.')),
        el('div', { class: 'lit-dialog-tools' }, el('button', { type: 'button', class: 'quiet', 'aria-label': 'Close', onclick: () => dialog.close() }, '×'))),
      el('div', { class: 'bx-filter' }, input, show), list,
      el('p', { class: 'lit-source' }, 'Texts © Libreria Editrice Vaticana, on vatican.va. Scriptorium keeps only their titles and links.'));
    draw();
    if (!dialog.open) dialog.showModal();
    input.focus();
  }

  window.ScriptoriumBenedict = { load, dayBox, open };
})();

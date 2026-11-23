/* BEGIN SCRIPTORIUM SIMPLER LAYOUT — fewer doors: five study tabs, your own Bibles first,
   and every display setting behind one ⚙ Display button. */
(() => {
  'use strict';
  const { el, recall, keep, on, watch, ready } = window.Scriptorium;
  const $ = id => document.getElementById(id);

  // ---------- Study panel: Words (with Lemma) · Commentary (with Books) · Notes · Map · Liturgy ----------
  const PARENT = { lemma: 'word', books: 'commentary' };
  const SUB = {
    word: [['word', 'Word'], ['lemma', 'Lemma study']],
    commentary: [['commentary', 'Commentaries'], ['books', 'Books & introductions']]
  };
  let sub = null;
  function syncStudyTabs(tab) {
    const shown = PARENT[tab] || tab;
    for (const id of ['word', 'commentary', 'note', 'map', 'liturgy']) {
      const b = $(id + '-tab'); if (!b) continue;
      const on = id === shown; b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on));
    }
    if (!sub) return;
    const choices = SUB[shown];
    sub.hidden = !choices;
    if (choices) sub.replaceChildren(...choices.map(([id, label]) => el('button', { type: 'button', class: id === tab ? 'active' : '', 'aria-pressed': String(id === tab),
      onclick: () => { if (id === 'books' && typeof showReadingBooks === 'function') { studyTab('books'); showReadingBooks({ related: state.book }); } else studyTab(id); } }, label)));
  }
  function tidyStudyPanel() {
    const tabs = document.querySelector('.study-tabs'); if (!tabs) return;
    for (const id of ['lemma-tab', 'books-tab']) { const b = $(id); if (b) { b.hidden = true; b.classList.add('sx-hidden'); } }
    if (!sub) { sub = el('div', { class: 'sx-subtabs', role: 'group', 'aria-label': 'Show', hidden: true }); tabs.after(sub); }
    syncStudyTabs(typeof activeStudyTab !== 'undefined' ? activeStudyTab : 'word');
  }
  on('study-tab', tab => syncStudyTabs(tab));
  // The panel's own clicks on the Words and Commentary tabs return to their main view.
  document.addEventListener('click', e => { const b = e.target.closest?.('#word-tab, #commentary-tab'); if (b) setTimeout(() => syncStudyTabs(b.id === 'word-tab' ? 'word' : 'commentary'), 0); }, true);

  // ---------- Your Bibles first: the translation menus list the ones you use, with "More translations…" ----------
  const MORE = '__more__';
  const installed = () => (state.meta?.versions || []).map(v => v.id);
  // Your Bibles: the Douay-Rheims and the Latin Vulgate; any other you choose from "More translations…" joins them.
  const FAV = 'scriptorium-favourite-bibles-v2';
  function favourites() {
    let fav = recall(FAV, null);
    if (!Array.isArray(fav)) { fav = ['DRA', 'VUL'].filter(v => installed().includes(v)); keep(FAV, fav); }
    return fav;
  }
  function addFavourite(id) { if (!id || id === MORE) return; const fav = favourites(); if (!fav.includes(id)) { fav.push(id); keep(FAV, fav); } }
  // Once: read in the Douay-Rheims with the Vulgate beside it.
  async function douayFirst() {
    if (recall('scriptorium-douay-first', false) || !state.meta || !installed().includes('DRA')) return;
    keep('scriptorium-douay-first', true);
    const langs = (state.languages || []).filter(v => v && v !== 'DRA');
    if (state.english === 'DRA' && langs.includes('VUL')) return;
    state.english = 'DRA';
    if (installed().includes('VUL') && !langs.includes('VUL')) langs.unshift('VUL');
    state.languages = langs;
    if (state.book) await window.navigate(state.book, state.chapter, state.verse);
  }
  function trimSelect(select) {
    if (select.dataset.sxTrimmed === '1' || select.dataset.sxExpanded === '1') return;
    select.dataset.sxTrimmed = '1';
    const fav = new Set([...favourites(), select.value]);
    for (const o of select.querySelectorAll('option')) if (o.value && !fav.has(o.value)) o.hidden = true;
    for (const g of select.querySelectorAll('optgroup')) g.hidden = ![...g.querySelectorAll('option')].some(o => !o.hidden);
    select.append(el('option', { value: MORE }, 'More translations…'));
    select.dataset.sxLast = select.value;
  }
  function trimAll() { document.querySelectorAll('#language-selectors select').forEach(trimSelect); }
  document.addEventListener('change', e => {
    const s = e.target;
    if (!(s instanceof HTMLSelectElement) || !s.closest('#language-selectors')) return;
    if (s.value === MORE) {
      e.stopImmediatePropagation();
      s.value = s.dataset.sxLast || '';
      s.dataset.sxExpanded = '1';
      s.querySelectorAll('option, optgroup').forEach(o => { o.hidden = false; });
      s.querySelector(`option[value="${MORE}"]`)?.remove();
      try { s.showPicker(); } catch { s.focus(); }
      return;
    }
    addFavourite(s.value); s.dataset.sxLast = s.value;
  }, true);

  // ---------- ⚙ Display: Bibles shown, layout, text size, study panel, verse alignment and theme in one place ----------
  let panel = null, button = null, summary = null;
  function versionsLabel() { if (!state.meta) return 'Bibles'; const cols = typeof columns === 'function' ? columns() : [state.english]; return cols.filter(Boolean).join(' · ') || 'Choose a Bible'; }
  function buildDisplay() {
    const options = document.querySelector('.reading-options'), align = document.querySelector('.alignment-options'), theme = $('theme-toggle');
    if (!options || panel) return;
    panel = el('div', { id: 'sx-display-panel', class: 'sx-display-panel', role: 'dialog', 'aria-label': 'Display', hidden: true },
      el('div', { class: 'sx-display-head' }, el('b', {}, 'Display'), el('button', { type: 'button', class: 'quiet', 'aria-label': 'Close', onclick: () => toggle(false) }, '×')),
      el('p', { class: 'sx-display-label' }, 'Bibles shown'));
    panel.append(options);
    if (align) panel.append(align);
    if (theme) { theme.classList.add('sx-theme'); panel.append(el('div', { class: 'sx-display-row' }, el('span', {}, 'Appearance'), theme)); }
    button = el('button', { id: 'sx-display', type: 'button', class: 'st-hist sx-display-btn', 'aria-expanded': 'false', 'aria-controls': 'sx-display-panel', title: 'Bibles shown, layout, text size, study panel, verse alignment, dark mode', onclick: () => toggle() }, '⚙ Display');
    summary = el('button', { type: 'button', class: 'sx-bibles', title: 'Change the Bibles shown', onclick: () => toggle(true) }, versionsLabel());
    const group = document.querySelector('.st-history') || document.querySelector('.chapter-actions');
    group?.append(button);
    const titleRow = $('chapter-title')?.parentElement;
    titleRow?.append(summary);
    (document.querySelector('.reader-toolbar') || document.body).append(panel);
  }
  const showModal0 = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function () { if (panel && !panel.hidden) toggle(false); return showModal0.apply(this, arguments); };
  function toggle(open = panel?.hidden) {
    if (!panel) return;
    panel.hidden = !open; button?.setAttribute('aria-expanded', String(!!open));
    if (open) { trimAll(); panel.querySelector('select, button:not(.quiet)')?.focus({ preventScroll: true }); }
  }
  document.addEventListener('pointerdown', e => { if (panel && !panel.hidden && !panel.contains(e.target) && !button?.contains(e.target) && !summary?.contains(e.target) && !e.target.closest?.('dialog')) toggle(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel && !panel.hidden && !document.querySelector('dialog[open]')) { e.stopPropagation(); toggle(false); button?.focus(); } }, true);
  document.addEventListener('scriptorium:dialog', () => toggle(false));

  // ---------- The library: one box (book or passage), searching moves to Search or go to ----------
  function tidyLibrary() {
    const adv = $('search-open'); if (adv) { adv.hidden = true; adv.classList.add('sx-hidden'); }
    const hint = document.querySelector('#sidebar-search-form p');
    if (hint && !hint.dataset.sx) { hint.dataset.sx = '1'; hint.textContent = 'Type a book, or a passage such as John 3:16. To search words, press Ctrl + K.'; }
  }

  function refresh() {
    tidyStudyPanel(); buildDisplay(); tidyLibrary(); trimAll();
    if (summary) summary.textContent = versionsLabel();
  }
  on('navigate', () => safe());
  watch('#language-selectors', () => trimAll());
  const safe = () => { try { refresh(); } catch (e) { console.warn(e); } };
  function start() {
    safe();
    ready.then(() => { safe(); return douayFirst(); }).catch(e => console.warn(e));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.ScriptoriumSimple = { toggleDisplay: toggle, favourites };
})();
/* END SCRIPTORIUM SIMPLER LAYOUT */

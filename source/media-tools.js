
/* BEGIN SCRIPTORIUM MAPS & PHOTOS — quicker access: Maps and Photos in the Study tools menu, one map library,
   full-screen viewing, and photos of the places in the chapter being read. */
(() => {
  'use strict';
  const { el } = window.Scriptorium;
  const MAP_TYPE = /map|plan|reconstruction/i;
  const dialog = () => document.getElementById('bible-map-dialog');

  // ---------- Open the Bible map dialog at a given view ----------
  async function openView(view) {
    const menu = document.getElementById('study-tools-menu'), toggle = document.getElementById('study-tools-open');
    menu?.classList.add('hidden'); toggle?.setAttribute('aria-expanded', 'false');
    if (!dialog()?.open) document.getElementById('bible-map-open')?.click();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    document.getElementById(view === 'maps' ? 'bible-map-saved-tab' : view === 'photos' ? 'bible-map-photos-tab' : 'bible-map-interactive-tab')?.click();
    if (view === 'maps') wireLibrary();
  }
  async function openPhoto(id) {
    await openView('photos');
    document.dispatchEvent(new CustomEvent('bible-map:open-photo', { detail: { id } }));
  }
  async function openPhotosOf(place) {
    await openView('photos');
    document.dispatchEvent(new CustomEvent('bible-map:photos-filter', { detail: { placeId: place.id, name: place.name, coord: place.coord } }));
  }

  // ---------- Study tools menu: Maps and Photos as their own entries ----------
  function addMenuItems() {
    const mapButton = document.getElementById('bible-map-open');
    if (!mapButton || document.getElementById('maps-open')) return;
    const item = (id, icon, label, note, view) => {
      const b = el('button', { id, type: 'button', class: 'study-tools-item', role: 'menuitem', tabindex: '-1' });
      b.innerHTML = icon + `<span>${label}</span><small>${note}</small>`;
      b.onclick = () => openView(view);
      return b;
    };
    const maps = item('maps-open', '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2Z"/><path d="M9 4v14M15 6v14"/></svg>', 'Maps', 'All maps, plates & city plans', 'maps');
    const photos = item('photos-open', '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/></svg>', 'Photos', 'Places of Scripture by region', 'photos');
    mapButton.after(maps);   // no Photos entry: the photographs are left out (patch.py)
  }

  // ---------- One map library: the saved maps plus every map, plate and plan in the photo atlas ----------
  let libraryZoom = null, libraryWired = false;
  const GROUPS = [
    ['Relief plates (BibleWorks)', i => i.type === 'BibleWorks map' && /relief plate/i.test(i.title)],
    ['Journeys & other BibleWorks plates', i => i.type === 'BibleWorks map'],
    ['City & site plans', i => /plan/i.test(i.type)],
    ['Reconstructions', i => /reconstruction/i.test(i.type)],
    ['Other maps', i => MAP_TYPE.test(i.type) && i.id !== 'jerusalem-orientation'],
  ];
  async function wireLibrary() {
    const gallery = document.getElementById('bible-map-gallery');
    if (!gallery || libraryWired) return;
    libraryWired = true;
    const tab = document.getElementById('bible-map-saved-tab');
    let nav;
    try { nav = await window.ScriptoriumAtlas.load(); } catch { return; }
    const list = gallery.querySelector('.bm-gallery-list');
    const saved = list.querySelectorAll('[data-saved-id]').length;
    list.prepend(el('p', { class: 'mt-group' }, 'Prepared maps'));
    const maps = nav.items.filter(i => MAP_TYPE.test(i.type) && i.id !== 'jerusalem-orientation');
    const used = new Set();
    for (const [label, test] of GROUPS) {
      const group = maps.filter(i => !used.has(i.id) && test(i)).sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
      if (!group.length) continue;
      list.append(el('p', { class: 'mt-group' }, `${label} (${group.length})`));
      for (const item of group) {
        used.add(item.id);
        const b = el('button', { type: 'button', class: 'bm-saved-card mt-card', 'data-library-id': item.id, 'aria-pressed': 'false' },
          el('img', { alt: '', loading: 'lazy', decoding: 'async', src: '/atlas/' + item.thumb }), el('span', {}, item.title), el('small', {}, item.type));
        b.onclick = () => showLibraryMap(item);
        list.append(b);
      }
    }
    if (tab) tab.firstChild.textContent = 'Maps ';
    tab?.querySelector('span') && (tab.querySelector('span').textContent = String(saved + used.size));
    // When one of the prepared maps is chosen, the original viewer takes over again.
    list.querySelectorAll('[data-saved-id]').forEach(b => b.addEventListener('click', () => { libraryZoom?.destroy?.(); libraryZoom = null; list.querySelectorAll('[data-library-id]').forEach(x => x.setAttribute('aria-pressed', 'false')); gallery.querySelector('.mt-map-actions')?.remove(); gallery.querySelector('#bible-map-explore-saved')?.classList.remove('hidden'); }, true));
  }
  function showLibraryMap(item) {
    const gallery = document.getElementById('bible-map-gallery');
    gallery.querySelectorAll('[data-saved-id],[data-library-id]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.libraryId === item.id)));
    gallery.querySelector('#bible-map-saved-title').textContent = item.title;
    gallery.querySelector('.bm-saved-subtitle').textContent = [item.type, item.path?.slice(1).map(n => n.label).join(' › ')].filter(Boolean).join(' · ');
    gallery.querySelector('.bm-saved-caption').textContent = [item.description, item.credit ? `${item.credit} · ${item.license || ''}` : ''].filter(Boolean).join(' ');
    libraryZoom?.destroy?.();
    libraryZoom = window.ScriptoriumAtlas.createZoom(gallery.querySelector('.bm-saved-image-wrap'), { src: '/atlas/' + item.image, alt: item.title });
    gallery.querySelector('#bible-map-explore-saved')?.classList.add('hidden');
    gallery.querySelector('.mt-map-actions')?.remove();
    const actions = el('span', { class: 'mt-map-actions' },
      el('button', { type: 'button', onclick: () => openPhoto(item.id) }, 'Open with details & Scripture'),
      item.location ? el('button', { type: 'button', onclick: () => { document.getElementById('bible-map-interactive-tab')?.click(); document.dispatchEvent(new CustomEvent('bible-map:locate', { detail: { ...item } })); } }, 'See this area on the map') : null);
    gallery.querySelector('.bm-saved-actions').prepend(actions);
    gallery.querySelector('.bm-saved-image-wrap .az-stage')?.focus({ preventScroll: true });
  }

  // ---------- Full screen for the map & photo window ----------
  function addFullScreen() {
    const d = dialog();
    if (!d || d.querySelector('.mt-full')) return;
    const heading = d.querySelector('.bm-view-tabs');
    if (!heading) return;
    const button = el('button', { type: 'button', class: 'mt-full', 'aria-pressed': 'false', title: 'Fill the window (F)' }, 'Full screen');
    const set = on => {
      d.classList.toggle('mt-fullscreen', on); button.setAttribute('aria-pressed', String(on)); button.textContent = on ? 'Restore' : 'Full screen';
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    };
    button.onclick = () => set(!d.classList.contains('mt-fullscreen'));
    // Beside the tabs, not inside the tab list (its arrow keys move between the tabs only).
    const row = el('div', { class: 'mt-tabrow' }); heading.before(row); row.append(heading, button);
    d.addEventListener('keydown', e => {
      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey && !['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) { e.preventDefault(); button.click(); }
    });
    // Saved/library map viewer: arrow keys step through the list of maps.
    d.addEventListener('keydown', e => {
      const gallery = document.getElementById('bible-map-gallery');
      if (!gallery || gallery.classList.contains('hidden') || !['ArrowLeft', 'ArrowRight'].includes(e.key) || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.target.closest('[role=tablist]')) return;
      const cards = [...gallery.querySelectorAll('.bm-gallery-list .bm-saved-card')], i = cards.findIndex(c => c.getAttribute('aria-pressed') === 'true');
      const next = cards[i + (e.key === 'ArrowRight' ? 1 : -1)];
      if (next) { e.preventDefault(); next.click(); next.scrollIntoView({ block: 'nearest' }); }
    });
  }

  // ---------- Photos of the places in a chapter (used by the study Map tab) ----------
  async function photosForPlaces(places, limit = 12) {
    let nav;
    try { nav = await window.ScriptoriumAtlas.load(); } catch { return []; }
    const out = [], seen = new Set();
    for (const p of places) {
      if (!p?.id || /region|territory|empire|kingdom/i.test(p.kind || '')) continue;   // a whole region's photos would bury the chapter's places
      let found;
      try { found = window.ScriptoriumAtlas.photosForPlace({ id: p.id, name: p.name, coord: p.coord }); } catch { continue; }
      // Only places with their own pictures — a whole region's thousand photos would bury the chapter's places.
      const items = (found.node && found.node.kind !== 'site' ? found.items.filter(i => i.relatedPlaceIds?.includes(p.id)) : found.items) || [];
      const pick = items.filter(i => !seen.has(i.id)).sort((a, b) => (b.priority || 0) - (a.priority || 0)).slice(0, 3);
      if (!pick.length) continue;
      pick.forEach(i => seen.add(i.id));
      out.push({ place: p, items: pick, total: items.length });
      if (out.reduce((n, x) => n + x.items.length, 0) >= limit) break;
    }
    return out;
  }
  const label = p => String(p.name || '').replace(/\s+\d+$/, '');
  function photoStrip(groups) {
    const box = el('section', { class: 'mt-strip', 'aria-label': 'Photos of the places in this chapter' });
    box.append(el('h4', {}, 'Photos of these places'));
    const row = el('div', { class: 'mt-thumbs' });
    for (const g of groups) for (const item of g.items) {
      row.append(el('button', { type: 'button', class: 'mt-thumb', title: item.title, onclick: () => openPhoto(item.id) },
        el('img', { src: '/atlas/' + item.thumb, alt: '', loading: 'lazy', decoding: 'async' }), el('span', {}, label(g.place))));
    }
    box.append(row);
    const more = el('div', { class: 'mt-more' });
    for (const g of groups) if (g.total > g.items.length) more.append(el('button', { type: 'button', class: 'quiet', onclick: () => openPhotosOf(g.place) }, `All ${g.total} of ${label(g.place)} →`));
    if (more.childNodes.length) box.append(more);
    return box;
  }

  function init() {
    addMenuItems();
    // The map window is built on first use: add its extras then.
    document.addEventListener('click', e => { if (e.target.closest?.('#bible-map-open, #maps-open, #photos-open')) setTimeout(() => { addFullScreen(); wireLibrary(); }, 50); });
    document.addEventListener('click', e => { if (e.target.closest?.('#bible-map-saved-tab')) wireLibrary(); });
  }
  init();
  async function openMap(id) {
    await openView('maps'); await wireLibrary();
    for (let i = 0; i < 30; i++) { const b = document.querySelector(`[data-library-id="${CSS.escape(id)}"]`); if (b) { b.click(); b.scrollIntoView({ block: 'nearest' }); return; } await new Promise(r => setTimeout(r, 100)); }
  }
  window.ScriptoriumMedia = { openView, openPhoto, openPhotosOf, photosForPlaces, photoStrip, openMap };
})();
/* END SCRIPTORIUM MAPS & PHOTOS */

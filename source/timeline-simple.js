/* BEGIN SCRIPTORIUM SIMPLE TIMELINE — three tabs (Old Testament, New Testament, Church history) in place of the
   collection menus, and the search box beside the zoom buttons. The side list, the Display menu, the manuscripts view
   and the notes around the chart are hidden by timeline-simple.css. */
(() => {
  'use strict';
  const { el, watch } = window.Scriptorium;

  function setUp(dialog) {
    if (dialog.dataset.simple) return;
    dialog.dataset.simple = '1';
    const preset = dialog.querySelector('#bt-preset'), search = dialog.querySelector('#bt-search');
    const toolbar = dialog.querySelector('.bt-toolbar'), heading = dialog.querySelector('.bt-heading');
    if (!preset || !toolbar || !heading) return;

    const tabs = el('div', { class: 'tl-views', role: 'tablist', 'aria-label': 'Timeline view' });
    const sync = () => {
      for (const b of tabs.children) {
        const on = b.dataset.view === preset.value && !search.value.trim();
        b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
      }
    };
    for (const option of preset.options) {
      const b = el('button', { type: 'button', role: 'tab', 'data-view': option.value }, option.textContent);
      b.addEventListener('click', () => {
        if (search.value) { search.value = ''; search.dispatchEvent(new Event('input', { bubbles: true })); }
        preset.value = option.value; preset.dispatchEvent(new Event('change', { bubbles: true }));
        dialog.querySelector('#bt-fit')?.click();     // show the whole of the chosen view
        sync();
      });
      b.addEventListener('keydown', e => {
        if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        e.preventDefault();
        const all = [...tabs.children], next = all[(all.indexOf(b) + (e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
        next.click(); next.focus();
      });
      tabs.append(b);
    }
    heading.after(tabs);

    // The search box joins the toolbar; it searches all three views at once.
    if (search) {
      const box = el('div', { class: 'tl-find' }); box.append(search); toolbar.prepend(box);
      search.addEventListener('input', sync);
    }
    dialog.addEventListener('bt-update', sync);
    sync();
  }

  watch('#bible-timeline-dialog', roots => { const d = roots[0]?.closest('#bible-timeline-dialog'); if (d && !d.dataset.simple) setUp(d); });
  const now = document.getElementById('bible-timeline-dialog'); if (now) setUp(now);
})();

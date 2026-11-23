
/* BEGIN SCRIPTORIUM SCRIPTURE MAP PANEL — journeys, wars and tribal movements traced on a map, in the study panel. */
(() => {
  'use strict';
  const core = window.ScriptoriumBibleMapData;
  const panel = document.getElementById('map-panel');
  if (!core || !panel) return;
  const { project } = core;
  const byId = new Map(core.places.filter(p => p.coord).map(p => [p.id, p]));
  const pointOf = p => p.point || (p.point = project(p.coord));
  const BROAD = new Set(['region', 'people group', 'body of water', 'mountain range', 'river']);
  const isBroad = p => BROAD.has(p.kind);
  const HOLY_LAND = [33.75, 30.5, 36.6, 33.8], WORLD = [10, 25, 50, 44];
  const KINDS = { people: 'Journey', war: 'War or battle', tribes: 'Tribes and nations' };
  const store = (key, value) => { try { localStorage.setItem('scriptorium-map-' + key, value); } catch {} };
  const recall = (key, fallback) => { try { return localStorage.getItem('scriptorium-map-' + key) ?? fallback; } catch { return fallback; } };
  const el = (tag, attrs = {}, text = '') => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) { if (key === 'style') node.style.cssText = value; else node.setAttribute(key, value); }
    if (text) node.textContent = text;
    return node;
  };
  const bookName = code => state.meta?.books.find(b => b.code === code)?.name || code;
  const nameOf = p => p.name.replace(/ \((?:Old|New) Testament\)$/, '').replace(/ \d+$/, '');
  const testamentOf = p => p.ot && p.nt ? 'Old & New Testament' : p.nt ? 'New Testament' : 'Old Testament';
  // Where a step happened: an OpenBible place, or an approximate named area (tribal territories).
  function stopOf(step) {
    if (step.stop) return step.stop;
    if (step.place) { const p = byId.get(step.place); return step.stop = { id: p.id, name: nameOf(p), point: pointOf(p), place: p }; }
    return step.stop = { id: 'area:' + step.name, name: step.name, point: project(step.coord), area: true };
  }
  const inChapter = (step, book, chapter) => step.ch.some(([b, c1, , c2]) => b === book && chapter >= c1 && chapter <= c2);
  const atVerse = (step, book, chapter, verse) => step.ch.some(([b, c1, v1, c2, v2]) => b === book && (chapter > c1 || chapter === c1 && verse >= v1) && (chapter < c2 || chapter === c2 && verse <= v2));

  let mode = ['chapter', 'journeys', 'places'].includes(recall('mode')) ? recall('mode') : 'chapter';
  let showNamed = recall('named', 'on') !== 'off';
  let indexPromise, eventsPromise, events = [], journey = null, step = 0, playTimer = null;
  let chapterKey = '', chapterEvents = [], namedStops = [], chapterRequest = 0;
  let selectedId = null, placeQuery = '', placeTestament = 'all', keyOnly = recall('key-only', 'on') !== 'off';
  let fitPending = true;
  let eraChoice = recall('era', 'auto'), boundaries = null, boundariesPromise, selectedArea = null;

  panel.innerHTML = `
    <div class="sm-heading"><h2>Map</h2><div id="sm-ref" class="section-label"></div></div>
    <div class="sm-modes" role="tablist" aria-label="Map view">
      <button type="button" role="tab" data-sm-mode="chapter">This chapter</button>
      <button type="button" role="tab" data-sm-mode="journeys">Journeys &amp; wars</button>
      <button type="button" role="tab" data-sm-mode="places">All places</button>
    </div>
    <div id="sm-controls" class="sm-controls"></div>
    <div class="sm-bounds"><label for="sm-era">Boundaries</label><select id="sm-era"></select></div>
    <div class="sm-map-wrap">
      <canvas id="sm-canvas" tabindex="0" role="img" aria-label="Map"></canvas>
      <div class="sm-zoom" role="group" aria-label="Map zoom">
        <button type="button" id="sm-zoom-in" aria-label="Zoom in" title="Zoom in">+</button>
        <button type="button" id="sm-zoom-out" aria-label="Zoom out" title="Zoom out">−</button>
        <button type="button" id="sm-fit" aria-label="Fit to the route" title="Fit to the route">⤢</button>
      </div>
      <span id="sm-status" class="sm-status" aria-hidden="true"></span>
    </div>
    <div id="sm-era-note" class="sm-era-note"></div>
    <div id="sm-legend" class="sm-legend"></div>
    <div id="sm-body" class="sm-body"></div>
    <p class="hint sm-credit">Routes are traced by hand from the text and drawn as straight lines between places, not roads or sea lanes. Locations follow <a href="https://www.openbible.info/geo/" target="_blank" rel="noopener noreferrer">OpenBible.info</a> (CC BY 4.0), as in the Bible map; some are uncertain.</p>`;
  const $m = id => panel.querySelector('#' + id);
  const canvas = $m('sm-canvas'), controls = $m('sm-controls'), body = $m('sm-body'), legend = $m('sm-legend');

  /* ---------- map view: pan, zoom and offline tiles ---------- */
  let centre = project([35.15, 32.15]), span = 420, bounds = null, frame = null, drag = null, moved = false;
  const tiles = new Map(); let wanted = new Map(), running = 0, queueTimer;
  function draw() { if (!frame) frame = requestAnimationFrame(() => { frame = null; render(); }); }
  function visible() { return !panel.classList.contains('hidden') && canvas.getBoundingClientRect().width > 0; }
  function trimTiles(limit = 28) {
    for (const [key, entry] of tiles) {
      if (tiles.size <= limit) break;
      if (entry.loading || wanted.has(key)) continue;
      entry.image.onload = entry.image.onerror = null; entry.image.src = ''; tiles.delete(key);
    }
  }
  function pumpTiles() {
    for (const [key, job] of wanted) {
      if (running >= 4) break; if (tiles.has(key)) continue;
      const image = new Image(), entry = { image, loading: true, ready: false }; tiles.set(key, entry); running++;
      image.decoding = 'async';
      const done = ready => { entry.loading = false; entry.ready = ready; running--; trimTiles(); draw(); pumpTiles(); };
      image.onload = () => done(true); image.onerror = () => done(false); image.src = job.src;
    }
  }
  function drawTiles(context, view, width, height, theme) {
    const overlap = (a, b) => { const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y), r = Math.min(a.x + a.w, b.x + b.w), d = Math.min(a.y + a.h, b.y + b.h); return r > x && d > y ? { x, y, w: r - x, h: d - y } : null; };
    const cut = (a, b) => {
      const i = overlap(a, b); if (!i) return [a]; const out = [];
      if (i.y > a.y) out.push({ x: a.x, y: a.y, w: a.w, h: i.y - a.y });
      if (i.y + i.h < a.y + a.h) out.push({ x: a.x, y: i.y + i.h, w: a.w, h: a.y + a.h - i.y - i.h });
      if (i.x > a.x) out.push({ x: a.x, y: i.y, w: i.x - a.x, h: i.h });
      if (i.x + i.w < a.x + a.w) out.push({ x: i.x + i.w, y: i.y, w: a.x + a.w - i.x - i.w, h: i.h });
      return out;
    };
    const layers = core.rasterLayers.filter(l => span < l.maxSpan && overlap(view, { x: l.x, y: l.y, w: l.width, h: l.height }));
    let remaining = [view]; const jobs = new Map();
    for (const l of [...layers].reverse()) {
      const rect = { x: l.x, y: l.y, w: l.width, h: l.height }, unit = l.width / l.pw;
      for (const part of remaining) {
        const hit = overlap(part, rect); if (!hit) continue;
        const minX = Math.max(0, Math.floor((hit.x - l.x) / unit / 512)), maxX = Math.min(l.cols - 1, Math.floor((hit.x + hit.w - l.x) / unit / 512));
        const minY = Math.max(0, Math.floor((hit.y - l.y) / unit / 512)), maxY = Math.min(l.rows - 1, Math.floor((hit.y + hit.h - l.y) / unit / 512));
        for (let row = minY; row <= maxY; row++) for (let col = minX; col <= maxX; col++) {
          const key = `${l.id}-terrain-${theme}-${col}-${row}`;
          jobs.set(key, { src: `/atlas/map-fast-${key}.webp`, x: l.x + col * 512 * unit, y: l.y + row * 512 * unit, w: Math.min(512, l.pw - col * 512) * unit, h: Math.min(512, l.ph - row * 512) * unit, level: core.rasterLayers.indexOf(l) });
        }
      }
      remaining = remaining.flatMap(part => cut(part, rect));
    }
    wanted = jobs; let ready = 0;
    for (const [key, job] of [...jobs].sort((a, b) => a[1].level - b[1].level)) {
      const entry = tiles.get(key); if (!entry?.ready) continue;
      ready++; tiles.delete(key); tiles.set(key, entry);
      context.drawImage(entry.image, (job.x - view.x) / view.w * width, (job.y - view.y) / view.h * height, job.w / view.w * width + .1, job.h / view.h * height + .1);
    }
    clearTimeout(queueTimer); queueTimer = setTimeout(pumpTiles, 35);
    return ready < jobs.size;
  }
  function fitPoints(points, minSpan = 70) {
    const rect = canvas.getBoundingClientRect(); if (!rect.width) { fitPending = true; return; }
    fitPending = false;
    if (!points.length) { setRegion(HOLY_LAND); return; }
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]), ratio = rect.width / Math.max(rect.height, 1);
    centre = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
    span = Math.max(minSpan, (Math.max(...xs) - Math.min(...xs)) * 1.3, (Math.max(...ys) - Math.min(...ys)) * ratio * 1.35);
    draw();
  }
  function setRegion([west, south, east, north]) { fitPoints([project([west, north]), project([east, south])], 1); }
  function zoom(factor, anchor = [.5, .5]) {
    const before = span; span = Math.max(4, Math.min(9000, span * factor));
    if (bounds) { centre[0] += (anchor[0] - .5) * (before - span); centre[1] += (anchor[1] - .5) * bounds.h * (1 - span / before); }
    draw();
  }
  function ensureVisible(point) {
    const rect = canvas.getBoundingClientRect(); if (!rect.width) return;
    const h = span * rect.height / rect.width, bounds = { x: centre[0] - span / 2, y: centre[1] - h / 2, w: span, h };
    const inside = point[0] > bounds.x + bounds.w * .12 && point[0] < bounds.x + bounds.w * .88 && point[1] > bounds.y + bounds.h * .12 && point[1] < bounds.y + bounds.h * .88;
    if (!inside) { centre = [...point]; draw(); }
  }
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    zoom(Math.exp(Math.max(-.35, Math.min(.35, event.deltaY * .0015))), [(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height]);
  }, { passive: false });
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    moved = false; drag = { x: event.clientX, y: event.clientY, centre: [...centre], rect: canvas.getBoundingClientRect(), w: bounds?.w, h: bounds?.h };
    canvas.setPointerCapture(event.pointerId); canvas.classList.add('sm-dragging');
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag || !bounds) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) moved = true;
    if (moved) { centre = [drag.centre[0] - dx / drag.rect.width * drag.w, drag.centre[1] - dy / drag.rect.height * drag.h]; draw(); }
  });
  canvas.addEventListener('pointerup', event => {
    if (!drag) return;
    const click = !moved; drag = null; canvas.classList.remove('sm-dragging');
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (click && bounds) {
      const rect = canvas.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
      let nearest = null, distance = Infinity;
      for (const marker of lastMarkers) {
        const d = Math.hypot(marker.sx - x, marker.sy - y);
        if (d < distance) { nearest = marker; distance = d; }
      }
      if (nearest && distance < 16) choose(nearest.id, false); else pickArea(x, y);
    }
  });
  canvas.addEventListener('pointercancel', () => { drag = null; canvas.classList.remove('sm-dragging'); });
  canvas.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const n = span * .12;
    const action = { ArrowLeft: () => centre[0] -= n, ArrowRight: () => centre[0] += n, ArrowUp: () => centre[1] -= n, ArrowDown: () => centre[1] += n,
      '+': () => zoom(.7), '=': () => zoom(.7), '-': () => zoom(1 / .7), Home: fit }[event.key];
    if (action) { event.preventDefault(); event.stopPropagation(); action(); draw(); }
  });
  $m('sm-zoom-in').onclick = () => zoom(.7);
  $m('sm-zoom-out').onclick = () => zoom(1 / .7);
  $m('sm-fit').onclick = () => fit();
  new ResizeObserver(() => { if (visible()) { if (fitPending) fit(); else draw(); } }).observe(canvas);
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------- boundaries by period ---------- */
  const ERA_NAMES = { tribes: 'Twelve tribes', united: 'United kingdom', divided: 'Israel and Judah', persian: 'Persian provinces', nt: 'Time of Jesus' };
  const AREA_COLORS = ['#c0843d', '#4f7fa8', '#7a9a3e', '#a3567a', '#3f8f86', '#b5652f', '#6a6bb0', '#8c7a2e', '#4f9a5f', '#b04a4a', '#5e8fbf', '#9b6a3c', '#7d5fa3'];
  function loadBoundaries() {
    if (!boundariesPromise) boundariesPromise = fetch('/atlas/scripture-boundaries.json').then(r => { if (!r.ok) throw Error('The boundaries could not be opened.'); return r.json(); })
      .then(data => { boundaries = data; for (const era of data.eras) for (const a of era.areas) { a.projected = a.parts.map(part => part.map(project)); a.labelPoint = project(a.label); } draw(); renderEraNote(); return data; })
      .catch(e => { boundariesPromise = null; throw e; });
    return boundariesPromise;
  }
  // The period that fits a passage, for the automatic setting.
  function eraFor(book, chapter) {
    const ot = ['Gen', 'Exo', 'Lev', 'Num', 'Deu', 'Job'], tribes = ['Jos', 'Jdg', 'Rut'], persian = ['Ezr', 'Neh', 'Est', 'Hag', 'Zec', 'Mal'];
    const nt = state.meta?.books.find(b => b.code === book)?.testament === 'NT';
    if (nt) return 'nt';
    if (ot.includes(book)) return null;
    if (tribes.includes(book)) return 'tribes';
    if (persian.includes(book)) return 'persian';
    if (['1Sa', '2Sa', '1Ch', 'Psa', 'Pro', 'Ecc', 'Sol'].includes(book) || book === '1Ki' && chapter <= 11 || book === '2Ch' && chapter <= 9) return 'united';
    return 'divided';
  }
  function currentEra() {
    if (!boundaries || eraChoice === 'off') return null;
    let id = eraChoice;
    if (id === 'auto') {
      if (mode === 'journeys' && journey) { const [b, c] = journey.steps[0].ch[0]; id = eraFor(b, c); }
      else id = eraFor(state.book, state.chapter);
    }
    return boundaries.eras.find(e => e.id === id) || null;
  }
  const eraSelect = $m('sm-era');
  eraSelect.append(new Option('Automatic (by book)', 'auto'), new Option('Off', 'off'));
  for (const [id, label] of Object.entries(ERA_NAMES)) eraSelect.append(new Option(label, id));
  eraSelect.value = [...eraSelect.options].some(o => o.value === eraChoice) ? eraChoice : 'auto';
  eraSelect.onchange = () => { eraChoice = eraSelect.value; store('era', eraChoice); selectedArea = null; loadBoundaries().catch(() => {}); renderEraNote(); draw(); };
  function timelineButton(id, label = 'Show on Timeline ↗') {
    const entry = window.ScriptoriumTimeline?.entry(id); if (!entry) return null;
    const b = el('button', { type: 'button', class: 'quiet sm-timeline', title: `${entry.title} · ${window.ScriptoriumTimeline.dateText(entry)} in the BibleWorks timeline` }, label);
    b.onclick = () => window.ScriptoriumTimeline.open(id);
    return b;
  }
  function timelineDate(ids) {
    const entry = (ids || []).map(id => window.ScriptoriumTimeline?.entry(id)).find(Boolean);
    return entry ? window.ScriptoriumTimeline.dateText(entry) : '';
  }
  function renderEraNote() {
    const host = $m('sm-era-note'); host.replaceChildren();
    const era = currentEra(); if (!era) { if (eraChoice !== 'off' && boundaries && eraChoice === 'auto') host.append(el('span', { class: 'hint' }, 'No boundaries are drawn for this book. Choose a period above to show one.')); return; }
    const area = selectedArea && era.areas.includes(selectedArea) ? selectedArea : null;
    const line = el('p', {});
    line.append(el('b', {}, area ? area.name : era.title), document.createTextNode(area ? ` · ${era.title}` : ` · ${era.span} · approximate borders`));
    host.append(line);
    if (area) {
      if (area.note) host.append(el('p', { class: 'hint' }, area.note));
      if (area.refs?.length) host.append(refChips(area.refs));
    } else {
      host.append(el('p', { class: 'hint' }, era.note + ' Click an area for its references.'));
      const t = timelineButton(era.timeline); if (t) host.append(t);
    }
  }
  function inside(point, poly) {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > point[1]) !== (yj > point[1]) && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  }
  function pickArea(x, y) {
    const era = currentEra(); if (!era || !bounds) return;
    const rect = canvas.getBoundingClientRect(), point = [bounds.x + x / rect.width * bounds.w, bounds.y + y / rect.height * bounds.h];
    const found = [...era.areas].reverse().find(a => a.projected.some(part => inside(point, part)));
    selectedArea = found && found !== selectedArea ? found : null;
    renderEraNote(); draw();
  }
  function drawBoundaries(context, screen, c, dark, boxes, width, height) {
    const era = currentEra(); if (!era) return;
    for (const a of era.areas) {
      const neighbour = a.kind === 'neighbour', color = neighbour ? (dark ? '#9aa59a' : '#7c857c') : AREA_COLORS[a.color % AREA_COLORS.length];
      const chosen = a === selectedArea;
      context.beginPath();
      for (const part of a.projected) { part.forEach((p, i) => { const [x, y] = screen(p); i ? context.lineTo(x, y) : context.moveTo(x, y); }); context.closePath(); }
      context.fillStyle = fade(color, chosen ? .34 : neighbour ? .08 : dark ? .2 : .16); context.fill('evenodd');
      if (a.kind !== 'kingdom' || chosen) {
        context.setLineDash(neighbour ? [3, 4] : [6, 4]); context.lineWidth = chosen ? 2.4 : 1.3;
        context.strokeStyle = fade(color, chosen ? .95 : neighbour ? .45 : .7); context.stroke(); context.setLineDash([]);
      }
    }
    // Area names: spaced capitals, drawn first so place names can sit on top.
    context.textAlign = 'center'; context.textBaseline = 'middle';
    for (const a of era.areas) {
      const [x, y] = screen(a.labelPoint); if (x < 10 || y < 10 || x > width - 10 || y > height - 10) continue;
      const neighbour = a.kind === 'neighbour', color = neighbour ? (dark ? '#c4ccc2' : '#626b63') : AREA_COLORS[a.color % AREA_COLORS.length];
      const size = a.kind === 'kingdom' ? 13 : 10.5;
      context.font = `${neighbour ? 'italic ' : ''}700 ${size}px system-ui, sans-serif`;
      try { context.letterSpacing = '1.5px'; } catch {}
      const text = a.name.toUpperCase(), w = context.measureText(text).width, box = [x - w / 2 - 2, y - size / 2 - 2, x + w / 2 + 2, y + size / 2 + 2];
      if (boxes.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) { try { context.letterSpacing = '0px'; } catch {} continue; }
      boxes.push(box);
      context.lineWidth = 3; context.strokeStyle = c.halo; context.strokeText(text, x, y);
      context.fillStyle = dark ? fade(color === '#626b63' ? '#c4ccc2' : color, .95) : color; context.fillText(text, x, y);
      try { context.letterSpacing = '0px'; } catch {}
    }
  }

  /* ---------- drawing ---------- */
  let lastMarkers = [];
  function colors(dark) {
    return { route: dark ? '#e3bf78' : '#8f5a22', faint: dark ? 'rgba(227,191,120,.33)' : 'rgba(143,90,34,.3)',
      enemy: dark ? '#f0897b' : '#b2392b', enemyFaint: dark ? 'rgba(240,137,123,.35)' : 'rgba(178,57,43,.3)',
      palette: dark ? ['#e3bf78', '#8cc4e0', '#c8adf0', '#8fd4b4'] : ['#8f5a22', '#2c6a8a', '#6b4f9c', '#2a7a5e'],
      marker: dark ? '#b4ceb8' : '#284b3c', markerText: dark ? '#17201b' : '#ffffff', ring: dark ? '#f1d08a' : '#c08a2c',
      ink: dark ? '#eef0df' : '#25352f', muted: dark ? '#b8c2b5' : '#5d6a61', halo: dark ? 'rgba(23,32,27,.88)' : 'rgba(250,248,243,.92)',
      ot: dark ? '#d3a173' : '#a26333', nt: dark ? '#94bfd8' : '#376e8a', both: dark ? '#b6ce91' : '#48724c', sea: dark ? '#223a3e' : '#dce9e7', edge: dark ? '#1e2722' : '#ffffff' };
  }
  const fade = (hex, alpha) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${alpha})`; };
  // Lines for one event. `solid(i)` decides which legs are drawn strongly.
  function eventLegs(event, color, solid) {
    if (event.route === false) return [];
    const legs = [];
    event.steps.forEach((s, i) => {
      if (!i || s.jump) return;
      legs.push({ from: stopOf(event.steps[i - 1]).point, to: stopOf(s).point, sea: !!s.sea, enemy: !!s.enemy, color, done: solid(i) });
    });
    return legs;
  }
  function overlay(c) {
    const verse = state.verse;
    if (mode === 'chapter') {
      const legs = [], markers = [];
      chapterEvents.forEach((item, n) => {
        const color = c.palette[n % c.palette.length];
        legs.push(...eventLegs(item.event, color, i => item.indexes.includes(i)));
        // One marker per place: a place visited twice in the chapter shows both step numbers.
        const here = new Map(), faint = new Set();
        item.indexes.forEach((i, k) => {
          const s = item.event.steps[i], stop = stopOf(s);
          if (!here.has(stop.id)) here.set(stop.id, { id: stop.id, point: stop.point, name: stop.name, style: 'numbered', number: k + 1, numbers: [], color: s.enemy ? c.enemy : color, battle: false, current: false, selected: selectedId === stop.id });
          const m = here.get(stop.id); m.numbers.push(k + 1); m.battle ||= !!s.battle; m.current ||= atVerse(s, state.book, state.chapter, verse);
        });
        for (const m of here.values()) markers.push({ ...m, label: m.numbers.length > 1 ? `${m.name} (${m.numbers.join(', ')})` : m.name });
        item.event.steps.forEach(s => {
          const stop = stopOf(s);
          if (here.has(stop.id) || faint.has(stop.id)) return;
          faint.add(stop.id); markers.push({ id: stop.id, point: stop.point, label: stop.name, style: 'dot', color, faint: true });
        });
      });
      if (showNamed || !chapterEvents.length) for (const n of namedStops) markers.push({ id: n.p.id, point: pointOf(n.p), label: nameOf(n.p), style: 'named', broad: isBroad(n.p), current: n.verses.includes(verse), selected: selectedId === n.p.id });
      return { legs, markers };
    }
    if (mode === 'journeys' && journey) {
      const legs = eventLegs(journey, c.route, i => i <= step), markers = [], seen = new Map();
      journey.steps.forEach((s, i) => {
        const stop = stopOf(s);
        if (!seen.has(stop.id)) { const m = { id: stop.id, point: stop.point, label: stop.name, style: 'dot', color: s.enemy ? c.enemy : c.route, visited: false, battle: false }; seen.set(stop.id, m); markers.push(m); }
        const m = seen.get(stop.id); m.visited ||= i <= step; m.battle ||= !!s.battle && i <= step;
        if (i === step) Object.assign(m, { style: 'numbered', number: i + 1, current: true, color: s.enemy ? c.enemy : c.marker });
      });
      return { legs, markers };
    }
    if (mode === 'places') return { legs: [], markers: filteredPlaces().map(p => ({ id: p.id, point: pointOf(p), label: nameOf(p), style: 'testament', place: p, selected: p.id === selectedId })) };
    return { legs: [], markers: [] };
  }
  function arrow(context, a, b, color) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]); if (length < 34) return;
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    context.save(); context.translate(mx, my); context.rotate(angle);
    context.beginPath(); context.moveTo(5.5, 0); context.lineTo(-4.5, -4.5); context.lineTo(-4.5, 4.5); context.closePath();
    context.fillStyle = color; context.fill(); context.restore();
  }
  // Two crossed swords, drawn beside a place where a battle or siege happened.
  function swords(context, x, y, c) {
    context.save(); context.translate(x, y); context.lineCap = 'round';
    for (const [pass, width, color] of [[0, 4.6, c.halo], [1, 1.9, c.enemy]]) {
      context.strokeStyle = color; context.lineWidth = width;
      for (const sign of [1, -1]) {
        context.beginPath(); context.moveTo(-5.5 * sign, -5.5); context.lineTo(5 * sign, 5); context.stroke();
        context.beginPath(); context.moveTo(-5 * sign, 2); context.lineTo(-2 * sign, 5); context.stroke();
      }
    }
    context.restore();
  }
  function render() {
    if (!visible()) return;
    const rect = canvas.getBoundingClientRect(), width = rect.width, height = rect.height; if (!width || !height) return;
    const dpi = Math.min(window.devicePixelRatio || 1, 2), pw = Math.round(width * dpi), ph = Math.round(height * dpi);
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    const context = canvas.getContext('2d', { alpha: false }); context.setTransform(dpi, 0, 0, dpi, 0, 0);
    span = Math.max(4, Math.min(9000, span));
    const h = span * height / width, s = span / width;
    bounds = { x: centre[0] - span / 2, y: centre[1] - h / 2, w: span, h };
    const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light', c = colors(theme === 'dark');
    context.fillStyle = c.sea; context.fillRect(0, 0, width, height);
    const loading = drawTiles(context, bounds, width, height, theme);
    const screen = p => [(p[0] - bounds.x) / s, (p[1] - bounds.y) / s];
    const boxes = [[width - 46, 0, width, 118], [0, height - 28, 150, height]];
    drawBoundaries(context, screen, c, theme === 'dark', boxes, width, height);
    const data = overlay(c);
    context.lineCap = 'round'; context.lineJoin = 'round';
    const legs = [...data.legs].sort((a, b) => a.done - b.done);
    for (const pass of ['halo', 'line']) for (const leg of legs) {
      const a = screen(leg.from), b = screen(leg.to);
      context.beginPath(); context.moveTo(...a); context.lineTo(...b);
      context.setLineDash(leg.sea ? [7, 6] : []);
      const color = leg.enemy ? c.enemy : leg.color;
      if (pass === 'halo') { context.strokeStyle = c.halo; context.lineWidth = leg.done ? 6 : 4; }
      else { context.strokeStyle = leg.done ? color : fade(color, .34); context.lineWidth = leg.done ? 3 : 2; }
      context.stroke();
    }
    context.setLineDash([]);
    for (const leg of legs) if (leg.done) arrow(context, screen(leg.from), screen(leg.to), leg.enemy ? c.enemy : leg.color);
    lastMarkers = [];
    const markers = data.markers.filter(m => { const [x, y] = screen(m.point); m.sx = x; m.sy = y; return x > -20 && y > -20 && x < width + 20 && y < height + 20; });
    const priority = m => (m.selected ? 8 : 0) + (m.current ? 6 : 0) + (m.style === 'numbered' ? 4 : 0) + (m.style === 'dot' && !m.faint ? 2 : 0) + (m.style === 'named' ? -1 : 0) + (m.place?.key ? 1 : 0) + (m.place ? Math.min(m.place.refCount, 400) / 1000 : 0);
    markers.sort((a, b) => priority(a) - priority(b));
    for (const m of markers) {
      const x = m.sx, y = m.sy; lastMarkers.push({ id: m.id, sx: x, sy: y });
      if (m.style === 'numbered') {
        const r = m.current || m.selected ? 10.5 : 9.5;
        if (m.current || m.selected) { context.beginPath(); context.arc(x, y, r + 4, 0, Math.PI * 2); context.strokeStyle = c.ring; context.lineWidth = 3; context.stroke(); }
        context.beginPath(); context.arc(x, y, r, 0, Math.PI * 2); context.fillStyle = m.color || c.marker; context.fill();
        context.lineWidth = 1.6; context.strokeStyle = c.edge; context.stroke();
        context.fillStyle = theme === 'dark' ? '#17201b' : '#ffffff'; context.font = `700 ${m.number > 9 ? 9.5 : 11}px system-ui, sans-serif`; context.textAlign = 'center'; context.textBaseline = 'middle';
        context.fillText(String(m.number), x, y + .5);
      } else if (m.style === 'dot') {
        context.beginPath(); context.arc(x, y, m.faint ? 3.5 : 5, 0, Math.PI * 2);
        context.fillStyle = m.faint ? fade(m.color, .55) : m.visited ? m.color : c.edge; context.fill();
        context.lineWidth = 1.5; context.strokeStyle = m.faint ? c.edge : m.visited ? c.edge : m.color; context.stroke();
      } else if (m.style === 'named') {
        context.beginPath(); context.arc(x, y, m.current || m.selected ? 5 : 3.5, 0, Math.PI * 2);
        context.setLineDash(m.broad ? [2, 2] : []); context.lineWidth = 1.4; context.strokeStyle = m.current || m.selected ? c.ring : c.muted;
        if (!m.broad) { context.fillStyle = fade(c.muted, .7); context.fill(); } context.stroke(); context.setLineDash([]);
      } else {
        const p = m.place, color = p.ot && p.nt ? c.both : p.nt ? c.nt : c.ot;
        if (m.selected) { context.beginPath(); context.arc(x, y, 10, 0, Math.PI * 2); context.strokeStyle = c.ring; context.lineWidth = 3; context.stroke(); }
        context.beginPath(); context.arc(x, y, m.selected ? 6 : p.key ? 4.5 : 3.5, 0, Math.PI * 2); context.fillStyle = color; context.fill();
        context.lineWidth = 1.2; context.strokeStyle = c.edge; context.setLineDash(p.uncertain ? [2, 2] : []); context.stroke(); context.setLineDash([]);
      }
      if (m.battle) swords(context, x + 12, y - 11, c);
    }
    const labelled = [...markers].reverse();
    context.textBaseline = 'alphabetic'; context.lineJoin = 'round';
    const label = (m, size = 12) => {
      const bold = m.selected || m.current, quiet = m.style === 'named' || m.faint;
      const text = m.label, x = m.sx, y = m.sy;
      context.font = `${m.broad ? 'italic ' : ''}${bold ? '700' : quiet ? '400' : '600'} ${quiet ? size - 1 : size}px system-ui, sans-serif`;
      const w = context.measureText(text).width, gap = m.battle ? 22 : 13;
      for (const [dx, align] of [[gap, 'left'], [-13, 'right']]) {
        const left = align === 'left' ? x + dx : x + dx - w, box = [left - 2, y - size + 1, left + w + 2, y + 5];
        if (box[0] < 2 || box[2] > width - 2 || box[1] < 2 || box[3] > height - 2) continue;
        if (!bold && boxes.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
        boxes.push(box); context.textAlign = 'left';
        context.lineWidth = 3.5; context.strokeStyle = c.halo; context.strokeText(text, left, y + 4); context.fillStyle = quiet ? c.muted : c.ink; context.fillText(text, left, y + 4);
        return true;
      }
      return false;
    };
    let count = 0; const limit = mode === 'places' ? 45 : 60;
    for (const m of labelled) { if (count >= limit && !m.selected && !m.current) break; if (label(m)) count++; }
    const km = span / 100 * 111.32 * Math.cos(Math.atan(Math.sinh(-centre[1] * Math.PI / 18000)));
    $m('sm-status').textContent = `≈ ${km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString()} km across${loading ? ' · loading…' : ''}`;
    canvas.setAttribute('aria-label', mapDescription());
  }
  function mapDescription() {
    if (mode === 'chapter') return chapterEvents.length ? `Map tracing ${chapterEvents.map(e => e.event.title).join('; ')} in ${bookName(state.book)} ${state.chapter}. The list below gives each step.` : `Map of places named in ${bookName(state.book)} ${state.chapter}.`;
    if (mode === 'journeys' && journey) return `Map of ${journey.title}, step ${step + 1} of ${journey.steps.length}: ${stopOf(journey.steps[step]).name}.`;
    return 'Map of biblical places. Use the list below to find and select places.';
  }

  /* ---------- data ---------- */
  function loadIndex() {
    if (!indexPromise) indexPromise = fetch('/atlas/verse-places.json').then(r => { if (!r.ok) throw Error('The chapter places could not be opened.'); return r.json(); }).catch(e => { indexPromise = null; throw e; });
    return indexPromise;
  }
  function loadEvents() {
    if (!eventsPromise) eventsPromise = fetch('/atlas/scripture-journeys.json').then(r => { if (!r.ok) throw Error('The journeys could not be opened.'); return r.json(); })
      .then(data => { events = data.events.filter(e => e.steps.every(s => s.coord || byId.has(s.place))); return events; })
      .catch(e => { eventsPromise = null; throw e; });
    return eventsPromise;
  }
  async function loadChapter() {
    const key = state.book + '/' + state.chapter, request = ++chapterRequest;
    if (key === chapterKey) return;
    const [index] = await Promise.all([loadIndex(), loadEvents()]);
    if (request !== chapterRequest) return;
    chapterEvents = events.map(event => ({ event, indexes: event.steps.map((s, i) => inChapter(s, state.book, state.chapter) ? i : -1).filter(i => i >= 0) })).filter(item => item.indexes.length);
    const traced = new Set(chapterEvents.flatMap(item => item.event.steps.map(s => s.place)));
    const verses = index.chapters[key] || {}, seen = new Map();
    for (const verse of Object.keys(verses).map(Number).sort((a, b) => a - b)) for (const i of verses[verse]) {
      const p = byId.get(index.placeIds[i]); if (!p || traced.has(p.id)) continue;
      if (!seen.has(p.id)) seen.set(p.id, { p, verses: [] });
      const named = seen.get(p.id); if (!named.verses.includes(verse)) named.verses.push(verse);
    }
    namedStops = [...seen.values()];
    chapterKey = key; selectedId = null; fitPending = true;
  }

  /* ---------- panel content ---------- */
  function setMode(next, keep = false) {
    mode = next; store('mode', next); stop(); if (!keep) selectedId = null; fitPending = true;
    panel.querySelectorAll('[data-sm-mode]').forEach(b => { const on = b.dataset.smMode === mode; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    return refresh();
  }
  panel.querySelectorAll('[data-sm-mode]').forEach(b => {
    b.onclick = () => setMode(b.dataset.smMode);
    b.onkeydown = event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const tabs = [...panel.querySelectorAll('[data-sm-mode]')], i = tabs.indexOf(b) + (event.key === 'ArrowRight' ? 1 : -1);
      const next = tabs[(i + tabs.length) % tabs.length]; setMode(next.dataset.smMode); next.focus();
    };
  });
  function fit() {
    if (mode === 'chapter') {
      if (chapterEvents.length) {
        // The chapter's own steps, plus the place each one was reached from.
        const points = chapterEvents.flatMap(item => item.indexes.flatMap(i => [stopOf(item.event.steps[i]).point, ...(i && !item.event.steps[i].jump ? [stopOf(item.event.steps[i - 1]).point] : [])]));
        fitPoints(points, 70);
      } else {
        const near = namedStops.filter(n => !isBroad(n.p)).map(n => pointOf(n.p));
        if (near.length) fitPoints(near, 70); else if (namedStops.length) fitPoints(namedStops.map(n => pointOf(n.p)), 300); else setRegion(HOLY_LAND);
      }
    } else if (mode === 'journeys' && journey) fitPoints(journey.steps.map(s => stopOf(s).point), 80);
    else if (mode === 'places') { const list = filteredPlaces(); placeQuery && list.length && list.length < 40 ? fitPoints(list.map(pointOf), 70) : setRegion(placeTestament === 'nt' ? [12, 29.5, 37, 42] : HOLY_LAND); }
    else setRegion(HOLY_LAND);
  }
  async function refresh() {
    const ref = $m('sm-ref');
    controls.replaceChildren(); body.replaceChildren(); legend.replaceChildren();
    try {
      if (mode === 'chapter') {
        ref.textContent = state.meta ? `${bookName(state.book)} ${state.chapter}`.toUpperCase() : '';
        await loadChapter(); renderChapter();
      } else if (mode === 'journeys') {
        ref.textContent = 'JOURNEYS, WARS & MIGRATIONS';
        await loadEvents(); renderJourneys();
      } else {
        ref.textContent = 'WHERE THE PLACES WERE';
        renderPlaces();
      }
    } catch (error) {
      body.append(el('p', { class: 'hint' }, error.message || 'The map could not be opened.'));
    }
    selectedArea = null; renderEraNote();
    if (eraChoice !== 'off') loadBoundaries().catch(() => {});
    if (fitPending) fit(); else draw();
  }
  function goToVerse(verse) {
    if (typeof selectVerse === 'function') selectVerse(verse);
    document.getElementById('verse-' + verse)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function reveal(item) {
    const list = item?.closest('.sm-scroll'); if (!list) return;
    const top = item.offsetTop - list.offsetTop, bottom = top + item.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top - 4;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight + 4;
  }
  function choose(id, fromList = true) {
    if (mode === 'journeys' && journey) {
      const index = journey.steps.findIndex((s, i) => i >= step && stopOf(s).id === id), first = journey.steps.findIndex(s => stopOf(s).id === id);
      const target = index >= 0 ? index : first;
      if (target >= 0) { stop(); setStep(target); }
      return;
    }
    selectedId = selectedId === id && fromList ? null : id;
    const p = byId.get(id);
    if (p && selectedId) ensureVisible(pointOf(p));
    if (mode === 'places') { if (p && selectedId && span > 260) { centre = [...pointOf(p)]; span = 220; } renderPlaces(false); }
    else body.querySelectorAll('[data-place]').forEach(item => { const on = item.dataset.place === selectedId; item.classList.toggle('selected', on); if (on && !fromList) reveal(item); });
    draw();
  }
  function refChips(refs) {
    const host = el('span', { class: 'sm-refs' });
    try { window.ScriptoriumReferences.render(host, refs); } catch { host.textContent = refs.join('; '); }
    return host;
  }
  function kindBadge(event) { return el('span', { class: 'sm-badge sm-badge-' + event.kind }, KINDS[event.kind]); }
  async function openEvent(event, index = 0) {
    journey = event; store('journey', event.id); step = index;
    await setMode('journeys', true);
  }

  let photoToken = 0;
  function renderChapter() {
    const reference = `${bookName(state.book)} ${state.chapter}`;
    const namedToggle = el('label', { class: 'sm-check' }); const box = el('input', { type: 'checkbox' }); box.checked = showNamed;
    box.onchange = () => { showNamed = box.checked; store('named', showNamed ? 'on' : 'off'); draw(); };
    namedToggle.append(box, document.createTextNode(' Show other places named'));
    if (chapterEvents.length) controls.append(namedToggle);
    const keys = ['<span><i class="sm-key-route"></i> Route in this chapter</span>', '<span><i class="sm-key-ahead"></i> Before and after</span>'];
    if (chapterEvents.some(item => item.event.steps.some(s => s.enemy))) keys.push('<span><i class="sm-key-enemy"></i> Enemy or foreign forces</span>');
    if (chapterEvents.some(item => item.indexes.some(i => item.event.steps[i].battle))) keys.push('<span><i class="sm-key-battle">⚔</i> Battle or siege</span>');
    if (chapterEvents.some(item => item.event.steps.some(s => s.sea))) keys.push('<span><i class="sm-key-sea"></i> By sea</span>');
    keys.push('<span><i class="sm-key-ring"></i> Selected verse</span>');
    if (chapterEvents.length) legend.innerHTML = keys.join('');
    if (!chapterEvents.length) {
      body.append(el('p', { class: 'sm-empty' }, `No journey, battle or migration is traced in ${reference}.`));
      body.append(el('p', { class: 'hint' }, namedStops.length ? 'The places this chapter names are shown on the map without routes. The Journeys & wars tab lists every traced event.' : 'This chapter names no places. The Journeys & wars tab lists every traced event.'));
    }
    chapterEvents.forEach((item, n) => {
      const { event, indexes } = item;
      const card = el('section', { class: 'sm-event', style: `--sm-event:var(--sm-event-${n % 4})` });
      const head = el('div', { class: 'sm-event-head' });
      const title = el('h3', {}); title.append(el('span', { class: 'sm-swatch', 'aria-hidden': 'true' }), document.createTextNode(event.title));
      head.append(title, kindBadge(event));
      const date = timelineDate(event.timeline);
      card.append(head, el('p', { class: 'sm-event-intro' }, `${event.span}${date ? ' · ' + date : ''}. ${event.intro}`));
      const list = el('ol', { class: 'sm-list' });
      indexes.forEach((i, k) => {
        const s = event.steps[i], stopInfo = stopOf(s);
        const li = el('li', { class: 'sm-item' + (atVerse(s, state.book, state.chapter, state.verse) ? ' current' : ''), 'data-place': stopInfo.id, 'data-step': String(i) });
        const main = el('button', { type: 'button', class: 'sm-place', title: 'Show on the map' });
        main.append(el('span', { class: 'sm-number' + (s.enemy ? ' enemy' : ''), 'aria-hidden': 'true' }, String(k + 1)),
          el('span', { class: 'sm-name' }, stopInfo.name + (s.battle ? ' ⚔' : '')), el('span', { class: 'sm-note' }, s.note));
        main.onclick = () => choose(stopInfo.id);
        li.append(main, refChips(s.refs)); list.append(li);
      });
      card.append(list);
      const follow = el('button', { type: 'button', class: 'quiet sm-follow' }, event.route === false ? 'See all the places →' : `Follow the whole ${event.kind === 'war' ? 'campaign' : event.kind === 'tribes' ? 'movement' : 'journey'} (${event.steps.length} steps) →`);
      follow.onclick = () => openEvent(event, indexes[0]);
      const actions = el('div', { class: 'sm-actions' }); const t = timelineButton(event.timeline?.[0]); if (t) actions.append(t); actions.append(follow);
      card.append(actions);
      body.append(card);
    });
    if (namedStops.length) {
      const details = el('details', { class: 'sm-named' }); if (!chapterEvents.length) details.open = true;
      details.append(el('summary', {}, `${chapterEvents.length ? 'Other places' : 'Places'} named in ${reference} (${namedStops.length})`));
      const ul = el('ul', { class: 'sm-list sm-compact sm-scroll' });
      for (const n of namedStops) {
        const li = el('li', { class: 'sm-item' + (n.verses.includes(state.verse) ? ' current' : ''), 'data-place': n.p.id });
        const b = el('button', { type: 'button', class: 'sm-place' });
        b.append(el('span', { class: isBroad(n.p) ? 'sm-area-mark' : 'sm-dot named', 'aria-hidden': 'true' }), el('span', { class: 'sm-name' }, nameOf(n.p)), el('span', { class: 'sm-kind' }, n.p.kind + (n.p.uncertain ? ' · location uncertain' : '')));
        b.onclick = () => { if (!showNamed && chapterEvents.length) { showNamed = true; box.checked = true; store('named', 'on'); } choose(n.p.id); };
        const verses = el('span', { class: 'sm-verses', 'aria-label': 'Verses' });
        for (const v of n.verses.slice(0, 10)) { const vb = el('button', { type: 'button', title: `Go to ${reference}:${v}` }, 'v. ' + v); vb.onclick = () => goToVerse(v); verses.append(vb); }
        li.append(b, verses); ul.append(li);
      }
      details.append(ul); body.append(details);
    }
    // Photos of the places this chapter names or traces (loaded after the list, so the map is never kept waiting).
    const chapterPlaces = [...chapterEvents.flatMap(item => item.indexes.map(i => { const s = stopOf(item.event.steps[i]); return byId.get(s.id) || s; })), ...namedStops.map(n => n.p)];
    const token = ++photoToken, here = body;
    // (The strip of photographs that used to follow was removed with the photographs.)
  }

  function renderJourneys() {
    if (!journey) journey = events.find(e => e.id === recall('journey')) || events[0];
    controls.replaceChildren();
    const select = el('select', { 'aria-label': 'Choose a journey, war or migration' });
    for (const [label, test] of [['Journeys — Old Testament', e => e.kind === 'people' && e.testament === 'OT'], ['Journeys — New Testament', e => e.kind === 'people' && e.testament === 'NT'],
      ['Wars and battles', e => e.kind === 'war'], ['Movements of tribes and nations', e => e.kind === 'tribes']]) {
      const group = el('optgroup', { label });
      for (const e of events.filter(test)) group.append(new Option(e.title, e.id, false, e === journey));
      if (group.children.length) select.append(group);
    }
    select.onchange = () => { stop(); journey = events.find(e => e.id === select.value); store('journey', journey.id); step = 0; fitPending = true; selectedArea = null; renderJourneys(); renderEraNote(); fit(); };
    const nav = el('div', { class: 'sm-stepper', role: 'group', 'aria-label': 'Steps' });
    const first = el('button', { type: 'button', 'aria-label': 'First step', title: 'Back to the start' }, 'Start');
    const prev = el('button', { type: 'button', 'aria-label': 'Previous step', title: 'Previous step (←)' }, '◀');
    const counter = el('span', { class: 'sm-counter', role: 'status', 'aria-live': 'polite' });
    const next = el('button', { type: 'button', 'aria-label': 'Next step', title: 'Next step (→)' }, '▶');
    const play = el('button', { type: 'button', class: 'sm-play' }, 'Play');
    first.onclick = () => { stop(); setStep(0); };
    prev.onclick = () => { stop(); setStep(step - 1); };
    next.onclick = () => { stop(); setStep(step + 1); };
    play.onclick = () => { if (playTimer) stop(); else { if (step >= journey.steps.length - 1) setStep(0); playTimer = setInterval(() => { if (step >= journey.steps.length - 1) stop(); else setStep(step + 1); }, 1800); play.textContent = 'Pause'; } };
    nav.append(first, prev, counter, next, play);
    controls.append(select, nav);
    const keys = journey.route === false ? ['<span><i class="sm-key-number">1</i> Selected place</span>'] : ['<span><i class="sm-key-route"></i> Travelled</span>', '<span><i class="sm-key-ahead"></i> Still to come</span>'];
    if (journey.steps.some(s => s.enemy)) keys.push('<span><i class="sm-key-enemy"></i> Enemy or foreign forces</span>');
    if (journey.steps.some(s => s.battle)) keys.push('<span><i class="sm-key-battle">⚔</i> Battle or siege</span>');
    if (journey.steps.some(s => s.sea)) keys.push('<span><i class="sm-key-sea"></i> By sea</span>');
    legend.innerHTML = keys.join('');
    const date = timelineDate(journey.timeline);
    const intro = el('div', { class: 'sm-event-head' }); intro.append(el('p', { class: 'sm-summary' }, `${journey.span}${date ? ' · ' + date : ''}. ${journey.intro}`), kindBadge(journey));
    body.replaceChildren(intro);
    if (journey.timeline?.length) { const links = el('div', { class: 'sm-actions sm-timeline-links' }); for (const id of journey.timeline) { const entry = window.ScriptoriumTimeline?.entry(id); const b = entry && timelineButton(id, `${entry.title.replace(/^\(-?\?\)\s*/, '')} on Timeline ↗`); if (b) links.append(b); } if (links.children.length) body.append(links); }
    const list = el('ol', { class: 'sm-list sm-steps sm-scroll', 'aria-label': journey.title });
    journey.steps.forEach((s, i) => {
      const stopInfo = stopOf(s);
      const li = el('li', { class: 'sm-item', 'data-step': String(i), 'data-place': stopInfo.id });
      const main = el('button', { type: 'button', class: 'sm-place' });
      main.append(el('span', { class: 'sm-number' + (s.enemy ? ' enemy' : ''), 'aria-hidden': 'true' }, String(i + 1)), el('span', { class: 'sm-name' }, stopInfo.name + (s.battle ? ' ⚔' : '')), el('span', { class: 'sm-note' }, s.note));
      main.onclick = () => { stop(); setStep(i); };
      li.append(main, refChips(s.refs)); list.append(li);
    });
    body.append(list);
    controls.onkeydown = event => {
      if (event.target.tagName === 'SELECT') return;
      if (event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); stop(); setStep(step + 1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); event.stopPropagation(); stop(); setStep(step - 1); }
    };
    setStep(Math.min(step, journey.steps.length - 1), false);
  }
  function setStep(index, follow = true) {
    if (!journey) return;
    step = Math.max(0, Math.min(journey.steps.length - 1, index));
    const counter = controls.querySelector('.sm-counter');
    if (counter) counter.textContent = `${step + 1} of ${journey.steps.length} · ${stopOf(journey.steps[step]).name}`;
    const [first, prev, , next] = controls.querySelectorAll('.sm-stepper > *');
    if (prev) { first.disabled = prev.disabled = step === 0; next.disabled = step === journey.steps.length - 1; }
    body.querySelectorAll('[data-step]').forEach(item => {
      const i = Number(item.dataset.step);
      item.classList.toggle('selected', i === step); item.classList.toggle('done', i < step);
      if (i === step) reveal(item);
    });
    if (follow) ensureVisible(stopOf(journey.steps[step]).point);
    draw();
  }
  function stop() {
    clearInterval(playTimer); playTimer = null;
    const play = controls.querySelector('.sm-play'); if (play) play.textContent = 'Play';
  }

  function filteredPlaces() {
    const q = placeQuery.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    return core.places.filter(p => p.coord && (placeTestament === 'all' || p[placeTestament]) && (q ? (p.search || (p.search = [p.name, ...(p.aliases || [])].join(' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase())).includes(q) : !keyOnly || p.key));
  }
  function renderPlaces(rebuild = true) {
    if (rebuild) {
      const search = el('input', { type: 'search', placeholder: 'Find a place: Jericho, Ephesus…', 'aria-label': 'Find a place', autocomplete: 'off' }); search.value = placeQuery;
      search.oninput = () => { placeQuery = search.value; selectedId = null; renderPlaces(false); fit(); };
      const testaments = el('div', { class: 'sm-segments', role: 'group', 'aria-label': 'Testament' });
      for (const [value, text] of [['all', 'All'], ['ot', 'Old Testament'], ['nt', 'New Testament']]) {
        const b = el('button', { type: 'button', 'aria-pressed': String(placeTestament === value) }, text);
        b.onclick = () => { placeTestament = value; testaments.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); selectedId = null; renderPlaces(false); fit(); };
        testaments.append(b);
      }
      const keyToggle = el('label', { class: 'sm-check' }); const box = el('input', { type: 'checkbox' }); box.checked = keyOnly;
      box.onchange = () => { keyOnly = box.checked; store('key-only', keyOnly ? 'on' : 'off'); renderPlaces(false); draw(); };
      keyToggle.append(box, document.createTextNode(' Key places only'));
      const regions = el('div', { class: 'sm-segments', role: 'group', 'aria-label': 'Map area' });
      for (const [text, area] of [['Holy Land', HOLY_LAND], ['Jerusalem area', [35.12, 31.68, 35.36, 31.86]], ['Biblical world', WORLD]]) {
        const b = el('button', { type: 'button' }, text); b.onclick = () => setRegion(area); regions.append(b);
      }
      const full = el('button', { type: 'button', class: 'quiet', 'aria-haspopup': 'dialog' }, 'Open full Bible map ↗');
      full.onclick = () => document.getElementById('bible-map-open')?.click();
      controls.append(search, testaments, keyToggle, regions, full);
      legend.innerHTML = '<span><i class="sm-key-ot"></i> Old Testament</span><span><i class="sm-key-nt"></i> New Testament</span><span><i class="sm-key-both"></i> Both</span><span><i class="sm-key-uncertain"></i> Uncertain</span>';
    }
    const list = filteredPlaces().sort((a, b) => (b.id === selectedId) - (a.id === selectedId) || b.refCount - a.refCount);
    body.replaceChildren();
    const selected = byId.get(selectedId);
    if (selected) {
      const card = el('article', { class: 'sm-card' });
      card.append(el('h3', {}, nameOf(selected)), el('p', { class: 'sm-kind' }, `${testamentOf(selected)} · ${selected.kind}${selected.uncertain ? ' · location uncertain' : ''} · ${selected.refCount} ${selected.refCount === 1 ? 'reference' : 'references'}`));
      if (selected.summary) card.append(el('p', {}, selected.summary));
      if (selected.note) card.append(el('p', { class: 'hint' }, selected.note));
      if (selected.refs?.length) card.append(refChips(selected.refs));
      const related = events.filter(e => e.steps.some(s => s.place === selected.id));
      if (related.length) {
        const p = el('p', { class: 'sm-related' }, 'Traced in: ');
        related.forEach((e, i) => { const b = el('button', { type: 'button', class: 'quiet' }, e.title); b.onclick = () => openEvent(e, e.steps.findIndex(s => s.place === selected.id)); p.append(b); if (i < related.length - 1) p.append(document.createTextNode(' · ')); });
        card.append(p);
      }
      body.append(card);
    }
    body.append(el('p', { class: 'sm-summary', role: 'status' }, `${list.length.toLocaleString()} ${list.length === 1 ? 'place' : 'places'}${placeQuery ? ` matching “${placeQuery}”` : keyOnly ? ' (key places)' : ''}${list.length > 80 ? ' · showing the 80 most mentioned' : ''}`));
    const ul = el('ul', { class: 'sm-list sm-compact sm-scroll' });
    for (const p of list.slice(0, 80)) {
      const li = el('li', { class: 'sm-item' + (p.id === selectedId ? ' selected' : ''), 'data-place': p.id });
      const b = el('button', { type: 'button', class: 'sm-place' });
      b.append(el('span', { class: 'sm-dot ' + (p.ot && p.nt ? 'both' : p.nt ? 'nt' : 'ot'), 'aria-hidden': 'true' }), el('span', { class: 'sm-name' }, nameOf(p)), el('span', { class: 'sm-kind' }, `${p.kind} · ${p.refCount}×`));
      b.onclick = () => choose(p.id); li.append(b); ul.append(li);
    }
    body.append(ul);
  }

  panel.querySelectorAll('[data-sm-mode]').forEach(b => { const on = b.dataset.smMode === mode; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
  // The map's data (about 230 KB) is fetched the first time a map, journey or timeline needs it, not at start-up.
  window.ScriptoriumScriptureMap = {
    show() { refresh(); },
    async list() { await loadEvents(); return events.map(e => ({ id: e.id, title: e.title })); },
    async eventsFor(id) { await loadEvents(); return events.filter(e => e.timeline?.includes(id)).map(e => ({ id: e.id, title: e.title })); },
    async openEvent(id) {
      await loadEvents(); const event = events.find(e => e.id === id); if (!event) return;
      if (typeof studyTab === 'function') studyTab('map');
      await openEvent(event, 0);
      panel.scrollIntoView({ block: 'start' });
    },
    chapterChanged() { if (mode === 'chapter' && !panel.classList.contains('hidden') && panel.offsetParent) refresh(); },
    verseChanged() {
      if (mode !== 'chapter' || panel.classList.contains('hidden')) return;
      body.querySelectorAll('.sm-event [data-step]').forEach(item => {
        const event = chapterEvents.find(e => e.event.steps[item.dataset.step] && item.closest('.sm-event') === body.querySelectorAll('.sm-event')[chapterEvents.indexOf(e)]);
        const s = event?.event.steps[item.dataset.step];
        item.classList.toggle('current', !!s && atVerse(s, state.book, state.chapter, state.verse));
      });
      body.querySelectorAll('.sm-named [data-place]').forEach(item => item.classList.toggle('current', !!namedStops.find(n => n.p.id === item.dataset.place)?.verses.includes(state.verse)));
      draw();
    }
  };
})();
/* END SCRIPTORIUM SCRIPTURE MAP PANEL */

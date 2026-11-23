import json
"""Apply the Map study-panel feature to Scriptorium's static files.

Usage: python3 patch.py <original static dir> <output static dir>
Every replacement must match exactly once, so a changed original fails loudly.
"""
import os, shutil, sys
from pathlib import Path

src, out = Path(sys.argv[1]), Path(sys.argv[2])
here = Path(__file__).parent
(out / 'atlas').mkdir(parents=True, exist_ok=True)


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new)


# index.html: a Map tab and its empty panel (the panel is filled by app.js).
html = (src / 'index.html').read_text(encoding='utf-8')
html = replace_once(html, '<button id="note-tab">My notes <span id="note-dot"></span></button></div>',
                    '<button id="note-tab">My notes <span id="note-dot"></span></button><button id="map-tab">Map</button><button id="liturgy-tab">Liturgy</button></div>', 'tab')
html = replace_once(html, '<label id="commentary-psalm-field" class="hidden">Commentary psalm (Vulgate)<input id="commentary-psalm" type="number" min="1" max="150" value="1"></label>',
                    '<label id="commentary-psalm-field" class="hidden">Commentary psalm (Vulgate)<input id="commentary-psalm" type="number" min="1" max="150" value="1"></label>'
                    '<label id="commentary-breviary-field" class="hidden">Breviary division (1962)<select id="commentary-breviary"><option value="">Whole psalm</option></select></label>', 'breviary field')
html = replace_once(html, '<div class="commentary-tools">', '<p id="commentary-breviary-note" class="hint hidden"></p><div class="commentary-tools">', 'breviary note')
html = replace_once(html, '<div id="note-panel" class="hidden">',
                    '<div id="map-panel" class="hidden"></div><div id="liturgy-panel" class="hidden"></div><div id="note-panel" class="hidden">', 'panel')
(out / 'index.html').write_text(html, encoding='utf-8')

# app.js: register the tab, expose the Bible map's place data, follow chapter and verse changes.
js = (src / 'app.js').read_text(encoding='utf-8')
js = replace_once(js, "saved.views.every(v=>['word','lemma','commentary','books','note'].includes(v))",
                  "saved.views.every(v=>['word','lemma','commentary','books','note','map','liturgy'].includes(v))", 'saved views')
js = replace_once(js, " if(tab==='books'&&typeof showReadingBooks==='function')showReadingBooks();\n",
                  " if(tab==='books'&&typeof showReadingBooks==='function')showReadingBooks();\n if(tab==='map')window.ScriptoriumScriptureMap?.show();\n if(tab==='liturgy')window.ScriptoriumLiturgy?.show();\n", 'studyTab')
js = replace_once(js, " for(const name of ['word','lemma','commentary','books','note']){",
                  " for(const name of ['word','lemma','commentary','books','note','map','liturgy']){", 'layout loop')
js = replace_once(js, "['books','Books'],['note','My notes']])select.add(new Option(label,value));",
                  "['books','Books'],['note','My notes'],['map','Map'],['liturgy','Liturgy']])select.add(new Option(label,value));", 'split options')
js = replace_once(js, " if(name==='word'&&lastWordAction)lastWordAction();\n",
                  " if(name==='word'&&lastWordAction)lastWordAction();\n if(name==='map')window.ScriptoriumScriptureMap?.show();\n if(name==='liturgy')window.ScriptoriumLiturgy?.show();\n", 'split view')
js = replace_once(js, " $('lemma-tab').onclick=()=>studyTab('lemma');\n",
                  " $('lemma-tab').onclick=()=>studyTab('lemma');\n $('map-tab').onclick=()=>studyTab('map');\n $('liturgy-tab').onclick=()=>studyTab('liturgy');\n", 'tab click')
js = replace_once(js, " window.ScriptoriumVersePlaces?.render();\n}",
                  " window.ScriptoriumVersePlaces?.render();\n window.ScriptoriumScriptureMap?.chapterChanged();\n window.ScriptoriumLiturgy?.chapterChanged();\n}", 'chapter hook')
js = replace_once(js, "function selectVerse(verse){\n state.verse=verse;document.querySelectorAll('.verse-row').forEach(r=>r.classList.toggle('selected',r.id==='verse-'+verse));store();",
                  "function selectVerse(verse){\n state.verse=verse;document.querySelectorAll('.verse-row').forEach(r=>r.classList.toggle('selected',r.id==='verse-'+verse));store();window.ScriptoriumScriptureMap?.verseChanged();window.ScriptoriumLiturgy?.chapterChanged();", 'verse hook')
js = replace_once(js, "  opener.onclick = () => {\n    if (!dialog) build();",
                  "  window.ScriptoriumBibleMapData = { places: DATA.places, rasterLayers: DATA.rasterLayers, project };\n  opener.onclick = () => {\n    if (!dialog) build();", 'expose map data')
js = replace_once(js, "    if(event.refs.length){const refs=node('div',{class:'bt-references','aria-label':'Biblical references'});window.ScriptoriumReferences.render(refs,event.refs);details.append(refs);}\n",
                  "    const scripture=window.ScriptoriumTimelineScripture?.[event.id],passages=scripture?scripture.refs:event.refs;\n"
                  "    if(passages.length){\n"
                  "      const box=node('section',{class:'bt-scripture','aria-label':'Scripture'});box.append(node('h4',{},'Scripture'));\n"
                  "      if(scripture?.note)box.append(node('p',{class:'bt-detail-hint'},scripture.note));\n"
                  "      const quote=node('blockquote',{class:'bt-quote'},'Loading '+passages[0]+'…');box.append(quote);\n"
                  "      const refs=node('div',{class:'bt-references','aria-label':'Biblical references'});window.ScriptoriumReferences.render(refs,passages);\n"
                  "      if(passages.length>1)box.append(node('p',{class:'bt-detail-hint'},'More passages (hover for the text, click to read):'));box.append(refs);details.append(box);\n"
                  "      window.ScriptoriumReferences.quote(passages[0]).then(text=>{\n"
                  "        if(selected!==event||!quote.isConnected)return;quote.replaceChildren();\n"
                  "        for(const row of text.rows){const p=node('p');p.append(node('sup',{},String(row.verse)),document.createTextNode(' '+row.text));quote.append(p);}\n"
                  "        const cite=node('footer',{class:'bt-quote-cite'});cite.append(document.createTextNode(passages[0]+' · '+text.version+(text.more?' · continues':'')+' '));\n"
                  "        const read=node('button',{type:'button',class:'quiet'},'Read in context →');read.onclick=()=>window.ScriptoriumReferences.read(passages[0],read);cite.append(read);quote.append(cite);\n"
                  "      }).catch(error=>{if(quote.isConnected)quote.textContent=error.message;});\n"
                  "    }\n"
                  "    window.ScriptoriumScriptureMap?.eventsFor?.(event.id).then(traced=>{if(!traced.length||!details.isConnected)return;const box=node('div',{class:'bt-map-links'});box.append(node('p',{class:'bt-detail-hint'},'Traced on the map:'));for(const item of traced){const b=node('button',{type:'button',class:'quiet'},item.title+' →');b.onclick=()=>{dialog.close();window.ScriptoriumScriptureMap.openEvent(item.id);};box.append(b);}details.append(box);}).catch(()=>{});\n", 'timeline map links')
js = replace_once(js, "  timelineButton.onclick=showTimeline;\n",
                  "  timelineButton.onclick=showTimeline;\n"
                  "  // Opened from the study map: show one BibleWorks entry, selected and centred.\n"
                  "  window.ScriptoriumTimeline={\n"
                  "    entry:id=>historyData.groups.flatMap(g=>g.events).find(e=>e.id===id)||null,\n"
                  "    entries:()=>historyData.groups.flatMap(g=>g.events),\n"
                  "    dateText,\n"
                  "    async open(id){\n"
                  "      closeMenu();if(!dialog)build();\n"
                  "      if(!dialog.open){savedScroll=[window.scrollX,window.scrollY];dialog.showModal();}\n"
                  "      if(mode!=='history')await setTimelineMode('history');\n"
                  "      const entry=allEntries.find(e=>e.id===id);if(!entry){update();return;}\n"
                  "      const chosen=DATA.presets.find(x=>x.id!=='all'&&x.groups.includes(entry.group))||DATA.presets.find(x=>x.id==='all');\n"
                  "      preset=chosen.id;presetSelect.value=preset;era='';search.value='';limit=100;fillCollections();eraSelect.value='';range=[...presetInfo().range];\n"
                  "      selected=entry;update();selectEvent(entry,true);\n"
                  "      const pad=Math.max(60,(entry.end-entry.start)*.6);range=[entry.start-pad,entry.end+pad];draw();\n"
                  "      setTimeout(()=>chart.querySelector(`[data-timeline-id=\"${entry.id}\"]`)?.scrollIntoView({block:'center'}),120);\n"
                  "      list.querySelector(`[data-timeline-event=\"${entry.id}\"]`)?.scrollIntoView({block:'nearest'});\n"
                  "    }\n"
                  "  };\n", 'timeline api')
js = replace_once(js, " const chapter=ref.book==='Psa'?Number($('commentary-psalm').value||ref.chapter):ref.chapter;\n",
                  " const chapter=ref.book==='Psa'?Number($('commentary-psalm').value||ref.chapter):ref.chapter;\n"
                  " window.ScriptoriumBreviary?.sync(ref.book,chapter);const division=window.ScriptoriumBreviary?.current(ref.book,chapter)||null;\n", 'breviary division')
js = replace_once(js, " $('commentary-ref').textContent=`${ref.book} ${ref.chapter}:${ref.verse}`;",
                  " $('commentary-ref').textContent=division?`Psa ${chapter}:${division.label} (Breviary)`:`${ref.book} ${ref.chapter}:${ref.verse}`;", 'breviary heading')
assert js.count("verse:ref.verse,language") == 2
js = js.replace("verse:ref.verse,language", "verse:division?division.first:ref.verse,language")
js = replace_once(js, " const viewKey=JSON.stringify([ref.book,chapter,language,$('commentary-work').value]);",
                  " const viewKey=JSON.stringify([ref.book,chapter,language,$('commentary-work').value,division?.key||'']);", 'breviary view key')
js = replace_once(js, "  commentaryViewKey=JSON.stringify([ref.book,chapter,language,$('commentary-work').value]);",
                  "  commentaryViewKey=JSON.stringify([ref.book,chapter,language,$('commentary-work').value,division?.key||'']);", 'breviary view key 2')
js = replace_once(js, "  data.entries=combineCatenaChapters(data.entries);\n",
                  "  if(division){data.entries=await window.ScriptoriumBreviary.gather(data.entries,{book:ref.book,chapter,language,...($('commentary-work').value?{work:$('commentary-work').value}:{})},division);if(request!==commentaryRequest)return;}\n"
                  "  data.entries=combineCatenaChapters(data.entries);\n", 'breviary gather')
js = replace_once(js, '<p id="bt-chart-help" class="bt-chart-help">Select an event for notes · Arrow keys pan · + / − zoom</p>',
                  '<p id="bt-chart-help" class="bt-chart-help">Click an entry for notes · drag to move through the years · Ctrl + scroll to zoom · click a period above to show it</p>', 'timeline help')
js = replace_once(js, '<button type="button" id="bt-fit">Fit events</button>',
                  '<button type="button" id="bt-fit">Fit events</button><button type="button" id="bt-here" title="Show the person or event of the chapter you are reading">This chapter</button>', 'this chapter button')
js = replace_once(js, "    dialog.querySelector('#bt-fit').onclick=fit;\n",
                  "    dialog.querySelector('#bt-fit').onclick=fit;\n"
                  "    dialog.querySelector('#bt-here').onclick=showChapter;\n", 'this chapter handler')
js = replace_once(js, "    new ResizeObserver(draw).observe(chart.parentElement);\n  }\n",
                  "    new ResizeObserver(draw).observe(chart.parentElement);\n"
                  "    // Drag sideways to move through the years (a short click still selects an entry).\n"
                  "    let drag=null,dragMoved=false;\n"
                  "    chart.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={x:e.clientX,range:[...range],w:Number(chart.dataset.plotWidth)||chart.clientWidth};dragMoved=false;});\n"
                  "    window.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x;if(!dragMoved&&Math.abs(dx)<6)return;if(!dragMoved){dragMoved=true;chart.classList.add('bt-dragging');}const span=drag.range[1]-drag.range[0],shift=-dx/drag.w*span;range=[drag.range[0]+shift,drag.range[1]+shift];draw();});\n"
                  "    window.addEventListener('pointerup',()=>{if(!drag)return;drag=null;chart.classList.remove('bt-dragging');setTimeout(()=>{dragMoved=false;},0);});\n"
                  "    chart.addEventListener('click',e=>{if(dragMoved){e.stopImmediatePropagation();e.preventDefault();}},true);\n"
                  "    // Ctrl (or ⌘) + scroll zooms around the pointer; plain scroll still scrolls the list of rows.\n"
                  "    chart.parentElement.addEventListener('wheel',e=>{if(!(e.ctrlKey||e.metaKey))return;e.preventDefault();const box=chart.getBoundingClientRect(),left=Number(chart.dataset.plotLeft)||150,w=Number(chart.dataset.plotWidth)||box.width;const f=Math.max(0,Math.min(1,(e.clientX-box.left-left)/w)),at=range[0]+f*(range[1]-range[0]),k=Math.exp(e.deltaY*.0015),span=Math.max(8,(range[1]-range[0])*k);range=[at-f*span,at+(1-f)*span];draw();},{passive:false});\n"
                  "    // Click a biblical period on the ruler to show just those years.\n"
                  "    dialog.addEventListener('click',e=>{const band=e.target.closest?.('[data-period]');if(!band)return;const a=Number(band.dataset.start),b=Number(band.dataset.end),pad=Math.max(2,(b-a)*.03);range=[a-pad,b+pad];draw();});\n"
                  "  }\n"
                  "  // Find the timeline entry for the chapter being read (from its Scripture passages).\n"
                  "  function showChapter(){\n"
                  "    const status=dialog.querySelector('#bt-year-status'),book=state.book,chapter=state.chapter,table=window.ScriptoriumTimelineScripture||{},bookName=code=>state.meta.books.find(b=>b.code===code)?.name||code;\n"
                  "    const hits=[];\n"
                  "    for(const [id,info] of Object.entries(table)){\n"
                  "      info.refs.forEach((ref,n)=>{const m=ref.match(/^(\\S+)\\s+(\\d+)(?::(\\d+))?(?:-(?:(\\d+):)?(\\d+))?/);if(!m||m[1]!==book)return;const c=Number(m[2]),v=Number(m[3]||1),c2=Number(m[4]||c),v2=m[3]?Number(m[5]||v):999;if(chapter<c||chapter>c2)return;const verse=state.verse||1,within=(chapter>c||verse>=v)&&(chapter<c2||verse<=v2);const e=allEntries.find(x=>x.id===id);if(e&&!e.invalidRange)hits.push({e,key:n===0,within,span:e.end-e.start});});\n"
                  "    }\n"
                  "    if(!hits.length){if(status)status.textContent=`No timeline entry is linked to ${bookName(book)} ${chapter}.`;return;}\n"
                  "    hits.sort((a,b)=>(b.within-a.within)||(b.key-a.key)||(a.span-b.span));\n"
                  "    if(status)status.textContent=`${bookName(book)} ${chapter}: ${[...new Set(hits.map(h=>h.e.title))].slice(0,4).join(' · ')}`;\n"
                  "    window.ScriptoriumTimeline.open(hits[0].e.id);\n"
                  "  }\n", 'timeline drag, wheel, periods')
js = replace_once(js, "  window.ScriptoriumReferences = { render, linkify, close };",
                  "  window.ScriptoriumReferences = { render, linkify, close, quote: reference => passageText(parse(reference)), read: (reference, trigger) => read(parse(reference), trigger) };", 'references api')
js = replace_once(js, "      button.append(node('span',{class:'bt-event-date'},dateText(event)),node('span',{class:'bt-event-title'},event.title),node('small',{},byId.get(event.group).name));\n",
                  "      button.append(node('span',{class:'bt-event-date'},dateText(event)),node('span',{class:'bt-event-title'},event.title),node('small',{},byId.get(event.group).name));\n"
                  "      const passages=window.ScriptoriumTimelineScripture?.[event.id]?.refs;if(passages)button.append(node('small',{class:'bt-event-scripture'},'Scripture: '+passages[0]+(passages.length>1?` +${passages.length-1}`:'')));\n", 'list scripture')
# Keep the view inside the years the shown entries cover: every move goes through draw(), so clamp there.
js = replace_once(js, "  function draw(){if(!frame)frame=requestAnimationFrame(()=>{frame=null;renderChart();});}",
                  "  function extents(){\n"
                  "    const query=search.value.trim(),ids=era?[era]:query?[...new Set(filtered.map(e=>e.group))]:presetInfo().groups;\n"
                  "    const entries=allEntries.filter(e=>ids.includes(e.group)&&e.kind!=='note'&&!e.invalidRange);if(!entries.length)return null;\n"
                  "    const low=Math.min(...entries.map(e=>e.start)),high=Math.max(...entries.map(e=>e.end)),pad=Math.max(4,Math.min(40,(high-low)*.02));return[low-pad,high+pad];\n"
                  "  }\n"
                  "  function clampRange(){\n"
                  "    const limits=extents(),nav=id=>dialog.querySelector(id);if(!limits)return;\n"
                  "    let span=Math.min(range[1]-range[0],limits[1]-limits[0]),a=range[0];\n"
                  "    if(!(span>0))span=limits[1]-limits[0];a=Math.max(limits[0],Math.min(limits[1]-span,a));range=[a,a+span];\n"
                  "    const edge=Math.max(.5,span*.002),full=span>=limits[1]-limits[0]-edge;\n"
                  "    const set=(id,off,why)=>{const b=nav(id);if(!b)return;b.disabled=off;b.title=off?why:b.dataset.title||b.title;};\n"
                  "    for(const id of['#bt-earlier','#bt-later','#bt-zoom-out']){const b=nav(id);if(b&&!b.dataset.title)b.dataset.title=b.title||b.getAttribute('aria-label');}\n"
                  "    set('#bt-earlier',a<=limits[0]+edge,'This is the earliest entry shown');set('#bt-later',a+span>=limits[1]-edge,'This is the latest entry shown');set('#bt-zoom-out',full,'All the years these entries cover are shown');\n"
                  "    dialog.querySelector('#bt-year-status')?.setAttribute('data-limits',`${year(Math.round(limits[0]))} – ${year(Math.round(limits[1]))}`);\n"
                  "  }\n"
                  "  function draw(){if(!frame)frame=requestAnimationFrame(()=>{frame=null;clampRange();renderChart();});}", 'clamp draw')
js = replace_once(js, "      yearStatus.textContent='';yearInput.removeAttribute('aria-invalid');const span=range[1]-range[0];range=[value-span/2,value+span/2];draw();\n",
                  "      const limits=extents();if(limits&&(value<limits[0]||value>limits[1])){yearStatus.textContent=`These entries cover ${year(Math.round(limits[0]))} to ${year(Math.round(limits[1]))}; showing the nearest years.`;setTimeout(()=>{yearStatus.textContent='';},6000);}else yearStatus.textContent='';\n"
                  "      yearInput.removeAttribute('aria-invalid');const span=range[1]-range[0];range=[value-span/2,value+span/2];draw();\n", 'year limits')
js = replace_once(js, "   const details=document.createElement('details');details.className='commentary-entry';\n",
                  "   const details=document.createElement('details');details.className='commentary-entry';\n"
                  "   // Enough to find this entry again from a bookmark.\n"
                  "   Object.assign(details.dataset,{work:entry.work,entryId:String(entry.id),entryTitle:entry.title||'',workTitle:entry.work_title||'',place:JSON.stringify({book:ref.book,chapter:ref.chapter,verse:ref.verse,cchapter:chapter})});\n", 'commentary entry data')
start = js.index('  function renderChart(){\n')
end = js.index('\n\n  function showTimeline(){', start)
assert js.count('  function renderChart(){\n') == 1
js = js[:start] + (here / 'timeline-chart.js').read_text(encoding='utf-8').rstrip('\n') + js[end:]
breviary = (here / 'breviary.js').read_text(encoding='utf-8').replace('__BREVIARY_DATA__', (here / 'breviary.json').read_text(encoding='utf-8'))
js = js.rstrip('\n') + '\n' + (here / 'core.js').read_text(encoding='utf-8')
js = js.rstrip('\n') + '\n' + breviary
js = js.rstrip('\n') + '\n/* SCRIPTORIUM TIMELINE SCRIPTURE: key passages for biblical timeline entries */\nwindow.ScriptoriumTimelineScripture=' + (here / 'timeline-refs.json').read_text(encoding='utf-8') + ';\n'
js = js.rstrip('\n') + '\n' + (here / 'scripture-map.js').read_text(encoding='utf-8')
js = js.rstrip('\n') + '\n' + (here / 'ordo.js').read_text(encoding='utf-8')
js = js.rstrip('\n') + '\n' + (here / 'liturgy.js').read_text(encoding='utf-8')
js = js.rstrip('\n') + '\n' + (here / 'media-tools.js').read_text(encoding='utf-8')
js = js.rstrip('\n') + '\n' + (here / 'catena.js').read_text(encoding='utf-8')
js = js.rstrip('\n') + '\n' + (here / 'benedict.js').read_text(encoding='utf-8')
js = js.rstrip('\n') + '\n' + (here / 'study-extras.js').read_text(encoding='utf-8')
js = js.rstrip('\n') + '\n' + (here / 'usability.js').read_text(encoding='utf-8')
js = js.rstrip('\n') + '\n' + (here / 'simplify.js').read_text(encoding='utf-8')
# The timeline remembers the period and years you were looking at.
js = replace_once(js, "  function showTimeline(){\n    closeMenu();if(!dialog)build();savedScroll=[window.scrollX,window.scrollY];dialog.showModal();update();",
                  "  let timelineRestored=false;\n"
                  "  function restoreTimelineView(){\n"
                  "    if(timelineRestored)return;timelineRestored=true;\n"
                  "    try{const v=JSON.parse(localStorage.getItem('scriptorium-timeline-view')||'null');\n"
                  "      if(v&&mode==='history'&&DATA.presets.some(p=>p.id===v.preset)){preset=v.preset;presetSelect.value=preset;era='';fillCollections();eraSelect.value='';range=[...presetInfo().range];\n"
                  "        if(Array.isArray(v.range)&&v.range.length===2&&v.range.every(Number.isFinite)&&v.range[1]>v.range[0])range=v.range;}}catch{}\n"
                  "  }\n"
                  "  function showTimeline(){\n    closeMenu();if(!dialog)build();restoreTimelineView();savedScroll=[window.scrollX,window.scrollY];dialog.showModal();update();", 'timeline remembers view')
js = replace_once(js, "  function draw(){if(!frame)frame=requestAnimationFrame(()=>{frame=null;clampRange();renderChart();});}",
                  "  let viewTimer;\n  function draw(){if(!frame)frame=requestAnimationFrame(()=>{frame=null;clampRange();renderChart();});clearTimeout(viewTimer);viewTimer=setTimeout(()=>{try{if(mode==='history')localStorage.setItem('scriptorium-timeline-view',JSON.stringify({preset,range}));}catch{}},500);}", 'timeline saves view')
# A simpler timeline: three views (Old Testament, New Testament, Church history) and only the collections
# they need. The manuscripts view, world and Western history, Roman rule and the duplicate overviews are left out.
_i = js.index('let DATA=') + len('let DATA=')
_data, _n = json.JSONDecoder().raw_decode(js[_i:])
_OT = ['CREATION', 'PSTFLOOD', 'WILDRNSS', 'PROMLAND', 'KINGS', 'ASSYR', 'BABYLON', 'PERSIAN', 'INTERTES']
_keep = _OT + ['NT_DET', 'CHURCH']
_data['groups'] = [g for g in _data['groups'] if g['id'] in _keep]
for g in _data['groups']:
    if g['id'] == 'NT_DET': g['name'] = 'New Testament'
    g['events'] = [e for e in g['events'] if e.get('kind') != 'note']     # chronology notes are not entries
# Firmer dates for the entries BibleWorks marked uncertain (feature/timeline-dates.json).
_firm = json.loads((here / 'timeline-dates.json').read_text(encoding='utf-8'))
for g in _data['groups']:
    for e in g['events']:
        f = _firm.get(e['id'])
        if f:
            e.update(title=f['title'], start=f['start'], end=f['end'], uncertain=False, dating=f['dating'], invalidRange=False)
            e['searchText'] = (e.get('searchText', '') + ' ' + f['dating']).strip()
# Church history, rewritten with exact dates where they are known (feature/church-history.txt).
_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
def _when(tok):
    tok = tok.strip(); approx = tok.startswith('c.'); tok = tok[2:] if approx else tok
    parts = [int(x) for x in tok.split('-')]
    y, m, d = (parts + [None, None])[:3]
    import datetime
    if d: frac = y + (datetime.date(y, m, d).timetuple().tm_yday - .5) / 365.25
    elif m: frac = y + (m - .5) / 12
    else: frac = y
    return {'y': y, 'm': m, 'd': d, 'approx': approx, 'frac': round(frac, 4)}
def _fmt(w, year=True):
    t = ' '.join(str(x) for x in ([w['d']] if w['d'] else []) + ([_MON[w['m'] - 1]] if w['m'] else []) + ([w['y']] if year else []))
    return ('c. ' if w['approx'] else '') + t
_church = []
for line in (here / 'church-history.txt').read_text(encoding='utf-8').splitlines():
    if not line.strip() or line.startswith('#'): continue
    a, b, title, note = [x.strip() for x in (line.split('|') + ['', '', ''])[:4]]
    s = _when(a); e = _when(b) if b else s
    if b and e['y'] == s['y'] and not s['approx'] and not e['approx']: when = f"{_fmt(s, False)} – {_fmt(e)}" if (s['m'] or s['d']) else str(s['y'])
    else: when = _fmt(s) + (f" – {_fmt(e)}" if b else '')
    _church.append({'id': f"CHURCH-{len(_church) + 1}", 'group': 'CHURCH', 'title': title, 'start': s['frac'], 'end': max(e['frac'], s['frac']),
                    'uncertain': False, 'kind': 'event', 'invalidRange': False, 'refs': [], 'topics': [], 'originalCaption': title,
                    'when': when, 'dating': note, 'searchText': note + ' ' + when})
for g in _data['groups']:
    if g['id'] == 'CHURCH': g['events'] = _church
_data['presets'] = [{'id': 'ot', 'name': 'Old Testament', 'groups': _OT, 'range': [-4000, 0]},
                    {'id': 'nt', 'name': 'New Testament', 'groups': ['NT_DET'], 'range': [-10, 105]},
                    {'id': 'church', 'name': 'Church history', 'groups': ['CHURCH'], 'range': [30, 2030]}]
_data['entryCount'] = sum(len(g['events']) for g in _data['groups'])
js = replace_once(js, "  const dateText=event=>event.kind==='note'?", "  const dateText=event=>event.when?event.when:event.kind==='note'?", 'timeline exact dates')
js = js[:_i] + json.dumps(_data, ensure_ascii=False, separators=(',', ':')) + js[_i + _n:]
js = replace_once(js, "||DATA.presets.find(x=>x.id==='all');", "||DATA.presets[0];", 'timeline open fallback')
js = replace_once(js, "    if(event.uncertain)details.append(node('p',{class:'bt-detail-hint'},'The original BibleWorks entry marks this date or identification as uncertain.'));",
                  "    if(event.dating)details.append(node('p',{class:'bt-dating'},event.dating));\n    else if(event.uncertain)details.append(node('p',{class:'bt-detail-hint'},'The date or identification is uncertain.'));", 'timeline dating note')
js = replace_once(js, '<button type="button" id="bt-fit">Fit events</button>', '<button type="button" id="bt-fit" title="Show every entry in this view">Show all</button>', 'timeline show all')
js = replace_once(js, '<h2 id="bt-title">BibleWorks timeline</h2>', '<h2 id="bt-title">Timeline</h2>', 'timeline title')
js = replace_once(js, '<input id="bt-search" type="search" placeholder="Paul, David, Nicaea…" autocomplete="off">', '<input id="bt-search" type="search" placeholder="Find a person or event…" aria-label="Find a person or event" autocomplete="off">', 'timeline search')
# Tell the view tabs when the timeline redraws, so they show the current view.
js = replace_once(js, "    renderList();showDetail();draw();\n  }\n  function renderList(){", "    renderList();showDetail();draw();dialog.dispatchEvent(new Event('bt-update'));\n  }\n  function renderList(){", 'timeline update event')
js = replace_once(js, "filtered.find(e=>e.group==='NT_DET'&&e.title.startsWith('(?) Jesus'))", "filtered.find(e=>e.id==='NT_DET-1')", 'timeline first entry')
js = js.rstrip('\n') + '\n' + (here / 'timeline-simple.js').read_text(encoding='utf-8')
# Original word: the verse in Greek or Hebrew under the Word tab, for a word of a translation (origword.js).
js = replace_once(js, "else showPlainWord(token,part,col.version);};",
    "else showPlainWord(token,part,col.version);window.ScriptoriumOriginal?.show(token,part,col.version);};", 'original word: word click')
js = js.rstrip('\n') + '\n' + (here / 'origword.js').read_text(encoding='utf-8')
js = js.rstrip('\n') + '\n' + (here / 'accents.js').read_text(encoding='utf-8')   # accents for the Antoniades text
# Brown–Driver–Briggs: the entry that fits first, the other entries with the same letters folded (lexicon-rank.js).
js = js.rstrip('\n') + '\n' + (here / 'lexicon-rank.js').read_text(encoding='utf-8')
js = replace_once(js, "for(const e of data.entries){const details=",
    "const _main=data.primary??data.entries.length,_more=document.createElement('details');_more.className='definition-more';_more.append(document.createElement('summary'));for(const [_i,e] of data.entries.entries()){const details=", 'lexicon rank: loop')
js = replace_once(js, "details.open=!data.forms?.length&&data.entries.length<4;", "details.open=!data.forms?.length&&(data.primary?_i<_main:data.entries.length<4);", 'lexicon rank: open')
js = replace_once(js, "details.append(summary,body);results.append(details);}",
    "details.append(summary,body);(_i<_main?results:_more).append(details);}if(data.entries.length>_main){_more.firstChild.textContent='Other entries with these letters ('+(data.entries.length-_main)+') · related words and homographs';results.append(_more);}", 'lexicon rank: fold')
js = replace_once(js, "dictionaryPanel(dict,versionInfo(version).language,t.lemma);", "window.ScriptoriumDefineHint={word:t.lemma,pos:t.description};dictionaryPanel(dict,versionInfo(version).language,t.lemma);", 'lexicon rank: hint 1')
js = replace_once(js, "dictionaryPanel(dict,'Hebrew',t.lemma)", "(window.ScriptoriumDefineHint={word:t.lemma,pos:t.description},dictionaryPanel(dict,'Hebrew',t.lemma))", 'lexicon rank: hint 2')
# No photographs: the atlas keeps its maps, plans, reconstructions and drawings; site and museum photographs are
# left out when the atlas index is read, with the pins that existed only for them. The image files stay on disk, unused.
js = replace_once(js, "promise=fetch('/atlas/manifest.json').then(r=>{if(!r.ok)throw Error('Atlas files unavailable');return r.json();}).then(data=>{",
    "promise=Promise.all([fetch('/atlas/manifest.json').then(r=>{if(!r.ok)throw Error('Atlas files unavailable');return r.json();}),"
    "fetch('/atlas/atlas-plans.json').then(r=>r.ok?r.json():{}).catch(()=>({}))]).then(([data,extra])=>{"
    "data={...data,items:[...data.items,...(extra.items||[])],places:[...data.places,...(extra.places||[])]};", 'site plans and models: atlas-plans.json')
js = replace_once(js, "      nav=makeNavigation(data);",
    "      data={...data,items:data.items.filter(i=>!/photograph/i.test(i.type))};\n"
    "      {const keep=new Set(data.items.flatMap(i=>[i.placeId,...i.relatedPlaceIds]));data.places=data.places.filter(p=>keep.has(p.id));}\n"
    "      nav=makeNavigation(data);", 'no photographs: atlas index')
js = replace_once(js, 'data-map-view="photos">Photos &amp; plans', 'data-map-view="photos">Plans &amp; pictures', 'no photographs: tab name')
js = replace_once(js, "'Browse photographs, plans and maps by the places they show.'", "'Browse maps, plans, models and drawings by the places they show.'", 'no photographs: intro')
js = replace_once(js, "', Jerusalem. Open Photos & plans to review its views and sources.'", "', Jerusalem.'", 'no photographs: pin summary')
js = replace_once(js, '<button type="button" data-theme="recent">New photographs</button>', '', 'no photographs: collection button')
js = replace_once(js, ",['OpenBible — photo index','https://www.openbible.info/geo/photos/'],['BiblePlaces — further collections','https://www.bibleplaces.com/pictorial-library-complete-collection/'],['BibleWalks — sites and photographs','https://www.biblewalks.com/']", '', 'no photographs: photo links')
js = replace_once(js, "'bm-see-photos' }, 'View photos');", "'bm-see-photos' }, 'Plans & pictures');", 'no photographs: place button')
js = replace_once(js, "    shortcut.replaceChildren();\n    shortcut.append(el('strong', {}, place.name));", "    shortcut.replaceChildren(); shortcut.style.display = '';\n    shortcut.append(el('strong', {}, place.name));", 'no photographs: place box')
js = replace_once(js, "      photos.textContent = selection.items.length ? `View photos (${selection.items.length})` : 'Browse images for this place';",
    "      photos.textContent = `Plans & pictures (${selection.items.length})`;\n"
    "      if (!selection.items.length) { photos.remove(); if (!shortcut.querySelector('button')) shortcut.style.display = 'none'; }", 'no photographs: place count')

# Minify (about a quarter smaller and quicker to parse). The marker comment tells the kit this is the improved app.js.
js = '/*! BEGIN SCRIPTORIUM improvements */\n' + js
(out / 'app.js').write_text(js, encoding='utf-8')
import subprocess
_esb = next((p for p in ('/opt/npm-tools/node_modules/.bin/esbuild', shutil.which('esbuild') or '') if p and Path(p).exists()), None)
if _esb and not os.environ.get('NO_MINIFY'):
    _r = subprocess.run([_esb, '--minify', '--legal-comments=inline', '--target=chrome100', '--charset=utf8', '--loader=js'], input=js.encode('utf-8'), capture_output=True)
    if _r.returncode: raise SystemExit('minify failed: ' + _r.stderr.decode()[:2000])
    (out / 'app.js').write_bytes(_r.stdout)
    print('app.js minified: %d KB -> %d KB' % (len(js.encode()) // 1024, len(_r.stdout) // 1024))

css = (src / 'style.css').read_text(encoding='utf-8')
(out / 'style.css').write_text(css.rstrip('\n') + '\n' + (here / 'scripture-map.css').read_text(encoding='utf-8') + (here / 'timeline.css').read_text(encoding='utf-8') + (here / 'liturgy.css').read_text(encoding='utf-8') + (here / 'media-tools.css').read_text(encoding='utf-8') + (here / 'study-extras.css').read_text(encoding='utf-8') + (here / 'usability.css').read_text(encoding='utf-8') + (here / 'simplify.css').read_text(encoding='utf-8') + (here / 'timeline-simple.css').read_text(encoding='utf-8') + (here / 'origword.css').read_text(encoding='utf-8'), encoding='utf-8')
# Faster start: the fonts were packed into style.css as text; they become files, read only when a script needs them.
import base64, re as _re, hashlib
css = (out / 'style.css').read_text(encoding='utf-8')
# Scriptorium's server only hands out flat files in atlas/ ending .json/.jpg/.png/.webp/.txt, so each font keeps its bytes under a .txt name.
def _font(m):
    data = base64.b64decode(m.group(2))
    fmt = {'font/ttf': 'truetype', 'font/otf': 'opentype', 'font/woff2': 'woff2', 'font/woff': 'woff'}.get(m.group(1), 'truetype')
    name = 'font-' + hashlib.sha1(data).hexdigest()[:12] + '.txt'
    (out / 'atlas' / name).write_bytes(data)
    return f"url('/atlas/{name}')"
css, n = _re.subn(r"url\(\s*['\"]?data:(font/[a-z0-9]+|application/(?:x-)?font-[a-z0-9]+);base64,([A-Za-z0-9+/=]+)['\"]?\s*\)", _font, css)
(out / 'style.css').write_text(css, encoding='utf-8')
print('fonts moved out of style.css:', n)
if _esb and not os.environ.get('NO_MINIFY'):
    _r = subprocess.run([_esb, '--minify', '--loader=css', '--target=chrome100', '--charset=utf8'], input=css.encode('utf-8'), capture_output=True)
    if _r.returncode: raise SystemExit('css minify failed: ' + _r.stderr.decode()[:2000])
    (out / 'style.css').write_bytes(_r.stdout)
    print('style.css minified: %d KB -> %d KB' % (len(css.encode()) // 1024, len(_r.stdout) // 1024))

shutil.copy(here / 'journeys.json', out / 'atlas' / 'scripture-journeys.json')
shutil.copy(here / 'boundaries.json', out / 'atlas' / 'scripture-boundaries.json')
shutil.copy(here / 'liturgy-1962.json', out / 'atlas' / 'liturgy-1962.json')
shutil.copy(here / 'search-boylan.json', out / 'atlas' / 'search-boylan.json')
shutil.copy(here / 'benedict-links.json', out / 'atlas' / 'benedict-links.json')
shutil.copy(here / 'liturgy-propers.json', out / 'atlas' / 'liturgy-propers.json')
for f in (here / 'catena').glob('*.json'): shutil.copy(f, out / 'atlas' / f.name)
# Site plans, maps and models from Wikimedia Commons (feature/atlas-plans.json, images in feature/plans).
shutil.copy(here / 'atlas-plans.json', out / 'atlas' / 'atlas-plans.json')
# PROIEL's word-by-word matching of the Vulgate to the Greek New Testament (origword/build_proiel.py, slim.py).
import zipfile
with zipfile.ZipFile(here / 'origword' / 'vulgate-greek.zip') as _z:   # made by origword/build_proiel.py and slim.py
    for _n in _z.namelist(): (out / 'atlas' / Path(_n).name).write_bytes(_z.read(_n))
with zipfile.ZipFile(here / 'accents' / 'antoniades-accents.zip') as _z:   # made by accents/build_accents.py
    for _n in _z.namelist(): (out / 'atlas' / Path(_n).name).write_bytes(_z.read(_n))
import zipfile
with zipfile.ZipFile(here / 'plans.zip') as _z:          # the plan and model images (feature/plans.zip)
    for _n in _z.namelist():
        if _n.endswith('.jpg'): (out / 'atlas' / Path(_n).name).write_bytes(_z.read(_n))
# ---------- Smaller and faster data ----------
# The start page needs only the calendar (titles, ranks, dates and reading references), not the full 3 MB liturgy.
_lit = json.loads((here / 'liturgy-1962.json').read_text(encoding='utf-8'))
_keep = ('id', 'cycle', 'title', 'sort', 'group', 'subtitle', 'note', 'local', 'class', 'gospels', 'sermons', 'homilies')
_cal = {'days': [], 'seasons': _lit.get('seasons')}
for d in _lit['days']:
    x = {k: d[k] for k in _keep if k in d}
    x['epistles'] = [{'text': e.get('text'), 'refs': e.get('refs', [])} for e in d.get('epistles', [])]
    x['gospel_texts'] = [{'text': g.get('text')} for g in d.get('gospel_texts', [])]
    _cal['days'].append(x)
(out / 'atlas' / 'liturgy-calendar.json').write_text(json.dumps(_cal, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
# "Search the Fathers" reads one prepared file instead of gathering every sermon, homily and Catena file at the first search.
_kinds = ['Matins homilies', 'Missal readings', 'Sermons of the Fathers', 'Catena Aurea', 'Boylan on the Psalms']
_docs, _paras = [], []
def _doc(kind, title, sub, opener):
    _docs.append([_kinds.index(kind), title, sub, opener]); return len(_docs) - 1
for hid, h in _lit['homilies'].items():
    di = _doc('Matins homilies', f"{h.get('father') or h.get('author')} — {h['ref']}", (h.get('title') or '') + (f" ({h['date']})" if h.get('date') else ''), ['h', hid])
    for t in h['lessons']: _paras.append([di, t])
for d in _lit['days']:
    for e in d.get('epistles', []):
        if e.get('body'): _paras.append([_doc('Missal readings', f"{d['title']} — Epistle", e.get('text', ''), ['d', d['id']]), e['body']])
    for g in d.get('gospel_texts', []):
        if g.get('body'): _paras.append([_doc('Missal readings', f"{d['title']} — Gospel", g.get('text', ''), ['d', d['id']]), g['body']])
_sidx = json.loads((here / 'sermons' / 'liturgy-sermons.json').read_text(encoding='utf-8'))
_packs = {}
for s in _sidx['sermons']:
    pk = s['pack']
    if pk not in _packs: _packs[pk] = json.loads((here / 'sermons' / f'liturgy-sermons-{pk}.json').read_text(encoding='utf-8'))
    body = _packs[pk].get(s['id'])
    if not body: continue
    di = _doc('Sermons of the Fathers', f"{s['father']} — {s['work']}", s['title'], ['s', s['id']])
    for i, t in enumerate(body['paragraphs']):
        # The text stays in the sermon pack; the search file only points to it.
        if i: _paras.append([di, ['s', pk, s['id'], i], i])
_GOS = {'Mat': 'Matthew', 'Mar': 'Mark', 'Luk': 'Luke', 'Joh': 'John'}
def _span(c, v, c2, v2): return f"{c}:{v}" + (f"–{c2}:{v2}" if c2 != c else f"–{v2}" if v2 != v else '')
_cidx = json.loads((here / 'catena' / 'catena-index.json').read_text(encoding='utf-8'))
_cpacks = {}
for pp in _cidx['passages']:
    if pp['pack'] not in _cpacks: _cpacks[pp['pack']] = json.loads((here / 'catena' / f"{pp['pack']}.json").read_text(encoding='utf-8'))
    t = _cpacks[pp['pack']][pp['id']]
    n = pp.get('nav') or pp
    label = f"{_GOS[pp['b']]} {_span(n['c'], n['v'], n['c2'], n['v2'])}"
    _paras.append([_doc('Catena Aurea', 'Catena Aurea — ' + label, t['lemma'][:120], ['c', pp['id']]), ['c', pp['pack'], pp['id'], -1, 0], 0])
    k = 0
    for si, sg in enumerate(t['segs']):
        di = _doc('Catena Aurea', f"{sg['f'] or 'St. Thomas'} — Catena on {label}", t['lemma'][:100], ['c', pp['id']])
        for ci, x in enumerate([y for y in sg['t'].split('\n\n') if y.strip()]):
            k += 1; _paras.append([di, ['c', pp['pack'], pp['id'], si, ci], k])
for s in json.loads((here / 'search-boylan.json').read_text(encoding='utf-8'))['sections']:
    _paras.append([_doc('Boylan on the Psalms', s['title'], 'Introduction' if s.get('scope') == 'chapter' else '', ['b', s.get('psalm'), (s.get('verses') or [1])[0]]), s['body']])
(out / 'atlas' / 'search-fathers.json').write_text(json.dumps({'v': 2, 'kinds': _kinds, 'docs': _docs, 'paras': _paras}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('calendar', (out / 'atlas' / 'liturgy-calendar.json').stat().st_size // 1024, 'KB; search', (out / 'atlas' / 'search-fathers.json').stat().st_size // 1024, 'KB,', len(_paras), 'passages')
for f in (here / 'sermons').glob('*.json'): shutil.copy(f, out / 'atlas' / f.name)
print('patched', out)

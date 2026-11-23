"""Combine the Gospel harmony table (with its 1962 liturgical uses) and the Breviary homilies.

Usage: python3 build_liturgy.py <harmony table .txt> <homilies.json> <out.json>
Output: {events: [...], homilies: {id: {...}}}
"""
import json, re, sys

table, homs, out = sys.argv[1:4]
GOSPELS = [('Mat', 'Matthew'), ('Mar', 'Mark'), ('Luk', 'Luke'), ('Joh', 'John')]
ABBR = {'matt': 'Mat', 'mark': 'Mar', 'luke': 'Luk', 'john': 'Joh'}

def harmony_refs(book, cell):
    """'2, 23-3, 21' / '1, 1-25*' / '3, 20-21; 3, 31-35' / '14-17*' / '21, 37 - 22, 6' → passages."""
    cell = cell.strip()
    if not cell: return []
    out = []
    for part in cell.split(';'):
        star = '*' in part; p = part.replace('*', '').replace(' ', '')
        m = re.match(r'^(\d+),(\d+)(?:-(?:(\d+),)?(\d+))?$', p)
        if m:
            c = int(m.group(1)); v = int(m.group(2)); c2 = int(m.group(3) or c); v2 = int(m.group(4) or v)
            out.append({'book': book, 'chapter': c, 'verse': v, 'endChapter': c2, 'endVerse': v2, 'read': star}); continue
        m = re.match(r'^(\d+)-(\d+)$', p)          # whole chapters
        if m: out.append({'book': book, 'chapter': int(m.group(1)), 'verse': 1, 'endChapter': int(m.group(2)), 'endVerse': 999, 'read': star}); continue
        m = re.match(r'^(\d+),(\d+)$', p)
        raise SystemExit(f'cannot read {book} {cell!r}')
    return out

def usage_ref(text):
    """'Ember Wed Advent (Luke 1:26-38)' → (label, part, passages)."""
    m = re.match(r'^(.*)\(((?:Matt|Mark|Luke|John)\.?\s[^()]*)\)\s*$', text.strip())
    if not m: return {'label': text.strip(), 'refs': []}
    label, ref = m.group(1).strip(), m.group(2)
    ref = re.sub(r'Luke 26:34\s*\[sic; presumably 24:34\]', 'Luke 24:34', ref)
    ref = re.sub(r'\s*\[sic;.*', '', ref)
    book = ABBR[re.match(r'(\w+)', ref).group(1).lower()]
    body = ref.split(None, 1)[1]
    refs, chapter = [], None
    for piece in re.split(r'[;,]\s*', body):
        piece = piece.strip()
        m2 = re.match(r'^(?:(\d+):)?(\d+)(?:-(?:(\d+):)?(\d+))?$', piece)
        if not m2: continue
        if m2.group(1): chapter = int(m2.group(1))
        if chapter is None: continue
        v = int(m2.group(2)); c2 = int(m2.group(3) or chapter); v2 = int(m2.group(4) or v)
        refs.append({'book': book, 'chapter': chapter, 'verse': v, 'endChapter': c2, 'endVerse': v2}); chapter = c2
    part = ''
    if ':' in label and not re.search(r'\d:\d', label):
        label, part = [s.strip() for s in label.rsplit(':', 1)]
    return {'label': label, 'part': part, 'text': ref, 'refs': refs}

rows = [l.rstrip('\n').split('\t') for l in open(table, encoding='utf-8')][1:]
events = []
for r in rows:
    r += [''] * (9 - len(r))
    r = [c.strip() for c in r]
    if r[1]:
        ev = {'id': f'h{len(events) + 1}', 'date': r[0], 'title': r[1], 'passages': [], 'temporal': [], 'sanctoral': [], 'propers': []}
        title, _, place = r[1].rpartition(', ') if ', ' in r[1] else (r[1], '', '')
        ev['event'], ev['place'] = (title, place) if title else (r[1], '')
        for (book, _), cell in zip(GOSPELS, r[2:6]): ev['passages'] += harmony_refs(book, cell)
        events.append(ev)
    ev = events[-1]
    for key, cell in (('temporal', r[6]), ('sanctoral', r[7]), ('propers', r[8])):
        if cell: ev[key].append(usage_ref(cell))

def overlap(a, b):
    if a['book'] != b['book']: return False
    s1, e1 = (a['chapter'], a['verse']), (a['endChapter'], a['endVerse'])
    s2, e2 = (b['chapter'], b['verse']), (b['endChapter'], b['endVerse'])
    return s1 <= e2 and s2 <= e1

def size(a): return (a['endChapter'] - a['chapter']) * 60 + a['endVerse'] - a['verse'] + 1

homilies = json.load(open(homs, encoding='utf-8'))
FATHERS = [(r'Gregory.*(Great|Pope)|Pope.*Gregory|Greg[oó]rii Pap', 'St. Gregory the Great'), (r'Augustin', 'St. Augustine'), (r'Ambros', 'St. Ambrose'),
           (r'Jerome|Hieron', 'St. Jerome'), (r'Chrysostom', 'St. John Chrysostom'), (r'Bede|Bed', 'St. Bede the Venerable'), (r'Hilar', 'St. Hilary'),
           (r'Bernard', 'St. Bernard'), (r'Leo', 'St. Leo the Great'), (r'Origen', 'Origen'), (r'Basil', 'St. Basil the Great'),
           (r'Cyril.*Alexand', 'St. Cyril of Alexandria'), (r'Peter Chrysologus|Chrysol', 'St. Peter Chrysologus'), (r'Bonavent', 'St. Bonaventure'),
           (r'Thomas', 'St. Thomas Aquinas'), (r'Cyprian', 'St. Cyprian'), (r'Maxim', 'St. Maximus of Turin'), (r'Damian', 'St. Peter Damian'),
           (r'Damascen', 'St. John Damascene'), (r'Anselm', 'St. Anselm'), (r'Bellarmin', 'St. Robert Bellarmine'), (r'Fulgent', 'St. Fulgentius'),
           (r'Ephr', 'St. Ephrem'), (r'Paulin', 'St. Paulinus of Nola'), (r'Laurence|Lauren', 'St. Laurence Justinian'), (r'Gregory', 'St. Gregory')]
DOCTORS = {'St. Gregory the Great', 'St. Augustine', 'St. Ambrose', 'St. Jerome', 'St. John Chrysostom', 'St. Bede the Venerable', 'St. Hilary', 'St. Bernard',
           'St. Leo the Great', 'St. Basil the Great', 'St. Cyril of Alexandria', 'St. Peter Chrysologus', 'St. Bonaventure', 'St. Thomas Aquinas',
           'St. Peter Damian', 'St. John Damascene', 'St. Anselm', 'St. Robert Bellarmine', 'St. Ephrem'}
for h in homilies:
    name = next((n for pat, n in FATHERS if re.search(pat, h['author'])), None)
    if not name:
        m = re.search(r'(St\.?\s+[A-Z][\w.]+(?:\s+(?:the\s+)?[A-Z]\w+)?)', h['author']); name = m.group(1) if m else h['author']
    h['father'] = name; h['doctor'] = name in DOCTORS
used = {}
for ev in events:
    found = []
    for h in homilies:
        p = h['pericope']
        hits = [x for x in ev['passages'] if overlap(p, x)]
        if not hits: continue
        # The pericope belongs to this event when most of it lies inside the event's passages.
        inside = max(min(size(p), size(x)) for x in hits)
        mass = any(overlap(p, r) for u in ev['temporal'] + ev['sanctoral'] for r in u['refs'])
        if inside >= min(3, size(p)) or mass: found.append((not mass, h['id']))
    ev['homilies'] = [i for _, i in sorted(found)]
    for i in ev['homilies']: used[i] = True
keep = {h['id']: h for h in homilies if h['id'] in used}
json.dump({'events': events, 'homilies': keep}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(events), 'events;', sum(1 for e in events if e['homilies']), 'with homilies;', len(keep), 'homilies used of', len(homilies))
print('events without:', [e['title'][:40] for e in events if not e['homilies']][:40])

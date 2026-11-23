"""Index complete sermons and commentaries of the Fathers and Doctors (human, public-domain translations only)
by the Gospel or Epistle passage they expound, and match them to the days of the 1962 liturgy.

Source: HistoricalChristianFaith Writings-Database (NPNF / Pusey etc.). Any file that says it was machine-translated is skipped,
as are works whose translation is not from a named (human) translator.
Usage: python3 build_sermons.py <Writings-Database dir> <liturgy-1962.json> <out dir>
Writes <out>/liturgy-sermons.json (index) and <out>/sermon-<id>.json (texts); adds day.sermons to liturgy-1962.json.
"""
import html, json, re, sys
from pathlib import Path

root, litpath, outdir = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
outdir.mkdir(parents=True, exist_ok=True)
ROMAN = {'i': 1, 'v': 5, 'x': 10, 'l': 50, 'c': 100}
def roman(s):
    s = s.lower(); t = 0
    for i, ch in enumerate(s):
        if ch not in ROMAN: return None
        v = ROMAN[ch]; t += -v if i + 1 < len(s) and ROMAN.get(s[i + 1], 0) > v else v
    return t
def num(s): return int(s) if s.isdigit() else roman(s)
MACHINE = re.compile(r'chatgpt|gpt-?4|machine[- ]translat|translated (?:into english )?(?:using|with|by) (?:an )?(?:ai|artificial)|claude|gemini', re.I)

def text_of(path):
    raw = path.read_text(encoding='utf-8', errors='replace')
    raw = re.sub(r'(?is)<script.*?</script>|<style.*?</style>|<head.*?</head>', '', raw)
    raw = re.sub(r'(?i)<sup[^>]*>.*?</sup>', '', raw)                      # footnote markers
    raw = re.sub(r'(?i)<br\s*/?>', '\n', raw)
    raw = re.sub(r'(?i)</(p|h\d|div|li|blockquote)>', '\n\n', raw)
    raw = re.sub(r'<[^>]+>', '', raw)
    t = html.unescape(raw).replace('\r', '')
    paras = [re.sub(r'\s+', ' ', p).strip() for p in re.split(r'\n\s*\n', t)]
    return [p for p in paras if p]

BOOKS = {'matt': 'Mat', 'matthew': 'Mat', 'mat': 'Mat', 'mark': 'Mar', 'luke': 'Luk', 'john': 'Joh', 'joh': 'Joh', 'rom': 'Rom', 'romans': 'Rom',
         '1 cor': '1Co', '2 cor': '2Co', 'gal': 'Gal', 'eph': 'Eph', 'ephes': 'Eph', 'phil': 'Phi', 'philip': 'Phi', 'col': 'Col', 'coloss': 'Col',
         '1 thess': '1Th', '2 thess': '2Th', '1 tim': '1Ti', '2 tim': '2Ti', 'tit': 'Tit', 'titus': 'Tit', 'philem': 'Phm', 'heb': 'Heb', 'hebr': 'Heb',
         'acts': 'Act', '1 john': '1Jo', 'jas': 'Jam', 'james': 'Jam'}
def book_of(name):
    k = re.sub(r'\s+', ' ', re.sub(r'^([12])\s*', r'\1 ', name.strip().lower().rstrip('.')))
    return BOOKS.get(k)

pieces = []
def add(father, doctor, work, title, ref, paras, source, kind='commentary', feasts=()):
    pid = f's{len(pieces) + 1}'
    pieces.append({'id': pid, 'father': father, 'doctor': doctor, 'work': work, 'title': title, 'ref': ref, 'kind': kind, 'feasts': list(feasts),
                   'source': source, 'words': sum(len(p.split()) for p in paras), '_paras': paras})

def files(folder):
    d = root / folder
    if not d.exists(): return []
    fs = [f for f in d.glob('*.html')]
    key = lambda f: [int(x) if x.isdigit() else x for x in re.split(r'(\d+)', f.stem)]
    return sorted(fs, key=key)

def human(paras):
    head = ' '.join(paras[:12])
    return not MACHINE.search(head)

# ---------- Sequential commentaries: each piece starts at a passage, and runs to the next piece ----------
def sequential(father, doctor, work, folder, book, header, source):
    found = []
    for f in files(folder):
        if not re.match(r'^(Homily|Tractate|Sermon|Lecture)\s+\d+$', f.stem): continue
        paras = text_of(f)
        if not human(paras): continue
        start = header(paras, book)
        if not start: continue
        found.append((f.stem, start, paras))
    for i, (stem, (b, c, v, end), paras) in enumerate(found):
        # The header quotes only the opening verses: the homily runs on until the next one begins.
        nxt = found[i + 1][1] if i + 1 < len(found) else None
        if nxt and nxt[0] == b and (nxt[1], nxt[2]) > (c, v):
            run = (nxt[1] - 1, 200) if nxt[2] == 1 and nxt[1] > c else (nxt[1], max(v, nxt[2] - 1))
        else:
            run = (c, 200) if not nxt else (c, v + 12)   # the last homily of a work runs to the end of its chapter
        end = max(end, run) if end else run
        ref = {'book': b, 'chapter': c, 'verse': v, 'endChapter': end[0], 'endVerse': end[1]}
        add(father, doctor, work, stem, ref, paras, source)

def head_chrys_gospel(paras, book):
    for p in paras[:4]:
        m = re.search(r'(Matthew|John|Mark|Luke) Chapter (\d+), Verse (\d+)', p)
        if m:
            last = re.findall(r'(?:Matthew|John|Mark|Luke) Chapter (\d+), Verse (\d+)', p)[-1]
            return (book_of(m.group(1)), int(m.group(2)), int(m.group(3)), (int(last[0]), int(last[1])) if len(re.findall('Chapter', p)) > 1 else None)
    return None
def head_roman(paras, book):
    for p in paras[:4]:
        m = re.match(r'^\W*(\d?\s*[A-Z][A-Za-z]{1,8})\.?\s+([IVXLCivxlc]+)\.\s*(\d+)', p)
        if m and book_of(m.group(1)) == book:
            return (book, roman(m.group(2)), int(m.group(3)), None)
    return None
def head_tractate(paras, book):
    for p in paras[:4]:
        m = re.match(r'^CHAPTER\s+([IVXLC]+)\.\s*(\d+)', p, re.I)
        if m:
            c, v = roman(m.group(1)), int(m.group(2))
            e = re.match(r'^CHAPTER\s+[IVXLC]+\.\s*\d+\s*[-–]\s*(\d+)\.?$', p, re.I)
            e2 = re.search(r'(?:TO|AND)\s+(?:CHAPTER\s+)?([IVXLC]+)\.\s*(\d+)', p[m.end():], re.I)
            end = (c, int(e.group(1))) if e else (roman(e2.group(1)), int(e2.group(2))) if e2 and roman(e2.group(1)) else None
            return (book, c, v, end)
    return None
def head_1john(paras, book):
    for p in paras[:4]:
        m = re.match(r'^1 John (\d+):(\d+)\s*[-–]\s*(?:(\d+):)?(\d+)', p)
        if m: return ('1Jo', int(m.group(1)), int(m.group(2)), (int(m.group(3) or m.group(1)), int(m.group(4))))
    return None

NPNF = 'Nicene and Post-Nicene Fathers (Schaff, 1886–1890)'

FULL = {'matthew': 'Mat', 'mark': 'Mar', 'luke': 'Luk', 'john': 'Joh', 'acts': 'Act', 'romans': 'Rom', '1 corinthians': '1Co', '2 corinthians': '2Co', 'galatians': 'Gal',
        'ephesians': 'Eph', 'philippians': 'Phi', 'colossians': 'Col', '1 thessalonians': '1Th', '2 thessalonians': '2Th', '1 timothy': '1Ti', '2 timothy': '2Ti',
        'titus': 'Tit', 'philemon': 'Phm', 'hebrews': 'Heb', '1 john': '1Jo'}
def bookname(s):
    s = re.sub(r'\s+', ' ', re.sub(r'^([12])\s*', r'\1 ', s.strip().lower().rstrip('.')))
    return FULL.get(s) or book_of(s)
NUMBER = r'([IVXLCivxlc]+|\d+)'
def head_any(paras, book):
    """Find the passage a homily opens with, in any of the header styles these files use."""
    for p in paras[1:5]:
        p = p.replace('chater', 'chapter')
        hits = re.findall(r'((?:[12] )?[A-Z][a-z]+) chapter (\d+), verse (\d+)', p, re.I)
        if hits and bookname(hits[0][0]) == book and p.lower().find('chapter') < 40:
            (_, c, v), (_, c2, v2) = hits[0], hits[-1]
            return (book, int(c), int(v), (int(c2), int(v2)) if len(hits) > 1 else None)
        m = re.match(r'^\W*((?:[12]\s?)?[A-Za-z]+)\.?\s+' + NUMBER + r'\.\s*(\d+)(?:\s*[-–,]\s*(?:' + NUMBER + r'\.\s*)?(\d+))?', p)
        if m and bookname(m.group(1)) == book and num(m.group(2)):
            c, v = num(m.group(2)), int(m.group(3))
            c2 = num(m.group(4)) if m.group(4) else c
            end = (c2, int(m.group(5))) if m.group(5) and (c2, int(m.group(5))) > (c, v) else None
            return (book, c, v, end)
        m = re.match(r'^\W*chapter\s+' + NUMBER + r'\.?\s*(?:verses?\s*)?(\d+)(?:\s*[-–]\s*(\d+))?', p, re.I)
        if m and num(m.group(1)):
            c, v = num(m.group(1)), int(m.group(2))
            return (book, c, v, (c, int(m.group(3))) if m.group(3) and int(m.group(3)) > v else None)
        m = re.match(r'^\W*((?:[12]\s?)?[A-Za-z]+)\.?\s+(\d+):(\d+)(?:\s*[-–]\s*(?:(\d+):)?(\d+))?', p)
        if m and bookname(m.group(1)) == book:
            c, v = int(m.group(2)), int(m.group(3))
            return (book, c, v, (int(m.group(4) or c), int(m.group(5))) if m.group(5) else None)
    return None
sequential('St. Augustine', True, 'Tractates on the Gospel of John', 'Augustine of Hippo/TRACTATES ON JOHN', 'Joh', head_any, NPNF + ', tr. John Gibb and James Innes')
sequential('St. Augustine', True, 'Homilies on the First Epistle of John', 'Augustine of Hippo/Ten Homilies on the First Epistle of John', '1Jo', head_any, NPNF + ', tr. H. Browne')
for sub, book in (('On Matthew', 'Mat'), ('On John', 'Joh')):
    sequential('St. John Chrysostom', True, f'Homilies on {"Matthew" if book == "Mat" else "John"}', f'John Chrysostom/Homilies/{sub}', book, head_any, NPNF)
for sub, book, name in (('On Romans', 'Rom', 'Romans'), ('On 1 Corinthians', '1Co', '1 Corinthians'), ('On 2 Corinthians', '2Co', '2 Corinthians'), ('On Galatians', 'Gal', 'Galatians'),
                        ('On Ephesians', 'Eph', 'Ephesians'), ('On Philippians', 'Phi', 'Philippians'), ('On Colossians', 'Col', 'Colossians'),
                        ('On 1 Thessalonians', '1Th', '1 Thessalonians'), ('On 2 Thessalonians', '2Th', '2 Thessalonians'), ('On 1 Timothy', '1Ti', '1 Timothy'),
                        ('On 2 Timothy', '2Ti', '2 Timothy'), ('On Titus', 'Tit', 'Titus'), ('On Philemon', 'Phm', 'Philemon'), ('On Hebrews', 'Heb', 'Hebrews'),
                        ('On the Acts of the Apostles', 'Act', 'Acts')):
    sequential('St. John Chrysostom', True, f'Homilies on {name}', f'John Chrysostom/Homilies/{sub}', book, head_any, NPNF)

# ---------- Single-file commentaries split by chapter, and whole books on one passage ----------
f = root / 'John Chrysostom/Homilies/On Galatians.html'
if f.exists():
    paras = text_of(f)
    if human(paras):
        marks = [i for i, x in enumerate(paras) if re.match(r'^Chapter\s+([IVX]+)\.?$', x)]
        for k, i in enumerate(marks):
            c = roman(re.match(r'^Chapter\s+([IVX]+)', paras[i]).group(1))
            add('St. John Chrysostom', True, 'Commentary on Galatians', f'Chapter {c}', {'book': 'Gal', 'chapter': c, 'verse': 1, 'endChapter': c, 'endVerse': 200},
                paras[i:marks[k + 1] if k + 1 < len(marks) else len(paras)], NPNF)
for book_file, rng in (('Book 1', (5, 1, 5, 48)), ('Book 2', (6, 1, 7, 29))):
    f = root / "Augustine of Hippo/OUR LORD'S SERMON ON THE MOUNT" / (book_file + '.html')
    if f.exists():
        paras = text_of(f)
        if human(paras):
            add('St. Augustine', True, "Our Lord's Sermon on the Mount", book_file, {'book': 'Mat', 'chapter': rng[0], 'verse': rng[1], 'endChapter': rng[2], 'endVerse': rng[3]}, paras, NPNF + ', tr. W. Findlay')
f = root / 'John Chrysostom/Homilies/2nd Homily On the birthday of our Savior.html'
if f.exists():
    paras = text_of(f)
    if human(paras): add('St. John Chrysostom', True, 'Sermon on the Birthday of our Saviour', 'On the Birthday of our Saviour Jesus Christ', None, paras, 'Tr. Bryson Sewell (released to the public domain)', kind='sermon', feasts=['christmas'])

# ---------- Augustine: Sermons on Selected Lessons of the New Testament (refs in the title) ----------
REFPAT = re.compile(r'\b(Matt|Mark|Luke|John|Rom|[12]\s?Cor|Gal|Eph|Phil|Col|[12]\s?Thess|[12]\s?Tim|Tit|Heb|Acts|1\s?John|James)\.?\s+([ivxlc]+|\d+)\.?\s*(\d+)(?:\s*[-–,]\s*(\d+))?', re.I)
for f in files('Augustine of Hippo/Sermons on Selected Lessons of the New Testament'):
    paras = text_of(f)
    if not human(paras) or not re.match(r'^Sermon\s+\d+$', f.stem): continue
    title = next((p for p in paras[1:4] if len(p) < 400), '')
    m = REFPAT.search(title)
    if not m: continue
    b = book_of(m.group(1)); c = num(m.group(2)); v = int(m.group(3)); e = int(m.group(4)) if m.group(4) and int(m.group(4)) > v else v
    if not b or not c: continue
    add('St. Augustine', True, 'Sermons on Selected Lessons of the New Testament', f'{f.stem}: {title[:160]}', {'book': b, 'chapter': c, 'verse': v, 'endChapter': c, 'endVerse': e}, paras,
        NPNF + ', tr. R. G. MacMullen', kind='sermon')

# ---------- Feast sermons: Leo the Great and Gregory Nazianzen, by the feast they were preached on ----------
FEASTS = [(r'Nativity', 'christmas'), (r'Epiphany', 'epiphany'), (r'Lent|Quadragesima', 'lent'), (r'Passion', 'passion'), (r'Resurrection', 'easter'),
          (r'Ascension', 'ascension'), (r'(Pentecost|Whi[td]suntide)(?!\s*Fast)', 'pentecost'), (r'December|Ten(th)? Month', 'ember-advent'), (r'Whi[td]suntide Fast', 'ember-pentecost'), (r'Seventh Month|September', 'ember-september'),
          (r'Transfiguration', 'transfiguration'), (r'Peter and Paul|Apostles Peter', 'peter-paul'), (r'Laurence|Lawrence', 'laurence'),
          (r'Beatitude', 'beatitudes'), (r'Anniversary|Elevation|Birthday of (?:his|St\. Leo)', 'pope'), (r'Maccabees', 'maccabees'), (r'Collection', 'collections')]
for f in files('Leo the Great/Sermons'):
    paras = text_of(f)
    if not human(paras): continue
    title = f.stem   # e.g. "Sermon 21 On the Feast of the Nativity, 1"
    tags = [k for pat, k in FEASTS if re.search(pat, title, re.I)]
    if 'transfiguration' in tags: tags = ['transfiguration']
    if not tags: continue
    add('St. Leo the Great', True, 'Sermons', re.sub(r'^Sermon (\d+)\s*\(?(.*?)\)?$', r'Sermon \1: \2', f.stem), None, paras, NPNF + ' 2nd ser. vol. 12, tr. C. L. Feltoe', kind='sermon', feasts=tags)
NAZ = [(r'Oration 38|Theophany|Birthday of Christ', 'christmas'), (r'Oration 39|Holy Lights', 'epiphany'), (r'Oration 41|Pentecost', 'pentecost'),
       (r'Oration 45|Second Oration on Easter', 'easter'), (r'Oration 1\b|Oration on Easter', 'easter'), (r'Oration 40|Holy Baptism', 'baptism')]
for f in files('Gregory of Nazianzus/Orations'):
    paras = text_of(f)
    if not human(paras): continue
    title = f.stem + ' ' + ' '.join(paras[:2])[:200]
    tags = sorted({k for pat, k in NAZ if re.search(pat, title, re.I)})
    if tags: add('St. Gregory Nazianzen', True, 'Orations', f'{f.stem}: {paras[1][:140] if len(paras) > 1 else ""}', None, paras, NPNF + ' 2nd ser. vol. 7, tr. C. G. Browne and J. E. Swallow', kind='sermon', feasts=tags)

# ---------- Match to days ----------
FEAST_DAYS = {'christmas': ['Christmas Day'], 'ember-pentecost': ['Ember Wednesday of Pentecost', 'Ember Friday of Pentecost', 'Ember Saturday of Pentecost'], 'epiphany': ['Epiphany'], 'baptism': ['Baptism of Our Lord'],
              'lent': ['1st Sunday of Lent', 'Ash Wednesday'], 'passion': ['Palm Sunday', 'Wednesday in Holy Week', 'Good Friday'], 'easter': ['Easter Sunday'],
              'ascension': ['Ascension'], 'pentecost': ['Pentecost'], 'ember-advent': ['Ember Wednesday of Advent', 'Ember Friday of Advent', 'Ember Saturday of Advent'],
              'ember-september': ['Ember Wednesday of September', 'Ember Friday of September', 'Ember Saturday of September'],
              'transfiguration': ['Transfiguration', '2nd Sunday of Lent'], 'peter-paul': ['Saints Peter & Paul'], 'laurence': ['St. Laurence'],
              'beatitudes': ['All Saints']}
def overlap_amount(a, b):
    if a['book'] != b['book']: return 0
    pos = lambda c, v: c * 300 + min(v, 299)
    s = max(pos(a['chapter'], a['verse']), pos(b['chapter'], b['verse'])); e = min(pos(a['endChapter'], a['endVerse']), pos(b['endChapter'], b['endVerse']))
    return max(0, e - s + 1)
lit = json.load(open(litpath, encoding='utf-8'))
used = set()
for d in lit['days']:
    found = []
    readings = [('Gospel', r) for g in d['gospels'] for r in g['refs']] + [('Epistle', r) for e in d.get('epistles', []) for r in e['refs']]
    events = {e['id']: e for e in lit['events']}
    for g in d['gospels']:
        ev = events.get(g.get('event'))
        if ev: readings += [('Parallel', x) for x in ev['passages'] if not any(x['book'] == r['book'] for r in g['refs'])]
    for p in pieces:
        if p['ref']:
            for which, r in readings:
                n = overlap_amount(p['ref'], r)
                if n and (which != 'Parallel' or n >= 2 or p['kind'] == 'sermon'):
                    size = max(1, (r['endChapter'] - r['chapter']) * 300 + r['endVerse'] - r['verse'] + 1)
                    found.append((which, -n / size, p['id'])); break
        elif any(d['title'] in FEAST_DAYS.get(t, []) for t in p['feasts']):
            found.append(('Feast', 0, p['id']))
    seen, out = set(), []
    for which, score, pid in sorted(found, key=lambda x: (['Gospel', 'Epistle', 'Feast', 'Parallel'].index(x[0]), x[1])):
        if pid in seen: continue
        seen.add(pid); out.append({'id': pid, 'on': which}); used.add(pid)
    d['sermons'] = out
json.dump(lit, open(litpath, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

index, packs = [], {}
PACK = 40   # sermons per bundle file, loaded only when one of them is opened
for p in pieces:
    if p['id'] not in used: continue
    paras = p.pop('_paras')
    # Translator's footnotes come last, each starting with its number: keep them apart from the text.
    k = len(paras)
    while k > 1 and re.match(r'^\d{1,3}\s+\S', paras[k - 1]) and len(paras[k - 1]) < 600: k -= 1
    notes, paras = paras[k:], paras[:k]
    p['pack'] = len(index) // PACK + 1
    packs.setdefault(p['pack'], {})[p['id']] = {'paragraphs': paras, 'notes': notes}
    index.append(p)
for n, texts in packs.items():
    json.dump(texts, open(outdir / f'liturgy-sermons-{n}.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump({'sermons': index, 'source': 'Texts: HistoricalChristianFaith Writings-Database (public domain; human translations only).'}, open(outdir / 'liturgy-sermons.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
from collections import Counter
print(len(pieces), 'pieces indexed;', len(index), 'used;', Counter(p['work'] for p in index).most_common())
days = lit['days']
print('days with full sermons:', sum(1 for d in days if d['sermons']), 'of', len(days), '| on Epistle:', sum(1 for d in days if any(s['on'] == 'Epistle' for s in d['sermons'])))
print('words total', sum(p['words'] for p in index))

"""Find the 1962 Missal's Epistle (and Gospel) for every day of the liturgy list.

Reads Divinum Officium's missa files (Vulgate numbering) and adds to each day:
  epistles: [{text, refs}]   and, where the table gave no Gospel, gospels from the Missal.
Usage: python3 build_missal.py <divinum-officium missa dir> <liturgy-1962.json>   (updates in place)
"""
import json, re, sys
from pathlib import Path

root, path = Path(sys.argv[1]), Path(sys.argv[2])
data = json.load(open(path, encoding='utf-8'))
cache = {}

def sections(lang, name):
    if (lang, name) in cache: return cache[(lang, name)]
    secs, cur = {}, None
    f = root / lang / (name + '.txt')
    if not f.exists() and name.startswith('Commune/'):
        for alt in (root.parent / 'horas' / lang / (name + '.txt'), root.parent.parent.parent / 'obsolete' / 'missa' / lang / (name + '.txt')):
            if alt.exists() and '[Evangelium' in alt.read_text(encoding='utf-8', errors='replace'): f = alt; break
    if f.exists():
        for line in f.read_text(encoding='utf-8', errors='replace').splitlines():
            if cur is None and not secs and line.startswith('@'): secs['__parent__'] = [line[1:].strip()]; continue
            m = re.match(r'^\[([^\]]+)\]\s*(\(.*\))?\s*$', line)
            if m:
                cond = (m.group(2) or '').lower()
                if cond and not (re.search(r'196(?!3)', cond) or 'nisi rubrica tridentina' in cond or 'communi summorum' in cond): cur = None; continue
                cur = m.group(1).strip(); secs[cur] = []; continue
            if cur is not None: secs[cur].append(line)
    cache[(lang, name)] = secs
    return secs

def resolve(lang, name, sec, depth=0):
    secs = sections(lang, name)
    lines = secs.get(sec)
    if lines is None:
        # A file may inherit whole sections: a first-line "@Commune/C6a", or "vide C6-1" in its rule.
        parent = (secs.get('__parent__') or [None])[0]
        if not parent and lang != 'Latin':
            # A translated file leaves out what it inherits: the Latin file says where its lessons come from.
            lat = sections('Latin', name)
            parent = (lat.get('__parent__') or [None])[0]
            if not parent and sec in lat:
                ref = next((l.strip() for l in lat[sec] if l.strip().startswith('@')), None)
                if ref:
                    mm = re.match(r'^@([^:]*)(?::([^:]*))?', ref)
                    got = resolve(lang, mm.group(1) or name, mm.group(2) or sec, depth + 1)
                    if got: return got
            secs = {**lat, **secs}
        if not parent:
            rule = ' '.join(secs.get('Rule', []) + secs.get('Rank', []))
            v = re.search(r'vide\s+(C[\w-]+|Sancti/[\w-]+|Tempora/[\w-]+)', rule)
            if v: parent = v.group(1) if '/' in v.group(1) else 'Commune/' + v.group(1)
        if parent and depth < 6 and parent != name: return resolve(lang, parent.split(':')[0], sec, depth + 1)
        return None
    out = []
    for line in lines:
        m = re.match(r'^@([^:]*)(?::([^:]*))?', line.strip())
        if m and depth < 6:
            got = resolve(lang, m.group(1) or name, m.group(2) or sec, depth + 1) or []
            out.extend(got)
        else: out.append(line)
    return out

BOOKS = {'matt': 'Mat', 'mark': 'Mar', 'luke': 'Luk', 'john': 'Joh', 'rom': 'Rom', '1 cor': '1Co', '2 cor': '2Co', 'gal': 'Gal', 'eph': 'Eph', 'phil': 'Phi',
         'col': 'Col', '1 thess': '1Th', '2 thess': '2Th', '1 tim': '1Ti', '2 tim': '2Ti', 'titus': 'Tit', 'tit': 'Tit', 'heb': 'Heb', 'jas': 'Jam', 'james': 'Jam',
         '1 pet': '1Pe', '2 pet': '2Pe', '1 john': '1Jo', '2 john': '2Jo', '3 john': '3Jo', 'apoc': 'Rev', 'rev': 'Rev', 'acts': 'Act', 'isa': 'Isa', 'is': 'Isa',
         'jer': 'Jer', 'ezek': 'Eze', 'dan': 'Dan', 'joel': 'Joe', 'jonah': 'Jon', 'mal': 'Mal', 'zech': 'Zec', 'mic': 'Mic', 'hos': 'Hos', 'amos': 'Amo',
         'gen': 'Gen', 'exod': 'Exo', 'lev': 'Lev', 'num': 'Num', 'deut': 'Deu', '1 kings': '1Ki', '2 kings': '2Ki', '3 kings': '1Ki', '4 kings': '2Ki',
         '1 sam': '1Sa', '2 sam': '2Sa', 'esther': 'Est', 'esth': 'Est', 'prov': 'Pro', 'eccli': 'Sir', 'ecclus': 'Sir', 'sir': 'Sir', 'wis': 'Wis', 'cant': 'Sol',
         'song': 'Sol', 'judith': 'Jdt', 'tob': 'Tob', '1 mach': '1Ma', '2 mach': '2Ma', 'bar': 'Bar', 'lam': 'Lam', 'zeph': 'Zep', 'job': 'Job', 'ruth': 'Rut',
         'judg': 'Jdg', 'jos': 'Jos', 'josh': 'Jos', 'ex': 'Exo', 'neh': 'Neh', 'ezra': 'Ezr', '1 esdr': 'Ezr', '2 esdr': 'Neh', 'psalm': 'Psa', 'ps': 'Psa',
         'hag': 'Hag', 'agg': 'Hag', 'nah': 'Nah', 'hab': 'Hab', 'obad': 'Oba', '1 par': '1Ch', '2 par': '2Ch', '1 chron': '1Ch', '2 chron': '2Ch', 'mk': 'Mar', 'mt': 'Mat', 'lk': 'Luk', 'jn': 'Joh', 'sap': 'Wis', 'hebr': 'Heb', 'ephes': 'Eph', 'philipp': 'Phi', '3 reg': '1Ki', '4 reg': '2Ki', '1 petri': '1Pe', '2 petri': '2Pe', 'osee': 'Hos', '1 joann': '1Jo', 'jo': 'Joh', 'jc': 'Jam', 'jac': 'Jam', 'isai': 'Isa', 'malach': 'Mal', 'jonas': 'Jon', 'eccles': 'Ecc', 'jude': 'Jud', 'jud': 'Jud', 'ezech': 'Eze', 'act': 'Act', 'thess': '1Th', '1 thes': '1Th', '2 thes': '2Th', 'luc': 'Luk', 'marc': 'Mar', 'joann': 'Joh', 'matth': 'Mat', 'joannes': 'Joh', '1 joannes': '1Jo', 'lucas': 'Luk', 'marcus': 'Mar', 'matthǽum': 'Mat', 'matthæus': 'Mat'}
def parse(ref):
    ref = ref.strip().rstrip('.')
    m = re.match(r'^((?:[1-4]\s*)?[A-Za-zæǽ]+)\.?\s+(\d+)\s*[:.]\s*(\d+)', ref)
    if not m: return None
    key = re.sub(r'\s+', ' ', re.sub(r'^([1-4])\s*', r'\1 ', m.group(1).lower()))
    book = BOOKS.get(key) or BOOKS.get(key.rstrip('s'))
    if not book: return None
    c = int(m.group(2)); v = int(m.group(3)); c2, v2 = c, v
    for piece in re.findall(r'(?:[;,]\s*|\s*[-–]\s*)(?:(\d+)\s*[:.]\s*)?(\d+)', ref[m.end():]):
        if piece[0]: c2 = int(piece[0])
        v2 = int(piece[1])
    if (c2, v2) < (c, v): c2, v2 = c, v
    return {'book': book, 'chapter': c, 'verse': v, 'endChapter': c2, 'endVerse': v2}

def reading(name, sec):
    for lang in ('English', 'Latin'):
        lines = resolve(lang, name, sec)
        refs = [l[1:].strip() for l in lines or [] if l.startswith('!')]
        p = parse(refs[0]) if refs else None
        if p: break
    if not p: return None
    head = next((l for l in lines if l.strip() and not l.startswith('!')), '')
    # The words of the lesson itself, in English where the Missal has them (needed for books the reader lacks).
    en = resolve('English', name, sec) or lines
    at = next((i for i, l in enumerate(en) if l.startswith('!')), None)
    body = [re.sub(r'[+¶]', '', l).strip() for l in (en[at + 1:] if at is not None else []) if l.strip() and not l.startswith(('!', '@', '&', '$', '_'))]
    return {'text': refs[0], 'heading': head.strip(), 'refs': [p] if p else [], 'body': ' '.join(body)[:6000]}

TEMPORAL = {
 '1st Sunday of Advent': 'Adv1-0', '2nd Sunday of Advent': 'Adv2-0', '3rd Sunday of Advent': 'Adv3-0', 'Ember Wednesday of Advent': 'Adv3-3', 'Ember Friday of Advent': 'Adv3-5',
 'Ember Saturday of Advent': 'Adv3-6', '4th Sunday of Advent': 'Adv4-0', 'Christmas Eve': '../Sancti/12-24', 'Christmas Day': '../Sancti/12-25m3',
 'Sunday within the Octave of Christmas': 'Nat1-0', 'Octave Day of Christmas': '../Sancti/01-01', 'Holy Name of Jesus': 'Nat2-0', 'Fifth Day within the Octave of Christmas': '../Sancti/12-29', 'Weekdays 2–5 January': 'Nat2-0', 'Weekdays 7–12 January': '../Sancti/01-06', 'Weekdays 7–12 January after the Holy Family': 'Epi1-0', 'Eucharistic Heart of Jesus': None, 'Most Pure Heart of Our Lady': None,
 'Epiphany': '../Sancti/01-06', 'Holy Family': 'Epi1-0', 'Baptism of Our Lord': '../Sancti/01-13',
 '2nd Sunday after Epiphany': 'Epi2-0', '3rd Sunday after Epiphany': 'Epi3-0', '4th Sunday after Epiphany': 'Epi4-0', '5th Sunday after Epiphany': 'Epi5-0', '6th Sunday after Epiphany': 'Epi6-0',
 'Septuagesima': 'Quadp1-0', 'Sexagesima': 'Quadp2-0', 'Quinquagesima': 'Quadp3-0', 'Ash Wednesday': 'Quadp3-3', 'Thursday after Ash Wednesday': 'Quadp3-4',
 'Friday after Ash Wednesday': 'Quadp3-5', 'Saturday after Ash Wednesday': 'Quadp3-6', 'Passion Sunday': 'Quad5-0', 'Palm Sunday': 'Quad6-0', 'Monday in Holy Week': 'Quad6-1',
 'Tuesday in Holy Week': 'Quad6-2', 'Wednesday in Holy Week': 'Quad6-3', 'Maundy Thursday': 'Quad6-4', 'Good Friday': 'Quad6-5', 'Easter Vigil': 'Quad6-6',
 'Easter Sunday': 'Pasc0-0', 'Easter Monday': 'Pasc0-1', 'Easter Tuesday': 'Pasc0-2', 'Easter Wednesday': 'Pasc0-3', 'Easter Thursday': 'Pasc0-4', 'Easter Friday': 'Pasc0-5',
 'Easter Saturday': 'Pasc0-6', 'Low Sunday': 'Pasc1-0', '2nd Sunday after Easter': 'Pasc2-0', '3rd Sunday after Easter': 'Pasc3-0', '4th Sunday after Easter': 'Pasc4-0',
 '5th Sunday after Easter': 'Pasc5-0', 'Rogation Days': 'Pasc5-1', 'Vigil of Ascension': 'Pasc5-3', 'Ascension': 'Pasc5-4', 'Sunday after Ascension': 'Pasc6-0',
 'Vigil of Pentecost': 'Pasc6-6', 'Pentecost': 'Pasc7-0', 'Pentecost Monday': 'Pasc7-1', 'Pentecost Tuesday': 'Pasc7-2', 'Ember Wednesday of Pentecost': 'Pasc7-3',
 'Pentecost Thursday': 'Pasc7-4', 'Ember Friday of Pentecost': 'Pasc7-5', 'Ember Saturday of Pentecost': 'Pasc7-6', 'Trinity Sunday': 'Pent01-0',
 '1st Sunday after Pentecost': 'Pent01-1', 'Corpus Christi': 'Pent01-4', '2nd Sunday after Pentecost': 'Pent02-0', 'Sacred Heart of Jesus': 'Pent02-5',
 'Ember Wednesday of September': '093-3', 'Ember Friday of September': '093-5', 'Ember Saturday of September': '093-6',
 'Christ the King': '../Sancti/10-DU', 'Last Sunday after Pentecost': 'Pent24-0',
}
for n in range(3, 24): TEMPORAL[f'{n}{"rd" if n in (3, 23) else "nd" if n == 22 else "st" if n == 21 else "th"} Sunday after Pentecost'] = f'Pent{n:02d}-0'
for w, wk in ((1, 'Quad1'), (2, 'Quad2'), (3, 'Quad3'), (4, 'Quad4')):
    nth = {1: '1st', 2: '2nd', 3: '3rd', 4: '4th'}[w]
    TEMPORAL[f'{nth} Sunday of Lent'] = f'{wk}-0'
    for i, d in enumerate(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], 1):
        TEMPORAL[f'{d} of the {nth} week of Lent'] = f'{wk}-{i}'
TEMPORAL.update({'Ember Wednesday of Lent': 'Quad1-3', 'Ember Friday of Lent': 'Quad1-5'})
for i, d in enumerate(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], 1): TEMPORAL[f'{d} in Passion Week'] = f'Quad5-{i}'

HORAS = root.parent / 'horas' / 'Latin'
LATIN = {'sorrows': 'dolor', 'seven': 'septem', 'sacred': 'sacrat', 'heart': 'cord', 'precious': 'pretios', 'blood': 'sanguin', 'cross': 'cruc',
         'name': 'nomin', 'apparition': 'apparit', 'conversion': 'conver', 'chair': 'cathedr', 'nativity': 'nativ', 'assumption': 'assumpt',
         'annunciation': 'annunt', 'visitation': 'visitat', 'purification': 'purific', 'candlemas': 'purific', 'transfiguration': 'transfig',
         'exaltation': 'exalt', 'immaculate': 'immacul', 'conception': 'concept', 'innocents': 'innocent', 'king': 'regis', 'queen': 'regin',
         'rosary': 'rosar', 'dedication': 'dedicat', 'basilica': 'basilic', 'michael': 'michael', 'archangel': 'archang', 'guardian': 'custod',
         'angels': 'angel', 'stephen': 'stephan', 'john': 'joann', 'james': 'jacob', 'peter': 'petr', 'paul': 'paul', 'andrew': 'andre',
         'thomas': 'thom', 'matthew': 'matth', 'luke': 'luc', 'mark': 'marc', 'jude': 'jud', 'simon': 'simon', 'bartholomew': 'bartholom',
         'philip': 'philipp', 'joseph': 'joseph', 'anne': 'ann', 'joachim': 'joachim', 'lawrence': 'laurent', 'laurence': 'laurent',
         'mary': 'mari', 'agnes': 'agn', 'lucy': 'luci', 'agatha': 'agath', 'cecilia': 'caecil', 'martin': 'martin', 'gregory': 'gregor',
         'leo': 'leon', 'benedict': 'benedict', 'patrick': 'patric', 'anthony': 'antoni', 'francis': 'francisc', 'dominic': 'dominic',
         'ignatius': 'ignat', 'augustine': 'augustin', 'ambrose': 'ambros', 'jerome': 'hieronym', 'bernard': 'bernard', 'clare': 'clar',
         'catherine': 'catharin', 'catharine': 'catharin', 'teresa': 'teres', 'louis': 'ludovic', 'charles': 'carol', 'edward': 'eduard',
         'stanislaus': 'stanisl', 'gervase': 'gervas', 'basilides': 'basilid', 'mother': 'matern', 'motherhood': 'matern', 'all': 'omn',
         'saints': 'sanct', 'souls': 'defunct', 'holy': 'sanct', 'family': 'famil', 'blessed': 'b.', 'precursor': 'praecurs', 'baptist': 'baptist',
         'beheading': 'decollat', 'birth': 'nativ', 'vigil': 'vigil', 'octave': 'octav', 'worker': 'opific', 'mediatrix': 'mediatric', 'christ': 'christ', 'pius': 'pii', 'titus': 'tit', 'vitus': 'vit', 'felix': 'felic',
         'snows': 'niv', 'madeleine': 'magdal', 'barat': 'barat', 'tryphon': 'tryfon', 'regis': 'regis', 'symphorosa': 'symforos', 'sons': 'filiis', 'mark': 'marc'}
STOP = {'st', 'saint', 'saints', 'and', 'of', 'the', 'companions', 'our', 'lady', 'blessed', 'virgin', 'b', 'v', 'm', 'mass', 'votive', 'in', 'to', 'at', 'on', 'a', 'de'}
def latinish(text):
    import unicodedata
    t = text.lower().replace('æ', 'ae').replace('œ', 'oe')
    t = ''.join(c for c in unicodedata.normalize('NFKD', t) if not unicodedata.combining(c))
    for a, b in (('á', 'a'), ('é', 'e'), ('í', 'i'), ('ó', 'o'), ('ú', 'u'), ('ǽ', 'ae'), ('ý', 'y')): t = t.replace(a, b)
    return t.replace('ae', 'e').replace('ph', 'f').replace('h', '').replace('y', 'i').replace('k', 'c')
def office_for(d):
    """The Breviary file of this feast in the general calendar, matched by date and name (None for a local feast)."""
    stem = '%02d-%02d' % tuple(d['sort'])
    words = [w for w in re.findall(r'[a-z]+', d['title'].lower()) if w not in STOP]
    keys = [latinish(LATIN.get(w, w[:5])) for w in words if len(w) > 2]
    if not keys: return None
    best = None
    for path in sorted(HORAS.joinpath('Sancti').glob(stem + '*.txt')):
        if re.search(r'oct$|o$|t$', path.stem) and path.stem != stem: continue
        text = path.read_text(encoding='utf-8', errors='replace')
        parent = re.match(r'^@(Sancti/[\w-]+)', text)   # a file that inherits everything names its source on the first line
        if parent and HORAS.joinpath(parent.group(1) + '.txt').exists(): text += '\n' + HORAS.joinpath(parent.group(1) + '.txt').read_text(encoding='utf-8', errors='replace')
        head = latinish(' '.join(re.findall(r'^\[Officium\][^\n]*\n([^\n]*)', text, re.M) + re.findall(r'^\[Rank\][^\n]*\n([^\n]*)', text, re.M)))
        hits = sum(1 for k in keys if k[:4] in head)
        if hits and (best is None or hits > best[0]): best = (hits, 'Sancti/' + path.stem)
    return best[1] if best else None
def feast_class(files):
    """Read the [Rank] line (the 1960-rubric variant where there is one) and turn DO's rank number into a class."""
    for f in files:
        stem = f.split(' ·')[0]
        base = re.sub(r'(r|m\d)$', '', stem)
        for path in (HORAS / (stem + '.txt'), HORAS / (base + '.txt'), root / 'Latin' / (stem + '.txt'), root / 'Latin' / (base + '.txt')):
            if not path.exists(): continue
            text = path.read_text(encoding='utf-8', errors='replace')
            ranks = re.findall(r'^\[Rank\]\s*(\(rubrica 196(?!3)[^)]*\))?\s*\n(.*?)(?:\n\((sed )?rubrica 196(?!3)[^)]*\)\s*\n(.*?))?(?:\n|$)', text, re.M)
            if not ranks: continue
            r = ranks[0]
            line = r[3] if r[3] else r[1]
            for whole in ranks:
                if whole[0]: line = whole[1]
            parts = line.split(';;')
            try: n = float(parts[2])
            except (IndexError, ValueError): continue
            label = parts[1].lower() if len(parts) > 1 else ''
            if re.search(r'\biii\.? class', label): return 3
            if re.search(r'\bii\.? class', label): return 2
            if re.search(r'\bi\.? class', label) or n >= 6: return 1
            if n >= 5: return 2
            if n >= 2: return 3
            return 4
    return 3

def overlap(a, b):
    return a['book'] == b['book'] and (a['chapter'], a['verse']) <= (b['endChapter'], b['endVerse']) and (b['chapter'], b['verse']) <= (a['endChapter'], a['endVerse'])

sancti = sorted(p.stem for p in (root / 'Latin' / 'Sancti').glob('*.txt'))

def common_masses():
    out = []
    files = {('horas', p.stem) for p in (root.parent / 'horas' / 'Latin' / 'Commune').glob('*.txt')} | {('obs', p.stem) for p in (root.parent.parent.parent / 'obsolete' / 'missa' / 'Latin' / 'Commune').glob('*.txt')}
    for kind, stem in sorted(files):
        name = 'Commune/' + stem
        secs = sections('Latin', name)
        for sec in secs:
            if not sec.startswith('Evangelium'): continue
            ev = reading(name, sec)
            lec = reading(name, sec.replace('Evangelium', 'Lectio')) or reading(name, 'Lectio')
            if ev and lec: out.append((name, sec, lec, ev))
    return out
COMMON_MASSES = common_masses()
def size(r): return (r['endChapter'] - r['chapter']) * 80 + r['endVerse'] - r['verse'] + 1
def close_match(a, b):
    if not overlap(a, b): return False
    s = max((a['chapter'], a['verse']), (b['chapter'], b['verse'])); e = min((a['endChapter'], a['endVerse']), (b['endChapter'], b['endVerse']))
    inter = (e[0] - s[0]) * 80 + e[1] - s[1] + 1
    return inter >= .6 * max(size(a), size(b))
commune = sorted({p.stem for p in (root.parent / 'horas' / 'Latin' / 'Commune').glob('*.txt') if '[Evangelium' in p.read_text(encoding='utf-8', errors='replace')} | {p.stem for p in (root.parent.parent.parent / 'obsolete' / 'missa' / 'Latin' / 'Commune').glob('*.txt')})
missing = []
for d in data['days']:
    names = []
    if d['cycle'] == 'temporal':
        key = TEMPORAL.get(d['title']) or TEMPORAL.get(d.get('missal_title', ''))
        if key: names = ['Tempora/' + key if not key.startswith('..') else key[3:]]
    elif d['cycle'] == 'sanctoral':
        stem = '%02d-%02d' % tuple(d['sort'])
        dated = [s for s in sancti if s.startswith(stem)]
        best = [s for s in dated if re.fullmatch(stem + r'(r|m\d)?', s)]
        names = ['Sancti/' + s for s in (sorted(best, key=lambda s: (not s.endswith('r'), s)) or dated)]
    else:
        names = ['Commune/' + s for s in commune]
    picks = []
    for n in names:
        ev, ep = reading(n, 'Evangelium'), reading(n, 'Lectio')
        if not ep and not ev: continue
        fits = d['cycle'] == 'temporal' or not d['gospels'] or (ev and any((close_match if d['cycle'] == 'common' else overlap)(ev['refs'][0], r) for g in d['gospels'] for r in g['refs']))
        if fits: picks.append((n, ep, ev))
    if d['cycle'] != 'temporal' and len(picks) > 1 and d['cycle'] == 'common': picks = picks[:3]
    if not any(ep for _, ep, _ in picks) and d['gospels'] and d['cycle'] != 'temporal':
        # The feast takes its Mass from a Common: find the Common Mass with this Gospel.
        for n, sec, lec, ev in COMMON_MASSES:
            if any(close_match(ev['refs'][0], r) for g in d['gospels'] for r in g['refs']):
                picks.append((n + (' · ' + sec if sec != 'Evangelium' else ''), {**lec, 'common': True}, ev)); break
    d['missal'] = [{'file': n, 'epistle': ep, 'gospel': ev} for n, ep, ev in picks[:3]]
    if not d['gospels'] and picks and picks[0][2]:
        d['gospels'] = [{'event': None, 'part': 'From the Missal', 'text': picks[0][2]['text'], 'refs': picks[0][2]['refs']}]
        d['gospel_from_missal'] = True
    d['epistles'] = []
    for n, ep, ev in picks:
        if ep and not any(x['text'] == ep['text'] for x in d['epistles']): d['epistles'].append({**ep, 'file': n, 'with': ev['text'] if ev else ''})
    if not d['epistles'] and d['gospels']: missing.append(d['title'])
    # The Gospel as printed in the Missal, for reading the whole Mass in the Liturgy tab.
    d['gospel_texts'] = []
    for n, ep, ev in picks:
        if ev and ev.get('body') and not any(x['text'] == ev['text'] for x in d['gospel_texts']): d['gospel_texts'].append({'text': ev['text'], 'heading': ev['heading'], 'body': ev['body']})
    # The feast's class in the 1962 rubrics (1 = I class … 4 = commemoration), for working out the Mass of the day.
    if d['cycle'] == 'sanctoral':
        # Match the feast to the Breviary's own entry for its date by the saint's name; none means a local calendar.
        own = office_for(d)
        d['local'] = own is None
        d['class'] = feast_class([own] if own else [x['file'] for x in d['missal']] or ['Sancti/%02d-%02d' % tuple(d['sort'])])

# The Matins homily of the day is the one filed under the same office as the day's Mass.
for d in data['days']:
    files = [x['file'].split(' ·')[0] for x in d.get('missal', [])]
    if not files or not d['homilies']: continue
    def offices(h): return [h['office']] + [a['office'] for a in h.get('also', [])]
    hit = next((h for h in d['homilies'] if any(o == f or f.startswith(o) or o.startswith(f) for o in offices(data['homilies'][h['id']]) for f in files)), None)
    if hit:
        for h in d['homilies']: h['own'] = h is hit
        d['homilies'].sort(key=lambda h: not h['own'])
# ---------- The Proper of the Mass: Introit, Collect, Gradual … Postcommunion, in Latin and English ----------
PRAYERS = {}
for lang in ('Latin', 'English'):
    f = root.parent / 'horas' / lang / 'Psalterium' / 'Common' / 'Prayers.txt'
    cur = None; PRAYERS[lang] = {}
    for line in (f.read_text(encoding='utf-8', errors='replace').splitlines() if f.exists() else []):
        m = re.match(r'^\[([^\]]+)\]\s*(\(.*\))?\s*$', line)
        if m: cur = m.group(1).strip() if not m.group(2) else None; (PRAYERS[lang].setdefault(cur, []) if cur else None); continue
        if cur and line.strip(): PRAYERS[lang][cur].append(line)
PARTS = [('Introitus', 'Introit'), ('Oratio', 'Collect'), ('Lectio', 'Epistle'), ('Graduale', 'Gradual'), ('Tractus', 'Tract'), ('Sequentia', 'Sequence'),
         ('Evangelium', 'Gospel'), ('Offertorium', 'Offertory'), ('Secreta', 'Secret'), ('Communio', 'Communion'), ('Postcommunio', 'Postcommunion')]
def clean_lines(lines, lang, depth=0):
    out = []
    for l in lines or []:
        l = l.rstrip()
        if not l.strip() or l.strip() == '_' or l.startswith('(') or l.startswith('@'): continue
        if l[0] in '$&':
            key = l[1:].strip()
            got = PRAYERS.get(lang, {}).get(key) or PRAYERS.get('Latin', {}).get(key)
            if got and depth < 2: out.extend(clean_lines(got, lang, depth + 1))
            continue
        if l.startswith('!'): out.append({'cite': l[1:].strip()}); continue
        l = re.sub(r'^[vr]\.\s*', '', l)
        l = re.sub(r'^V\.\s*', '℣. ', l); l = re.sub(r'^R\.\s*', '℟. ', l)
        l = re.sub(r'[¶+]\s*', '', l).strip()
        if l: out.append({'text': l})
    return out
PROPERS = {}
for d in data['days']:
    files = [x['file'].split(' ·')[0] for x in d.get('missal', [])]
    if not files: continue
    n = files[0]; parts = []
    for sec, title in PARTS:
        la = resolve('Latin', n, sec)
        if la is None: continue
        en = resolve('English', n, sec)
        part = {'key': sec, 'title': title, 'la': clean_lines(la, 'Latin'), 'en': clean_lines(en, 'English') if en else []}
        if sec in ('Lectio', 'Evangelium'): part['ref'] = next((l[1:].strip() for l in la if l.startswith('!')), '')
        parts.append(part)
    if any(p.get('la') for p in parts): PROPERS[d['id']] = {'file': n, 'parts': parts}
json.dump(PROPERS, open(path.parent / 'liturgy-propers.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('propers for', len(PROPERS), 'of', len(data['days']), 'days')
json.dump(data, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
from collections import Counter
print('days with an Epistle:', Counter(d['cycle'] for d in data['days'] if d['epistles']), 'of', Counter(d['cycle'] for d in data['days']))
print('Gospels filled from the Missal:', [d['title'] for d in data['days'] if d.get('gospel_from_missal')])
print('no Epistle found:', missing[:60])

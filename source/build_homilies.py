"""Collect the Breviary's Gospel homilies (Fathers and Doctors) from Divinum Officium.

For every office whose lessons open with a Gospel pericope ("!Luke 5:1-11") followed by a homily,
gather the pericope, the homilist, the source and the homily text in English and Latin.
Usage: python3 build_homilies.py <divinum-officium horas dir> <out.json>
"""
import json, re, sys
from pathlib import Path

root, out = Path(sys.argv[1]), Path(sys.argv[2])
BOOKS = {'matt': 'Mat', 'matth': 'Mat', 'mt': 'Mat', 'mark': 'Mar', 'marc': 'Mar', 'mk': 'Mar', 'luke': 'Luk', 'luc': 'Luk', 'lk': 'Luk', 'john': 'Joh', 'joann': 'Joh', 'jn': 'Joh', 'joh': 'Joh', 'joannes': 'Joh', 'joannem': 'Joh', 'lucas': 'Luk', 'lucam': 'Luk', 'marcus': 'Mar', 'marcum': 'Mar', 'matthaeus': 'Mat', 'matthæus': 'Mat', 'matthaeum': 'Mat', 'matthæum': 'Mat'}
HEAD = re.compile(r'^\W*(From|Continuation|The Lesson|Lesson|L[ée]ctio|Sequ[ée]ntia|Initium)\b.*(Gospel|Evang)', re.I)
cache = {}

def sections(lang, name):
    key = (lang, name)
    if key in cache: return cache[key]
    path = root / lang / (name + '.txt')
    secs = {}
    if path.exists():
        cur = None
        for line in path.read_text(encoding='utf-8', errors='replace').splitlines():
            m = re.match(r'^\[([^\]]+)\]\s*(\(.*\))?\s*$', line)
            if m:
                cond = (m.group(2) or '').lower()
                # Keep the plain section; a variant applies only if it names the 1960 rubrics or excludes older ones.
                if cond and not (re.search(r'196(?!3)', cond) or 'nisi rubrica tridentina' in cond): cur = None; continue
                cur = m.group(1).strip(); secs[cur] = []; continue
            if cur is not None: secs[cur].append(line)
    cache[key] = secs
    return secs

def resolve(lang, name, sec, depth=0):
    lines = sections(lang, name).get(sec)
    if lines is None or depth > 6: return None
    outl = []
    for line in lines:
        m = re.match(r'^@([^:]*)(?::([^:]*))?(?::(.*))?$', line.strip())
        if m:
            fname = m.group(1) or name; s2 = m.group(2) or sec; subs = m.group(3) or ''
            got = resolve(lang, fname, s2, depth + 1) or []
            text = '\n'.join(got)
            for a, b, flags in re.findall(r's/((?:[^/\\]|\\.)*)/((?:[^/\\]|\\.)*)/(\w*)', subs):
                try: text = re.sub(a.replace('$', r'\Z') if a == '$' else a, b.replace('\\', ''), text, count=0 if 'g' in flags else 1, flags=re.S if 's' in flags else 0)
                except re.error: pass
            outl.extend(text.split('\n'))
        else: outl.append(line)
    return outl

def clean(lines):
    text = []
    for l in lines:
        l = l.rstrip()
        if not l or l == '_' or l.startswith('&') or l.startswith('$'): text.append(''); continue
        if l.startswith('!'): continue
        text.append(re.sub(r'^v\.\s*', '', l))
    paras = [p for p in '\n'.join(text).split('\n\n')]
    return '\n\n'.join(re.sub(r'\s*\n\s*', ' ', p).strip() for p in paras if p.strip())

def pericope(ref):
    m = re.match(r'^\s*(?:St\.\s*)?([A-Za-zæ]+)\.?\s+(\d+)\s*[:,]\s*(\d+)(?:\s*[-–]\s*(?:(\d+)\s*[:,]\s*)?(\d+))?', ref)
    if not m or m.group(1).lower() not in BOOKS: return None
    c = int(m.group(2)); v = int(m.group(3)); c2 = int(m.group(4) or c); v2 = int(m.group(5) or v)
    tail = re.findall(r'[;,]\s*(\d+)\s*:\s*(\d+)(?:\s*[-–]\s*(\d+))?', ref[m.end():])   # "15:26-27; 16:1-4" continues
    if tail: c2 = int(tail[-1][0]); v2 = int(tail[-1][2] or tail[-1][1])
    return {'book': BOOKS[m.group(1).lower()], 'chapter': c, 'verse': v, 'endChapter': c2, 'endVerse': v2}

def homily(lang, name, first):
    lines = resolve(lang, name, f'Lectio{first}')
    if not lines: return None
    head = [l for l in lines[:6]]
    if not any(HEAD.search(l) for l in head[:2]): return None
    refs = [l[1:].strip() for l in lines if l.startswith('!')]
    per = pericope(refs[0]) if refs else None
    if not per: return None
    # Split: incipit before "_", homily heading after it.
    try: cut = lines.index('_')
    except ValueError: cut = None
    incipit = clean(lines[2:cut]) if cut else ''
    rest = lines[cut + 1:] if cut else lines[3:]
    author = rest[0].strip() if rest else ''
    source = rest[1][1:].strip() if len(rest) > 1 and rest[1].startswith('!') else ''
    body = [clean(rest[2 if source else 1:])]
    for n in (first + 1, first + 2):
        more = resolve(lang, name, f'Lectio{n}')
        if not more or any(HEAD.search(l) for l in more[:1]): break
        body.append(clean(more))
    return {'ref': refs[0], 'pericope': per, 'incipit': incipit, 'author': author, 'source': source, 'lessons': [b for b in body if b]}

SANCTI_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
result = []
for kind in ('Tempora', 'Sancti', 'Commune'):
    for path in sorted((root / 'English' / kind).glob('*.txt')):
        name = f'{kind}/{path.stem}'
        if re.search(r'(o|tt|r|t|a|g)$', path.stem) and kind == 'Tempora' and (root / 'English' / kind / (re.sub(r'(o|tt|r|t|a|g)$', '', path.stem) + '.txt')).exists():
            continue   # older-rubric or alternative variants of a day already covered
        if kind == 'Sancti' and re.search(r'oct$', path.stem): continue   # octave days dropped before 1962
        for first in (7, 1):
            en = homily('English', name, first)
            if not en: continue
            la = homily('Latin', name, first)
            title = (resolve('Latin', name, 'Officium') or resolve('English', name, 'Officium') or [''])[0].strip()
            entry = {'id': f'{name}#{first}', 'office': name, 'title': title, 'nocturn': 3 if first == 7 else 1, **en,
                     'latin': {'author': la['author'], 'source': la['source'], 'incipit': la['incipit'], 'lessons': la['lessons']} if la else None}
            if kind == 'Sancti':
                m = re.match(r'(\d\d)-(\d\d)', path.stem)
                if m: entry['date'] = f'{int(m.group(2))} {SANCTI_MONTHS[int(m.group(1)) - 1]}'
            result.append(entry); break

# The same homily filed under several days (a Sunday repeated in the week): keep one, list every office.
merged = {}
for e in result:
    key = (e['author'], e['lessons'][0][:120] if e['lessons'] else '')
    if key in merged: merged[key]['also'].append({'office': e['office'], 'title': e['title'], **({'date': e['date']} if 'date' in e else {})})
    else: e['also'] = []; merged[key] = e
items = list(merged.values())
out.write_text(json.dumps(items, ensure_ascii=False), encoding='utf-8')
print(len(result), 'offices;', len(items), 'distinct homilies;', sum(1 for e in items if e['latin']), 'with Latin')
from collections import Counter
print(Counter(re.sub(r'^(Homily|Sermon|Exposition)\s+(by|of|from)\s+', '', e['author']).split(',')[0][:40] for e in items).most_common(15))

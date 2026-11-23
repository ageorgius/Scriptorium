"""Organise the harmony table's 1962 uses as the liturgical year: temporal cycle, sanctoral cycle, commons & votives.

Usage: python3 build_days.py <liturgy.json> <out.json>
"""
import json, re, sys
from collections import OrderedDict

src, out = sys.argv[1:3]
data = json.load(open(src, encoding='utf-8'))
events, homilies = data['events'], data['homilies']

# ---------- Temporal cycle: (season, [labels in order]) ----------
def lent(week, days): return [f'{week} {d} Lent' for d in days]
SEASONS = [
 ('Advent', ['1st Sun Advent', '2nd Sun Advent', '3rd Sun Advent', 'Ember Wed Advent', 'Ember Fri Advent', 'Ember Sat Advent', '4th Sun Advent']),
 ('Christmastide', ['Christmas Eve', 'Christmas Day', 'Sun in Octave of Christmas', '5th Day in Octave of Christmas', 'Octave Day of Christmas',
                    'Sun aft Octave of Christmas', 'Jan 2nd-5th']),
 ('Epiphany & after', ['Epiphany', 'Jan 7th-12th before 1st Sun aft Epiphany', '1st Sun aft Epiphany (Holy Family)', 'Jan 7th-12th aft 1st Sun aft Epiphany',
                       'Baptism of Our Lord', '2nd Sun aft Epiphany', '3rd Sun aft Epiphany', '3rd, 4th, 5th & 6th Sun aft Epiphany', '4th Sun aft Epiphany',
                       '5th Sun aft Epiphany', '6th Sun aft Epiphany']),
 ('Septuagesima', ['Septuagesima', 'Sexagesima', 'Quinquagesima']),
 ('Lent', ['Ash Wed', 'Thu aft Ash Wed', 'Fri aft Ash Wed', 'Sat aft Ash Wed', '1st Sun Lent', '1st Mon Lent', '1st Tue Lent', 'Ember Wed Lent', '1st Thu Lent',
           'Ember Fri Lent', '2nd Sun Lent', '2nd Mon Lent', '2nd Tue Lent', '2nd Wed Lent', '2nd Thu Lent', '2nd Fri Lent', '2nd Sat Lent',
           '3rd Sun Lent', '3rd Mon Lent', '3rd Tue Lent', '3rd Wed Lent', '3rd Thu Lent', '3rd Fri Lent', '3rd Sat Lent',
           '4th Sun Lent', '4th Mon Lent', '4th Tue Lent', '4th Wed Lent', '4th Thu Lent', '4th Fri Lent', '4th Sat Lent']),
 ('Passiontide & Holy Week', ['Passion Sun', 'Mon in Passion Wk', 'Tue in Passion Wk', 'Wed in Passion Wk', 'Thu in Passion Wk', 'Fri in Passion Wk', 'Sat in Passion Wk',
                             'Palm Sun', 'Mon in Holy Week', 'Tue in Holy Week', 'Wed in Holy Week', 'Maundy Thu', 'Good Fri']),
 ('Eastertide', ['Easter Vigil', 'Easter Sun', 'Easter Mon', 'Easter Tue', 'Easter Wed', 'Easter Thu', 'Easter Fri', 'Easter Sat', 'Low Sun',
                 '2nd Sun aft Easter', '3rd Sun aft Easter', '4th Sun aft Easter', '5th Sun aft Easter', 'Rogation Days', 'Vigil of Ascension', 'Ascension',
                 'Sun aft Ascension', 'Vigil of Pentecost']),
 ('Pentecost & its octave', ['Pentecost', 'Pentecost Mon', 'Pentecost Tue', 'Ember Wed Pentecost', 'Pentecost Thu', 'Ember Fri Pentecost', 'Ember Sat Pentecost']),
 ('Time after Pentecost', ['Trinity Sun', '1st Sun aft Pentecost (now only on ferias after Trinity Sun)', 'Corpus Christi', '2nd Sun aft Pentecost', 'Sacred Heart of Jesus',
                           '2nd Thu aft Corpus Christi (Eucharistic Heart of Jesus)', '2nd Sat aft Corpus Christi (Most Pure Heart of O.L.)']
                          + [f'{n}{"st" if n % 10 == 1 and n != 11 else "nd" if n % 10 == 2 and n != 12 else "rd" if n % 10 == 3 and n != 13 else "th"} Sun aft Pentecost' for n in range(3, 17)]
                          + ['Ember Wed Sept', 'Ember Fri Sept', 'Ember Sat Sept']
                          + [f'{n}{"st" if n % 10 == 1 and n != 11 else "nd" if n % 10 == 2 and n != 12 else "rd" if n % 10 == 3 and n != 13 else "th"} Sun aft Pentecost' for n in range(17, 24)]
                          + ['Last Sun in Oct (Christ the King)', 'Last Sun aft Pentecost']),
]
ALIAS = {'Sun in Christmas Octave': 'Sun in Octave of Christmas', '7th-12th Jan bef 1st Sun aft Epiphany': 'Jan 7th-12th before 1st Sun aft Epiphany', '7th-12th Jan aft 1st Sun aft Epiphany': 'Jan 7th-12th aft 1st Sun aft Epiphany'}
TEMPORAL = {label: (si, i) for si, (_, labels) in enumerate(SEASONS) for i, label in enumerate(labels)}
NAMES = {'Sun': 'Sunday', 'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday',
         'aft': 'after', 'Wk': 'Week', 'Sept': 'September', 'O.L.': 'Our Lady'}
def pretty(label):
    s = ' '.join(NAMES.get(w, w) for w in label.split(' '))
    s = re.sub(r'^(\d\w\w) Sunday (Lent|Advent)$', r'\1 Sunday of \2', s)
    s = re.sub(r'^(\d\w\w) (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday) (Lent|Advent)$', r'\2 of the \1 week of \3', s)
    s = re.sub(r'^Ember (\w+) (Advent|Lent|Pentecost|September)$', r'Ember \1 of \2', s)
    s = s.replace('Ash Wed', 'Ash Wednesday').replace('Maundy Thursday', 'Maundy Thursday').replace('Good Friday', 'Good Friday')
    return s.replace('Ash Wednesdaynesday', 'Ash Wednesday')
def temporal_key(label):
    label = ALIAS.get(label, label)
    part = ''
    m = re.match(r'^(.*?) \((Passion)\)$', label)
    if m: label, part = m.group(1), 'Passion'
    if ': ' in label: label, p2 = label.split(': ', 1); part = (p2 + (' · ' + part if part else ''))
    if label not in TEMPORAL: raise SystemExit('unknown temporal day: ' + label)
    return label, part

# ---------- Sanctoral cycle ----------
MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
EXPAND = [(r'\bB\.V\.M\.', 'Blessed Virgin Mary'), (r'\bO\.L\.', 'Our Lady'), (r'\bSs\.', 'Saints'), (r'\bTrans\.', 'Translation'), (r'\bApp\.', 'Apparition'),
          (r'\bConv\.', 'Conversion'), (r'\bMirac\.', 'Miraculous'), (r'\bBls?\.', 'Blessed'), (r'\bet al\b', 'and companions')]
def expand(s):
    for a, b in EXPAND: s = re.sub(a, b, s)
    return s
DATE_FIX = {'7th Jan (St. Anthony)': '17th Jan (St. Anthony)'}   # St. Anthony, Abbot, is kept on 17 January
def sanctoral_key(label):
    label = DATE_FIX.get(label, label)
    m = re.match(r'^(\d+)\w\w(?: or \d+\w\w)? (\w{3}) \((.*)\)$', label)
    if not m: return None
    day, month, name = int(m.group(1)), MONTHS.index(m.group(2)) + 1, m.group(3)
    part = ''
    m2 = re.match(r'^(.*?): (.*Mass)$', name)
    if m2: name, part = m2.group(1), m2.group(2)
    return (month, day), name, part
def words(name): return {w for w in re.findall(r'[a-z]+', expand(name).lower()) if w not in {'of', 'the', 'st', 'saint', 'saints', 'and', 'companions', 'holy', 'blessed', 'our', 'lady', 'virgin', 'mary', 'seven', '7'}}

# ---------- Commons, votive Masses, Masses for the dead ----------
def common_key(label):
    l = re.sub(r'\s*\[[^\]]*\]$', '', label)
    l = re.sub(r'^Mass pro defunctis \((.*)\)$', r'Mass pro defunctis, \1', l)
    part = ''
    m = re.match(r'^(Common of .*?) \(([IVX, ]+)\)$', l)
    if m: l, part = m.group(1), 'Mass ' + m.group(2)
    group = 'Commons of Saints' if l.startswith('Common') else 'Votive Masses' if l.startswith('Votive') else 'Masses for the Dead' if 'defunctis' in l else 'Nuptial Mass' if l.startswith('Nuptial') else None
    if not group: raise SystemExit('unplaced day: ' + label)
    return group, l, part

days = OrderedDict()
def day(cycle, key, title, sort, group, subtitle=''):
    if key not in days: days[key] = {'id': f'd{len(days) + 1}', 'cycle': cycle, 'title': title, 'sort': sort, 'group': group, 'subtitle': subtitle, 'gospels': [], 'propers': []}
    return days[key]

sanct_names = {}   # (month, day) -> list of (key, words)
def resolve_label(label):
    if label.split(':')[0].strip() in TEMPORAL or ALIAS.get(label.split(':')[0].strip()) or re.sub(r' \(Passion\)$', '', label).split(': ')[0] in TEMPORAL:
        l, part = temporal_key(label)
        si, i = TEMPORAL[l]
        return day('temporal', ('T', l), pretty(l), [si, i], SEASONS[si][0]), part
    s = sanctoral_key(label)
    if s:
        (month, d), name, part = s
        bucket = sanct_names.setdefault((month, d), [])
        w = words(name)
        match = next((k for k, kw in bucket if len(w & kw) >= max(1, min(len(w), len(kw)) // 2)), None)
        if match is None:
            match = ('S', month, d, name); bucket.append((match, w))
        rec = day('sanctoral', match, expand(name), [month, d], FULL[month - 1], f'{d} {FULL[month - 1]}')
        if len(expand(name)) > len(rec['title']): rec['title'] = expand(name)
        return rec, part
    group, l, part = common_key(label)
    order = ['Commons of Saints', 'Votive Masses', 'Masses for the Dead', 'Nuptial Mass'].index(group)
    return day('common', ('C', l), expand(l), [order, l], group), part

def ref_text(r):
    b = {'Mat': 'Matt.', 'Mar': 'Mark', 'Luk': 'Luke', 'Joh': 'John'}[r['book']]
    end = f"{r['endVerse']}" if r['endChapter'] == r['chapter'] else f"{r['endChapter']}:{r['endVerse']}"
    return f"{b} {r['chapter']}:{r['verse']}" + (f'-{end}' if (r['endChapter'], r['endVerse']) != (r['chapter'], r['verse']) else '')

for ev in events:
    for key in ('temporal', 'sanctoral'):
        for u in ev[key]:
            label = u['label'] + (': ' + u['part'] if u['part'] else '')
            rec, part = resolve_label(label)
            rec['gospels'].append({'event': ev['id'], 'part': part, 'text': u.get('text', ''), 'refs': u['refs']})
    for u in ev['propers']:
        rec, part = resolve_label(u['label'])
        rec['propers'].append({'event': ev['id'], 'part': ' · '.join(x for x in (part, u['part']) if x), 'text': u.get('text', ''), 'refs': u['refs']})

# ---------- Homilies: the Matins homily on this day's Gospel ----------
def overlap(a, b):
    if a['book'] != b['book']: return 0
    pos = lambda c, v: c * 200 + min(v, 199)
    s = max(pos(a['chapter'], a['verse']), pos(b['chapter'], b['verse'])); e = min(pos(a['endChapter'], a['endVerse']), pos(b['endChapter'], b['endVerse']))
    if e < s: return 0
    size = lambda x: pos(x['endChapter'], x['endVerse']) - pos(x['chapter'], x['verse']) + 1
    return (e - s + 1) / min(size(a), size(b)) * (1 if max(size(a), size(b)) < 3 * min(size(a), size(b)) else .6)
KIND = {'temporal': ('Tempora', 'Sancti'), 'sanctoral': ('Sancti',), 'common': ('Commune',)}
for rec in days.values():
    scored = []
    for h in homilies.values():
        best = max((overlap(h['pericope'], r) for g in rec['gospels'] for r in g['refs']), default=0)
        if best < .5: continue
        offices = [h['office']] + [a['office'] for a in h.get('also', [])]
        kind = any(o.split('/')[0] in KIND[rec['cycle']] for o in offices)
        dated = rec['cycle'] == 'sanctoral' and any(o == 'Sancti/%02d-%02d' % tuple(rec['sort']) or o.startswith('Sancti/%02d-%02d' % tuple(rec['sort'])) for o in offices)
        def fit(a, b):   # how closely the homily's pericope matches the day's Gospel (1 = identical)
            if a['book'] != b['book']: return 0
            span = lambda x: (x['chapter'] * 200 + x['verse'], x['endChapter'] * 200 + min(x['endVerse'], 199))
            (s1, e1), (s2, e2) = span(a), span(b)
            inter = min(e1, e2) - max(s1, s2) + 1
            return max(0, inter) / (max(e1, e2) - min(s1, s2) + 1)
        close = max((fit(h['pericope'], r) for g in rec['gospels'] for r in g['refs']), default=0)
        scored.append((dated, kind, round(best, 2), close, h['id']))
    scored.sort(reverse=True)
    # Keep this day's own homily first; others on the same Gospel follow as further reading.
    own_kind = {'temporal': 'Tempora', 'sanctoral': None, 'common': 'Commune'}[rec['cycle']]
    first = next((i for d, k, b, c, i in scored if d or (own_kind and b >= .6 and any(o.split('/')[0] == own_kind for o in [homilies[i]['office']] + [a['office'] for a in homilies[i].get('also', [])]))), None)
    rec['homilies'] = [{'id': i, 'own': i == first} for d, k, b, c, i in scored[:6]]
    rec['homilies'].sort(key=lambda h: not h['own'])

out_days = sorted(days.values(), key=lambda r: (['temporal', 'sanctoral', 'common'].index(r['cycle']), r['sort']))
RENAME = {
 'Last Sunday in Oct (Christ the King)': ('Christ the King', 'Last Sunday of October'),
 '1st Sunday after Pentecost (now only on ferias after Trinity Sun)': ('1st Sunday after Pentecost', 'In 1962 this Mass is said only on the weekdays after Trinity Sunday'),
 '1st Sunday after Epiphany (Holy Family)': ('Holy Family', '1st Sunday after Epiphany'),
 '2nd Thursday after Corpus Christi (Eucharistic Heart of Jesus)': ('Eucharistic Heart of Jesus', 'Thursday after the octave of Corpus Christi (for some places)'),
 '2nd Saturday after Corpus Christi (Most Pure Heart of O.L.)': ('Most Pure Heart of Our Lady', 'Saturday after the octave of Corpus Christi (for some places)'),
 'Jan 2nd-5th': ('Weekdays 2–5 January', ''),
 'Jan 7th-12th before 1st Sunday after Epiphany': ('Weekdays 7–12 January', 'Before the feast of the Holy Family'),
 'Jan 7th-12th after 1st Sunday after Epiphany': ('Weekdays 7–12 January after the Holy Family', 'After the feast of the Holy Family'),
 '3rd, 4th, 5th & 6th Sunday after Epiphany': ('3rd–6th Sundays after Epiphany', 'Chants shared by these Sundays'),
 'Sunday after Octave of Christmas': ('Holy Name of Jesus', 'Sunday between 2 and 5 January'),
 'Sunday in Octave of Christmas': ('Sunday within the Octave of Christmas', ''),
 '5th Day in Octave of Christmas': ('Fifth Day within the Octave of Christmas', '29 December'),
}
WORDS = [(r'^V\.M\.\s*(.*)$', r'\1 (Votive Mass)'), (r'\bDel\.', 'Deliverance'), (r'\bAnniv\.', 'Anniversary'), (r'\baft\b', 'after'), (r'\bBarnabus\b', 'Barnabas'), (r'\[([^\]]+)\]', r'(\1)')]
for r in out_days:
    r.setdefault('note', '')
    if r['title'] in RENAME: r['title'], r['note'] = RENAME[r['title']]
    for a, b in WORDS: r['title'] = re.sub(a, b, r['title'])
    m = re.match(r'^Votive Mass \((.*)\)$', r['title'])
    if m: r['title'] = 'Votive Mass: ' + m.group(1)
    m = re.match(r'^Mass pro defunctis, (.*)$', r['title'])
    if m: r['title'] = 'Mass for the Dead: ' + m.group(1).replace('Day after Burial', 'Day after Burial')
    r['title'] = expand(r['title'])
used = {h['id'] for r in out_days for h in r['homilies']}
for e in events: e['homilies'] = [i for i in e['homilies'] if i in homilies]
result = {'days': out_days, 'events': events, 'homilies': {i: h for i, h in homilies.items()},
          'seasons': [s for s, _ in SEASONS], 'source': 'Gospel harmony and 1962 usage table supplied by the user; homilies from the Divinum Officium project (divinumofficium.com), Matins lessons.'}
json.dump(result, open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
from collections import Counter
print(Counter(r['cycle'] for r in out_days), 'days;', sum(1 for r in out_days if any(h['own'] for h in r['homilies'])), 'with own homily;', sum(1 for r in out_days if r['homilies']), 'with any')
print('temporal without homily:', [r['title'] for r in out_days if r['cycle'] == 'temporal' and not r['homilies'] and r['gospels']])
print('sanctoral dates sample:', [(r['subtitle'], r['title']) for r in out_days if r['cycle'] == 'sanctoral'][:12])

"""Psalm divisions of the Roman Breviary under the 1960 rubrics (the 1962 typical edition).

Source: the Divinum Officium project's psalter (web/www/horas/Latin/Psalterium/Psalmi),
which marks each division as psalm(first-last), Vulgate numbering. Day1..Day6 are Monday..Saturday.
Usage: python3 build_breviary.py <Psalmi folder> <output.json>
"""
import json, re, sys
from pathlib import Path

src, out = Path(sys.argv[1]), Path(sys.argv[2])
DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
MINOR = {'Dominica': 0, 'Feria II': 1, 'Feria III': 2, 'Feria IV': 3, 'Feria V': 4, 'Feria VI': 5, 'Sabbato': 6}
HOURS = {'Prima': 'Prime', 'Tertia': 'Terce', 'Sexta': 'Sext', 'Nona': 'None', 'Completorium': 'Compline'}
ROMAN = ['I', 'II', 'III']
LETTERS = ['Aleph', 'Beth', 'Gimel', 'Daleth', 'He', 'Vau', 'Zain', 'Heth', 'Teth', 'Jod', 'Caph', 'Lamed', 'Mem', 'Nun', 'Samech', 'Ain', 'Phe', 'Sade', 'Coph', 'Res', 'Sin', 'Tau']

def sections(text):
    out, name = {}, None
    for line in text.splitlines():
        m = re.match(r'^\[(.+?)\]\s*$', line)
        if m: name = m.group(1); out[name] = []; continue
        if name is not None: out[name].append(line)
    return out

def psalm(token):
    """'17(2-'16b')' -> (17, '2', '16b'); '92' -> (92, None, None). Half-verse letters are kept for display."""
    m = re.match(r"^\s*\[?(\d+)(?:\(\s*'?(\d+[a-c]?)'?\s*-\s*'?(\d+[a-c]?)'?\s*\))?\]?\s*$", token)
    if not m: raise SystemExit(f'Unrecognized psalm reference: {token!r}')
    return int(m.group(1)), m.group(2), m.group(3)
num = lambda v: int(re.match(r'\d+', v).group())

uses = {}
def add(token, use):
    """use is (day index, hour label)."""
    n, a, b = psalm(token)
    if n > 150: return  # canticles are numbered from 200
    uses.setdefault(n, {}).setdefault((a, b), []).append(use)

matins = sections((src / 'Psalmi matutinum.txt').read_text(encoding='utf-8'))
for d in range(7):
    nocturn = 0
    for line in matins[f'Day{d}']:
        if line.startswith('V.'): nocturn += 1; continue
        if ';;' not in line: continue
        when = 'Matins' + (f', {ROMAN[nocturn]} nocturn' if d == 0 else '') + (' (not on penitential days)' if d == 3 and nocturn == 2 else '')
        add(line.split(';;')[1].strip(), (d, when))
# On penitential Wednesdays Psalm 50 goes to Lauds II and Psalm 49 is said in three parts.
nocturn = 0
for line in matins['Day31']:
    if line.startswith('V.'): nocturn += 1; continue
    if ';;' in line and nocturn == 2: add(line.split(';;')[1].strip(), (3, 'Matins on penitential days'))

major = sections((src / 'Psalmi major.txt').read_text(encoding='utf-8'))
for d in range(7):
    for key, label in ((f'Day{d} Laudes1', 'Lauds I'), (f'Day{d} Laudes2', 'Lauds II (penitential days)'), (f'Day{d} Vespera', 'Vespers')):
        for line in major[key]:
            if ';;' in line: add(line.split(';;')[1].strip(), (d, label))

minor = sections((src / 'Psalmi minor.txt').read_text(encoding='utf-8'))
for hour, label in HOURS.items():
    lines = [l for l in minor[hour] if l.strip()]
    for i in range(0, len(lines) - 1, 2):
        day = lines[i].split('=')[0].strip()
        if day not in MINOR: continue
        for token in lines[i + 1].split(','):
            token = token.strip()
            if not token: continue
            add(token, (MINOR[day], label + (' (penitential days)' if token.startswith('[') else '')))

# Psalm 94 is the Invitatory, said at the start of Matins every day; it is not in the weekly psalter files.
uses.setdefault(94, {})[(None, None)] = [(d, 'Invitatory at Matins') for d in range(7)]

def describe(where):
    """[(day, hour)] -> ['Sunday Prime', 'Daily Lauds II (penitential days)', 'Monday and Thursday Vespers']"""
    hours = {}
    for d, hour in dict.fromkeys(where): hours.setdefault(hour, []).append(d)
    out = []
    for hour, days in sorted(hours.items(), key=lambda kv: min(kv[1])):
        days = sorted(set(days))
        if len(days) == 7: out.append(f'Daily: {hour}')
        else: out.append(' and '.join([', '.join(DAYS[d] for d in days[:-1]), DAYS[days[-1]]] if len(days) > 1 else [DAYS[days[0]]]) + ' ' + hour)
    return out

psalms = {}
for n in sorted(uses):
    divisions = []
    for (a, b), where in sorted(uses[n].items(), key=lambda kv: (num(kv[0][0]) if kv[0][0] else 0, num(kv[0][1]) if kv[0][1] else 0)):
        item = {'uses': describe(where)}
        if a is not None:
            item['first'], item['last'] = num(a), num(b)
            if a != str(item['first']) or b != str(item['last']): item['label'] = f'{a}–{b}'
            if n == 118 and (item['first'] - 1) % 8 == 0 and item['last'] - item['first'] == 15: item['name'] = f'{LETTERS[(item["first"] - 1) // 8]}–{LETTERS[(item["first"] - 1) // 8 + 1]}'
        divisions.append(item)
    psalms[n] = divisions

out.write_text(json.dumps({'source': 'Divinum Officium psalter, Roman Breviary 1960 rubrics (Vulgate numbering)', 'psalms': psalms}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(len(psalms), 'psalms;', sum(1 for d in psalms.values() for x in d if 'first' in x), 'divisions')
for n in (17, 49, 50, 94, 144, 116, 109, 44):
    print(n, [(x.get('label') or (x.get('first'), x.get('last')), x.get('name'), x['uses']) for x in psalms.get(n, [])])

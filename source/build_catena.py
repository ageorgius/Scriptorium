"""The Catena Aurea of St. Thomas Aquinas on the four Gospels (Oxford translation ed. J. H. Newman, 1841-45),
from the verbatim, verse-keyed corpus of github.com/AlvaroBalbin/catena (public domain text).

Writes an index (one line per Gospel passage) and one file per Gospel with the Fathers' words.
Verse numbers are the Vulgate/Douay ones the Missal uses; 'nav' gives the reader's numbering where it differs.
Usage: python3 build_catena.py <catena repo data/catena dir> <out dir>
"""
import json, sys
from pathlib import Path
from vulgate_nav import to_kjv

src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
GOSPELS = {'matthew': 'Mat', 'mark': 'Mar', 'luke': 'Luk', 'john': 'Joh'}
index = []
for slug, code in GOSPELS.items():
    pack, rows = f'catena-{code.lower()}', {}
    for line in open(src / f'{slug}.jsonl', encoding='utf-8'):
        d = json.loads(line)
        keys = [tuple(int(x) for x in k.split('/')[1:]) for k in d.get('commented_verse_keys') or []]
        if not keys:
            parts = d['id'].split('.')
            keys = [(int(parts[2]), int(parts[3]))]
        keys.sort()
        (c1, v1), (c2, v2) = keys[0], keys[-1]
        segs = []
        for s in d['segments']:
            text = s['text'].strip()
            if not text: continue
            if segs and segs[-1]['f'] == s.get('father'): segs[-1]['t'] += '\n\n' + text
            else: segs.append({'f': s.get('father') or '', 't': text})
        rows[d['id']] = {'lemma': d.get('lemma', ''), 'segs': segs}
        k1, k2 = to_kjv(code, c1, v1), to_kjv(code, c2, v2)
        entry = {'id': d['id'], 'b': code, 'c': c1, 'v': v1, 'c2': c2, 'v2': v2, 'lemma': d.get('lemma', '')[:160],
                 'fathers': list(dict.fromkeys(s['f'] for s in segs if s['f'])), 'n': sum(len(s['t']) for s in segs), 'pack': pack}
        if (k1, k2) != ((c1, v1), (c2, v2)): entry['nav'] = {'c': k1[0], 'v': k1[1], 'c2': k2[0], 'v2': k2[1]}
        index.append(entry)
    (out / f'{pack}.json').write_text(json.dumps(rows, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
(out / 'catena-index.json').write_text(json.dumps({
    'title': 'Catena Aurea', 'author': 'St. Thomas Aquinas',
    'edition': 'Commentary on the Four Gospels, collected out of the works of the Fathers. Oxford translation, ed. John Henry Newman (London: J. G. F. and J. Rivington, 1841–45). Public domain.',
    'passages': index}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(len(index), 'passages;', sum(e['n'] for e in index) // 1000, 'thousand characters')

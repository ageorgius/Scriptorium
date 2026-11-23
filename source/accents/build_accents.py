"""Accents for the Antoniades Patriarchal Text, which Scriptorium has only without accents.
Each word of Dr Robinson's Antoniades text (byztxt/greektext-antoniades, unaccented) takes the accented form of the same
word in the same verse of the Robinson–Pierpont Byzantine text (byztxt/byzantine-majority-text, accented), which differs
from the Patriarchal text in few places; words found only in Antoniades take the commonest accented form of that word in
the Byzantine text. Both sources are in the public domain. (An optional third folder of MorphGNT SBLGNT files can add
forms, but its text is under the SBLGNT licence, so the published data is built without it: pass an empty folder.) Output: one file per book, verse → accented words."""
import csv, json, os, re, sys, unicodedata, collections, difflib
ant_dir, rp_dir, sbl_dir, out = sys.argv[1:5]
os.makedirs(out, exist_ok=True)
BOOKS = [('MT', 'MAT', 'Mt', 'Mat'), ('MR', 'MAR', 'Mk', 'Mar'), ('LU', 'LUK', 'Lk', 'Luk'), ('JOH', 'JOH', 'Jn', 'Joh'), ('AC', 'ACT', 'Ac', 'Act'),
         ('RO', 'ROM', 'Ro', 'Rom'), ('1CO', '1CO', '1Co', '1Co'), ('2CO', '2CO', '2Co', '2Co'), ('GA', 'GAL', 'Ga', 'Gal'), ('EPH', 'EPH', 'Eph', 'Eph'),
         ('PHP', 'PHP', 'Php', 'Phi'), ('COL', 'COL', 'Col', 'Col'), ('1TH', '1TH', '1Th', '1Th'), ('2TH', '2TH', '2Th', '2Th'), ('1TI', '1TI', '1Ti', '1Ti'),
         ('2TI', '2TI', '2Ti', '2Ti'), ('TIT', 'TIT', 'Tit', 'Tit'), ('PHM', 'PHM', 'Phm', 'Phm'), ('HEB', 'HEB', 'Heb', 'Heb'), ('JAS', 'JAM', 'Jas', 'Jam'),
         ('1PE', '1PE', '1Pe', '1Pe'), ('2PE', '2PE', '2Pe', '2Pe'), ('1JO', '1JO', '1Jn', '1Jo'), ('2JO', '2JO', '2Jn', '2Jo'), ('3JO', '3JO', '3Jn', '3Jo'),
         ('JUDE', 'JUD', 'Jud', 'Jud'), ('RE', 'REV', 'Re', 'Rev')]
def bare(w):
    w = unicodedata.normalize('NFD', w); w = ''.join(c for c in w if not unicodedata.combining(c))
    return re.sub(r'[^Ͱ-Ͽἀ-῿]', '', w).lower().replace('ς', 'σ')
def words(text): return [w for w in re.findall(r"[Ͱ-Ͽἀ-῿̀-ͯ’']+", unicodedata.normalize('NFC', text)) if bare(w)]
common = collections.defaultdict(collections.Counter)
rp = {}
for _, rpname, sblname, code in BOOKS:
    verses = {}
    for name in [rpname] + (['PA'] if code == 'Joh' else []):
        with open(f'{rp_dir}/{name}.csv', encoding='utf-8') as f:
            for row in csv.DictReader(f): verses[f"{row['chapter']}:{row['verse']}"] = words(row['text'])
    rp[code] = verses
    for ws in verses.values():
        for w in ws: common[bare(w)][w.lower() if w[0].isupper() and len(w) > 1 and False else w] += 1
    sbl = next((f for f in os.listdir(sbl_dir) if re.match(rf'\d\d-{sblname}-', f)), None)
    if sbl:
        for line in open(f'{sbl_dir}/{sbl}', encoding='utf-8'):
            w = line.split()[4] if len(line.split()) > 4 else ''
            if bare(w): common[bare(w)][re.sub(r'[^Ͱ-Ͽἀ-῿’]', '', unicodedata.normalize('NFC', w))] += 1
stats = collections.Counter()
for antname, _, _, code in BOOKS:
    result = {}
    for line in open(f'{ant_dir}/{antname}.txt', encoding='utf-8'):
        m = re.match(r'(\d+:\d+)\s+(.*)', line.strip())
        if not m: continue
        ant = words(m.group(2)); ref = rp[code].get(m.group(1), [])
        acc = [None] * len(ant)
        sm = difflib.SequenceMatcher(a=[bare(w) for w in ant], b=[bare(w) for w in ref], autojunk=False)
        for a, b, n in sm.get_matching_blocks():
            for k in range(n): acc[a + k] = ref[b + k]
        for i, w in enumerate(ant):
            if acc[i]: stats['verse'] += 1; continue
            forms = common.get(bare(w))
            if forms: acc[i] = forms.most_common(1)[0][0]; stats['common'] += 1
            else: acc[i] = w; stats['none'] += 1
        result[m.group(1)] = ' '.join(acc)
    json.dump(result, open(f'{out}/antoniades-{code}.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(dict(stats), sum(os.path.getsize(f'{out}/{f}') for f in os.listdir(out)) // 1024, 'KB')

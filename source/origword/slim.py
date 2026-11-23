"""vg.json (from build_proiel.py) → one small file per New Testament book: verse → 'latin=greeklemma latin=greeklemma …'.
Only the Vulgate words PROIEL matches to a Greek word are kept."""
import json, sys, os, re, collections
CODES = dict(MATT='Mat', MARK='Mar', LUKE='Luk', JOHN='Joh', ACTS='Act', ROM='Rom', **{'1COR': '1Co', '2COR': '2Co'}, GAL='Gal', EPH='Eph', PHIL='Phi', COL='Col',
             **{'1THESS': '1Th', '2THESS': '2Th', '1TIM': '1Ti', '2TIM': '2Ti'}, TIT='Tit', PHILEM='Phm', HEB='Heb', JAS='Jam', **{'1PET': '1Pe', '2PET': '2Pe', '1JOHN': '1Jo', '2JOHN': '2Jo', '3JOHN': '3Jo'}, JUDE='Jud', REV='Rev')
d = json.load(open(sys.argv[1])); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
books = collections.defaultdict(dict)
for key, words in d.items():
    b, cv = key.split(' '); pairs = [f'{w[0]}={re.sub(r"#\d+$", "", w[2])}' for w in words if len(w) > 2]
    if pairs: books[CODES[b]][cv] = ' '.join(pairs)
total = 0
for b, verses in books.items():
    p = f'{out}/vulgate-greek-{b}.json'; json.dump(verses, open(p, 'w'), ensure_ascii=False, separators=(',', ':')); total += os.path.getsize(p)
print(len(books), 'books', total // 1024, 'KB')

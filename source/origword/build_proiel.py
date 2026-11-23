"""Builds vulgate-greek.json from the PROIEL treebank (latin-nt.xml + greek-nt.xml):
for every New Testament verse, each Vulgate word with the Greek word(s) it translates."""
import xml.etree.ElementTree as ET, json, sys, collections, unicodedata, re
src = sys.argv[1]
def tokens(path):
    for ev, e in ET.iterparse(path, events=('end',)):
        if e.tag == 'token':
            yield e.attrib
        elif e.tag == 'sentence':
            e.clear()
greek = {}
for t in tokens(src + '/greek-nt.xml'):
    if 'form' in t and 'lemma' in t:
        greek[t['id']] = (t['form'], t['lemma'], t.get('citation-part', ''))
print('greek tokens', len(greek), file=sys.stderr)
verses = collections.OrderedDict(); stat = collections.Counter(); aligned = collections.Counter()
def norm(s):
    s = unicodedata.normalize('NFD', s.lower()); s = ''.join(c for c in s if not unicodedata.combining(c))
    return s.replace('j', 'i').replace('v', 'u')
for t in tokens(src + '/latin-nt.xml'):
    if 'form' not in t: continue
    cp = t.get('citation-part', '')
    m = re.match(r'(\S+) (\d+)\.(\d+)', cp)
    if not m: continue
    key = f'{m.group(1)} {m.group(2)}:{m.group(3)}'
    stat[m.group(1)] += 1
    g = greek.get(t.get('alignment-id', ''))
    words = verses.setdefault(key, [])
    if g:
        aligned[m.group(1)] += 1
        words.append([norm(t['form']), t.get('lemma', ''), g[1], g[0]])
    else:
        words.append([norm(t['form']), t.get('lemma', '')])
for b in stat: print(f'{b:6} {aligned[b]*100//stat[b]:3}% of {stat[b]}', file=sys.stderr)
json.dump(verses, open(sys.argv[2], 'w'), ensure_ascii=False, separators=(',', ':'))

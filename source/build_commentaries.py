"""Turn the Internet Archive OCR text of Boylan and Calmet into Scriptorium commentary sections.

Output: a JSON list of works, each with sections {chapter, scope, title, body, verses}.
  scope 'chapter' — the whole psalm (introduction, text and notes), shown as chapter context;
  scope 'verse'   — Boylan's numbered note on one verse (or verse range), shown as a verse match.
Usage: python3 build_commentaries.py <books dir> <output.json>
"""
import json, re, sys
from pathlib import Path

src, out = Path(sys.argv[1]), Path(sys.argv[2])
ROMAN = {'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100}

def roman(s):
    s = s.upper(); total = 0
    for i, ch in enumerate(s):
        if ch not in ROMAN: return None
        v = ROMAN[ch]; total += -v if i + 1 < len(s) and ROMAN.get(s[i + 1], 0) > v else v
    return total

def tidy(text):
    """Rejoin hyphenated line breaks, collapse OCR spacing, keep paragraph breaks."""
    text = re.sub(r'(\w)-\s*\n\s*(\w)', r'\1\2', text)
    paras = [re.sub(r'\s+', ' ', p).strip() for p in re.split(r'\n\s*\n', text)]
    return '\n\n'.join(p for p in paras if p)

# ---------------- Boylan ----------------
def boylan_psalms():
    found = {}
    for vol in ('boylan1.txt', 'boylan2.txt'):
        lines = (src / vol).read_text(encoding='utf-8').splitlines()
        heads = []
        for i, line in enumerate(lines):
            m = re.match(r'^\s*PSALMS?\s+([IVXLCivxlcm1]+)(?:\s+AND\s+([IVXLC]+))?(?:\s+\(Hebrew[^)]*\))?\s*$', line)
            if not m: continue
            fix = lambda t: roman(t.upper().replace('1', 'I').replace('M', 'III'))
            n = fix(m.group(1))
            if n and 1 <= n <= 150:
                heads.append((i, n))
                if m.group(2) and fix(m.group(2)): heads.append((i, fix(m.group(2))))  # Psalms 114 and 115 share one treatment
        # Keep headings in ascending sequence (drops stray matches in the introduction).
        seq, last = [], 0
        for i, n in heads:
            if n > last: seq.append((i, n)); last = n
        starts = sorted({i for i, _ in seq})
        for i, n in seq:
            later = [j for j in starts if j > i]
            end = later[0] if later else len(lines)
            body = lines[i + 1:end]
            # Running heads and page furniture.
            body = [l for l in body if not re.match(r'^\s*\d+\s+THE\s+PSALMS\s+\[', l) and not re.match(r'^\s*[ivxlc]+\]\s+.*\s\d+\s*$', l, re.I)
                    and not re.match(r'^\s*(?:[A-Za-z]?[-.,\\/]|[A-Z])\s*$', l) and 'KELLY' not in l]
            found.setdefault(n, '\n'.join(body))
    return found

LATIN = set('et in non est ejus eius qui quia sicut ad me mea meus tua tuus domine dominus domini deus dei super sunt eorum quoniam tu ego cum de nos nobis meum tuum enim ut illi ab'.split())
ENGLISH = set('the and of is to his that he it was which this be they are as with for by from have their not but'.split())

def is_text_block(par):
    words = re.findall(r'[a-z]+', par.lower())
    lat = sum(w in LATIN for w in words); eng = sum(w in ENGLISH for w in words)
    return (lat >= 3 and lat * 1.6 >= eng) or (lat >= 1 and eng == 0 and len(words) >= 3)

NOTE = re.compile(r'^\s*\.?\s*([0-9ilI]{1,3})(?:\s*[-–,]\s*([0-9ilI]{1,3}))?\.\s+(?=\S)')
def num(s):
    s = s.replace('i', '1').replace('l', '1').replace('I', '1')
    return int(s) if s.isdigit() else None

def boylan_sections():
    sections = []
    for n, raw in sorted(boylan_psalms().items()):
        text = tidy(raw)
        paras = text.split('\n\n')
        title = paras[0].title() if paras and paras[0].isupper() and len(paras[0]) < 80 else ''
        sections.append({'chapter': n, 'scope': 'chapter', 'title': f'Psalm {n}' + (f' · {title}' if title else ''), 'body': text, 'verses': []})
        # Verse notes: numbered English paragraphs that follow a Latin/English text block.
        # Each psalm (or each section of a long psalm) prints the Latin and English text with numbered verses,
        # then numbered notes. Notes begin once no further Latin verse continues the text's numbering; a Latin
        # verse numbered beyond the text already printed starts the next section.
        items = []
        for p in paras:
            m = NOTE.match(p); k = num(m.group(1)) if m else None
            latin = bool(m) and (is_text_block(p) or re.search(r'\s' + re.escape(m.group(1)) + r'\.\s', p[m.end():m.end() + 140]) is not None)
            items.append((p, m, k, latin))
        mode, current, notes, part, top, first = 'intro', None, [], 0, 0, 0
        for idx, (p, m, k, latin) in enumerate(items):
            if k is None:
                if mode == 'notes' and current is not None and not p.isupper(): current['text'] += '\n\n' + p
                continue
            if mode == 'intro':
                mode, top, first = 'text', k, k; continue
            if mode == 'notes' and latin and (k > top or (k <= 2 and current and current['first'] > 3)):
                if k <= 2: part += 1; top = 0       # numbering restarts: a second psalm (114–115)
                mode, current, first = 'text', None, k
            if mode == 'text':
                if latin: top = max(top, k); continue
                ahead = [it for it in items[idx + 1:] if it[2] is not None][:5]
                if any(it[3] and it[2] > top for it in ahead): continue   # still inside the text (an English line)
                if k > first + 2: continue                                  # English lines at the end of the text
                mode = 'notes'
            b = num(m.group(2)) if m.group(2) else k
            if b is None or b < k or b - k > 12: b = k
            if current is not None and k <= current['first']:
                current['text'] += '\n\n' + p; continue        # same verse again, or a misread number
            current = {'first': k, 'last': b, 'text': p, 'part': part}; notes.append(current)
        if n in (114, 115): notes = [x for x in notes if x['part'] == (n - 114)]
        # Where numbering starts over, an earlier run whose verses are all annotated again in the next run
        # was the English translation, not notes: drop it.
        runs, start = [], 0
        for i in range(1, len(notes) + 1):
            if i == len(notes) or notes[i]['first'] < notes[i - 1]['first'] - 2: runs.append(notes[start:i]); start = i
        kept = []
        for r, run in enumerate(runs):
            nxt = {x['first'] for x in runs[r + 1]} if r + 1 < len(runs) else set()
            if nxt and {x['first'] for x in run} <= nxt | {min(nxt) - 1}: continue
            kept.extend(run)
        notes = kept
        for note in notes:
            if note['first'] > 200: continue
            verses = list(range(note['first'], note['last'] + 1))
            label = f"{note['first']}" if note['first'] == note['last'] else f"{note['first']}–{note['last']}"
            sections.append({'chapter': n, 'scope': 'verse', 'title': f'Psalm {n}:{label}', 'body': note['text'], 'verses': verses})
    return sections

# ---------------- Calmet ----------------
sys.path.insert(0, str(Path(__file__).parent))
from calmet_split import starts_anchored, head_num
from collections import Counter

def calmet_sections():
    sections = []
    for vol, first, last in (('calmet1.txt', 1, 71), ('calmet2.txt', 72, 150)):
        lines = (src / vol).read_text(encoding='utf-8').splitlines()
        begin = next(i for i, l in enumerate(lines) if re.match(r'^\s*PSEAUME\s+(PREMIER|LXXII)\b', l))
        seq = [(i + begin, n) for i, n in starts_anchored(lines[begin:], first, last)]
        for k, (i, n) in enumerate(seq):
            end = seq[k + 1][0] if k + 1 < len(seq) else len(lines)
            heads = Counter(h for h in (head_num(l) for l in lines[i:end]) if h and first <= h <= last)
            covered = sorted({n} | {h for h, c in heads.items() if c >= 2 and abs(h - n) <= 2})
            body = [l for l in lines[i:end] if 'Digitized' not in l and 'Digilized' not in l and 'Dipitized' not in l
                    and not re.match(r'^\s*S\W?[UVÜ]\W?R\s*L', l) and not re.match(r'^\s*COMMENTAIRE\s+LITTERAL\s*$', l)]
            title = f'Pseaume {n}' if covered == [n] else f'Pseaumes {covered[0]}–{covered[-1]}'
            for c in covered:
                sections.append({'chapter': c, 'scope': 'chapter', 'title': title, 'body': tidy('\n'.join(body)), 'verses': [],
                                 'note': '' if covered == [n] else 'The scan’s psalm divisions are unclear here, so this text may begin or end with part of a neighbouring psalm.'})
    # A psalm whose heading never surfaced in the scan is filed with the stretch of text that contains it.
    have = {x['chapter'] for x in sections}
    for m in [n for n in range(1, 151) if n not in have]:
        host = max((x for x in sections if x['chapter'] < m), key=lambda x: x['chapter'])
        sections.append({**host, 'chapter': m, 'title': host['title'] + f' (includes Pseaume {m})',
                         'note': f'Psalm {m} could not be separated in the scan; it is part of this text.'})
    return sections

boylan, calmet = boylan_sections(), calmet_sections()
out.write_text(json.dumps({'boylan': boylan, 'calmet': calmet}, ensure_ascii=False), encoding='utf-8')
bc = sorted({s['chapter'] for s in boylan}); cc = sorted({s['chapter'] for s in calmet})
print('Boylan psalms', len(bc), 'missing', [n for n in range(1, 151) if n not in bc], 'verse notes', sum(s['scope'] == 'verse' for s in boylan))
print('Calmet psalms', len(cc), 'missing', [n for n in range(1, 151) if n not in cc])

"""Vulgate/Douay verse numbers (used by the Missal, Breviary and the harmony table) → the reader's KJV numbering.

Only the places where the two systems differ in the New Testament readings are handled.
"""

def to_kjv(book, chapter, verse):
    if book == 'Mat' and chapter == 17 and verse >= 15: return chapter, verse + 1
    if book == 'Mar' and chapter == 8 and verse >= 39: return 9, 1
    if book == 'Mar' and chapter == 9: return chapter, verse + 1
    if book == 'Joh' and chapter == 6 and verse >= 52: return chapter, verse - 1
    if book == '2Co' and chapter == 13 and verse >= 13: return chapter, verse + 1
    if book == '3Jo' and verse >= 15: return chapter, 14
    return chapter, verse

def nav(ref):
    """Return the reader-numbered copy of a reference, or None when nothing changes."""
    c, v = to_kjv(ref['book'], ref['chapter'], ref['verse'])
    ec, ev = to_kjv(ref['book'], ref['endChapter'], ref['endVerse']) if ref['endVerse'] < 900 else (ref['endChapter'], ref['endVerse'])
    # A range ending on a verse the KJV splits keeps its last half (Vulgate Matt 17:14 = KJV 17:14-15).
    if ref['book'] == 'Mat' and ref['endChapter'] == 17 and ref['endVerse'] == 14: ev = 15
    if ref['book'] == 'Joh' and ref['chapter'] == 6 and ref['verse'] == 52: v = 51
    if (c, v, ec, ev) == (ref['chapter'], ref['verse'], ref['endChapter'], ref['endVerse']): return None
    return {'chapter': c, 'verse': v, 'endChapter': ec, 'endVerse': ev}

def annotate(obj):
    """Add 'nav' to every reference dict (book/chapter/verse/endChapter/endVerse) found in obj."""
    if isinstance(obj, dict):
        if {'book', 'chapter', 'verse', 'endChapter', 'endVerse'} <= obj.keys():
            n = nav(obj)
            if n: obj['nav'] = n
        for v in list(obj.values()): annotate(v)
    elif isinstance(obj, list):
        for v in obj: annotate(v)

if __name__ == '__main__':
    import json, sys
    path = sys.argv[1]
    data = json.load(open(path, encoding='utf-8'))
    annotate({'days': data['days'], 'events': data['events']})
    json.dump(data, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    n = sum(1 for d in data['days'] for g in d['gospels'] for r in g['refs'] if 'nav' in r)
    print('Gospel references renumbered for the reader:', n)
    assert nav({'book': 'Joh', 'chapter': 6, 'verse': 56, 'endChapter': 6, 'endVerse': 59}) == {'chapter': 6, 'verse': 55, 'endChapter': 6, 'endVerse': 58}
    assert nav({'book': 'Mar', 'chapter': 9, 'verse': 16, 'endChapter': 9, 'endVerse': 28}) == {'chapter': 9, 'verse': 17, 'endChapter': 9, 'endVerse': 29}
    assert nav({'book': 'Mat', 'chapter': 17, 'verse': 14, 'endChapter': 17, 'endVerse': 20}) == {'chapter': 17, 'verse': 14, 'endChapter': 17, 'endVerse': 21}

"""Key Scripture passages for the biblical entries of the BibleWorks timeline.

The first passage of each entry is quoted in the Timeline notes; the rest are listed as links.
Existing BibleWorks references are kept after these (fixed where malformed).
Usage: python3 timeline_refs.py <timeline.json> <books.json> <out.json>
"""
import json, re, sys

R = {
 # Creation to the Flood
 'CREATION-3': 'Gen 1:1; Gen 50:24-26',
 'CREATION-4': 'Gen 1:1-3; Gen 1:26-28; Gen 2:1-3; Joh 1:1-3',
 'CREATION-5': 'Gen 2:7; Gen 3:17-19; Gen 5:1-5; Rom 5:12',
 'CREATION-6': 'Gen 4:25-26; Gen 5:6-8',
 'CREATION-7': 'Gen 4:26; Gen 5:9-11',
 'CREATION-8': 'Gen 5:15-17',
 'CREATION-9': 'Gen 5:18-20',
 'CREATION-10': 'Gen 5:21-24; Heb 11:5; Jud 1:14-15',
 'CREATION-11': 'Gen 5:25-27',
 'CREATION-12': 'Gen 5:28-31',
 'CREATION-13': 'Gen 6:8-9; Gen 6:13-22; Gen 9:8-17; Heb 11:7',
 'CREATION-14': 'Gen 9:26; Gen 11:10-11',
 'CREATION-15': 'Gen 7:11-12; Gen 7:17-24; Gen 8:1-5; 1Pe 3:20',
 'CREATION-16': 'Luk 3:36; Gen 5:12-14',
 # Flood to the Exodus
 'PSTFLOOD-1': 'Gen 11:10-13',
 'PSTFLOOD-2': 'Gen 11:12-15',
 'PSTFLOOD-3': 'Gen 11:14-17',
 'PSTFLOOD-4': 'Gen 10:25; Gen 11:16-19',
 'PSTFLOOD-5': 'Gen 11:18-21',
 'PSTFLOOD-6': 'Gen 11:20-23',
 'PSTFLOOD-7': 'Gen 11:22-25',
 'PSTFLOOD-8': 'Gen 11:31-32; Gen 11:26; Jos 24:2',
 'PSTFLOOD-9': 'Gen 12:1-3; Gen 15:5-6; Gen 22:1-18; Rom 4:3; Heb 11:8-10',
 'PSTFLOOD-10': 'Job 1:1; Job 1:21-22; Job 42:10-17; Jam 5:11',
 'PSTFLOOD-11': 'Gen 21:1-3; Gen 22:9-12; Gen 26:2-5; Gen 35:28-29',
 'PSTFLOOD-12': 'Gen 28:12-15; Gen 32:24-30; Gen 49:1-2; Heb 11:21',
 'PSTFLOOD-13': 'Gen 45:4-8; Gen 37:3-4; Gen 41:39-41; Gen 50:20',
 'PSTFLOOD-14': 'Exo 1:8-11; Gen 15:13',
 'PSTFLOOD-15': 'Exo 3:2-6; Exo 2:10; Deu 34:5-10; Heb 11:24-27',
 # Exodus & wilderness
 'WILDRNSS-1': 'Exo 14:21-22; Exo 12:41; Exo 14:29-31; Exo 20:1-3',
 'WILDRNSS-2': 'Deu 6:4-5; Lev 19:2; Num 6:24-26',
 'WILDRNSS-3': 'Psa 90:1-2; Psa 90:10-12',
 # Promised Land
 'PROMLAND-1': 'Jos 1:6-9; Jos 24:14-15; Jos 24:29',
 'PROMLAND-2': 'Jos 3:14-17; Jos 4:19; Jos 5:10-12',
 'PROMLAND-3': 'Jos 21:43-45; Jos 11:23',
 'PROMLAND-4': 'Jdg 21:25; Rut 1:16-17; Rut 4:17',
 'PROMLAND-5': 'Jdg 2:16-19',
 'PROMLAND-6': 'Jdg 3:9-11',
 'PROMLAND-7': 'Jdg 3:15; Jdg 3:15-30',
 'PROMLAND-8': 'Jdg 4:4-5; Jdg 4:14-16; Jdg 5:31',
 'PROMLAND-9': 'Jdg 6:12-14; Jdg 7:19-22; Jdg 8:28',
 'PROMLAND-10': 'Jdg 10:1-5',
 'PROMLAND-11': 'Jdg 11:29-33; Heb 11:32',
 'PROMLAND-12': 'Jdg 12:8-15',
 'PROMLAND-13': 'Jdg 16:28-30; Jdg 13:24-25; Heb 11:32',
 'PROMLAND-14': '1Sa 7:15-17; 1Sa 3:19-20; 1Sa 7:2-13',
 # The kings
 'KINGS-1': '1Sa 8:5-7; 1Sa 16:13',
 'KINGS-2': '1Sa 10:1; 1Sa 15:22-23; 1Sa 31:4-6',
 'KINGS-3': '2Sa 7:12-16; 1Sa 16:12-13; 1Sa 17:45-47; 1Ki 2:10-11',
 'KINGS-4': 'Psa 127:1-2; Psa 23:1-3; 2Sa 23:1-2',
 'KINGS-5': '2Sa 5:3-5; 2Ki 25:8-11; 2Ch 36:22-23',
 'KINGS-6': '1Ch 16:4-7; 1Ch 6:31-33; 2Ch 29:30',
 'KINGS-7': '1Ki 4:29-32; Pro 1:1-7; Ecc 1:1-2; Sol 1:1',
 'KINGS-8': '1Ki 3:9-12; 1Ki 3:5-14; 1Ki 11:4-6; 1Ki 11:41-43',
 'KINGS-9': '1Ki 6:1; 1Ki 6:11-14; 2Ch 3:1',
 'KINGS-10': '1Ki 12:26-30; 1Ki 12:20; 1Ki 14:19-20',
 'KINGS-11': '1Ki 12:19-20; 2Ki 17:6-8',
 'KINGS-12': '1Ki 12:17; 1Ki 12:21; 2Ki 25:21',
 'KINGS-13': '1Ki 14:21; 1Ki 12:13-16; 2Ch 12:1',
 'KINGS-14': '1Ki 15:1-3; 2Ch 13:1-2',
 'KINGS-15': '1Ki 15:9-11; 2Ch 14:2-6; 2Ch 16:12-13',
 'KINGS-16': '1Ki 15:25-26',
 'KINGS-17': '1Ki 15:33-34; 1Ki 16:1-4',
 'KINGS-18': '1Ki 16:8-10',
 'KINGS-19': '1Ki 16:23-26',
 'KINGS-20': '1Ki 16:15-18; 1Ki 16:21-22',
 'KINGS-21': '1Ki 16:30-33; 1Ki 18:17-18; 1Ki 21:17-19; 1Ki 22:34-38',
 'KINGS-22': '1Ki 22:41-43; 2Ch 17:3-6; 2Ch 20:20',
 'KINGS-23': 'Oba 1:1; Oba 1:15; Oba 1:21',
 'KINGS-24': '1Ki 22:51-53; 2Ki 1:2-4; 2Ki 1:17',
 'KINGS-25': '2Ki 8:16-18; 2Ch 21:4-7; 2Ch 21:18-20',
 'KINGS-26': '2Ki 3:1-3; 2Ki 9:24',
 'KINGS-27': '2Ki 8:25-27; 2Ki 9:27; 2Ch 22:2-4',
 'KINGS-28': '2Ki 11:1-3; 2Ki 11:13-16',
 'KINGS-29': '2Ki 10:28-31; 2Ki 9:6-7; 2Ki 10:34-36',
 'KINGS-30': '2Ki 12:1-2; 2Ki 11:21; 2Ch 24:17-22',
 'KINGS-31': '2Ki 13:1-4',
 'KINGS-32': '2Ki 13:10-11; 2Ki 13:14-19',
 'KINGS-33': '2Ki 14:1-3; 2Ch 25:1-2',
 'KINGS-34': '2Ki 14:23-25; 2Ki 14:26-27',
 'KINGS-35': '2Ch 26:3-5; 2Ki 15:1-5; 2Ch 26:16-21; Isa 6:1',
 'KINGS-36': '2Ki 14:25; Jon 1:1-3; Jon 3:4-5; Mat 12:40-41',
 'KINGS-37': 'Isa 1:1; Isa 6:8; Mic 1:1; Mic 6:8',
 'KINGS-38': 'Amo 1:1; Amo 5:24; Amo 7:14-15',
 'KINGS-39': '2Ki 15:8-10; 2Ki 15:12',
 'KINGS-40': '2Ki 15:32-35; 2Ch 27:6',
 'KINGS-41': '2Ki 15:17-18; 2Ki 15:14; 2Ki 15:19-20',
 'KINGS-42': '2Ki 15:13-14; 2Ki 15:10',
 'KINGS-43': '2Ki 16:1-3; 2Ki 16:7-8; Isa 7:10-14',
 'KINGS-44': 'Hos 1:1-2; Hos 6:6; Hos 11:1',
 'KINGS-45': '2Ki 15:23-25',
 'KINGS-46': '2Ki 15:27-29; 2Ki 16:5; Isa 7:1',
 'KINGS-47': '2Ki 17:5-6; 2Ki 17:1-4; 2Ki 17:7-18',
 # Judah after Samaria
 'ASSYR-1': '2Ki 18:5-7; 2Ki 18:1-4; 2Ch 29:1-3; 2Ki 20:20-21',
 'ASSYR-2': 'Isa 10:5-7; 2Ki 15:19; 2Ki 15:29',
 'ASSYR-3': '2Ki 17:3; 2Ki 16:7-9',
 'ASSYR-4': '2Ki 17:4-5; 2Ki 18:9',
 'ASSYR-5': 'Isa 20:1',
 'ASSYR-6': '2Ki 17:6; 2Ki 18:9-12; 2Ki 17:22-23',
 'ASSYR-7': 'Isa 20:1-2; Isa 20:3-6',
 'ASSYR-8': '2Ki 18:13; 2Ki 19:35-37; Isa 37:36-38',
 'ASSYR-9': '2Ki 20:5-6; 2Ki 20:1-6; Isa 38:1-5',
 'ASSYR-10': '2Ki 20:12-13; Isa 39:1-2; 2Ki 20:16-18',
 'ASSYR-11': '2Ki 18:13-16; Isa 36:1',
 'ASSYR-12': '2Ki 19:35-36; 2Ki 19:32-34; Isa 37:36-37; 2Ch 32:21',
 'ASSYR-13': '2Ki 21:1-3; 2Ch 33:12-13; 2Ki 21:16',
 'ASSYR-14': '2Ki 19:37; Ezr 4:2',
 'ASSYR-15': '2Ki 17:24; 2Ki 17:29-33; Ezr 4:2; Ezr 4:10',
 'ASSYR-17': 'Ezr 4:9-10',
 'ASSYR-18': 'Nah 1:1; Nah 1:7; Nah 3:8',
 'ASSYR-19': '2Ch 33:11-13',
 'ASSYR-20': '2Ki 21:19-22; 2Ch 33:21-25',
 'ASSYR-21': '2Ki 22:1-2; 2Ch 34:1-3',
 'ASSYR-23': '2Ch 34:3-5; 2Ki 23:4-5; 2Ki 23:24-25',
 'ASSYR-24': 'Jer 1:4-5; Jer 1:1-10; Jer 25:1-3',
 'ASSYR-25': '2Ki 22:8; 2Ki 22:10-13; 2Ki 23:1-3; 2Ch 34:14-15',
 'ASSYR-26': 'Zep 1:1; Zep 1:14-15; Zep 3:17',
 'ASSYR-27': 'Hab 1:5-6; Hab 1:1; Hab 2:4; Hab 3:17-19',
 # Babylonian period
 'BABYLON-3': 'Zep 2:13-15; Nah 2:8; Nah 3:7',
 'BABYLON-4': '2Ki 23:29; 2Ch 35:20',
 'BABYLON-5': '2Ki 23:31-33; 2Ki 23:34; 2Ch 36:1-4',
 'BABYLON-6': '2Ki 23:29-30; 2Ch 35:20-25',
 'BABYLON-7': '2Ki 23:36-37; 2Ki 24:1; Jer 36:22-24',
 'BABYLON-8': 'Jer 46:2; 2Ki 24:7',
 'BABYLON-9': 'Dan 1:6-8; Dan 6:10; Eze 14:14; Mat 24:15',
 'BABYLON-10': 'Dan 1:1-2; Dan 1:3-6; 2Ki 24:1',
 'BABYLON-11': 'Dan 2:37-38; 2Ki 24:1; 2Ki 25:8-9; Dan 4:37',
 'BABYLON-12': '2Ki 24:10-12; 2Ki 24:14-15; Eze 1:2',
 'BABYLON-13': '2Ki 24:17-18; 2Ki 25:6-7; Jer 52:1-3',
 'BABYLON-14': '2Ki 25:8-11; 2Ch 36:17-21; Jer 52:12-15; Psa 137:1-4',
 'BABYLON-15': 'Lam 1:1; Lam 3:22-24; Lam 5:21',
 'BABYLON-16': '2Ki 25:25-26; Jer 41:1-2; Jer 43:4-7',
 'BABYLON-17': '2Ki 25:27-28; Jer 52:31-34',
 'BABYLON-18': '2Ki 25:27-30; Jer 52:31-34',
 'BABYLON-20': 'Dan 5:30-31; Dan 5:1; Dan 5:25-28; Dan 7:1',
 # Persian period
 'PERSIAN-1': 'Isa 45:1-4; Isa 44:28; Ezr 1:1-2; 2Ch 36:22-23',
 'PERSIAN-2': 'Eze 1:1-3; Eze 36:26-27; Eze 37:1-6',
 'PERSIAN-3': 'Joe 2:12-13; Joe 1:1; Act 2:16-21',
 'PERSIAN-4': 'Isa 21:2',
 'PERSIAN-5': 'Dan 8:20; Dan 5:28',
 'PERSIAN-7': 'Dan 5:30-31; Isa 13:17-19; Isa 21:9; Jer 51:11',
 'PERSIAN-8': 'Ezr 7:10; Ezr 7:6; Neh 8:1-3',
 'PERSIAN-9': 'Ezr 3:8; Zec 4:6-9; Hag 2:23; Ezr 2:2',
 'PERSIAN-10': 'Ezr 1:1-3; 2Ch 36:22-23; Ezr 2:1; Ezr 2:64-65',
 'PERSIAN-12': 'Ezr 6:1-3; Ezr 4:24; Ezr 6:6-8; Hag 1:1',
 'PERSIAN-13': 'Ezr 5:1-2; Hag 1:1; Hag 1:7-8; Zec 1:1; Zec 9:9',
 'PERSIAN-14': 'Ezr 6:14-16; Hag 2:9',
 'PERSIAN-16': 'Est 1:1-3; Ezr 4:6',
 'PERSIAN-17': 'Est 4:14; Est 2:17; Est 9:20-22',
 'PERSIAN-18': 'Ezr 7:12-13; Ezr 7:11; Neh 2:1',
 'PERSIAN-19': 'Psa 126:1-3; Psa 137:1-4',
 'PERSIAN-20': 'Ezr 7:6-9; Ezr 8:31-32',
 'PERSIAN-21': 'Ezr 7:8-10; Ezr 8:21-23',
 'PERSIAN-22': 'Mal 3:1; Mal 1:1; Mal 1:11',
 'PERSIAN-23': 'Neh 6:15-16; Neh 2:17-18; Neh 4:6',
 'PERSIAN-24': 'Neh 2:4-6; Neh 1:1-4; Neh 2:11',
 'PERSIAN-25': 'Neh 5:14; Neh 1:1',
 'PERSIAN-26': 'Neh 13:6',
 'PERSIAN-27': 'Neh 13:6-7; Neh 13:15-18',
 # Between the Testaments: Daniel's visions, traditionally read of these events (the Books of Maccabees are not in this app's Bible list)
 'INTERTES-7': 'Dan 11:3-4; Dan 8:5-8',
 'INTERTES-12': 'Dan 11:5',
 'INTERTES-14': 'Dan 8:21-22; Dan 8:8; Dan 11:4',
 'INTERTES-16': 'Dan 11:5-6',
 'INTERTES-40': 'Dan 11:21; Dan 8:9-12',
 'INTERTES-43': 'Dan 11:31; Dan 8:11-13; Mat 24:15',
 'INTERTES-77': 'Joh 2:20',
}
NOTES = {f'INTERTES-{n}': 'Daniel’s visions are traditionally read of this; the event itself is narrated in 1–2 Maccabees.' for n in (7, 12, 14, 16, 40, 43)}
NOTES['NT_DET-40'] = NOTES['NT-16'] = None
NOTES['NT_DET-40'] = 'Scripture names James but does not record his death.'
del NOTES['NT-16']

NT = {
 'jesus': 'Joh 1:14; Mat 1:21; Luk 2:6-7; Gal 4:4',
 'annas': 'Joh 18:13; Luk 3:2; Act 4:6',
 'caiaphas': 'Joh 11:49-50; Mat 26:57; Joh 18:14',
 'john': 'Luk 3:1-3; Mat 3:1-3; Mar 1:4',
 'pentecost': 'Act 2:1-4; Act 2:14-17; Act 2:41',
 'cross': 'Joh 19:28-30; Mat 27:33-37; Luk 23:44-46; 1Co 15:3-4',
 'paul': 'Act 9:3-6; Act 9:15; Gal 1:15-17; 2Ti 4:7',
 'stephen': 'Act 7:59-60; Act 6:8; Act 8:1',
 'visit': 'Gal 1:18-19; Act 9:26-28',
 'famine': 'Act 11:29-30; Act 11:28; Act 12:25',
 'council': 'Act 15:28-29; Act 15:6; Act 15:19-20; Gal 2:1-2',
 'war': 'Luk 21:20-22; Mat 24:15-16',
 'fall': 'Mat 24:1-2; Luk 19:43-44; Luk 21:24',
 'johndeath': 'Joh 21:22-24; Rev 1:9',
}
for a, b in (('NT-1', 'jesus'), ('NT_DET-1', 'jesus'), ('NT-2', 'annas'), ('NT_DET-2', 'annas'), ('NT-3', 'caiaphas'), ('NT_DET-4', 'caiaphas'),
             ('NT-4', 'john'), ('NT_DET-5', 'john'), ('NT-5', 'pentecost'), ('NT_DET-7', 'pentecost'), ('NT-6', 'cross'), ('NT_DET-8', 'cross'),
             ('NT-7', 'paul'), ('NT_DET-9', 'paul'), ('NT-8', 'stephen'), ('NT_DET-10', 'stephen'), ('NT-9', 'visit'), ('NT_DET-11', 'visit'),
             ('NT-10', 'famine'), ('NT_DET-14', 'famine'), ('NT-12', 'council'), ('NT_DET-16', 'council'), ('NT-14', 'war'), ('NT_DET-45', 'war'),
             ('NT-15', 'fall'), ('NT_DET-46', 'fall'), ('NT-16', 'johndeath'), ('NT_DET-47', 'johndeath')):
    R[a] = NT[b]
R.update({
 'NT-11': 'Act 13:2-4; Act 15:40-41; Act 18:23',
 'NT-13': '2Ti 3:16-17; Luk 1:1-4; 2Pe 3:15-16',
 'NT_DET-3': 'Luk 2:46-49; Luk 2:41-43',
 'NT_DET-6': 'Joh 2:19-21',
 'NT_DET-12': 'Act 11:25-26',
 'NT_DET-13': 'Act 12:1-2',
 'NT_DET-15': 'Act 13:2-3; Act 13:4-5; Act 14:26-27',
 'NT_DET-17': 'Act 15:40-41; Act 16:9-10; Act 18:22',
 'NT_DET-18': '1Th 1:1; 2Th 1:1; Act 17:1-4',
 'NT_DET-19': 'Act 17:22-23; Act 18:1-4; Act 18:11',
 'NT_DET-20': 'Act 19:8-10; Act 19:1; Act 20:31',
 'NT_DET-21': 'Act 18:22-23; Act 19:1; Act 20:1-3',
 'NT_DET-22': '1Co 1:1-2; 1Co 16:8; Gal 1:1-2',
 'NT_DET-23': '2Co 1:1; 2Co 2:12-13; 2Co 7:5',
 'NT_DET-24': 'Act 20:1-3; 2Co 7:5',
 'NT_DET-25': 'Act 24:27; Act 23:33-35; Act 25:10-12',
 'NT_DET-26': 'Act 21:30-33; Act 21:27-29',
 'NT_DET-27': 'Rom 1:1; Rom 1:16-17; Rom 15:25-26; Rom 16:1',
 'NT_DET-28': 'Act 28:1-3; Act 27:41-44; Act 28:4-6',
 'NT_DET-29': 'Act 27:8-9; Act 27:12-13',
 'NT_DET-30': 'Act 27:1-2; Act 25:12',
 'NT_DET-31': 'Act 28:30-31; Act 28:14-16',
 'NT_DET-32': 'Phi 1:12-13; Phm 1:1; Col 4:18; Eph 3:1',
 'NT_DET-33': '1Ti 1:3; Tit 1:4-5',
 'NT_DET-34': 'Rom 15:28; Rom 15:24; Tit 1:5; 1Ti 1:3',
 'NT_DET-35': '1Pe 1:1; 1Pe 5:13; 2Pe 3:1',
 'NT_DET-36': 'Joh 21:18-19; 2Pe 1:14',
 'NT_DET-37': '2Ti 4:16-17',
 'NT_DET-38': '1Pe 4:12-14',
 'NT_DET-39': 'Tit 3:12',
 'NT_DET-40': 'Jam 1:1; Gal 1:19; Act 15:13; Act 21:18',
 'NT_DET-41': '2Ti 4:6-8; 2Ti 4:16-18',
 'NT_DET-42': 'Luk 1:1-4; Act 1:1-2; Jud 1:3',
 'NT_DET-43': '2Ti 1:1-2; 2Ti 1:8; 2Ti 4:9-11',
 'NT_DET-44': 'Rev 1:9-11; Rev 1:1',
 'NT_DET-48': 'Joh 20:30-31; 1Jo 1:1-4; Rev 22:20-21',
})

timeline, books, out = sys.argv[1:4]
verses = {b['code']: b['verses'] for b in json.load(open(books))}
codes = {c.lower(): c for c in verses}
FIX = {'1Ki 20': '2Ki 20'}   # Hezekiah's sickness is 2 Kings 20

def norm(ref):
    ref = ref.split('|', 1)[0].strip()
    ref = FIX.get(ref, ref)
    m = re.match(r'^(\w+)\s+(\d+)(?::(\d+))?(?:-(\d+))?$', ref)
    if not m or m.group(1).lower() not in codes: raise SystemExit('bad ref ' + ref)
    book = codes[m.group(1).lower()]; c = int(m.group(2))
    if c > len(verses[book]): raise SystemExit('bad chapter ' + ref)
    for v in (m.group(3), m.group(4)):
        if v and int(v) > verses[book][c - 1]: raise SystemExit('bad verse ' + ref)
    return book + ref[len(m.group(1)):]

data = json.load(open(timeline))
entries = {e['id']: e for g in data['groups'] for e in g['events']}
result = {}
for id_, refs in R.items():
    assert id_ in entries, id_
    mine = [norm(r) for r in refs.split(';')]
    for r in entries[id_].get('refs') or []:
        n = norm(r)
        if n not in mine: mine.append(n)
    result[id_] = {'refs': mine, **({'note': NOTES[id_]} if NOTES.get(id_) else {})}
# Entries not curated above keep their own references, tidied.
for id_, e in entries.items():
    if id_ not in result and e.get('refs') and id_.split('-')[0] in ('CREATION', 'PSTFLOOD', 'WILDRNSS', 'PROMLAND', 'KINGS', 'ASSYR', 'BABYLON', 'PERSIAN', 'INTERTES', 'NT', 'NT_DET'):
        result[id_] = {'refs': [norm(r) for r in e['refs']]}
json.dump(result, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
bib = [e for e in entries.values() if e['id'].split('-')[0] in ('CREATION', 'PSTFLOOD', 'WILDRNSS', 'PROMLAND', 'KINGS', 'ASSYR', 'BABYLON', 'PERSIAN', 'NT', 'NT_DET')]
print(len(result), 'entries with Scripture; biblical entries without:', [e['id'] + ' ' + e['title'] for e in bib if e['id'] not in result])

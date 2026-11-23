"""Approximate boundaries for five periods, drawn by hand after common Bible-atlas layouts.

Coordinates are [longitude, latitude]. Shared borders reuse the same points so neighbouring
areas meet without gaps. Kingdoms are built from the same tribal shapes.
"""
import json, sys
from pathlib import Path

# Coast, Jordan and Dead Sea reference points, reused by every period.
GAZA, ASHKELON, ASHDOD, JABNEEL, JOPPA, YARKON = [34.46, 31.50], [34.55, 31.67], [34.64, 31.80], [34.70, 31.88], [34.75, 32.05], [34.80, 32.15]
CAESAREA, DOR, CARMEL_S, CARMEL, ACCO, ACHZIB = [34.89, 32.50], [34.92, 32.62], [34.96, 32.75], [34.96, 32.83], [35.07, 32.92], [35.10, 33.05]
TYRE, ZAREPHATH, SIDON, RAPHIA, EGYPT_BROOK = [35.20, 33.27], [35.30, 33.46], [35.37, 33.56], [34.25, 31.29], [33.80, 31.13]
DAN, HULEH, GALILEE_N, GALILEE_S, GALILEE_E = [35.65, 33.25], [35.61, 33.07], [35.60, 32.90], [35.57, 32.70], [35.65, 32.85]
BETHSHAN_J, ADAM_J, JERICHO_J, DEADSEA_N, DEADSEA_W, DEADSEA_S, ARNON_MOUTH = [35.55, 32.50], [35.55, 32.10], [35.55, 31.85], [35.53, 31.76], [35.40, 31.45], [35.42, 31.03], [35.58, 31.45]

T = {  # the tribes (Joshua 13–19)
 'Asher': [CARMEL_S, CARMEL, ACCO, ACHZIB, TYRE, ZAREPHATH, SIDON, [35.45, 33.45], [35.35, 33.20], [35.30, 33.00], [35.20, 32.83], [35.10, 32.75], [35.10, 32.62]],
 'Naphtali': [[35.20, 32.83], [35.30, 32.85], [35.40, 32.78], [35.45, 32.70], GALILEE_S, GALILEE_N, HULEH, DAN, [35.55, 33.40], [35.45, 33.45], [35.35, 33.20], [35.30, 33.00]],
 'Zebulun': [[35.10, 32.62], [35.18, 32.62], [35.25, 32.66], [35.39, 32.69], [35.45, 32.70], [35.40, 32.78], [35.30, 32.85], [35.20, 32.83], [35.10, 32.75]],
 'Issachar': [[35.18, 32.62], [35.30, 32.55], BETHSHAN_J, GALILEE_S, [35.45, 32.70], [35.39, 32.69], [35.25, 32.66]],
 'Manasseh (west)': [YARKON, CAESAREA, DOR, CARMEL_S, [35.10, 32.62], [35.18, 32.62], [35.30, 32.55], BETHSHAN_J, ADAM_J, [35.40, 32.10], [35.28, 32.15], [35.10, 32.10], [34.85, 32.15]],
 'Ephraim': [JOPPA, YARKON, [34.85, 32.15], [35.10, 32.10], [35.28, 32.15], [35.40, 32.10], ADAM_J, [35.55, 31.95], [35.45, 31.97], [35.30, 31.98], [35.24, 31.93], [35.05, 31.88], [34.95, 31.95]],
 'Benjamin': [JERICHO_J, DEADSEA_N, [35.23, 31.76], [35.10, 31.81], [35.05, 31.88], [35.24, 31.93], [35.30, 31.98], [35.45, 31.97], [35.55, 31.95]],
 'Dan': [JABNEEL, JOPPA, [34.95, 31.95], [35.05, 31.88], [35.10, 31.81], [34.97, 31.75], [34.85, 31.78]],
 'Judah': [JABNEEL, [34.85, 31.78], [34.97, 31.75], [35.10, 31.81], [35.23, 31.76], DEADSEA_N, DEADSEA_W, DEADSEA_S, [34.42, 30.65], EGYPT_BROOK, RAPHIA, GAZA, ASHKELON, ASHDOD],
 'Simeon': [[34.55, 31.35], [34.95, 31.35], [35.05, 31.15], [34.85, 30.95], [34.45, 31.05]],
 'Reuben': [ARNON_MOUTH, [35.95, 31.45], [35.95, 31.80], [35.70, 31.85], JERICHO_J, DEADSEA_N],
 'Gad': [JERICHO_J, [35.70, 31.85], [35.95, 31.80], [35.98, 32.10], [35.75, 32.20], [35.65, 32.40], [35.62, 32.70], GALILEE_S, BETHSHAN_J, ADAM_J],
 'Manasseh (east)': [[35.62, 32.70], [35.65, 32.40], [35.75, 32.20], [35.98, 32.10], [36.30, 32.40], [36.40, 32.90], [36.10, 33.20], [35.75, 33.10], GALILEE_E],
}
DAN_NORTH = [[35.55, 33.40], DAN, [35.75, 33.22], [35.80, 33.33], [35.65, 33.45]]
N = {  # neighbours
 'Philistia': [RAPHIA, GAZA, ASHKELON, ASHDOD, JABNEEL, [34.85, 31.78], [34.90, 31.62], [34.70, 31.35]],
 'Phoenicia': [ACHZIB, TYRE, ZAREPHATH, SIDON, [35.50, 33.90], [35.70, 33.85], [35.55, 33.40], [35.45, 33.45], [35.35, 33.20], [35.30, 33.00], [35.20, 33.05]],
 'Moab': [ARNON_MOUTH, [35.95, 31.45], [36.05, 31.00], [35.65, 30.95], DEADSEA_S, [35.52, 31.25]],
 'Ammon': [[35.95, 31.80], [36.25, 31.75], [36.30, 32.20], [35.98, 32.10]],
 'Edom': [DEADSEA_S, [35.65, 30.95], [35.75, 30.50], [35.50, 29.90], [35.05, 29.55], [35.15, 30.30], [35.35, 30.80]],
 'Aram (Damascus)': [[35.75, 33.10], [36.10, 33.20], [36.60, 33.30], [36.60, 33.80], [35.90, 33.65], [35.80, 33.33], [35.75, 33.22]],
}
TRIBE_REFS = {'Asher': 'Joshua 19:24–31', 'Naphtali': 'Joshua 19:32–39', 'Zebulun': 'Joshua 19:10–16', 'Issachar': 'Joshua 19:17–23', 'Manasseh (west)': 'Joshua 17:1–13',
  'Ephraim': 'Joshua 16:5–10', 'Benjamin': 'Joshua 18:11–28', 'Dan': 'Joshua 19:40–48', 'Judah': 'Joshua 15:1–12', 'Simeon': 'Joshua 19:1–9', 'Reuben': 'Joshua 13:15–23',
  'Gad': 'Joshua 13:24–28', 'Manasseh (east)': 'Joshua 13:29–31'}

def area(kind, name, parts, refs=None, note=None, label=None, color=0):
    return {k: v for k, v in dict(name=name, kind=kind, parts=parts, refs=refs, note=note, label=label, color=color).items() if v is not None}

LABELS = {'Judah': [35.02, 31.50], 'Simeon': [34.72, 31.12]}
tribes = [area('tribe', name, [poly], [TRIBE_REFS[name]], label=LABELS.get(name), color=i) for i, (name, poly) in enumerate(T.items())]
tribes.append(area('tribe', 'Dan (later)', [DAN_NORTH], ['Judges 18:27–29'], 'Where Dan resettled after leaving its first allotment.', color=7))
neighbours = lambda names, suffix='': [area('neighbour', n + suffix, [N[n]]) for n in names]

ISRAEL_TRIBES = ['Asher', 'Naphtali', 'Zebulun', 'Issachar', 'Manasseh (west)', 'Ephraim', 'Gad', 'Manasseh (east)', 'Reuben']
JUDAH_TRIBES = ['Judah', 'Benjamin', 'Dan']

ERAS = [
 dict(id='tribes', title='The twelve tribes', span='Joshua – Judges', timeline='PROMLAND-4',
      note='The territories as allotted in Joshua 13–19. The Philistine coast was allotted to Judah but not held. Levi received cities, not a territory.',
      areas=tribes),
 dict(id='united', title='The united kingdom', span='Saul, David and Solomon', timeline='KINGS-8',
      note='Israel under David and Solomon. Moab, Ammon, Edom and Aram were subject peoples for part of this time (2 Samuel 8).',
      areas=[area('kingdom', 'Israel', [T[t] for t in ISRAEL_TRIBES + JUDAH_TRIBES] + [DAN_NORTH], ['2 Samuel 5:1–5', '1 Kings 4:20–25'], label=[35.25, 32.05], color=0)]
            + neighbours(['Philistia', 'Phoenicia']) + neighbours(['Moab', 'Ammon', 'Edom', 'Aram (Damascus)'], ' (subject to David)')),
 dict(id='divided', title='Israel and Judah', span='1 Kings 12 – 2 Kings 17', timeline='KINGS-11',
      note='After the kingdom divided: Israel in the north with its capital at Samaria, Judah in the south with Jerusalem. Borders moved with each war.',
      areas=[area('kingdom', 'Israel', [T[t] for t in ISRAEL_TRIBES] + [DAN_NORTH], ['1 Kings 12:16–20'], label=[35.30, 32.35], color=1),
             area('kingdom', 'Judah', [T[t] for t in JUDAH_TRIBES], ['1 Kings 12:21'], label=[35.05, 31.55], color=0)]
            + neighbours(['Philistia', 'Phoenicia', 'Moab', 'Ammon', 'Edom', 'Aram (Damascus)'])),
 dict(id='persian', title='Persian provinces', span='Ezra – Nehemiah', timeline='PERSIAN-10',
      note='Judah became the small province of Yehud around Jerusalem, with Samaria to the north and Edomite settlers (later Idumea) to the south.',
      areas=[
        area('region', 'Yehud', [[[34.98, 31.92], [35.30, 31.92], [35.46, 31.90], DEADSEA_N, DEADSEA_W, [35.40, 31.55], [35.10, 31.57], [34.98, 31.70]]], ['Ezra 5:8', 'Nehemiah 2:11'], color=0),
        area('region', 'Samaria', [[YARKON, CAESAREA, DOR, CARMEL_S, [35.10, 32.62], [35.30, 32.55], BETHSHAN_J, ADAM_J, [35.55, 31.92], [35.46, 31.90], [35.30, 31.92], [34.98, 31.92], [34.85, 32.10]]], ['Nehemiah 4:1–2'], color=1),
        area('region', 'Galilee', [[CARMEL_S, CARMEL, ACCO, ACHZIB, [35.30, 33.00], [35.45, 33.15], HULEH, GALILEE_N, GALILEE_S, BETHSHAN_J, [35.30, 32.55], [35.10, 32.62]]], color=3),
        area('region', 'Ashdod', [[GAZA, ASHKELON, ASHDOD, JABNEEL, JOPPA, [34.85, 32.10], [34.98, 31.92], [34.98, 31.70], [34.85, 31.55], [34.60, 31.35], RAPHIA]], ['Nehemiah 4:7'], color=4),
        area('region', 'Edomites (later Idumea)', [[[34.98, 31.70], [35.10, 31.57], [35.40, 31.55], DEADSEA_W, DEADSEA_S, [34.85, 30.95], [34.60, 31.35], [34.85, 31.55]]], color=5),
        area('neighbour', 'Ammon', [N['Ammon']], ['Nehemiah 2:19']), area('neighbour', 'Moab', [N['Moab']]), area('neighbour', 'Phoenicia', [N['Phoenicia']])]),
 dict(id='nt', title='The land in the time of Jesus', span='The Gospels and Acts', timeline='NT_DET-1',
      note='Around AD 30: Judea, Samaria and Idumea under a Roman prefect; Galilee and Perea under Herod Antipas; Philip’s tetrarchy to the north-east; the Decapolis cities.',
      areas=[
        area('region', 'Galilee', [[[35.12, 32.75], [35.25, 32.62], [35.45, 32.62], GALILEE_S, GALILEE_N, HULEH, [35.50, 33.15], [35.30, 33.10], [35.20, 32.95]]], ['Luke 4:14', 'Matthew 4:23'], color=3),
        area('region', 'Samaria', [[YARKON, CAESAREA, DOR, [34.98, 32.62], [35.25, 32.55], [35.45, 32.48], [35.55, 32.30], ADAM_J, [35.30, 32.10], [35.10, 32.10], [34.85, 32.15]]], ['John 4:4–5', 'Acts 8:5'], color=1),
        area('region', 'Judea', [[JABNEEL, JOPPA, YARKON, [34.85, 32.15], [35.10, 32.10], [35.30, 32.10], ADAM_J, JERICHO_J, DEADSEA_N, DEADSEA_W, [35.40, 31.30], [34.90, 31.40], [34.70, 31.62]]], ['Matthew 2:1', 'Luke 1:5'], color=0),
        area('region', 'Idumea', [[[34.70, 31.62], [34.90, 31.40], [35.40, 31.30], DEADSEA_S, [34.85, 30.95], [34.50, 31.30]]], ['Mark 3:8'], color=5),
        area('region', 'Perea', [[[35.55, 32.30], [35.75, 32.30], [35.80, 32.00], [35.75, 31.50], ARNON_MOUTH, DEADSEA_N, JERICHO_J, ADAM_J]], ['Matthew 19:1', 'Mark 10:1'], 'Called “beyond the Jordan” in the Gospels.', color=2),
        area('region', 'Decapolis', [[[35.45, 32.55], BETHSHAN_J, GALILEE_S, GALILEE_E, [35.95, 32.85], [36.30, 32.60], [36.10, 32.10], [35.90, 31.95], [35.80, 32.00], [35.75, 32.30], [35.55, 32.30], [35.45, 32.48]]], ['Mark 5:20', 'Mark 7:31'], color=4),
        area('region', 'Philip’s tetrarchy (Iturea & Trachonitis)', [[HULEH, GALILEE_N, GALILEE_E, [35.95, 32.85], [36.40, 32.85], [36.60, 33.10], [36.20, 33.45], [35.75, 33.40], DAN]], ['Luke 3:1'], color=6),
        area('neighbour', 'Phoenicia (Tyre and Sidon)', [[ACCO, ACHZIB, TYRE, ZAREPHATH, SIDON, [35.50, 33.90], [35.70, 33.85], [35.75, 33.40], DAN, [35.50, 33.15], [35.30, 33.10], [35.20, 32.95], [35.12, 32.75], CARMEL]], ['Mark 7:24', 'Acts 21:3']),
        area('neighbour', 'Nabataea', [[[35.75, 31.50], [35.80, 32.00], [35.90, 31.95], [36.40, 31.70], [36.40, 30.50], [35.20, 29.50], [34.90, 30.50], DEADSEA_S, DEADSEA_W, ARNON_MOUTH]], ['2 Corinthians 11:32']),
      ]),
]

def centroid(poly):
    a = cx = cy = 0
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        f = x1 * y2 - x2 * y1; a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f
    return [round(cx / (3 * a), 4), round(cy / (3 * a), 4)], abs(a) / 2

for era in ERAS:
    for item in era['areas']:
        if 'label' not in item:
            item['label'] = max((centroid(p) for p in item['parts']), key=lambda c: c[1])[0]
out = Path(sys.argv[1] if len(sys.argv) > 1 else 'boundaries.json')
out.write_text(json.dumps({'version': '2026.11.05', 'note': 'Approximate boundaries drawn by hand for orientation, after common Bible-atlas layouts. Borders changed often and many are uncertain.', 'eras': ERAS}, ensure_ascii=False), encoding='utf-8')
print(len(ERAS), 'periods,', sum(len(e['areas']) for e in ERAS), 'areas')

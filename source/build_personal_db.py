"""Write Scriptorium's personal-commentaries.sqlite with Boylan and Calmet, matching the main library's tables."""
import hashlib, json, sqlite3, sys
from pathlib import Path
data = json.load(open(sys.argv[1], encoding='utf-8')); books = Path(sys.argv[2]); out = Path(sys.argv[3])
if out.exists(): out.unlink()
db = sqlite3.connect(out)
db.executescript("""
CREATE TABLE works(id TEXT PRIMARY KEY,title TEXT,author TEXT,language TEXT,edition TEXT,source_file TEXT,sha256 TEXT,notice TEXT);
CREATE TABLE sections(id INTEGER PRIMARY KEY,work TEXT REFERENCES works(id),book TEXT,chapter INTEGER,scope TEXT,title TEXT,body TEXT,source_href TEXT, reference_note TEXT DEFAULT '');
CREATE TABLE coverage(section INTEGER REFERENCES sections(id),chapter INTEGER,verse INTEGER,PRIMARY KEY(section,chapter,verse));
CREATE INDEX section_reference ON sections(book,chapter,work);
CREATE INDEX coverage_reference ON coverage(chapter,verse,section);
""")
sha = lambda *names: hashlib.sha256(b''.join((books / n).read_bytes() for n in names)).hexdigest()
db.executemany('INSERT INTO works VALUES(?,?,?,?,?,?,?,?)', [
 ('boylan-psalms', 'The Psalms: A Study of the Vulgate Psalter in the Light of the Hebrew Text', 'Patrick Boylan', 'English',
  'Dublin: M. H. Gill & Son, 1920–1924, 2 vols. Text from the Internet Archive OCR of the University of Toronto copies (psalmsstudyofvul01boyluoft, psalmsstudyofvul02boyluoft).',
  'psalmsstudyofvul01boyluoft_djvu.txt; psalmsstudyofvul02boyluoft_djvu.txt', sha('boylan1.txt', 'boylan2.txt'),
  'Boylan uses Vulgate numbering. Verse notes were separated automatically from the scanned text; occasional OCR errors and a few missed or merged notes are possible. The whole-psalm entry keeps his introduction, translation and all notes.'),
])
next_id = 900000001
SRC = {'boylan-psalms': ['https://archive.org/details/psalmsstudyofvul01boyluoft', 'https://archive.org/details/psalmsstudyofvul02boyluoft'],
       'calmet-psalms': ['https://archive.org/details/bub_gb_3bxaYAzyzF8C', 'https://archive.org/details/bub_gb_XXc2RSOUZnAC']}
for work, key, split in (('boylan-psalms', 'boylan', 72),):
    for s in data[key]:
        href = SRC[work][0 if s['chapter'] < split else 1]
        db.execute('INSERT INTO sections VALUES(?,?,?,?,?,?,?,?,?)', (next_id, work, 'Psa', s['chapter'], s['scope'], s['title'], s['body'], href, s.get('note', '')))
        for v in s['verses']: db.execute('INSERT OR IGNORE INTO coverage VALUES(?,?,?)', (next_id, s['chapter'], v))
        next_id += 1
db.commit()
for row in db.execute('SELECT work,scope,count(*),count(DISTINCT chapter) FROM sections GROUP BY work,scope'): print(row)
print('coverage rows', db.execute('SELECT count(*) FROM coverage').fetchone()[0])
db.execute('VACUUM'); db.close(); print(out.stat().st_size // 1024, 'KB')

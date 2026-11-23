# Scriptorium improvements

Additions to **Scriptorium**, the Windows Bible study program, with a traditional Catholic emphasis: the 1962 Missal and Breviary, the Fathers, the Douay–Rheims and the Vulgate.

The repository holds the improvements. Scriptorium itself (release 2026.10.31, with its Bible library) is attached to the **Releases** page as `Scriptorium Setup.exe`, because at 1.3 GB it is too large for the repository. The improvements installer reads the program's own display files from your computer and adds the improvements to them.

## What it adds

- **Liturgy tab (1962 Missal and Breviary)**
  - The 1962 calendar is worked out for any date, with local feasts of Britain and Ireland listed apart.
  - Each day has the Proper of the Mass in English and Latin, with the Epistle and Gospel.
  - Each day also has the sermons of the Fathers on that Gospel (Augustine, Chrysostom, Leo, Gregory), the Matins homily, the Catena Aurea, and links to Pope Benedict XVI's homilies on vatican.va.
- **Start page:** where you left off reading, and today's Mass.
- **Search or go to** (Ctrl + K): a passage, a feast, a Father, a place, a word or your notes.
- **Search the Fathers:** about 32,000 passages.
- **My study:** bookmarks, highlights, notes, tags and collections, with export and backup.
- **Reading**
  - Douay–Rheims with the Vulgate beside it.
  - Back and Forward through the passages you've read.
  - A reading mode that hides everything but the text.
  - Hover previews of Bible references.
- **In the original:** choose a word of the Douay–Rheims or the Vulgate and see the verse in Greek or Hebrew, with the matching word picked out and its dictionary entry.
  - New Testament: Vulgate words are matched to the Greek word by word.
  - Psalms: the Septuagint first.
- **Antoniades Patriarchal Text with accents**, which the library has only unaccented.
- **Brown–Driver–Briggs:** the entry that fits the word comes first, and related words are folded away.
- **Commentary:** the Catena Aurea on the Gospels, and Boylan's *The Psalms*, divided as in the Roman Breviary.
- **Map tab and Atlas**
  - Journeys, wars and movements, traced step by step.
  - Period boundaries.
  - A library of maps, site plans and models of the holy places.
- **Timeline:** Old Testament, New Testament and Church history (371 entries with exact dates where known).
- **A simpler, tidier layout**, with a light or dark theme.

## Requirements

- **Windows**, with **Scriptorium release 2026.10.31** ("bellarmine-reviewed") installed in the usual place (`%LOCALAPPDATA%\Programs\Scriptorium`). Its installer is on this repository's **Releases** page.
  - The installer checks the program's files and changes nothing on a different version.
- **Python 3.8 or newer** ([python.org](https://www.python.org/downloads/); tick "Add python.exe to PATH").
  - It is used only to build the files; nothing else is installed.

## Installing

1. Install Scriptorium: download `Scriptorium Setup.exe` from the **Releases** page and run it. It isn't signed, so Windows may show "Windows protected your PC": choose **More info → Run anyway**. Then open it once and close it.
1. Download this repository: **Code → Download ZIP**. Unzip it.
2. Close Scriptorium.
3. Double-click **`install\Install Scriptorium improvements.cmd`**.
   - If Windows warns about the file, choose **More info → Run anyway**. It is a plain-text script, and you can read it in Notepad first.
4. Open Scriptorium.

After reinstalling or repairing Scriptorium, run the installer again.

**What it touches:**
- Your notes, bookmarks and the Bible library are not touched.
- Scriptorium's original `app.js`, `style.css` and `index.html` are kept in `%LOCALAPPDATA%\Scriptorium improvements\original-files`.
- To undo, reinstall Scriptorium.

`install\Check Scriptorium improvements.cmd` only reports whether the improvements are installed.

## How it is built

`source\patch.py <folder with Scriptorium's original app.js, style.css, index.html> <output folder>` writes the improved files.

- It changes the program's code only at named points, and stops with an error, rather than guessing, if the code there has changed.
- It minifies the output when `esbuild` is on the PATH.
- The output is copied into `_internal\static`.

Each feature is its own file in `source\`:

| File | What it does |
|---|---|
| `core.js` | Shared helpers |
| `liturgy.js`, `ordo.js` | The Liturgy tab and the 1962 calendar |
| `breviary.js` | The Breviary |
| `catena.js` | The Catena Aurea |
| `benedict.js` | The Benedict XVI links |
| `study-extras.js` | Bookmarks, highlights, notes and My study |
| `usability.js` | Start page, Search or go to, previews, shortcuts, backup |
| `simplify.js` | The simpler layout |
| `scripture-map.js` | The Map tab |
| `media-tools.js` | The Atlas |
| `timeline-chart.js`, `timeline-simple.js` | The Timeline |
| `origword.js` | In the original |
| `accents.js` | Antoniades accents |
| `lexicon-rank.js` | The Brown–Driver–Briggs order |

The data are built by the `build_*.py` scripts.

- `rebuild_liturgy.sh` rebuilds the liturgy in order. It needs the Divinum Officium and Writings-Database checkouts it names.
- To correct a reading, edit `harmony-1962.txt`, then rebuild.

## Licence, sources and credits

The code is under the MIT licence ([LICENSE](LICENSE)). The data keep the terms of their sources, listed below and in full in [NOTICE.md](NOTICE.md).


| Data | Source | Terms |
|---|---|---|
| Missal and Breviary texts (Latin and English) | [Divinum Officium](https://github.com/DivinumOfficium/divinum-officium) | MIT |
| 1962 Gospel harmony | The repository owner's own table (`harmony-1962.txt`) | |
| Sermons and homilies of the Fathers | [HistoricalChristianFaith Writings-Database](https://github.com/HistoricalChristianFaith/Writings-Database), chiefly the Nicene and Post-Nicene Fathers | Public domain translations |
| Catena Aurea | Newman's translation | Public domain |
| Boylan, *The Psalms* (1920–24) | Internet Archive | Public domain |
| Places | [OpenBible.info](https://www.openbible.info/geo/) | CC BY 4.0 |
| Site plans, maps and models (`source\plans.zip`) | Wikimedia Commons | Each image keeps its own licence and credit, recorded in `atlas-plans.json` |
| Vulgate–Greek word matching (`source\origword\vulgate-greek.zip`) | [PROIEL Treebank](https://github.com/proiel/proiel-treebank), University of Oslo | **CC BY-NC-SA 3.0**: non-commercial use, same licence |
| Antoniades accents (`source\accents\antoniades-accents.zip`) | [byztxt/greektext-antoniades](https://github.com/byztxt/greektext-antoniades) and [byztxt/byzantine-majority-text](https://github.com/byztxt/byzantine-majority-text) | Public domain |
| Benedict XVI | [vatican.va](https://www.vatican.va/) | Titles and links only; the texts are © Libreria Editrice Vaticana |

Scriptorium and its Bible library belong to their author and to the publishers of the texts; the installer on the Releases page is redistributed as published by its author.

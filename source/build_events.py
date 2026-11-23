"""Build scripture-journeys.json: hand-traced journeys, wars and tribal movements.

Each step is (place, reference, note[, flags]).
  place  – an OpenBible.info place id from the Bible map, or ('Name', lon, lat) for an
           approximate area the data does not hold (tribal territories).
  flags  – 'b' battle or siege here, 'e' enemy/foreign force, 's' by sea,
           'j' start a new line (no line drawn into this step).
"""
import json, re, sys
from pathlib import Path

places = json.load(open(sys.argv[1] if len(sys.argv) > 1 else '/root/work/places_data.json'))['places']
books = json.load(open(sys.argv[2] if len(sys.argv) > 2 else '/mnt/user-data/uploads/Scriptorium/_internal/books.json'))
byid = {p['id']: p for p in places}
codes = {b['name']: b['code'] for b in books}

def E(id, title, kind, testament, span, intro, steps, route=True):
    return dict(id=id, title=title, kind=kind, testament=testament, span=span, intro=intro, steps=steps, route=route)

EVENTS = [
# ---------------- People: Old Testament ----------------
E('abraham', 'Abraham’s journey', 'people', 'OT', 'Genesis 11–23', 'From Ur to Canaan, down to Egypt and back, ending at Hebron.', [
  ('a6cf75c', 'Genesis 11:31', 'Terah sets out from Ur with Abram and Sarai'),
  ('a6d9af3', 'Genesis 11:31–32', 'They settle in Haran; Terah dies'),
  ('adf74d4', 'Genesis 12:6–7', 'The Lord appears at the oak of Moreh'),
  ('a64f355', 'Genesis 12:8', 'Abram builds an altar between Bethel and Ai'),
  ('af301ca', 'Genesis 12:10', 'Famine drives Abram down to Egypt'),
  ('a64f355', 'Genesis 13:3–4', 'He returns to the altar at Bethel'),
  ('aeb9e97', 'Genesis 13:18', 'He settles by the oaks of Mamre at Hebron'),
  ('a3f5814', 'Genesis 20:1', 'He sojourns in Gerar'),
  ('ad2f6c2', 'Genesis 21:31–33', 'The covenant well at Beersheba'),
  ('aac1fcf', 'Genesis 22:2', 'The offering of Isaac on Moriah'),
  ('ad2f6c2', 'Genesis 22:19', 'Abraham returns to Beersheba'),
  ('a85151a', 'Genesis 23:2', 'Sarah dies and is buried at Hebron')]),
E('lot', 'Lot and the cities of the plain', 'people', 'OT', 'Genesis 13; 19', 'Lot parts from Abram, settles near Sodom, and escapes to Zoar.', [
  ('a64f355', 'Genesis 13:3–9', 'Abram and Lot part company near Bethel'),
  ('a0aa664', 'Genesis 13:11–12', 'Lot moves his tent as far as Sodom'),
  ('aacfcda', 'Genesis 19:22–23', 'Lot flees to Zoar as Sodom is destroyed')]),
E('jacob', 'Jacob’s flight and return', 'people', 'OT', 'Genesis 28–35', 'Jacob flees to Haran, then returns with his family to Canaan.', [
  ('ad2f6c2', 'Genesis 28:10', 'Jacob leaves Beersheba'),
  ('a64f355', 'Genesis 28:19', 'The ladder to heaven at Bethel'),
  ('a6d9af3', 'Genesis 29:4', 'Twenty years with Laban near Haran'),
  ('ae5bfe9', 'Genesis 32:2', 'Angels of God meet him at Mahanaim'),
  ('a8a9ff9', 'Genesis 32:30–31', 'He wrestles with God at Penuel'),
  ('a0905b5', 'Genesis 33:17', 'He builds booths at Succoth'),
  ('adf74d4', 'Genesis 33:18', 'He camps before Shechem'),
  ('a64f355', 'Genesis 35:6–7', 'He returns to Bethel'),
  ('a112427', 'Genesis 35:19', 'Rachel dies on the way to Ephrath'),
  ('aeb9e97', 'Genesis 35:27', 'Jacob comes home to Isaac at Mamre')]),
E('joseph', 'Joseph sold into Egypt', 'people', 'OT', 'Genesis 37–39', 'Joseph looks for his brothers, is sold to traders, and is taken down to Egypt.', [
  ('a85151a', 'Genesis 37:14', 'Jacob sends Joseph from the valley of Hebron'),
  ('adf74d4', 'Genesis 37:14–16', 'He searches for his brothers near Shechem'),
  ('ab635e4', 'Genesis 37:17–28', 'At Dothan he is thrown into a pit and sold'),
  ('af301ca', 'Genesis 39:1', 'He is sold to Potiphar in Egypt')]),
E('moses', 'Moses in Midian and his return', 'people', 'OT', 'Exodus 2–4', 'Moses flees Pharaoh, meets God at the burning bush, and goes back to Egypt.', [
  ('af301ca', 'Exodus 2:11–15', 'Moses kills an Egyptian and flees'),
  ('acc6d8e', 'Exodus 2:15–21', 'He settles in Midian and marries Zipporah'),
  ('a9bb03e', 'Exodus 3:1–6', 'The burning bush at Horeb'),
  ('af301ca', 'Exodus 4:20', 'He returns to Egypt with his family')]),
E('ruth', 'Naomi and Ruth', 'people', 'OT', 'Ruth 1–4', 'A family leaves Bethlehem in famine; Naomi returns with Ruth.', [
  ('a112427', 'Ruth 1:1', 'Elimelech’s family leaves Bethlehem in a famine'),
  ('aa0b1d6', 'Ruth 1:2–5', 'They live in Moab; Naomi is widowed'),
  ('a112427', 'Ruth 1:19–22', 'Naomi returns with Ruth at the barley harvest')]),
E('ark', 'Journey of the Ark of the Covenant', 'people', 'OT', '1 Samuel 4 – 2 Samuel 6', 'Captured in battle, the Ark passes through Philistine cities before David brings it to Jerusalem.', [
  ('aa4680a', '1 Samuel 4:3–4', 'The Ark is brought from Shiloh to the camp'),
  ('abfdefc', '1 Samuel 4:10–11', 'Israel is defeated at Ebenezer; the Ark is taken', 'b'),
  ('a30c937', '1 Samuel 5:1–2', 'It is set beside Dagon in Ashdod', 'e'),
  ('a18873f', '1 Samuel 5:8', 'It is moved to Gath', 'e'),
  ('a3fc47a', '1 Samuel 5:10', 'It is sent on to Ekron', 'e'),
  ('a3b5b53', '1 Samuel 6:12', 'The cows take it to Beth-shemesh'),
  ('a9bba61', '1 Samuel 7:1–2', 'Twenty years at Kiriath-jearim'),
  ('a15257a', '2 Samuel 6:12–17', 'David brings it up to Jerusalem')]),
E('samuel', 'Samuel’s circuit', 'people', 'OT', '1 Samuel 7:15–17', 'Each year Samuel judged Israel in a circuit from his home at Ramah.', [
  ('a6d57ed', '1 Samuel 7:17', 'Samuel’s home at Ramah'),
  ('a64f355', '1 Samuel 7:16', 'Bethel'),
  ('ab94aea', '1 Samuel 7:16', 'Gilgal'),
  ('a736f6c', '1 Samuel 7:16', 'Mizpah'),
  ('a6d57ed', '1 Samuel 7:17', 'Back to Ramah')]),
E('david-flight', 'David flees from Saul', 'people', 'OT', '1 Samuel 19–27', 'Hunted by Saul, David moves from refuge to refuge in Judah and Philistia.', [
  ('ac24f5f', '1 Samuel 19:10–12', 'David escapes from Saul at Gibeah'),
  ('a6d57ed', '1 Samuel 19:18', 'He goes to Samuel at Ramah'),
  ('afdda14', '1 Samuel 21:1–6', 'The holy bread at Nob'),
  ('a18873f', '1 Samuel 21:10–15', 'He feigns madness before Achish of Gath'),
  ('af82614', '1 Samuel 22:1–2', 'The cave of Adullam'),
  ('ac702f1', '1 Samuel 22:3–4', 'He leaves his parents with the king of Moab at Mizpeh'),
  ('ad9df93', '1 Samuel 23:1–5', 'He saves Keilah from the Philistines', 'b'),
  ('a9b852f', '1 Samuel 23:14–18', 'Hiding in the wilderness of Ziph'),
  ('a6845b1', '1 Samuel 23:24–28', 'Saul nearly catches him at Maon'),
  ('a51df0e', '1 Samuel 24:1–7', 'He spares Saul in a cave at En-gedi'),
  ('a18873f', '1 Samuel 27:2–3', 'He goes over to Achish of Gath'),
  ('a0ed7ff', '1 Samuel 27:6', 'Achish gives him Ziklag')]),
E('david-king', 'David becomes king', 'people', 'OT', '2 Samuel 2–5', 'From Ziklag to Hebron, then to Jerusalem as king of all Israel.', [
  ('a0ed7ff', '2 Samuel 1:1', 'David at Ziklag hears of Saul’s death'),
  ('a85151a', '2 Samuel 2:1–4', 'Anointed king of Judah at Hebron'),
  ('a85151a', '2 Samuel 5:3', 'Anointed king over all Israel'),
  ('a15257a', '2 Samuel 5:6–9', 'He takes the stronghold of Zion', 'b')]),
E('absalom', 'David flees from Absalom', 'people', 'OT', '2 Samuel 15–20', 'Absalom seizes Jerusalem; David crosses the Jordan, then returns after the battle.', [
  ('a15257a', '2 Samuel 15:14', 'David leaves Jerusalem'),
  ('ac2c4c5', '2 Samuel 15:30', 'He weeps as he climbs the Mount of Olives'),
  ('a9ed5a4', '2 Samuel 16:5–13', 'Shimei curses him at Bahurim'),
  ('ae686c9', '2 Samuel 17:22', 'He crosses the Jordan by night'),
  ('ae5bfe9', '2 Samuel 17:24–27', 'He waits at Mahanaim'),
  ('ae5bfe9', '2 Samuel 18:6–15', 'Battle in the forest of Ephraim; Absalom dies', 'b'),
  ('ab94aea', '2 Samuel 19:15', 'Judah meets the king at Gilgal'),
  ('a15257a', '2 Samuel 20:3', 'David returns to Jerusalem')]),
E('elijah', 'Elijah and Elisha', 'people', 'OT', '1 Kings 17 – 2 Kings 2', 'Elijah’s ministry, from the brook Cherith to his taking up beyond the Jordan.', [
  ('aa7bee8', '1 Kings 17:3–5', 'Ravens feed Elijah at the brook Cherith'),
  ('a6fa2d3', '1 Kings 17:9–10', 'The widow of Zarephath'),
  ('a3e21c6', '1 Kings 18:19–20', 'Fire falls on Mount Carmel'),
  ('ae0bf4a', '1 Kings 18:45–46', 'Elijah runs ahead of Ahab to Jezreel'),
  ('ad2f6c2', '1 Kings 19:3', 'He flees to Beersheba'),
  ('a9bb03e', '1 Kings 19:8', 'The still small voice at Horeb'),
  ('a5a1bdd', '1 Kings 19:16–19', 'He calls Elisha from Abel-meholah'),
  ('a64f355', '2 Kings 2:2', 'Elijah and Elisha go to Bethel'),
  ('a231f80', '2 Kings 2:4', 'On to Jericho'),
  ('ae686c9', '2 Kings 2:7–11', 'Elijah is taken up beyond the Jordan')]),
E('naaman', 'Naaman is healed', 'people', 'OT', '2 Kings 5', 'The Aramean commander travels to Israel and washes in the Jordan.', [
  ('a69c1d4', '2 Kings 5:1–5', 'Naaman sets out from Damascus'),
  ('a041bb3', '2 Kings 5:6–8', 'The king of Israel in Samaria; Elisha sends for him'),
  ('ae686c9', '2 Kings 5:14', 'He dips seven times in the Jordan'),
  ('a69c1d4', '2 Kings 5:19', 'He goes home in peace')]),
E('jonah', 'Jonah', 'people', 'OT', 'Jonah 1–3', 'Jonah sails from Joppa for Tarshish, far to the west, but is sent to Nineveh.', [
  ('ac51cec', '2 Kings 14:25', 'Jonah son of Amittai, of Gath-hepher'),
  ('ae023a9', 'Jonah 1:3', 'He boards a ship at Joppa, bound for Tarshish'),
  ('a70fd5d', 'Jonah 3:3', 'He goes to Nineveh and preaches')]),

# ---------------- Wars and battles: Old Testament ----------------
E('kings', 'Abram rescues Lot', 'war', 'OT', 'Genesis 14', 'Four eastern kings defeat the kings of the plain and carry off Lot; Abram pursues them north.', [
  ('af725b1', 'Genesis 14:1', 'Four kings from Shinar, Elam and beyond', 'e'),
  ('a4a5cce', 'Genesis 14:8–12', 'Battle in the Valley of Siddim; Lot is taken', 'be'),
  ('aeb9e97', 'Genesis 14:13', 'Word reaches Abram at Mamre', 'j'),
  ('a513646', 'Genesis 14:14', 'Abram pursues them as far as Dan'),
  ('a6779cd', 'Genesis 14:15', 'A night attack; pursuit to Hobah', 'b'),
  ('aad7e4e', 'Genesis 14:17–20', 'Melchizedek of Salem blesses Abram')]),
E('amalek', 'Battle with Amalek', 'war', 'OT', 'Exodus 17:8–16', 'Joshua fights Amalek while Moses’ hands are held up.', [
  ('a05ebb7', 'Exodus 17:8–13', 'Amalek attacks Israel at Rephidim', 'b')]),
E('hormah', 'Defeat and victory at Hormah', 'war', 'OT', 'Numbers 14; 21', 'Israel is driven back at Hormah, and later destroys the cities of Arad.', [
  ('ac2cef0', 'Numbers 14:40–44', 'Israel presumes to go up from Kadesh'),
  ('ada25df', 'Numbers 14:45', 'Amalekites and Canaanites beat them back to Hormah', 'b'),
  ('abc358b', 'Numbers 21:1', 'The king of Arad attacks Israel', 'bej'),
  ('ada25df', 'Numbers 21:3', 'Israel devotes the cities to destruction: Hormah', 'b')]),
E('sihon-og', 'Victory over Sihon and Og', 'war', 'OT', 'Numbers 21:21–35', 'The Amorite kings refuse passage and are defeated east of the Jordan.', [
  ('a4cc324', 'Numbers 21:13', 'Israel camps beyond the Arnon'),
  ('ad9b1cd', 'Numbers 21:23–24', 'Sihon is defeated at Jahaz', 'b'),
  ('abf2fc1', 'Numbers 21:25–26', 'Israel takes Heshbon, Sihon’s city'),
  ('a095b6e', 'Numbers 21:32', 'Jazer is captured', 'b'),
  ('aaa6f7a', 'Numbers 21:33–35', 'Og king of Bashan is defeated at Edrei', 'b')]),
E('conquest-centre', 'Jericho and Ai', 'war', 'OT', 'Joshua 5–9', 'Joshua’s first campaign from the camp at Gilgal.', [
  ('ab94aea', 'Joshua 5:10', 'The camp at Gilgal'),
  ('a231f80', 'Joshua 6:20', 'The walls of Jericho fall', 'b'),
  ('a7e13e1', 'Joshua 7:4–5', 'Defeat at Ai after Achan’s sin', 'b'),
  ('a7e13e1', 'Joshua 8:19–28', 'The ambush takes Ai', 'b'),
  ('aa5cc66', 'Joshua 8:30–35', 'The altar and the Law read at Mount Ebal'),
  ('ab94aea', 'Joshua 9:6', 'Back to the camp at Gilgal')]),
E('conquest-south', 'The southern campaign', 'war', 'OT', 'Joshua 10', 'Joshua marches by night to save Gibeon, then takes the cities of the south.', [
  ('ab94aea', 'Joshua 10:9', 'An all-night march from Gilgal'),
  ('aede336', 'Joshua 10:10', 'The five kings routed at Gibeon; the sun stands still', 'b'),
  ('a75b45e', 'Joshua 10:10–11', 'Hailstones on the descent of Beth-horon'),
  ('af2ca0c', 'Joshua 10:10–11', 'Pursuit as far as Azekah'),
  ('abf8e4e', 'Joshua 10:16–28', 'The kings in the cave at Makkedah', 'b'),
  ('a97b595', 'Joshua 10:29–30', 'Libnah', 'b'),
  ('a3cc590', 'Joshua 10:31–32', 'Lachish, taken on the second day', 'b'),
  ('a244d8f', 'Joshua 10:34–35', 'Eglon', 'b'),
  ('a85151a', 'Joshua 10:36–37', 'Hebron', 'b'),
  ('ad2048e', 'Joshua 10:38–39', 'Debir', 'b'),
  ('ab94aea', 'Joshua 10:43', 'Return to Gilgal')]),
E('conquest-north', 'The northern campaign', 'war', 'OT', 'Joshua 11', 'Jabin of Hazor gathers the northern kings and is defeated.', [
  ('ab94aea', 'Joshua 10:43', 'Israel sets out from Gilgal'),
  ('a6ee047', 'Joshua 11:5–7', 'Surprise attack at the waters of Merom', 'b'),
  ('a98e4d7', 'Joshua 11:8', 'Pursuit as far as Great Sidon'),
  ('a6f33c5', 'Joshua 11:10–11', 'Hazor is captured and burned', 'b')]),
E('deborah', 'Deborah and Barak against Sisera', 'war', 'OT', 'Judges 4–5', 'Barak musters at Kedesh, descends from Mount Tabor and routs Sisera by the Kishon.', [
  ('a321cb8', 'Judges 4:10', 'Barak summons Zebulun and Naphtali to Kedesh'),
  ('acd63ee', 'Judges 4:12–14', 'Ten thousand go down from Mount Tabor'),
  ('a49c017', 'Judges 4:13', 'Sisera’s chariots come from Harosheth-hagoyim', 'ej'),
  ('a5a6458', 'Judges 4:15; 5:21', 'The rout by the river Kishon', 'be'),
  ('a49c017', 'Judges 4:16', 'Barak pursues to Harosheth-hagoyim'),
  ('a321cb8', 'Judges 4:17–21', 'Sisera flees and is killed by Jael near Kedesh', 'j')]),
E('gideon', 'Gideon against Midian', 'war', 'OT', 'Judges 7–8', 'Three hundred men surprise the Midianite camp and chase them across the Jordan.', [
  ('ae3cace', 'Judges 7:1–7', 'Gideon camps at the spring of Harod'),
  ('a772880', 'Judges 7:19–22', 'Torches and trumpets at the camp by the hill of Moreh', 'b'),
  ('a83d789', 'Judges 7:22', 'Midian flees toward Beth-shittah'),
  ('a5a1bdd', 'Judges 7:22', 'and the border of Abel-meholah'),
  ('a0905b5', 'Judges 8:5–7', 'Succoth refuses bread'),
  ('a8a9ff9', 'Judges 8:8–9', 'Penuel refuses too'),
  ('a0415e8', 'Judges 8:10–12', 'Zebah and Zalmunna caught at Karkor', 'b')]),
E('jephthah', 'Jephthah against Ammon', 'war', 'OT', 'Judges 11', 'Jephthah marches from Mizpah in Gilead and subdues the Ammonites.', [
  ('a0f8af9', 'Judges 11:29', 'Jephthah sets out from Mizpah of Gilead'),
  ('af74969', 'Judges 11:33', 'He strikes Ammon from Aroer', 'b'),
  ('a222545', 'Judges 11:33', 'to Minnith, twenty cities'),
  ('a0f8af9', 'Judges 11:34', 'His daughter comes out to meet him at Mizpah')]),
E('gibeah', 'War against Benjamin', 'war', 'OT', 'Judges 20', 'The tribes gather at Mizpah and fight Benjamin at Gibeah.', [
  ('a736f6c', 'Judges 20:1', 'The tribes assemble at Mizpah'),
  ('a64f355', 'Judges 20:18', 'They inquire of God at Bethel'),
  ('ac24f5f', 'Judges 20:19–48', 'Three battles at Gibeah', 'b'),
  ('a45acc3', 'Judges 20:47', 'Six hundred Benjaminites flee to the rock of Rimmon')]),
E('ebenezer', 'Battle of Ebenezer', 'war', 'OT', '1 Samuel 4', 'The Philistines at Aphek defeat Israel and capture the Ark.', [
  ('a7b2e63', '1 Samuel 4:1', 'The Philistines camp at Aphek', 'e'),
  ('abfdefc', '1 Samuel 4:1–11', 'Israel is defeated at Ebenezer; the Ark is taken', 'be'),
  ('aa4680a', '1 Samuel 4:12–18', 'A runner brings the news to Eli at Shiloh', 'j')]),
E('jabesh', 'Saul rescues Jabesh-gilead', 'war', 'OT', '1 Samuel 11', 'Saul musters Israel at Bezek and breaks the Ammonite siege.', [
  ('ac24f5f', '1 Samuel 11:4–7', 'News reaches Saul at Gibeah'),
  ('af48fdd', '1 Samuel 11:8', 'He musters Israel at Bezek'),
  ('af92088', '1 Samuel 11:11', 'He strikes the Ammonites at Jabesh-gilead', 'b'),
  ('ab94aea', '1 Samuel 11:14–15', 'Saul is made king at Gilgal')]),
E('michmash', 'Jonathan at Michmash', 'war', 'OT', '1 Samuel 13–14', 'Jonathan climbs to the Philistine outpost and the Philistines flee.', [
  ('ab94aea', '1 Samuel 13:8–15', 'Saul waits for Samuel at Gilgal'),
  ('a264254', '1 Samuel 13:16', 'Saul and Jonathan at Geba'),
  ('adea06c', '1 Samuel 14:13–15', 'Jonathan’s attack on the outpost at Michmash', 'b'),
  ('a03cb21', '1 Samuel 14:23', 'The battle passes beyond Beth-aven'),
  ('a1c600b', '1 Samuel 14:31', 'The Philistines are struck down as far as Aijalon')]),
E('goliath', 'David and Goliath', 'war', 'OT', '1 Samuel 17', 'Israel faces the Philistines across the Valley of Elah.', [
  ('a39a6b9', '1 Samuel 17:1', 'The Philistines gather at Socoh', 'e'),
  ('ab183f8', '1 Samuel 17:2–51', 'David kills Goliath in the Valley of Elah', 'b'),
  ('a18873f', '1 Samuel 17:52', 'Israel pursues the Philistines to Gath'),
  ('a3fc47a', '1 Samuel 17:52', 'and to the gates of Ekron')]),
E('gilboa', 'Battle of Mount Gilboa', 'war', 'OT', '1 Samuel 28–31', 'The Philistines march north; Saul and his sons fall on Gilboa.', [
  ('a7b2e63', '1 Samuel 29:1', 'The Philistines muster at Aphek', 'e'),
  ('ac86af5', '1 Samuel 28:4', 'They camp at Shunem', 'e'),
  ('acf57c5', '1 Samuel 28:4', 'Saul camps on Gilboa', 'j'),
  ('aca444b', '1 Samuel 28:7–25', 'Saul visits the medium at En-dor'),
  ('acf57c5', '1 Samuel 31:1–6', 'Saul and his sons die on Mount Gilboa', 'b'),
  ('a2a8df0', '1 Samuel 31:10', 'Their bodies are hung on the wall of Beth-shan', 'e'),
  ('af92088', '1 Samuel 31:11–13', 'The men of Jabesh-gilead bury them')]),
E('david-wars', 'David’s wars with the Philistines', 'war', 'OT', '2 Samuel 5', 'After taking Jerusalem, David twice defeats the Philistines in the Valley of Rephaim.', [
  ('a15257a', '2 Samuel 5:6–9', 'David takes Jerusalem', 'b'),
  ('a7559e6', '2 Samuel 5:18', 'The Philistines spread out in the Valley of Rephaim', 'e'),
  ('a6bf059', '2 Samuel 5:20', 'The Lord breaks through at Baal-perazim', 'b'),
  ('aed6538', '2 Samuel 5:25', 'David strikes them as far as Gezer', 'b')]),
E('rabbah', 'Siege of Rabbah', 'war', 'OT', '2 Samuel 11–12', 'While Joab besieges the Ammonite capital, David stays in Jerusalem.', [
  ('a15257a', '2 Samuel 11:1', 'David sends Joab out in the spring'),
  ('ae067b5', '2 Samuel 11:1; 12:26–29', 'Rabbah is besieged and taken', 'b')]),
E('aram', 'Ahab’s wars with Aram', 'war', 'OT', '1 Kings 20; 22', 'Ben-hadad besieges Samaria and is beaten at Aphek; Ahab later dies at Ramoth-gilead.', [
  ('a69c1d4', '1 Kings 20:1', 'Ben-hadad of Damascus gathers his army', 'e'),
  ('a041bb3', '1 Kings 20:1–21', 'Siege of Samaria; Aram is routed', 'be'),
  ('a6fc60d', '1 Kings 20:26–30', 'Aram defeated again at Aphek', 'b'),
  ('a041bb3', '1 Kings 22:10', 'Ahab and Jehoshaphat at Samaria', 'j'),
  ('a2fe63c', '1 Kings 22:29–35', 'Ahab is killed at Ramoth-gilead', 'b'),
  ('a041bb3', '1 Kings 22:37', 'He is buried in Samaria')]),
E('mesha', 'War against Mesha of Moab', 'war', 'OT', '2 Kings 3', 'Israel, Judah and Edom go round by the wilderness of Edom to attack Moab.', [
  ('a041bb3', '2 Kings 3:6', 'Jehoram musters Israel at Samaria'),
  ('a2735ff', '2 Kings 3:8–20', 'Seven days through the wilderness of Edom'),
  ('ab55371', '2 Kings 3:25–27', 'The siege of Kir-hareseth', 'b')]),
E('jehu', 'Jehu’s revolt', 'war', 'OT', '2 Kings 9–10', 'Anointed at Ramoth-gilead, Jehu drives to Jezreel and destroys the house of Ahab.', [
  ('a2fe63c', '2 Kings 9:1–13', 'Jehu is anointed at Ramoth-gilead'),
  ('ae0bf4a', '2 Kings 9:16–37', 'Joram and Jezebel are killed at Jezreel', 'b'),
  ('a041bb3', '2 Kings 10:17', 'He strikes Ahab’s house in Samaria', 'b')]),
E('jehoshaphat', 'Jehoshaphat at the Valley of Beracah', 'war', 'OT', '2 Chronicles 20', 'Moab, Ammon and Mount Seir come up by En-gedi; Judah goes out singing.', [
  ('a51df0e', '2 Chronicles 20:2', 'A great army at Hazazon-tamar, that is En-gedi', 'e'),
  ('a4446f1', '2 Chronicles 20:16', 'They come up by the ascent of Ziz', 'e'),
  ('a15257a', '2 Chronicles 20:20', 'Judah sets out from Jerusalem', 'j'),
  ('a2e3aa0', '2 Chronicles 20:20–23', 'The enemies destroy one another near Tekoa', 'b'),
  ('a71f834', '2 Chronicles 20:26', 'Blessing in the Valley of Beracah'),
  ('a15257a', '2 Chronicles 20:27–28', 'They return to Jerusalem with joy')]),
E('samaria-falls', 'Fall of Samaria', 'war', 'OT', '2 Kings 17', 'Assyria besieges Samaria for three years and takes it.', [
  ('a70fd5d', '2 Kings 17:3', 'Shalmaneser king of Assyria comes up', 'e'),
  ('a041bb3', '2 Kings 17:5–6', 'Samaria is besieged three years and falls', 'be')]),
E('sennacherib', 'Sennacherib’s invasion of Judah', 'war', 'OT', '2 Kings 18–19; Isaiah 36–37', 'Assyria takes Lachish and threatens Jerusalem, then withdraws.', [
  ('a70fd5d', '2 Kings 18:13', 'Sennacherib comes against the fortified cities of Judah', 'e'),
  ('a3cc590', '2 Kings 18:14–17', 'Siege of Lachish; envoys sent to Jerusalem', 'be'),
  ('a15257a', '2 Kings 18:17 – 19:35', 'Jerusalem threatened; the angel strikes the camp', 'be'),
  ('a97b595', '2 Kings 19:8', 'The king fights against Libnah', 'be'),
  ('a70fd5d', '2 Kings 19:36', 'Sennacherib returns to Nineveh', 'e')]),
E('megiddo', 'Josiah falls at Megiddo', 'war', 'OT', '2 Kings 23:29–30; 2 Chronicles 35:20–24', 'Pharaoh Neco marches north toward Carchemish; Josiah goes out to stop him.', [
  ('af301ca', '2 Kings 23:29', 'Pharaoh Neco marches out of Egypt', 'e'),
  ('a8554e3', '2 Chronicles 35:22–23', 'Battle in the plain of Megiddo', 'be'),
  ('af6c730', '2 Chronicles 35:20', 'Neco presses on toward Carchemish', 'e'),
  ('a15257a', '2 Kings 23:29', 'Josiah sets out from Jerusalem', 'j'),
  ('a8554e3', '2 Kings 23:29', 'Josiah is killed at Megiddo', 'b'),
  ('a15257a', '2 Kings 23:30', 'He is carried back to Jerusalem and buried')]),
E('carchemish', 'Battle of Carchemish', 'war', 'OT', 'Jeremiah 46:2', 'Babylon defeats Egypt on the Euphrates in the fourth year of Jehoiakim.', [
  ('af301ca', 'Jeremiah 46:2', 'Pharaoh Neco’s army', 'e'),
  ('af6c730', 'Jeremiah 46:2–12', 'Egypt is defeated at Carchemish', 'be'),
  ('a217d18', 'Jeremiah 46:2', 'Nebuchadnezzar of Babylon', 'ej'),
  ('af6c730', 'Jeremiah 46:2', 'His victory by the Euphrates', 'e')]),
E('jerusalem-falls', 'Babylon conquers Judah', 'war', 'OT', '2 Kings 24–25; Jeremiah 34; 39; 52', 'Nebuchadnezzar takes Jerusalem, then besieges and destroys it; Zedekiah is judged at Riblah.', [
  ('a217d18', '2 Kings 24:10', 'Nebuchadnezzar’s army comes up', 'e'),
  ('a15257a', '2 Kings 24:10–16', 'First capture; Jehoiachin is taken to Babylon', 'be'),
  ('a3cc590', 'Jeremiah 34:7', 'Lachish holds out', 'be'),
  ('af2ca0c', 'Jeremiah 34:7', 'and Azekah', 'be'),
  ('a15257a', '2 Kings 25:1–10', 'Jerusalem is besieged, breached and burned', 'be'),
  ('a231f80', '2 Kings 25:5', 'Zedekiah is caught in the plains of Jericho', 'e'),
  ('ab2bde8', '2 Kings 25:6–7', 'He is judged at Riblah', 'e'),
  ('a217d18', '2 Kings 25:7', 'He is taken in chains to Babylon', 'e')]),

# ---------------- Tribes and nations ----------------
E('to-egypt', 'Israel goes down to Egypt', 'tribes', 'OT', 'Genesis 46–47', 'Jacob’s household, seventy persons, settles in Goshen.', [
  ('a85151a', 'Genesis 37:14', 'The family’s home near Hebron'),
  ('ad2f6c2', 'Genesis 46:1–4', 'Sacrifices at Beersheba; “Do not be afraid to go down”'),
  ('a60f092', 'Genesis 46:28–47:6', 'Joseph meets Jacob; they settle in Goshen')]),
E('exodus', 'The Exodus and the wilderness', 'tribes', 'OT', 'Exodus 12 – Joshua 4', 'Many stations are uncertain. This follows Numbers 33 using leading identifications.', [
  ('a079b21', 'Exodus 12:37', 'Israel sets out from Rameses'),
  ('aa28709', 'Exodus 12:37', 'First camp at Succoth'),
  ('a27d0e0', 'Exodus 13:20', 'Camp at Etham, at the edge of the wilderness'),
  ('ababfd2', 'Exodus 14:2', 'Camp by the sea at Pi-hahiroth; the sea is crossed'),
  ('ad3970d', 'Exodus 15:23', 'Bitter water made sweet at Marah'),
  ('a2410c1', 'Exodus 15:27', 'Twelve springs and seventy palms at Elim'),
  ('a0f54e4', 'Exodus 16:1', 'Manna in the wilderness of Sin'),
  ('a05ebb7', 'Exodus 17:1', 'Water from the rock; battle with Amalek'),
  ('abfba2a', 'Exodus 19:1–2', 'The covenant at Mount Sinai'),
  ('ac2cef0', 'Numbers 13:26', 'The spies report at Kadesh'),
  ('a8e53d5', 'Numbers 33:35', 'Camp at Ezion-geber'),
  ('ac2cef0', 'Numbers 33:36', 'Back to Kadesh, in the wilderness of Zin'),
  ('ad8027f', 'Numbers 20:22–28', 'Aaron dies on Mount Hor'),
  ('a4cc324', 'Numbers 21:13', 'Around Edom and Moab to the Arnon'),
  ('a51d1fa', 'Numbers 33:49', 'Camp in the plains of Moab at Abel-shittim'),
  ('aefaa2d', 'Deuteronomy 34:1', 'Moses views the land from Mount Nebo'),
  ('ae686c9', 'Joshua 3:16–17', 'Israel crosses the Jordan'),
  ('ab94aea', 'Joshua 4:19', 'First camp in the land at Gilgal')]),
E('east-tribes', 'Reuben, Gad and half Manasseh settle east of the Jordan', 'tribes', 'OT', 'Numbers 32; Joshua 13', 'Two and a half tribes ask for the cattle country of Gilead and Bashan.', [
  ('a095b6e', 'Numbers 32:1', 'The land of Jazer and Gilead, good for cattle'),
  ('abf2fc1', 'Numbers 32:37', 'Reuben rebuilds Heshbon'),
  ('ae73b90', 'Numbers 32:39–40', 'Machir son of Manasseh takes Gilead'),
  ('aa7a40a', 'Deuteronomy 3:13', 'Half Manasseh receives Bashan')], route=False),
E('dan', 'The tribe of Dan moves north', 'tribes', 'OT', 'Judges 18', 'Unable to hold its land, Dan sends out spies and resettles at Laish.', [
  ('a08174b', 'Judges 18:2', 'Spies set out from Zorah'),
  ('a355b6e', 'Judges 18:11', 'Six hundred armed men leave Eshtaol'),
  ('ab3fd96', 'Judges 18:12', 'They camp at Mahaneh-dan near Kiriath-jearim'),
  ('ac0d1a5', 'Judges 18:13–20', 'They take Micah’s idols in the hill country of Ephraim'),
  ('a513646', 'Judges 18:27–29', 'They burn Laish and rebuild it as Dan', 'b')]),
E('divided', 'The kingdom divides', 'tribes', 'OT', '1 Kings 12', 'Ten tribes reject Rehoboam at Shechem; Jeroboam sets up shrines at Bethel and Dan.', [
  ('adf74d4', '1 Kings 12:1–16', 'All Israel gathers at Shechem; the ten tribes revolt'),
  ('a15257a', '1 Kings 12:18–21', 'Rehoboam flees to Jerusalem; Judah and Benjamin stay with him'),
  ('a64f355', '1 Kings 12:29', 'Jeroboam’s golden calf at Bethel'),
  ('a513646', '1 Kings 12:29', 'and at Dan')], route=False),
E('north-exile-1', 'The northern tribes deported by Tiglath-pileser', 'tribes', 'OT', '2 Kings 15:29; 1 Chronicles 5:26', 'Galilee and Gilead are taken; Reuben, Gad and half Manasseh are carried to Assyria.', [
  ('a062b95', '2 Kings 15:29', 'Ijon is captured', 'be'),
  ('abffcaa', '2 Kings 15:29', 'Abel-beth-maacah', 'be'),
  ('a6f33c5', '2 Kings 15:29', 'Hazor', 'be'),
  ('ae73b90', '2 Kings 15:29', 'Gilead and Galilee, all the land of Naphtali', 'e'),
  ('a924b16', '1 Chronicles 5:26', 'Carried away to Hara and the river Gozan', 'e'),
  ('abf176f', '1 Chronicles 5:26', 'and to Halah', 'e')]),
E('north-exile-2', 'Israel carried away to Assyria', 'tribes', 'OT', '2 Kings 17:6; 18:11', 'After Samaria falls, its people are settled in Mesopotamia and Media.', [
  ('a041bb3', '2 Kings 17:6', 'Samaria is taken', 'b'),
  ('a924b16', '2 Kings 17:6', 'Settled on the Habor, the river of Gozan', 'e'),
  ('abf176f', '2 Kings 17:6', 'in Halah', 'e'),
  ('ad2fadf', '2 Kings 17:6', 'and in the cities of the Medes', 'e')]),
E('resettled', 'Foreigners settled in Samaria', 'tribes', 'OT', '2 Kings 17:24', 'Assyria brings peoples from five places to live in the cities of Samaria.', [
  ('a217d18', '2 Kings 17:24', 'From Babylon', 'e'),
  ('a041bb3', '2 Kings 17:24', 'to the cities of Samaria', 'e'),
  ('a538831', '2 Kings 17:24', 'From Cuthah', 'ej'),
  ('a041bb3', '2 Kings 17:24', 'to Samaria', 'e'),
  ('a4b500d', '2 Kings 17:24', 'From Avva', 'ej'),
  ('a041bb3', '2 Kings 17:24', 'to Samaria', 'e'),
  ('ac62cbc', '2 Kings 17:24', 'From Hamath', 'ej'),
  ('a041bb3', '2 Kings 17:24', 'to Samaria', 'e'),
  ('a282c15', '2 Kings 17:24', 'From Sepharvaim', 'ej'),
  ('a041bb3', '2 Kings 17:24', 'to Samaria', 'e')]),
E('judah-exile', 'Judah carried away to Babylon', 'tribes', 'OT', '2 Kings 24–25; Daniel 1', 'The route is schematic: travellers followed the Euphrates rather than crossing the desert.', [
  ('a15257a', 'Daniel 1:1–6', 'Daniel and others taken in Jehoiakim’s third year'),
  ('a217d18', 'Daniel 1:1–6', 'They serve in the king’s court in Babylon'),
  ('a15257a', '2 Kings 24:14–16', 'Jehoiachin and ten thousand captives', 'j'),
  ('a217d18', '2 Kings 24:15', 'are carried to Babylon'),
  ('a15257a', '2 Kings 25:11', 'The rest of the people after the city burns', 'j'),
  ('a217d18', '2 Kings 25:11', 'are carried away to Babylon')]),
E('flight-egypt', 'The remnant flees to Egypt', 'tribes', 'OT', 'Jeremiah 41–43', 'After Gedaliah is murdered, the remnant takes Jeremiah to Egypt.', [
  ('a736f6c', 'Jeremiah 41:1–3', 'Gedaliah is murdered at Mizpah'),
  ('aede336', 'Jeremiah 41:12', 'The captives are freed at the great pool in Gibeon'),
  ('a1c28f1', 'Jeremiah 41:17', 'They stop at Geruth Chimham near Bethlehem'),
  ('adb008c', 'Jeremiah 43:7', 'They go into Egypt as far as Tahpanhes')]),
E('return', 'The return from exile', 'tribes', 'OT', 'Ezra 1–8; Nehemiah 2', 'The exiles return under Zerubbabel, then Ezra; Nehemiah comes from Susa.', [
  ('a217d18', 'Ezra 1:11; 2:1', 'The first exiles leave Babylon'),
  ('a15257a', 'Ezra 3:1–2', 'The altar is rebuilt in Jerusalem'),
  ('a6c3859', 'Ezra 8:15–31', 'Ezra gathers the people by the river Ahava', 'j'),
  ('a15257a', 'Ezra 8:32', 'Ezra arrives in Jerusalem'),
  ('a033b84', 'Nehemiah 1:1; 2:1–8', 'Nehemiah, cupbearer at Susa', 'j'),
  ('a15257a', 'Nehemiah 2:11', 'Nehemiah arrives and inspects the walls')]),

# ---------------- People: New Testament ----------------
E('nativity', 'Birth and childhood of Jesus', 'people', 'NT', 'Matthew 2; Luke 1–2', 'A harmony of Matthew and Luke.', [
  ('af5884f', 'Luke 1:26–27', 'The Annunciation at Nazareth'),
  ('a112427', 'Luke 2:4–7', 'Jesus is born in Bethlehem'),
  ('a15257a', 'Luke 2:22', 'The Presentation in the Temple'),
  ('af301ca', 'Matthew 2:13–15', 'The flight into Egypt'),
  ('af5884f', 'Matthew 2:23', 'The family settles in Nazareth'),
  ('a15257a', 'Luke 2:41–49', 'The boy Jesus in the Temple'),
  ('af5884f', 'Luke 2:51', 'He returns to Nazareth')]),
E('ministry', 'The ministry of Jesus', 'people', 'NT', 'The four Gospels', 'The order follows a common harmony; the Gospels arrange some events differently.', [
  ('af5884f', 'Mark 1:9', 'Jesus comes from Nazareth'),
  ('a6e060d', 'John 1:28', 'Baptism at Bethany beyond the Jordan'),
  ('a031bda', 'John 2:1–11', 'Water made wine at Cana'),
  ('af2161c', 'John 2:12', 'A short stay at Capernaum'),
  ('a15257a', 'John 2:13–16', 'The Temple cleansed at Passover'),
  ('a27b472', 'John 4:5–7', 'The Samaritan woman at Sychar'),
  ('a031bda', 'John 4:46', 'The official’s son healed, from Cana'),
  ('af5884f', 'Luke 4:16–30', 'Rejected in the synagogue at Nazareth'),
  ('af2161c', 'Luke 4:31', 'Teaching and healing at Capernaum'),
  ('aee679c', 'Luke 7:11–15', 'The widow’s son raised at Nain'),
  ('a91b732', 'Luke 9:10–17', 'The five thousand fed near Bethsaida'),
  ('a160272', 'Mark 7:24–30', 'The Syrophoenician woman near Tyre'),
  ('ab7bf48', 'Matthew 16:13–16', 'Peter’s confession at Caesarea Philippi'),
  ('acd63ee', 'Matthew 17:1–2', 'The Transfiguration (traditionally Mount Tabor)'),
  ('af2161c', 'Matthew 17:24', 'The Temple tax at Capernaum'),
  ('aaf03fa', 'Luke 19:1–10', 'Zacchaeus at Jericho'),
  ('a4f35bc', 'John 12:1', 'Supper at Bethany'),
  ('a15257a', 'Matthew 21:10', 'He enters Jerusalem')]),
E('passion', 'Holy Week and the Resurrection', 'people', 'NT', 'Matthew 21 – Acts 1', 'Jerusalem and its surroundings. Zoom in to separate nearby places.', [
  ('a4f35bc', 'John 12:1–3', 'Mary anoints Jesus at Bethany'),
  ('abff59d', 'Matthew 21:1–2', 'The colt is brought from Bethphage'),
  ('a15257a', 'Matthew 21:10–12', 'The entry into Jerusalem'),
  ('ac2c4c5', 'Matthew 24:3', 'Teaching on the Mount of Olives'),
  ('a42418f', 'Matthew 26:36', 'The agony in Gethsemane'),
  ('a631d35', 'John 19:17–18', 'The Crucifixion at Golgotha'),
  ('ae7274b', 'Luke 24:13–31', 'The risen Christ at Emmaus'),
  ('a15257a', 'Luke 24:33–36', 'He appears to the disciples in Jerusalem'),
  ('ac2c4c5', 'Acts 1:9–12', 'The Ascension from the Mount of Olives')]),
E('philip', 'Philip the evangelist', 'people', 'NT', 'Acts 8', 'Scattered by persecution, Philip preaches in Samaria and along the coast.', [
  ('a15257a', 'Acts 8:1', 'Persecution scatters the church from Jerusalem'),
  ('a041bb3', 'Acts 8:5–8', 'Philip preaches Christ in Samaria'),
  ('aa8edd2', 'Acts 8:26–39', 'The Ethiopian is baptized on the road to Gaza'),
  ('a30c937', 'Acts 8:40', 'Philip appears at Azotus'),
  ('a58735e', 'Acts 8:40', 'He preaches all the way to Caesarea')]),
E('peter', 'Peter goes to Cornelius', 'people', 'NT', 'Acts 9–11', 'Peter travels down to the coast and opens the door to the Gentiles.', [
  ('a15257a', 'Acts 9:32', 'Peter travels from Jerusalem'),
  ('a2c5cc7', 'Acts 9:32–35', 'Aeneas healed at Lydda'),
  ('ae023a9', 'Acts 9:36–43', 'Tabitha raised; the vision at Joppa'),
  ('a58735e', 'Acts 10:24–48', 'Cornelius’s household receives the Spirit at Caesarea'),
  ('a15257a', 'Acts 11:2–18', 'Peter explains himself in Jerusalem')]),
E('saul', 'Saul’s conversion and early years', 'people', 'NT', 'Acts 9–11; Galatians 1', 'From persecutor to apostle, ending in Antioch.', [
  ('a15257a', 'Acts 9:1–2', 'Saul sets out from Jerusalem'),
  ('a69c1d4', 'Acts 9:3–8', 'The light on the road to Damascus'),
  ('a0f4ea8', 'Galatians 1:17', 'He goes away into Arabia'),
  ('a69c1d4', 'Galatians 1:17', 'He returns to Damascus'),
  ('a15257a', 'Acts 9:26–28', 'Barnabas brings him to the apostles'),
  ('a58735e', 'Acts 9:30', 'The brothers take him down to Caesarea'),
  ('a666ea0', 'Acts 9:30', 'He is sent on to Tarsus'),
  ('ae41ab4', 'Acts 11:25–26', 'Barnabas brings him to Antioch')]),
E('paul1', 'Paul’s first journey', 'people', 'NT', 'Acts 13–14', 'With Barnabas through Cyprus and southern Galatia.', [
  ('ae41ab4', 'Acts 13:1–3', 'Barnabas and Saul are sent out from Antioch'),
  ('a6d306d', 'Acts 13:4', 'Down to the port of Seleucia'),
  ('afa863b', 'Acts 13:5', 'Preaching in the synagogues of Salamis', 's'),
  ('a314765', 'Acts 13:6–12', 'The proconsul believes at Paphos'),
  ('aff04b8', 'Acts 13:13', 'John Mark leaves them at Perga', 's'),
  ('a6c704a', 'Acts 13:14–48', 'The sermon at Antioch in Pisidia'),
  ('ae425aa', 'Acts 13:51', 'Iconium'),
  ('af0719d', 'Acts 14:8–19', 'A lame man healed; Paul stoned at Lystra'),
  ('aa401a9', 'Acts 14:20–21', 'Many disciples made at Derbe'),
  ('af0719d', 'Acts 14:21', 'Back through Lystra'),
  ('ae425aa', 'Acts 14:21', 'and Iconium'),
  ('a6c704a', 'Acts 14:21–23', 'and Antioch, appointing elders'),
  ('aff04b8', 'Acts 14:25', 'The word preached in Perga'),
  ('ac744c1', 'Acts 14:25', 'Down to Attalia'),
  ('ae41ab4', 'Acts 14:26–27', 'They sail back to Antioch', 's')]),
E('paul2', 'Paul’s second journey', 'people', 'NT', 'Acts 15:36 – 18:22', 'With Silas, and later Timothy and Luke, into Europe.', [
  ('ae41ab4', 'Acts 15:36–40', 'Paul and Silas leave Antioch'),
  ('aa401a9', 'Acts 16:1', 'Derbe'),
  ('af0719d', 'Acts 16:1–3', 'Timothy joins them at Lystra'),
  ('a91c509', 'Acts 16:8–10', 'The vision of the man of Macedonia at Troas'),
  ('a68750d', 'Acts 16:11', 'A straight course to Samothrace', 's'),
  ('a6a7150', 'Acts 16:11', 'Landing at Neapolis', 's'),
  ('a49e1d0', 'Acts 16:12–40', 'Lydia, the jailer, and the church at Philippi'),
  ('a4bdea7', 'Acts 17:1', 'Through Amphipolis'),
  ('ab20df9', 'Acts 17:1', 'and Apollonia'),
  ('afa9d8e', 'Acts 17:1–9', 'Three sabbaths in Thessalonica'),
  ('a62fe31', 'Acts 17:10–12', 'The Bereans search the Scriptures'),
  ('a1fe6e7', 'Acts 17:15–34', 'The Areopagus address at Athens', 's'),
  ('a6f437a', 'Acts 18:1–11', 'Eighteen months at Corinth'),
  ('aa31dd3', 'Acts 18:18', 'Paul cuts his hair at Cenchreae'),
  ('a5feb15', 'Acts 18:19–21', 'A brief stop at Ephesus', 's'),
  ('a58735e', 'Acts 18:22', 'Landing at Caesarea', 's'),
  ('a15257a', 'Acts 18:22', 'He goes up and greets the church'),
  ('ae41ab4', 'Acts 18:22', 'He returns to Antioch')]),
E('paul3', 'Paul’s third journey', 'people', 'NT', 'Acts 18:23 – 21:17', 'Through Galatia to Ephesus, Macedonia and Greece, then back to Jerusalem.', [
  ('ae41ab4', 'Acts 18:23', 'Paul sets out from Antioch'),
  ('a0f440a', 'Acts 18:23', 'Strengthening the disciples in Galatia'),
  ('ab8ae56', 'Acts 18:23', 'and Phrygia'),
  ('a5feb15', 'Acts 19:1–20', 'More than two years at Ephesus'),
  ('a49e1d0', 'Acts 20:1', 'On to Macedonia (Philippi shown)'),
  ('a6f437a', 'Acts 20:2–3', 'Three months in Greece (probably Corinth)'),
  ('a49e1d0', 'Acts 20:6', 'Unleavened Bread at Philippi'),
  ('a91c509', 'Acts 20:6–12', 'Eutychus raised at Troas', 's'),
  ('a0a2ca7', 'Acts 20:13–14', 'Paul walks to Assos'),
  ('a33910d', 'Acts 20:14', 'Mitylene', 's'),
  ('a4c2c75', 'Acts 20:15', 'Off Chios', 's'),
  ('acf6ec0', 'Acts 20:15', 'Samos', 's'),
  ('a55027d', 'Acts 20:15–38', 'Farewell to the Ephesian elders at Miletus', 's'),
  ('a398e5d', 'Acts 21:1', 'Cos', 's'),
  ('a4218ee', 'Acts 21:1', 'Rhodes', 's'),
  ('ade301b', 'Acts 21:1', 'Patara', 's'),
  ('a160272', 'Acts 21:3–6', 'Seven days with the disciples at Tyre', 's'),
  ('abc2af0', 'Acts 21:7', 'Ptolemais', 's'),
  ('a58735e', 'Acts 21:8–14', 'Agabus prophesies at Caesarea'),
  ('a15257a', 'Acts 21:15–17', 'Arrival in Jerusalem')]),
E('rome', 'Paul’s voyage to Rome', 'people', 'NT', 'Acts 27–28', 'A prisoner’s voyage, shipwreck on Malta, and arrival in Rome.', [
  ('a58735e', 'Acts 27:1–2', 'Paul is handed over and sails from Caesarea'),
  ('a98e4d7', 'Acts 27:3', 'Friends care for him at Sidon', 's'),
  ('aa4b3e2', 'Acts 27:5–6', 'A ship of Alexandria at Myra', 's'),
  ('ab793ce', 'Acts 27:7', 'Slowly off Cnidus', 's'),
  ('a1c44ea', 'Acts 27:7', 'Under the lee of Crete, off Salmone', 's'),
  ('aae626a', 'Acts 27:8–12', 'Paul warns them at Fair Havens', 's'),
  ('a57835d', 'Acts 27:41 – 28:10', 'Shipwreck and winter on Malta', 's'),
  ('a1e3697', 'Acts 28:12', 'Three days at Syracuse', 's'),
  ('a63bb26', 'Acts 28:13', 'Rhegium', 's'),
  ('a4488e9', 'Acts 28:13–14', 'Brothers welcome them at Puteoli', 's'),
  ('a121d5e', 'Acts 28:15', 'Believers meet him at the Forum of Appius'),
  ('afef438', 'Acts 28:15', 'and the Three Taverns'),
  ('afc8e7a', 'Acts 28:16–31', 'Two years under guard in Rome')]),
]

REF = re.compile(r'^(?:(.+?)\s+)?(\d+)(?::(\d+))?(?:\s*[–-]\s*(?:(\d+):)?(\d+))?$')

def parse(ref):
    """Split 'Judges 4:15; 5:21' into full references and the chapters they cover."""
    refs, ranges, book = [], [], None
    for part in [p.strip() for p in ref.split(';')]:
        m = REF.match(part)
        if not m: raise SystemExit(f'Unrecognized reference: {ref}')
        name, c1, v1, c2, v2 = m.groups()
        if name:
            if name not in codes: raise SystemExit(f'Unknown book in: {ref}')
            book = name
        if not book: raise SystemExit(f'No book in: {ref}')
        first = int(c1)
        last = int(c2) if c2 else (int(v2) if v2 and not v1 else first)
        start_verse = int(v1) if v1 else 1
        end_verse = int(v2) if (v2 and v1) else (int(v1) if v1 else 999)
        refs.append(f'{book} {part[len(name):].strip()}' if name else f'{book} {part}')
        # [book, first chapter, first verse, last chapter, last verse]
        ranges.append([codes[book], first, start_verse, last, end_verse])
    return refs, ranges

# Matching entries in the BibleWorks timeline (Study tools → Timeline).
TIMELINE = {
 'abraham': ['PSTFLOOD-9'], 'lot': ['PSTFLOOD-9'], 'jacob': ['PSTFLOOD-12'], 'joseph': ['PSTFLOOD-13'], 'moses': ['PSTFLOOD-15'],
 'ruth': ['PROMLAND-4'], 'ark': ['PROMLAND-14', 'KINGS-3'], 'samuel': ['PROMLAND-14'], 'david-flight': ['KINGS-2', 'KINGS-3'], 'david-king': ['KINGS-3'],
 'absalom': ['KINGS-3'], 'elijah': ['KINGS-21'], 'naaman': ['KINGS-26'], 'jonah': ['KINGS-36'],
 'kings': ['PSTFLOOD-9'], 'amalek': ['WILDRNSS-1'], 'hormah': ['WILDRNSS-2'], 'sihon-og': ['WILDRNSS-2'],
 'conquest-centre': ['PROMLAND-2', 'PROMLAND-1'], 'conquest-south': ['PROMLAND-1'], 'conquest-north': ['PROMLAND-3'],
 'deborah': ['PROMLAND-8'], 'gideon': ['PROMLAND-9'], 'jephthah': ['PROMLAND-11'], 'gibeah': ['PROMLAND-5'], 'ebenezer': ['PROMLAND-14'],
 'jabesh': ['KINGS-2'], 'michmash': ['KINGS-2'], 'goliath': ['KINGS-3'], 'gilboa': ['KINGS-2'], 'david-wars': ['KINGS-3'], 'rabbah': ['KINGS-3'],
 'aram': ['KINGS-21'], 'mesha': ['KINGS-26'], 'jehu': ['KINGS-29'], 'jehoshaphat': ['KINGS-22'], 'samaria-falls': ['ASSYR-6', 'ASSYR-4'],
 'sennacherib': ['ASSYR-12'], 'megiddo': ['BABYLON-6'], 'carchemish': ['BABYLON-8'], 'jerusalem-falls': ['BABYLON-14', 'BABYLON-12'],
 'to-egypt': ['PSTFLOOD-14'], 'exodus': ['WILDRNSS-1', 'WILDRNSS-2', 'PROMLAND-2'], 'east-tribes': ['WILDRNSS-2'], 'allotments': ['PROMLAND-3'],
 'dan': ['PROMLAND-5'], 'divided': ['KINGS-11'], 'north-exile-1': ['KINGS-46'], 'north-exile-2': ['ASSYR-6'], 'resettled': ['ASSYR-15'],
 'judah-exile': ['BABYLON-10', 'BABYLON-12', 'BABYLON-14'], 'flight-egypt': ['BABYLON-16'], 'return': ['PERSIAN-10', 'PERSIAN-21', 'PERSIAN-24'],
 'nativity': ['NT_DET-1', 'NT_DET-3'], 'ministry': ['NT_DET-1', 'NT_DET-5'], 'passion': ['NT_DET-8'], 'philip': ['NT_DET-10'],
 'saul': ['NT_DET-9', 'NT_DET-11', 'NT_DET-12'], 'paul1': ['NT_DET-15'], 'paul2': ['NT_DET-17'], 'paul3': ['NT_DET-21'], 'rome': ['NT_DET-30', 'NT_DET-28', 'NT_DET-31'],
}

out = []
for e in EVENTS:
    steps = []
    for s in e['steps']:
        place, ref, note = s[:3]; flags = s[3] if len(s) > 3 else ''
        refs, ranges = parse(ref)
        step = {'ref': ref, 'refs': refs, 'note': note, 'ch': ranges}
        if isinstance(place, tuple): step['name'], step['coord'] = place[0], [place[1], place[2]]
        else:
            if place not in byid: raise SystemExit(f'{e["id"]}: unknown place {place}')
            step['place'] = place
        for flag, key in (('s', 'sea'), ('b', 'battle'), ('e', 'enemy'), ('j', 'jump')):
            if flag in flags: step[key] = True
        steps.append(step)
    item = {k: v for k, v in e.items() if k != 'steps'}
    if item['route']: item.pop('route')
    item['timeline'] = TIMELINE.get(e['id'], [])
    item['steps'] = steps
    out.append(item)

doc = {'version': '2026.11.05.2',
       'note': 'Hand-traced from the biblical text. Lines join places in order of travel; they are not roads or sea lanes. Identifications follow the Bible map’s OpenBible.info data (CC BY 4.0). Tribal territory points are approximate.',
       'events': out}
Path(sys.argv[3] if len(sys.argv) > 3 else 'journeys.json').write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding='utf-8')
from collections import Counter
print(len(out), 'events', Counter(e['kind'] for e in out), sum(len(e['steps']) for e in out), 'steps')

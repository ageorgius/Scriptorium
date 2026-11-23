"""Pope Benedict XVI: links to the official texts on vatican.va, filed under the days of the 1962 calendar.

Only titles, dates and links are kept: the texts themselves are © Libreria Editrice Vaticana and are read on vatican.va.
Each line: kind | date or slug | title | where it belongs
  kind A = Wednesday general audience (URL from the date), H = homily (URL from its slug)
  where = month-day of a saint's day in the calendar, a day title of the temporal cycle, or '-' (only in the full list)
Usage: python3 build_benedict.py liturgy-1962.json out-dir
"""
import json, re, sys
from pathlib import Path

SERIES = [  # (from, to, name) for the audiences
    ('20060315', '20070214', 'The Apostles and the first disciples'),
    ('20070307', '20080625', 'The Fathers of the Church'),
    ('20080702', '20090204', 'Saint Paul'),
    ('20090211', '20100707', 'Christian writers of the Middle Ages'),
    ('20100804', '20110413', 'Holy women and the Doctors of the Church'),
]

DATA = r"""
A | 20060222 | On this rock I will build my Church (the Chair of Peter) | 1-18
A | 20060215 | Magnificat: My soul glorifies the Lord | 7-2
A | 20060301 | Ash Wednesday | Ash Wednesday
A | 20060517 | Peter, the fisherman | 6-29
A | 20060524 | Peter, the Apostle | 6-29
A | 20060607 | Peter, the rock | 6-29
A | 20060614 | Andrew, the "Protoclete" | 11-30
A | 20060621 | James, the Greater | 7-25
A | 20060628 | James, the Lesser | 5-11
A | 20060705 | John, son of Zebedee | 12-27
A | 20060809 | John, the theologian | 12-27
A | 20060816 | Solemnity of the Assumption of the Blessed Virgin Mary | 8-15
A | 20060823 | John, "the Seer of Patmos" | 12-27
A | 20060830 | Matthew, the tax collector | 9-21
A | 20060906 | Philip, the Apostle | 5-11
A | 20060927 | Thomas, "the twin" | 12-21
A | 20061004 | Bartholomew | 8-24
A | 20061011 | Simon and Jude | 10-28
A | 20061018 | Judas and Matthias | 2-24
A | 20061025 | Paul the Apostle | 6-30
A | 20061108 | St Paul's new outlook | 6-30
A | 20061115 | St Paul and the Spirit | 6-30
A | 20061122 | St Paul and the Church | 6-30
A | 20061213 | Timothy and Titus | 2-6
A | 20061220 | The meaning of Christmas | Christmas Day
A | 20061227 | The Mystery of Christmas | Christmas Day
A | 20070103 | The joyful event of Christ's birth | Christmas Day
A | 20070110 | Stephen, the Protomartyr | 12-26
A | 20070131 | Barnabas, Silas (also called Silvanus), and Apollos | 6-11
A | 20070207 | Priscilla and Aquila | -
A | 20070214 | Women at the service of the Gospel | -
A | 20070221 | Ash Wednesday | Ash Wednesday
A | 20070307 | Saint Clement, Bishop of Rome | -
A | 20070314 | Saint Ignatius of Antioch | 2-1
A | 20070321 | Saint Justin, Philosopher and Martyr | 4-14
A | 20070328 | Saint Irenaeus of Lyons | 7-3
A | 20070404 | The Easter Triduum | Maundy Thursday
A | 20070411 | Octave of Easter | Easter Monday
A | 20070418 | Clement of Alexandria | -
A | 20070425 | Origen of Alexandria (1) | -
A | 20070502 | Origen of Alexandria (2) | -
A | 20070530 | Tertullian | -
A | 20070606 | Saint Cyprian | -
A | 20070613 | Eusebius of Caesarea | -
A | 20070620 | Saint Athanasius of Alexandria | 5-2
A | 20070627 | Saint Cyril of Jerusalem | 3-18
A | 20070704 | Saint Basil (1) | 6-14
A | 20070801 | Saint Basil (2) | 6-14
A | 20070808 | Saint Gregory Nazianzus (1) | -
A | 20070822 | Saint Gregory Nazianzus (2) | -
A | 20070829 | Saint Gregory of Nyssa (1) | -
A | 20070905 | Saint Gregory of Nyssa (2) | -
A | 20070919 | Saint John Chrysostom (1) | -
A | 20070926 | Saint John Chrysostom (2) | -
A | 20071003 | Saint Cyril of Alexandria | -
A | 20071010 | Saint Hilary of Poitiers | -
A | 20071017 | Saint Eusebius of Vercelli | -
A | 20071024 | Saint Ambrose of Milan | -
A | 20071031 | Saint Maximus of Turin | -
A | 20071107 | Saint Jerome (1) | -
A | 20071114 | Saint Jerome (2) | -
A | 20071121 | Aphraates, "the Sage" | -
A | 20071128 | Saint Ephrem | -
A | 20071205 | Saint Chromatius of Aquileia | -
A | 20071212 | Saint Paulinus, Bishop of Nola | 6-22
A | 20071219 | Christ's Birth | Christmas Day
A | 20080102 | Mary, Mother of God | Octave Day of Christmas
A | 20080109 | Saint Augustine of Hippo (1) | -
A | 20080116 | Saint Augustine of Hippo (2) | -
A | 20080130 | Saint Augustine of Hippo (3) | -
A | 20080206 | Lenten Season | Ash Wednesday
A | 20080220 | Saint Augustine of Hippo (4) | -
A | 20080227 | Saint Augustine of Hippo (5) | -
A | 20080305 | Saint Leo the Great | -
A | 20080312 | Boethius and Cassiodorus | -
A | 20080319 | Easter Triduum | Maundy Thursday
A | 20080326 | Octave of Easter | Easter Monday
A | 20080409 | Saint Benedict of Norcia | 3-21
A | 20080507 | Pentecost | Pentecost
A | 20080514 | Pseudo-Dionysius, the Areopagite | -
A | 20080521 | Saint Romanus the Melodist | -
A | 20080528 | Saint Gregory the Great (1) | -
A | 20080604 | Saint Gregory the Great (2) | -
A | 20080611 | Saint Columban | -
A | 20080618 | Saint Isidore of Seville | -
A | 20080625 | St Maximus the Confessor | -
A | 20080702 | Saint Paul (1). Religious and Cultural Environment | 6-30
A | 20080813 | St Edith Stein and St Maximilian Mary Kolbe | -
A | 20080820 | Reflection on several Saints | -
A | 20080827 | Saint Paul (2). Life of Saint Paul before and after Damascus | 1-25
A | 20080903 | Saint Paul (3). St Paul's "Conversion" | 1-25
A | 20080910 | Saint Paul (4). Saint Paul's Concept of Apostolate | 6-30
A | 20080924 | Saint Paul (5). Paul, the Twelve and the pre-Pauline Church | 6-30
A | 20081001 | Saint Paul (6). The "Council" of Jerusalem and the Incident in Antioch | 6-30
A | 20081008 | Saint Paul (7). The Relationship with the Historical Jesus | 6-30
A | 20081015 | Saint Paul (8). Paul's Ecclesiological Dimension | 6-30
A | 20081022 | Saint Paul (9). The Importance of Christology: Pre-existence and Incarnation | 6-30
A | 20081029 | Saint Paul (10). The Importance of Christology: the Theology of the Cross | 6-30
A | 20081105 | Saint Paul (11). The Importance of Christology: the Decisiveness of the Resurrection | 6-30
A | 20081112 | Saint Paul (12). Eschatology: the Expectation of the Parousia | 6-30
A | 20081119 | Saint Paul (13). The Doctrine of Justification: from Works to Faith | 6-30
A | 20081126 | Saint Paul (14). The Doctrine of Justification: Faith and Works | 6-30
A | 20081203 | Saint Paul (15). The Relation between Adam and Christ | 6-30
A | 20081210 | Saint Paul (16). Theology of the Sacraments | 6-30
A | 20081217 | Spiritual meaning of Christmas | Christmas Day
A | 20090107 | Saint Paul (17). The Spiritual Worship | 6-30
A | 20090114 | Saint Paul (18). The Letters to the Colossians and Ephesians | 6-30
A | 20090128 | Saint Paul (19). Theological vision of the Pastoral Letters | 6-30
A | 20090204 | Saint Paul (20). St Paul's martyrdom and heritage | 6-30
A | 20090211 | John Climacus | -
A | 20090218 | Bede, the Venerable | -
A | 20090311 | Saint Boniface, the Apostle of the Germans | 6-5
A | 20090408 | Holy Triduum of Easter | Maundy Thursday
A | 20090415 | Octave of Easter | Easter Monday
A | 20090422 | Ambrose Autpert | -
A | 20090429 | Germanus of Constantinople | -
A | 20090506 | John Damascene | 3-27
A | 20090527 | Saint Theodore the Studite | -
A | 20090603 | Rabanus Maurus | -
A | 20090610 | John Scotus Erigena | -
A | 20090617 | Saints Cyril and Methodius | 7-7
A | 20090805 | St John Mary Vianney, the Holy Curé of Ars | 8-8
A | 20090812 | The Blessed Virgin Mary and the priesthood | -
A | 20090819 | Saint John Eudes and the formation of the diocesan clergy | 8-19
A | 20090902 | Saint Odo of Cluny | -
A | 20090909 | Saint Peter Damian | -
A | 20090916 | Symeon the New Theologian | -
A | 20090923 | Saint Anselm | -
A | 20091007 | Saint John Leonardi | 10-9
A | 20091014 | Peter the Venerable | -
A | 20091021 | Saint Bernard of Clairvaux | -
A | 20091028 | Monastic Theology and Scholastic Theology | -
A | 20091104 | Two Theological Models in Comparison: Bernard and Abelard | -
A | 20091111 | The Cluniac Reform | -
A | 20091125 | Hugh and Richard of Saint-Victor | -
A | 20091202 | William of Saint-Thierry | -
A | 20091209 | Rupert of Deutz | -
A | 20091216 | John of Salisbury | -
A | 20091223 | Christmas | Christmas Day
A | 20091230 | Peter Lombard | -
A | 20100113 | The Mendicant Orders | -
A | 20100127 | Saint Francis of Assisi | 10-4
A | 20100203 | Saint Dominic Guzman | 8-4
A | 20100210 | Saint Anthony of Padua | -
A | 20100217 | Ash Wednesday | Ash Wednesday
A | 20100303 | Saint Bonaventure (1) | -
A | 20100310 | Saint Bonaventure (2) | -
A | 20100317 | Saint Bonaventure (3) | -
A | 20100324 | Saint Albert the Great | -
A | 20100331 | Easter Triduum | Maundy Thursday
A | 20100407 | Octave of Easter | Easter Monday
A | 20100428 | Saint Leonard Murialdo and Saint Joseph Cottolengo | -
A | 20100602 | Saint Thomas Aquinas (1) | -
A | 20100616 | Saint Thomas Aquinas (2) | -
A | 20100623 | Saint Thomas Aquinas (3) | -
A | 20100630 | Saint Joseph Cafasso | -
A | 20100707 | John Duns Scotus | -
A | 20100804 | Saint Tarcisius | -
A | 20100818 | Saint Pius the Tenth | 9-3
A | 20100901 | Saint Hildegard of Bingen (1) | -
A | 20100908 | Saint Hildegard of Bingen (2) | -
A | 20100915 | Saint Clare of Assisi | -
A | 20100929 | Saint Matilda of Hackeborn | -
A | 20101006 | Saint Gertrude the Great | -
A | 20101013 | Blessed Angela of Foligno | -
A | 20101020 | Saint Elizabeth of Hungary | -
A | 20101027 | Saint Bridget of Sweden | -
A | 20101103 | Marguerite d'Oingt | -
A | 20101117 | Saint Juliana of Cornillon | -
A | 20101124 | Saint Catherine of Siena | -
A | 20101201 | Julian of Norwich | -
A | 20101215 | Saint Veronica Giuliani (1) | -
A | 20101222 | Saint Veronica Giuliani (2) | -
A | 20101229 | Saint Catherine of Bologna | -
A | 20110105 | Light in the Christmas Season | Christmas Day
A | 20110112 | Saint Catherine of Genoa | 3-22
A | 20110126 | Saint Joan of Arc | -
A | 20110202 | Saint Teresa of Avila | -
A | 20110209 | Saint Peter Canisius | -
A | 20110216 | Saint John of the Cross | -
A | 20110223 | Saint Robert Bellarmine | 5-13
A | 20110302 | Saint Francis de Sales | -
A | 20110309 | Ash Wednesday | Ash Wednesday
A | 20110323 | Saint Lawrence of Brindisi | -
A | 20110330 | Saint Alphonsus Liguori | 8-2
A | 20110406 | Saint Thérèse of Lisieux | 10-3
A | 20110413 | Holiness | 11-1
A | 20110420 | Easter Triduum | Maundy Thursday
A | 20110427 | Octave of Easter | Easter Monday
A | 20111102 | Commemoration of All the Faithful Departed | 11-2
H | 2005/20050515_priestly-ordination | Solemnity of Pentecost | Pentecost
H | 2005/20050526_corpus-domini | Solemnity of the Sacred Body and Blood of Christ | Corpus Christi
H | 2005/20050629_sts-peter-paul | Solemnity of Sts Peter and Paul | 6-29
H | 2005/20050815_assunzione-maria | Solemnity of the Assumption | 8-15
H | 2005/20051126_vespri-avvento | First Vespers of the First Sunday of Advent | 1st Sunday of Advent
H | 2005/20051208_anniv-vat-council | Immaculate Conception (40th anniversary of the close of the Council) | 12-8
H | 2005/20051224_christmas | Christmas, Midnight Mass | Christmas Day
H | 2006/20060101_world-day-peace | Solemnity of Mary, Mother of God | Octave Day of Christmas
H | 2006/20060106_epifania | Solemnity of the Epiphany | Epiphany
H | 2006/20060108_battesimo | Feast of the Baptism of the Lord | Baptism of Our Lord
H | 2006/20060125_conversion-st-paul | Conversion of St Paul, Vespers | 1-25
H | 2006/20060202_presentation-lord | Feast of the Presentation of the Lord | 2-2
H | 2006/20060301_ash-wednesday | Ash Wednesday | Ash Wednesday
H | 2006/20060409_palm-sunday | Palm Sunday | Palm Sunday
H | 2006/20060413_messa-crismale | Chrism Mass | Maundy Thursday
H | 2006/20060413_coena-domini | Mass of the Lord's Supper | Maundy Thursday
H | 2006/20060415_veglia-pasquale | Easter Vigil | Easter Vigil
H | 2006/20060603_veglia-pentecoste | Vigil of Pentecost | Vigil of Pentecost
H | 2006/20060604_pentecoste | Solemnity of Pentecost | Pentecost
H | 2006/20060615_corpus-christi | Solemnity of the Sacred Body and Blood of Christ | Corpus Christi
H | 2006/20060629_sts-peter-paul | Solemnity of Sts Peter and Paul | 6-29
H | 2006/20060815_assunzione-maria | Solemnity of the Assumption | 8-15
H | 2006/20061101_all-saints | Solemnity of All Saints | 11-1
H | 2006/20061202_i-vespri-avvento | First Vespers of the First Sunday of Advent | 1st Sunday of Advent
H | 2006/20061224_christmas | Christmas, Midnight Mass | Christmas Day
H | 2007/20070101_world-day-peace | Solemnity of Mary, Mother of God | Octave Day of Christmas
H | 2007/20070106_epifania | Solemnity of the Epiphany | Epiphany
H | 2007/20070107_battesimo | Feast of the Baptism of the Lord | Baptism of Our Lord
H | 2007/20070125_conversion-st-paul | Conversion of St Paul, Vespers | 1-25
H | 2007/20070221_ash-wednesday | Ash Wednesday | Ash Wednesday
H | 2007/20070401_palm-sunday | Palm Sunday | Palm Sunday
H | 2007/20070405_messa-crismale | Chrism Mass | Maundy Thursday
H | 2007/20070405_coena-domini | Mass of the Lord's Supper | Maundy Thursday
H | 2007/20070407_veglia-pasquale | Easter Vigil | Easter Vigil
H | 2007/20070607_corpus-christi | Solemnity of the Sacred Body and Blood of Christ | Corpus Christi
H | 2007/20070628_vespri | First Vespers of Sts Peter and Paul | 6-29
H | 2007/20070629_pallio | Solemnity of Sts Peter and Paul | 6-29
H | 2007/20070815_castel-gandolfo | Solemnity of the Assumption | 8-15
H | 2007/20070908_mariazell | Nativity of Our Lady, at Mariazell | 9-8
H | 2007/20071201_vespri-avvento | First Vespers of the First Sunday of Advent | 1st Sunday of Advent
H | 2007/20071202_ospedale-smom | First Sunday of Advent | 1st Sunday of Advent
H | 2007/20071216_martiri-portuensi | Third Sunday of Advent | 3rd Sunday of Advent
H | 2007/20071224_christmas | Christmas, Midnight Mass | Christmas Day
H | 2008/20080101_world-day-peace | Solemnity of Mary, Mother of God | Octave Day of Christmas
H | 2008/20080106_epifania | Solemnity of the Epiphany | Epiphany
H | 2008/20080113_battesimo | Feast of the Baptism of the Lord | Baptism of Our Lord
H | 2008/20080206_ash-wednesday | Ash Wednesday | Ash Wednesday
H | 2008/20080316_palm-sunday | Palm Sunday | Palm Sunday
H | 2008/20080320_coena-domini | Mass of the Lord's Supper | Maundy Thursday
H | 2008/20080322_veglia-pasquale | Easter Vigil | Easter Vigil
H | 2008/20080511_pentecoste | Solemnity of Pentecost | Pentecost
H | 2008/20080522_corpus-domini | Solemnity of the Sacred Body and Blood of Christ | Corpus Christi
H | 2008/20080628_vespri | First Vespers of Sts Peter and Paul (opening of the Pauline Year) | 6-29
H | 2008/20080629_pallio | Solemnity of Sts Peter and Paul | 6-29
H | 2008/20080815_assunzione | Solemnity of the Assumption | 8-15
H | 2008/20081129_vespri-avvento | First Vespers of the First Sunday of Advent | 1st Sunday of Advent
H | 2008/20081224_christmas | Christmas, Midnight Mass | Christmas Day
H | 2009/20090101_world-day-peace | Solemnity of Mary, Mother of God | Octave Day of Christmas
H | 2009/20090106_epifania | Solemnity of the Epiphany | Epiphany
H | 2009/20090111_battesimo | Feast of the Baptism of the Lord | Baptism of Our Lord
H | 2009/20090125_week-prayer | Conversion of St Paul, Vespers | 1-25
H | 2009/20090202_vita-consacrata | Feast of the Presentation of the Lord | 2-2
H | 2009/20090225_ash-wednesday | Ash Wednesday | Ash Wednesday
H | 2009/20090405_palm-sunday | Palm Sunday | Palm Sunday
H | 2009/20090409_coena-domini | Mass of the Lord's Supper | Maundy Thursday
H | 2009/20090411_veglia-pasquale | Easter Vigil | Easter Vigil
H | 2009/20090412_pasqua | Easter Sunday | Easter Sunday
H | 2009/20090531_pentecoste | Solemnity of Pentecost | Pentecost
H | 2009/20090611_corpus-domini | Solemnity of the Sacred Body and Blood of Christ | Corpus Christi
H | 2009/20090619_anno-sac | Solemnity of the Most Sacred Heart of Jesus (opening of the Year for Priests) | Sacred Heart of Jesus
H | 2009/20090628_chius-anno-paolino | First Vespers of Sts Peter and Paul (closing of the Pauline Year) | 6-29
H | 2009/20090629_pallio | Solemnity of Sts Peter and Paul | 6-29
H | 2009/20090815_assunzione | Solemnity of the Assumption | 8-15
H | 2009/20091128_vespri-avvento | First Vespers of the First Sunday of Advent | 1st Sunday of Advent
H | 2009/20091224_christmas | Christmas, Midnight Mass | Christmas Day
H | 2010/20100101_world-day-peace | Solemnity of Mary, Mother of God | Octave Day of Christmas
H | 2010/20100106_epifania | Solemnity of the Epiphany | Epiphany
H | 2010/20100110_battesimo | Feast of the Baptism of the Lord | Baptism of Our Lord
H | 2010/20100125_week-prayer | Conversion of St Paul, Vespers | 1-25
H | 2010/20100202_vita-consacrata | Presentation of the Lord, Vespers | 2-2
H | 2010/20100211_giornata-malato | Our Lady of Lourdes | 2-11
H | 2010/20100217_ceneri | Ash Wednesday | Ash Wednesday
H | 2010/20100328_palm-sunday | Palm Sunday | Palm Sunday
H | 2010/20100401_coena-domini | Mass of the Lord's Supper | Maundy Thursday
H | 2010/20100403_veglia-pasquale | Easter Vigil | Easter Vigil
H | 2010/20100523_pentecoste | Solemnity of Pentecost | Pentecost
H | 2010/20100603_corpus-domini | Solemnity of the Sacred Body and Blood of Christ | Corpus Christi
H | 2010/20100628_vespri-pietro-paolo | First Vespers of Sts Peter and Paul | 6-29
H | 2010/20100629_pallio | Solemnity of Sts Peter and Paul | 6-29
H | 2010/20100815_assunzione | Solemnity of the Assumption | 8-15
H | 2010/20101127_vespri-avvento | First Vespers of the First Sunday of Advent | 1st Sunday of Advent
H | 2010/20101224_christmas | Christmas, Midnight Mass | Christmas Day
H | 2011/20110101_world-day-peace | Solemnity of Mary, Mother of God | Octave Day of Christmas
H | 2011/20110106_epifania | Solemnity of the Epiphany | Epiphany
H | 2011/20110109_battesimo | Feast of the Baptism of the Lord | Baptism of Our Lord
H | 2011/20110125_week-prayer | Conversion of St Paul, Vespers | 1-25
H | 2011/20110202_vita-consacrata | Feast of the Presentation of the Lord | 2-2
H | 2011/20110309_ceneri | Ash Wednesday | Ash Wednesday
H | 2011/20110417_palm-sunday | Palm Sunday | Palm Sunday
H | 2011/20110421_coena-domini | Mass of the Lord's Supper | Maundy Thursday
H | 2011/20110423_veglia-pasquale | Easter Vigil | Easter Vigil
H | 2011/20110612_pentecoste | Solemnity of Pentecost | Pentecost
H | 2011/20110623_corpus-domini | Solemnity of the Sacred Body and Blood of Christ | Corpus Christi
H | 2011/20110629_pallio | Solemnity of Sts Peter and Paul | 6-29
H | 2011/20110815_assunzione | Solemnity of the Assumption | 8-15
H | 2011/20111224_christmas | Christmas, Midnight Mass | Christmas Day
H | 2012/20120101_world-day-peace | Solemnity of Mary, Mother of God | Octave Day of Christmas
H | 2012/20120106_epifania | Solemnity of the Epiphany | Epiphany
H | 2012/20120108_battesimo | Feast of the Baptism of the Lord | Baptism of Our Lord
H | 2012/20120125_week-prayer | Conversion of St Paul, Vespers | 1-25
H | 2012/20120202_vita-consacrata | Presentation of the Lord, Vespers | 2-2
H | 2012/20120222_ceneri | Ash Wednesday | Ash Wednesday
H | 2012/20120401_palm-sunday | Palm Sunday | Palm Sunday
H | 2012/20120405_coena-domini | Mass of the Lord's Supper | Maundy Thursday
H | 2012/20120407_veglia-pasquale | Easter Vigil | Easter Vigil
H | 2012/20120527_pentecoste | Solemnity of Pentecost | Pentecost
H | 2012/20120607_corpus-domini | Solemnity of the Sacred Body and Blood of Christ | Corpus Christi
H | 2012/20120629_pallio | Solemnity of Sts Peter and Paul | 6-29
H | 2012/20120815_assunzione | Solemnity of the Assumption | 8-15
H | 2012/20121224_christmas | Christmas, Midnight Mass | Christmas Day
H | 2013/20130101_world-day-peace | Solemnity of Mary, Mother of God | Octave Day of Christmas
H | 2013/20130106_epifania | Solemnity of the Epiphany | Epiphany
H | 2013/20130113_battesimo | Feast of the Baptism of the Lord | Baptism of Our Lord
H | 2013/20130125_vespri | Conversion of St Paul, Vespers | 1-25
H | 2013/20130202_vita-consacrata | Feast of the Presentation of the Lord | 2-2
H | 2013/20130213_ceneri | Ash Wednesday (his last public Mass) | Ash Wednesday
"""

BASE = 'https://www.vatican.va/content/benedict-xvi/en/'
lit = json.load(open(sys.argv[1], encoding='utf-8'))
out = Path(sys.argv[2])
by_date = {}
by_title = {}
for d in lit['days']:
    if d['cycle'] == 'sanctoral' and d.get('sort'): by_date.setdefault('%d-%d' % tuple(d['sort'][:2]), []).append(d)
    else: by_title.setdefault(d['title'], d)

items, days, missing = [], {}, []
for line in DATA.strip().splitlines():
    kind, key, title, where = [x.strip() for x in line.split('|')]
    if kind == 'A':
        date = key
        url = f'{BASE}audiences/{date[:4]}/documents/hf_ben-xvi_aud_{date}.html'
        series = next((name for a, b, name in SERIES if a <= date <= b), None)
        if re.search(r'Christmas|Christ.s Birth|Easter|Triduum|Octave|Ash Wednesday|Lent|Pentecost|Assumption|Mother of God|Magnificat|Holiness|Faithful Departed', title): series = None
    else:
        year, slug = key.split('/')
        date = slug[:8]
        url = f'{BASE}homilies/{year}/documents/hf_ben-xvi_hom_{slug}.html'
        series = None
    item = {'k': 'audience' if kind == 'A' else 'homily', 'd': f'{date[:4]}-{date[4:6]}-{date[6:]}', 't': title, 'u': url}
    if series: item['s'] = series
    if where != '-':
        if re.fullmatch(r'\d+-\d+', where):
            cands = by_date.get(where, [])
            # Where two days share a date, the first feast of the day (not a vigil) is meant.
            words = {w for w in re.findall(r'[a-z]{4,}', title.lower())} - {'saint', 'saints', 'blessed', 'virgin', 'mary', 'solemnity', 'feast'}
            cands = [c for c in cands if not c['title'].startswith('Vigil')]
            day = max(cands, key=lambda c: len(words & set(re.findall(r'[a-z]{4,}', c['title'].lower()))), default=None)
        else:
            day = by_title.get(where)
        if day: days.setdefault(day['id'], []).append(len(items)); item['day'] = day['title']
        else: missing.append((title, where))
    items.append(item)

json.dump({'source': 'Titles and links only. The texts are © Libreria Editrice Vaticana and are read on vatican.va.',
           'items': items, 'days': days}, open(out / 'benedict-links.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(items), 'links;', sum(len(v) for v in days.values()), 'filed under', len(days), 'days;', len(items) - sum(len(v) for v in days.values()), 'only in the full list')
for m in missing: print('  no day found:', m)

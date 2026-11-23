#!/bin/sh
# Rebuild the 1962 liturgy data from the sources, in order.
set -e
cd "$(dirname "$0")"
DO=${DO:-/root/work/do/repo/web/www}
WDB=${WDB:-/root/work/src2/Writings-Database}
python3 build_homilies.py "$DO/horas" homilies.json
python3 build_liturgy.py harmony-1962.txt homilies.json liturgy.json
python3 build_days.py liturgy.json liturgy-1962.json
python3 build_missal.py "$DO/missa" liturgy-1962.json   # also writes liturgy-propers.json
python3 vulgate_nav.py liturgy-1962.json
rm -rf sermons && python3 build_sermons.py "$WDB" liturgy-1962.json sermons
python3 build_catena.py "${CATENA:-/root/work/dl/catena/repo/data/catena}" catena
python3 build_benedict.py liturgy-1962.json .

#!/usr/bin/env bash
# Uso: ./add_episode.sh <id> <carpeta_origen> "<título>" "<autor>" [url_original]
# Ej.: ./add_episode.sh hussain-vender /workspace/podcasts/hussainibarra "Cómo volverte..." "Hussain Ibarra" https://x.com/...
# Copia <carpeta>/articulo-es.mp3 y articulo-es.md a ep/<id>.*, añade la entrada a episodes.json (arriba del todo) y regenera index.html.
set -euo pipefail
cd "$(dirname "$0")"
ID="$1"; SRC="$2"; TITLE="$3"; AUTHOR="$4"; URL="${5:-#}"
cp "$SRC/articulo-es.mp3" "ep/$ID.mp3"
cp "$SRC/articulo-es.md"  "ep/$ID.md"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "ep/$ID.mp3" | python3 -c 'import sys;s=int(float(sys.stdin.read()));print(f"{s//60}:{s%60:02d}")')
python3 - "$ID" "$TITLE" "$AUTHOR" "$URL" "$DUR" <<'PY'
import json,sys,datetime
i,t,a,u,d=sys.argv[1:]
eps=[e for e in json.load(open('episodes.json')) if e['id']!=i]
eps.insert(0,{"id":i,"title":t,"author":a,"date":datetime.date.today().isoformat(),"duration":d,"source":u})
json.dump(eps,open('episodes.json','w'),ensure_ascii=False,indent=1)
PY
python3 build_site.py
echo "Añadido $ID ($DUR). Si la web está publicada, vuelve a subir index.html y ep/$ID.mp3."

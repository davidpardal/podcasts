#!/bin/sh
# Copia un episodio a ep/ y regenera index.html.
# Uso: ./add_episode.sh <id> <audio.mp3> <texto.md> <titulo> <autor> [fileRate]
set -eu
if [ "$#" -lt 5 ]; then
  echo "Uso: $0 <id> <audio.mp3> <texto.md> <titulo> <autor> [fileRate]" >&2
  exit 1
fi
id=$1
audio=$2
text=$3
title=$4
author=$5
rate=${6:-1}
mkdir -p ep
cp "$audio" "ep/${id}.mp3"
cp "$text" "ep/${id}.md"
python3 - "$id" "$title" "$author" "$rate" << 'PY'
import json
import sys
from pathlib import Path

episode_id, title, author, rate = sys.argv[1:5]
item = {
    "id": episode_id,
    "title": title,
    "author": author,
    "audio": f"ep/{episode_id}.mp3",
    "transcript": f"ep/{episode_id}.md",
    "fileRate": float(rate),
}
path = Path("episodes.json")
data = json.loads(path.read_text(encoding="utf-8"))
episodes = data["episodes"]
for index, episode in enumerate(episodes):
    if episode["id"] == episode_id:
        episodes[index] = item
        break
else:
    episodes.insert(0, item)
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
PY
python3 build_site.py
echo "Episodio ${id} listo"

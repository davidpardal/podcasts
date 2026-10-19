# Web de podcasts (David)
- `index.html`: página única (móvil). Generada por `build_site.py` desde `episodes.json` + `ep/<id>.mp3|.md`.
- Nuevo episodio: `./add_episode.sh <id> <carpeta con articulo-es.mp3/.md> "<título>" "<autor>" [url]`.
- Servir localmente (con soporte Range para iPhone): `nohup python3 serve.py > server.log 2>&1 &` → http://127.0.0.1:8765
- Publicación pública: PENDIENTE. Cloudflare quick tunnel (puerto 7844) y tunnelmole (8083) bloqueados por la red del box; sin ssh.
- Velocidad y posición se guardan por episodio en localStorage (claves rate:<id>, pos:<id>).

# Reproductor de podcasts

Sitio estático. La página pública es https://davidpardal.github.io/podcasts/

## Archivos

- `index.html` — reproductor. Lo genera `build_site.py`; no lo edites a mano.
- `episodes.json` — lista de episodios.
- `ep/<id>.mp3` — audio.
- `ep/<id>.md` — texto.
- `.nojekyll` — GitHub Pages sirve la carpeta tal cual, sin Jekyll.

## Episodios

- `hussain-vender`: audio a velocidad normal (`fileRate` 1).
- `dankoe-human30`: el mp3 está codificado a 1,5× (`fileRate` 1.5). El botón 1× del reproductor lo ralentiza para que suene a velocidad de habla normal.

## Añadir un episodio

```sh
./add_episode.sh <id> <audio.mp3> <texto.md> "Título" "Autor" [fileRate]
```

`fileRate` es 1 si el mp3 va a velocidad normal. El script copia los archivos a `ep/`, actualiza `episodes.json` y regenera `index.html`.

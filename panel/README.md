# Panel de casa (estilo Wes Bos)

Réplica en español del panel familiar de **[wesbos/photo-frame-dashboard](https://github.com/wesbos/photo-frame-dashboard)**
(carpeta `dashboard/`, commit `f1e0820`, 19/10/2026), pensada para una pantalla táctil de **1280×800**
(el marco de fotos del vídeo, o una tablet en modo quiosco). Mismo aspecto, mismas pantallas y mismos gestos;
cambian el idioma, los formatos (24 h, día/mes, coma decimal, €) y de dónde salen los datos.

Licencia: el original es **MIT, © 2026 Wes Bos** (ver `LICENSE-wesbos.txt`); este derivado mantiene ese aviso.
`vendor/ical.min.js` es ical.js (MPL-2.0). Fotos de demo: picsum.photos. Tipografías: Google Fonts (Archivo, Instrument Serif).

## Pantallas (como el original)

| Original | Aquí | Datos |
|---|---|---|
| Today: reloj gigante, tiempo + 6 horas, presencia, «Next up» con cuenta atrás y «Leave in», carriles por persona, foto, anillos de tareas, compra, estado de casa | **Hoy**, idéntico | Tiempo **real** (Open-Meteo, Vitoria-Gasteiz). Agenda real si pones iCal; si no, demo. Presencia: con tus personas, los peques según la **custodia** y los adultos según su agenda/jornada; sin personas, demo |
| Calendar: hoy por persona, 3 días, semana, mes, hoja de cita, añadir cita, deslizar para cambiar de día | **Agenda**, idéntica | iCal (Google, etc.) + jornada y cambios de custodia de Ajustes + citas añadidas en el panel (se quedan en el aparato) |
| Chores: rutinas mañana/tarde/noche, columna por persona + «Anyone», estrellas, semana, «¿quién la hizo?» | **Tareas**, idéntica | Demo hasta pulsar «Empezar con mis tareas»; luego se guardan en el aparato y se reinician cada día |
| Shopping: lista por secciones, 2 tiendas, habituales, autocompletar, cantidades, deshacer | **Compra**, idéntica (catálogo en español) | Demo hasta «Empezar mi lista»; luego se guarda en el aparato |
| Photos: pase con Ken Burns, diseños Auto/Cover/Pair/Collage/Polaroid, favoritas, «On this day» | **Fotos**, idéntica | Demo (picsum) o tus URLs de fotos en Ajustes |
| Home: luces con deslizar, persianas, cerraduras (mantener para abrir), garaje (deslizar para confirmar), escenas, termostato, cámaras, música | **Casa**, idéntica | **Solo demo**: el original también es simulado; para datos reales haría falta Home Assistant (campos guardados en Ajustes, conexión no implementada) |
| Agents: uso de Claude/Codex/Cursor/Gemini/Copilot con ritmo y gráfico semanal | **Agentes**, idéntica | Demo, o un JSON propio (URL en Ajustes, mismo formato que la demo) |
| Ambient (reposo a los 2 min), Night (reloj rojo 22–6 h), desplazamiento anti-quemado, alertas (timbre, fuga, garaje, paquete), cajón de demo, `?diag` | Igual | Alertas = demo (marcadas) |
| Android `kiosk/` (WebView a pantalla completa) | No incluido | En una tablet usa Fully Kiosk Browser; en el marco rooteado, el kiosk del repo original |

Todo lo que es de ejemplo lleva la etiqueta **DEMO**. Nada inventado se presenta como real.

## Uso

- Abre `index.html` desde un servidor (funciona bajo subruta, p. ej. `…/podcasts/panel/`; todas las rutas son relativas).
- **Mantén pulsado el reloj** de la barra lateral → **Ajustes** (o tecla `D`). Atajos: `1–7` pantallas, `A` ambiente, `N` noche.
- **Importar**: Ajustes → Importar archivo. Acepta el JSON del marco familiar (`tipo: marco-familiar-ajustes`: padre/madre,
  peques, custodia, jornada) y el propio (`tipo: panel-ajustes`). Todo se guarda **solo en este aparato** (localStorage).
- **Calendarios de Google**: dirección secreta iCal. Google no manda cabeceras CORS, así que hace falta un proxy:
  `proxy/cloudflare-worker.js` (no desplegado; necesita una cuenta de Cloudflare) o `python3 serve.py` en un ordenador de casa
  (proxy en `/proxy?url=`). Sin proxy, la agenda sigue en demo.

## Pruebas

```sh
mkdir -p /tmp/site/podcasts && ln -sfn "$PWD" /tmp/site/podcasts/panel
(cd /tmp/site && python3 -m http.server 8802) &
python3 tests/test_panel.py
```

Las capturas de `capturas/` usan solo datos de ejemplo. `capturas/original/` son del original, para comparar.

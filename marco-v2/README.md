# Marco familiar · versión experimental (v2)

Esta carpeta es **otra versión**, no sustituye al marco que ya está publicado.

- El de casa sigue en [https://davidpardal.github.io/podcasts/marco/](https://davidpardal.github.io/podcasts/marco/) (`marco/`).
- Esta prueba vive en [https://davidpardal.github.io/podcasts/marco-v2/](https://davidpardal.github.io/podcasts/marco-v2/) (`marco-v2/`).

Trae las mejoras inspiradas en Home HQ y en Antonio Leiva: tareas por franja y por niño (en pausa la semana sin niños), menú semanal, tiempo por horas con consejo según las citas, calendarios de fondo, citas hechas, un Ahora más completo y copia sin conexión. La sincronización con Google es **opcional**: un Apps Script tuyo (en `apps-script/`), sin servidor que mantener. Si no lo configuras, todo sigue igual en el dispositivo.

Los datos van en `marco-v2.*` dentro de localStorage, así que no se mezclan con los del marco actual aunque se abran en el mismo navegador. Rutas, manifest y el service worker se quedan en esta carpeta (`/podcasts/marco-v2/`).

Panel de pared para casa, inspirado en
[leontdi/marco-familiar-dashboard](https://github.com/leontdi/marco-familiar-dashboard), pero hecho como
**web estática** (HTML + CSS + JS, sin compilar ni instalar nada). Funciona a pantalla completa en el navegador de
cualquier tablet o marco Android, o en una app de quiosco (Fully Kiosk Browser…). Probado en horizontal a 1280×800
y 1920×1200, y también en móvil.

> Todas las citas y nombres de las capturas son **inventados** (modo demostración, «Peque A/B»). En el código no hay datos
> personales, direcciones iCal, tokens ni contraseñas: todo eso se pone en Ajustes y se queda en el dispositivo.

## Pantallas

| Pantalla | Qué tiene |
|---|---|
| **Hoy** | Bloque «cielo» que cambia de color con el sol (amanecer, día, atardecer, noche) con la hora, la fecha, el tiempo de varios días y las **próximas horas** (Open-Meteo), con un aviso si llueve o hace frío a la hora de una cita. **Ahora**: lo siguiente con cuenta atrás, la comida y la cena de hoy, y mañana de un vistazo. La semana con las citas (las de fondo, tenues), la **jornada** y, si activas la custodia, los días con los niños sombreados y **con quién están**. Abajo, resúmenes de niños, compra y luz. |
| **Calendario** | 13 semanas de lunes a domingo, con el mes, el día 1 resaltado, el tiempo de los próximos 16 días, la jornada, las citas y las **semanas de custodia sombreadas**. Los calendarios **de fondo** se ven tenues y no tapan el resto. «+N más» abre el día entero. Tocar una cita permite **marcarla hecha** (tachada; se guarda en el dispositivo). |
| **Luz** | Periodo **2.0TD** actual (punta/llano/valle; fines de semana y festivos nacionales, todo valle), franjas de hoy y mañana, **mejores horas** para lavadora y lavavajillas. Precios de tu tarifa solo si los metes tú en Ajustes (no se inventan). Gráfico **PVPC de REE marcado como referencia, «NO es tu tarifa»**. |
| **Niños** | Tareas por **franja** (mañana, después del cole, noche) y por niño. Si se pasa la hora, quedan **fuera de hora**. Una **racha** semanal (L–D). En la semana sin niños (custodia) se **pausan solas**. Estrellas, recompensas y canje que **aprueba un adulto con PIN** (bloqueo 5 min tras 5 fallos). |
| **Compra** | Lista con «comprado», «Quitar comprados», «Compartir lista», **«Haz la cesta»** (copia la lista pendiente y abre un correo para Grok Bot) y **habituales** (los que más añades y aún no están en la lista). Con la sincronización, la lista se comparte entre el marco y el móvil. |
| **Menú** | Plan de la semana **L–D o L–V**: comida y cena. Se elige entre platos habituales (tocar la casilla y el plato, o arrastrar). Hoy lo enseña en Ahora. |
| **Ajustes** | **Sincronización con Google** (URL y clave, solo en este dispositivo), calendarios iCal de respaldo (cada uno puede ser **de fondo**), proxy CORS, modo demo, **familia** (nombres, custodia, jornada por día, ciudad), precios de la tarifa, tareas y recompensas, PIN, **correo de «Haz la cesta»** (vacío hasta que lo pongas), reloj nocturno, **importar/exportar ajustes (JSON)** y avanzado. |

Tocar cualquier cita abre su detalle (calendario, título entero, fecha y hora, lugar y descripción) y el botón **Marcar hecha**.
Reloj nocturno de 23:00 a 07:00 (o con el botón «Dormir»), con **lo primero de mañana**; vuelve solo a «Hoy» tras 3 min sin tocar;
calendarios cada 15 min, tiempo cada 30 min, PVPC cada hora y recarga completa a las 04:00.
Si no hay red, un aviso **«Sin conexión · datos de las H:MM»** y la última copia guardada en el dispositivo (service worker para la página; citas, tiempo y luz en localStorage).

Sin sincronización, todo se guarda **solo en el dispositivo** (localStorage, clave `marco-v2.`). Si pegas la URL y la clave en Ajustes, el marco habla con **tu** Apps Script: los calendarios los lee él (con tu cuenta) y la compra, el menú, las estrellas y las citas hechas se guardan en las propiedades de ese script. La URL y la clave no van en el repositorio.

## Cómo probarlo en local

```bash
cd marco-v2
python3 serve.py              # abre http://127.0.0.1:8080
python3 serve.py --host 0.0.0.0 --port 8080   # para abrirlo desde la tablet en la misma wifi
```

Para simular una fecha: `http://127.0.0.1:8080/?fecha=2026-10-24T10:00`. Para ir directo a una pantalla: `#calendario`, `#luz`, `#ninos`, `#compra`, `#menu`.

Pruebas automáticas (Chromium headless, Playwright):

```bash
python3 serve.py --port 8765 &
pip install playwright && python3 -m playwright install chromium
python3 tests/test_marco.py   # comprobaciones y capturas (con datos de ejemplo) en capturas/
# MARCO_AJUSTES=/ruta/privada.json para comprobar además tus ajustes reales (no hace capturas con ellos)
```

## Sincronización con Google (opcional)

Sirve para dos cosas, sin montar un servidor:

1. **Calendarios.** El script lee los calendarios de tu cuenta (`CalendarApp`) y devuelve las citas de unas 13 semanas (desde unos días antes de esta semana). El marco ya no necesita la dirección secreta iCal ni el proxy. Si la conexión falla y habías pegado un iCal, se usa ese de respaldo. Si no hay ni script ni iCal, sigue el modo demo.
2. **Datos compartidos** entre el marco y el móvil: lista de la compra, menú semanal, estrellas, tareas hechas, canjes y citas marcadas como hechas. Si los dos editan a la vez, no se pisan entero: cada cosa lleva una revisión y se queda la más nueva; un borrado es una marca para que no vuelva a aparecer. Si no hay red, se sigue con lo guardado en el dispositivo, sale el aviso de sin conexión o «Sin sincronizar» y se reintenta con el refresco de los calendarios (15 min). Tras un cambio local, se empuja al cabo de un par de segundos.

No se sincronizan los nombres de la familia, el PIN, los precios ni las direcciones. Las tareas (el catálogo) se definen en cada dispositivo, o las copias con Importar/Exportar; lo que viaja es quién las ha hecho y las estrellas. **«Haz la cesta» sigue igual:** copia los pendientes y abre el correo de Ajustes. El marco no entra en la tienda.

Los calendarios **de fondo** se pueden fijar de dos maneras (vale cualquiera):

- en el script, con el nombre tal como sale en Google Calendar, en la lista `BACKGROUND_CALENDARS` de `Code.gs` (afecta a todos los dispositivos);
- en Ajustes, casilla «De fondo» de cada calendario de Google (solo ese dispositivo; pisa la lista del script).

En Google Calendar, un calendario desmarcado (no visible en tu lista) no se envía.

### Cómo montarlo

1. Entra en [script.google.com](https://script.google.com) con la cuenta de Google cuyos calendarios quieres leer. **Nuevo proyecto**.
2. Borra el `Código.gs` de ejemplo y pega el contenido de `marco-v2/apps-script/Code.gs`. En el engranaje → **Editor de manifiesto** (`appsscript.json`), pega `marco-v2/apps-script/appsscript.json` (o deja el que cree el editor y no te preocupes: lo importante es la zona `Europe/Madrid`).
3. Si quieres turnos o trabajo siempre de fondo, escribe sus nombres en `BACKGROUND_CALENDARS`.
4. Engranaje → **Propiedades del script** → añade `MARCO_KEY` con una clave larga (16 caracteres o más; letras y números). No la pegues dentro de `Code.gs` ni en el repositorio.
5. En el editor, elige la función `probar` y pulsa ▶. La primera vez Google pide permiso para ver tus calendarios. Acéptalo. En el registro debe salir «Clave configurada» y la lista de calendarios. El script solo lee citas; CalendarApp no ofrece un permiso más estrecho, por eso la pantalla de Google habla del calendario en general.
6. **Implementar → Nueva implementación → Tipo: Aplicación web.**
   - **Ejecutar como:** Yo (`USER_DEPLOYING`). Así lee tus calendarios, no los de quien abre la página.
   - **Quién tiene acceso:** Cualquier persona (`ANYONE_ANONYMOUS`). El marco y el móvil no inician sesión en Google.
   - Implementa y copia la URL que acaba en `/exec`.
7. En el marco (y otra vez en el móvil): **Ajustes → Sincronización con Google**. Pega la URL y la misma clave. **Guardar y probar.** Tiene que decir que está conectado y listar los calendarios. Eso queda solo en `localStorage` (`marco-v2.settings`), en ese aparato.
8. Cada vez que cambies `Code.gs`, haz **Nueva implementación** (o edita la que ya tienes y súbele la versión). La URL `/exec` de «Administrar implementaciones» es la que hay que pegar; la de `/dev` no vale para el marco.

Para probar la clave en el navegador puedes abrir la URL con `?action=ping&key=TU_CLAVE` y ver `{"ok":true,"service":"marco-v2"}`. Hazlo en una ventana privada: la clave se queda en el historial.

### Qué protege la clave (y qué no)

La aplicación web está en «Cualquier persona» porque el marco no tiene sesión de Google. Google **no pregunta quién llama**: cualquiera que tenga la URL puede intentar la petición. La clave es lo único que lo impide. Por eso:

- no va en el código ni en las capturas reales;
- viaja en el cuerpo de la petición (HTTPS), no en la barra del marco;
- quien la copie (otro usuario de la tablet, una captura, el `localStorage` de ese navegador) puede leer tus citas y la lista de la compra mientras la implementación siga activa.

No es un login de Google. Es un candado compartido entre tus aparatos, parecido a la clave del proxy de Cloudflare. Si se te escapa, cambia `MARCO_KEY`, actualiza Ajustes en cada dispositivo y publica una versión nueva del script. «Cualquier persona con una cuenta de Google» parece más cerrado, pero en la tablet suele fallar (pide iniciar sesión y el navegador bloquea la respuesta).

## Calendarios de Google y CORS (importante)

1. En Google Calendar (web): Configuración → el calendario → **Dirección secreta en formato iCal**.
2. En el marco: Ajustes → «Añadir calendario», pega la URL y pulsa «Guardar y probar». Se guarda solo en ese dispositivo.

**Comprobado (21/10/2026):** `calendar.google.com/calendar/ical/...` responde **sin** cabecera
`Access-Control-Allow-Origin`, así que el navegador **bloquea** la lectura directa (en Chromium: `TypeError: Failed to fetch`).
Open-Meteo y REE sí mandan `Access-Control-Allow-Origin: *` y funcionan directamente.

Tienes dos opciones de proxy (cualquiera vale; en Ajustes → «Proxy CORS» va el prefijo):

- **`serve.py`** (este repositorio): si el marco abre la web desde ese servidor (un PC o una Raspberry Pi en casa), pon `/proxy?url=`.
- **Cloudflare Worker** (`proxy/cloudflare-worker.js`, **no desplegado**): solo reenvía a `calendar.google.com`, admite una clave
  `PROXY_KEY` y no guarda nada. Instrucciones dentro del fichero. Prefijo: `https://marco-ics.<tu-subdominio>.workers.dev/?key=<clave>&url=`.

Mientras no haya calendarios ni sincronización, el **modo demo** está activo (citas inventadas con «(demo)» y aviso amarillo «MODO DEMO»). Si activas la sincronización, el demo se apaga solo; puedes volver a marcarlo a mano.
Las citas que se ven en demo prueban también RRULE semanal, EXDATE, RECURRENCE-ID y el cambio de hora.

El análisis del iCal se hace en el navegador con [ical.js](https://github.com/kewisch/ical.js) 2.2.1 (MPL-2.0, en `vendor/`).

## Configuración

`js/config.js` solo trae valores genéricos de ejemplo («Peque A/B», jornada 9:00–17:00, custodia desactivada, Vitoria-Gasteiz
como ciudad del tiempo). Lo de tu familia se pone en **Ajustes → Familia, custodia y jornada**:

- nombres (tú, el otro progenitor, los niños y su color);
- custodia por semanas alternas: fecha y hora de inicio de una semana contigo (de ahí salen el día y la hora del cambio),
  ciclo en días (14) y días contigo (7);
- jornada por día de la semana (vacío = libre), ciudad y coordenadas para el tiempo, nombre de tu tarifa.

O de golpe: **Ajustes → Importar / exportar** acepta un JSON como este (guárdalo fuera del repositorio). Puede llevar además `menu` (el plan semanal) y, en cada calendario, `"background": true`. En cada tarea, `slot` (`manana`, `cole`, `noche`) y `kids` (ids; vacío = todos). Si faltan, se usan los valores de siempre:

```json
{ "tipo": "marco-familiar-ajustes", "version": 1,
  "advanced": { "parent": "Nombre", "otherParent": "Nombre",
    "kids": [{ "id": "a", "name": "Nombre", "color": "#2F80ED" }],
    "custody": { "enabled": true, "anchor": "AAAA-MM-DDTHH:MM", "cycleDays": 14, "daysWithParent": 7 },
    "work": { "enabled": true, "label": "Trabajo", "shifts": { "1": ["09:00", "17:00"], "5": ["09:00", "15:00"] } } },
  "settings": {} }
```

Exportar no incluye las direcciones de los calendarios salvo que marques la casilla. La URL y la clave de la sincronización no se exportan nunca.

## Estructura

```
index.html            esqueleto y navegación
sw.js                 service worker (copia de la página para abrirla sin red)
css/app.css           estilo (escala sola: 16 px a 1280×800, 24 px a 1920×1200; móvil con barra inferior)
js/config.js          valores por defecto genéricos (sin datos personales ni secretos)
js/util.js            fechas en español, almacenamiento local
js/custody.js         custodia por semanas alternas
js/calendar.js        descarga y análisis de iCal + calendario demo
js/sync.js            mezcla y envío al Apps Script (no hace nada si Ajustes está vacío)
js/weather.js         Open-Meteo (día y hora) y consejo según las citas
js/luz.js             periodos 2.0TD y PVPC de REE
js/app.js             pantallas, PIN, compra, menú, ajustes, reloj y refrescos
apps-script/          Code.gs y appsscript.json para pegar en script.google.com (no está desplegado)
vendor/ical.min.js    ical.js 2.2.1 (MPL-2.0)
proxy/cloudflare-worker.js  proxy CORS opcional (no desplegado)
serve.py              servidor local + proxy opcional
tests/test_marco.py   pruebas con Playwright
capturas/             capturas a 1280×800 (y 1920×1200 y móvil), con datos de ejemplo
```

## Avisos y siguientes pasos

- **Qué pantalla comprar:** vale cualquier tablet Android con un navegador moderno y una app de quiosco (Fully Kiosk Browser es la habitual).
  Los «calendarios familiares» cerrados (Skylight, Dragon Touch…) suelen no dejar abrir una web propia. Los marcos que usan
  Wes Bos y leontdi (Allwinner A133, Android 10, root) sirven, pero hacerles root requiere ADB por USB desde un ordenador.
  Comprueba antes de comprar que el navegador sea Chrome/WebView reciente (el CSS usa `color-mix`, Chrome 111+).
- **Alojamiento:** esta versión se publica en GitHub Pages bajo `/podcasts/marco-v2/` (rutas relativas y service worker con alcance solo de esa carpeta). El marco en uso sigue en `/podcasts/marco/`.
  Es **público**: por eso el código no lleva datos personales; tus ajustes viven solo en el dispositivo. Alternativas privadas:
  `serve.py` en un PC o Raspberry Pi de casa, o Cloudflare Pages con Access.
- La lista de la compra, el menú, las estrellas y las citas hechas se comparten **si** configuras el Apps Script de arriba. Si no, siguen siendo de ese dispositivo. «Haz la cesta» copia los pendientes y abre un `mailto:` al correo de Ajustes (`eroskiNotifyEmail`, vacío por defecto) con asunto «Haz la cesta». El marco no entra en la tienda: Grok Bot rellena la cesta fuera de esta página. Eso no depende de la sincronización.
- Los precios de tu tarifa no vienen: cópialos de tu factura en Ajustes si quieres verlos. El PVPC es solo referencia, sin IVA ni impuesto eléctrico
  (el «con impuestos» es una estimación).
- El PIN se guarda en el dispositivo: es un candado para niños, no seguridad fuerte.
- Festivos: para la luz solo cuentan los nacionales de fecha fija; la jornada no conoce tus vacaciones ni los festivos locales o autonómicos.

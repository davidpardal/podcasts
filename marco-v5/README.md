# Marco familiar · v5

Esta carpeta es **otra versión**, en paralelo. No sustituye a `marco/`, `marco-v2/` ni `marco-v4/`, que no se tocan.

- El de casa sigue en [https://davidpardal.github.io/podcasts/marco/](https://davidpardal.github.io/podcasts/marco/) (`marco/`).
- La v4 sigue en [https://davidpardal.github.io/podcasts/marco-v4/](https://davidpardal.github.io/podcasts/marco-v4/) (`marco-v4/`).
- Esta se previsualiza en [https://davidpardal.github.io/podcasts/marco-v5/](https://davidpardal.github.io/podcasts/marco-v5/) (`marco-v5/`).

## Qué cambia en la v5

La v5 no añade funciones: quita lo repetido y ordena. El menú lateral baja de 11 pantallas a 7 (Hoy, Calendario, Niños, Compra, Menú, Salud, Casa) más Ajustes.

**Se quita**

- **Pantalla Semana.** Repetía mochila, tareas, agenda y compra, que ya están en Hoy y Niños. La cuenta atrás de custodia sigue en Hoy.
- **Pantalla Outfit.** Era la tarjeta de Hoy a pantalla completa: ahora se abre tocando la tarjeta.
- **Tipo de entreno por día** (fuerza / running / descanso, en Ajustes). Duplicaba la semana tipo según custodia, que es la que manda.
- **Consejo genérico de ropa** de la v3 y su ajuste «Al aire libre». Lo sustituye el outfit. El aviso de lluvia junto a la cita y los chips de AEMET siguen.
- **Datos de ejemplo de Dinero y Plazos.** Vienen vacíos y lo dicen, con un botón que lleva a su sección de Ajustes.
- **Menú semanal entero en Hoy.** En Hoy solo sale lo de hoy; la semana está en Menú.

**Se junta**

- **Luz + Dinero + Plazos → Casa**, con tres pestañas. La pestaña Plazos lleva un contador de los que vencen en 3 días o menos. Los enlaces antiguos `#luz`, `#dinero` y `#plazos` abren Casa en su pestaña.
- **`AtajoCompra.gs` dentro de `Code.gs`**: un solo fichero que pegar y publicar.

**Se mejora**

- **Hoy, por urgencia.** Bajo el cielo, la franja **Hoy toca**: mochila de hoy y de mañana, entreno de hoy con su semáforo y comida y cena de hoy. Abajo, el outfit y los resúmenes; el de **Casa** enseña el periodo de luz y el plazo más cercano si vence en 14 días o menos.
- **Ajustes plegado y por grupos** (Conexión, Familia y niños, Casa, Este dispositivo): 16 secciones cerradas que se abren al tocarlas. «Desplegar todo» se recuerda en el dispositivo.
- **Código por pantalla.** `js/app.js` (2.540 líneas) pasa a `js/core.js`, `js/main.js` y un fichero por pantalla en `js/screens/`.
- **Ya no se pierde lo tecleado en Ajustes** si una carga de fondo (tiempo, calendarios) termina mientras escribes.

### Si vienes de la v4

- **Datos.** La primera vez que se abre la v5 en un navegador copia lo de la v4 (`marco-v4.*` → `marco-v5.*`: ajustes, tareas, compra, menú, URL y clave de sincronización). No toca la v4 ni copia sus cachés, y solo lo hace una vez.
- **Apps Script.** La v5 funciona con el script de la v4 ya publicado; no hay acciones nuevas. Si actualizas el script, pega el `Code.gs` nuevo y **borra `AtajoCompra.gs`** del proyecto (sus funciones ya van dentro), y publica una versión nueva.
- **Entreno.** El tipo por día que hubiera en Ajustes se ignora. La semana tipo se cambia con `planEntreno: { sin: [...7], con: [...7] }` en Ajustes → Avanzado.

Los datos van en `marco-v5.*` (localStorage). El service worker solo borra cachés `marco-v5-shell-*`.

## Entreno de hoy

En **Salud**, la tarjeta **💪 Entreno de hoy**, y en **Hoy** la casilla Entreno de la franja «Hoy toca»:

- **Semáforo** con la noche de hoy frente a los 7 días anteriores, de la respuesta `salud` del script. Gana el peor de sueño, VFC y pulso en reposo. Verde: la sesión prevista. Ámbar: la misma sesión más suave. Rojo: descanso o paseo. Los umbrales están en `js/plan.js`.
- **Semana tipo** según la custodia de Ajustes: la semana (lunes a domingo) con los niños es la que sigue al cambio. Debajo, la semana de L a D con ✓ en los días con entreno en Garmin.
- Pruebas sin navegador: `node tests/test_plan.js`.

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
| **Hoy** | Bloque «cielo» que cambia de color con el sol (amanecer, día, atardecer, noche) con la hora, la fecha, el tiempo de varios días y las **próximas horas** (Open-Meteo), con un aviso si llueve o hace frío a la hora de una cita. Si hay un **aviso naranja o rojo de AEMET** para Álava / Vitoria, sale un chip en el cielo: al tocarlo lees el texto. **Ahora**: lo siguiente con cuenta atrás y la hora de salir, y mañana de un vistazo. **Hoy toca**: mochila de hoy y de mañana, entreno de hoy con su semáforo y comida y cena de hoy. La semana con las citas (las de fondo, tenues), la **jornada**, una etiqueta **Festivo** si el día lo es, y, si activas la custodia, los días con los niños sombreados y **con quién están**. Abajo, el **outfit de mañana** (al tocarlo se abre con la imagen, las piezas y el porqué) y los resúmenes de niños, compra, casa (luz y el plazo más cercano) y salud. |
| **Calendario** | 13 semanas de lunes a domingo, con el mes, el día 1 resaltado, el tiempo de los próximos 16 días, la jornada, las citas y las **semanas de custodia sombreadas**. Los calendarios **de fondo** se ven tenues y no tapan el resto. «+N más» abre el día entero. Tocar una cita permite **marcarla hecha** (tachada; se guarda en el dispositivo). |
| **Casa** | Tres pestañas. **Luz**: periodo **2.0TD** actual (punta/llano/valle; fines de semana y festivos nacionales, todo valle), franjas de hoy y mañana, mejores horas para lavadora y lavavajillas, tus precios si los metes en Ajustes y el gráfico **PVPC de REE como referencia, «NO es tu tarifa»**. **Dinero**: luz, fibra (con una alternativa opcional) y suscripciones del mes en €, y el **ahorro frente al mes pasado** (o «—» si falta algún importe). **Plazos**: fechas con semáforo, **rojo** a 3 días o menos, **ámbar** a 14, **verde** después y **gris** si ya pasó. Dinero y Plazos vienen vacíos; se rellenan en Ajustes. |
| **Niños** | Tareas por **franja** (mañana, después del cole, noche) y por niño. Si se pasa la hora, quedan **fuera de hora**. Una **racha** semanal (L–D). Arriba, la **mochila** de hoy y de mañana: pegatinas que salen de las citas (chándal, equipación, toalla…). En un festivo o si la cita dice «sin cole», pone **día libre** y no pide mochila. En la semana sin niños (custodia) las tareas y la mochila se **pausan solas**. Estrellas, recompensas y canje que **aprueba un adulto con PIN** (bloqueo 5 min tras 5 fallos). |
| **Compra** | Lista con «comprado», «Quitar comprados», «Compartir lista», **«Haz la cesta»** (copia la lista pendiente y abre un correo para Grok Bot) y **habituales** (los que más añades y aún no están en la lista). Con la sincronización, la lista se comparte entre el marco y el móvil. |
| **Menú** | Plan de la semana **L–D o L–V**: comida y cena. Se elige entre platos habituales (tocar la casilla y el plato, o arrastrar). Hoy lo enseña en Ahora. |
| **Salud** | Tendencias de **7 y 28 días** (pulso en reposo, VFC, pasos, peso, sueño, entreno). Arriba, franja **Hoy**: sueño, batería corporal / energía (si el script ya las trae) y el entreno ya registrado hoy. Debajo, **Entreno de hoy** con el semáforo y la semana tipo. Sin sincronización, datos de ejemplo marcados. |
| **Ajustes** | **Sincronización con Google** (URL y clave, solo en este dispositivo), calendarios iCal de respaldo (cada uno puede ser **de fondo**), proxy CORS, modo demo, **familia** (nombres, custodia, jornada por día, ciudad), precios de la tarifa, **dinero y plazos**, tareas y recompensas, **reglas de la mochila** (puedes restaurar la lista por defecto), PIN, **correo de «Haz la cesta»** (vacío hasta que lo pongas), reloj nocturno, **importar/exportar ajustes (JSON)** y avanzado. |

Tocar cualquier cita abre su detalle (calendario, título entero, fecha y hora, lugar y descripción) y el botón **Marcar hecha**.
Reloj nocturno de 23:00 a 07:00 (o con el botón «Dormir»), con **lo primero de mañana**; vuelve solo a «Hoy» tras 3 min sin tocar;
calendarios cada 15 min, tiempo cada 30 min, PVPC cada hora y recarga completa a las 04:00.
Si no hay red, un aviso **«Sin conexión · datos de las H:MM»** y la última copia guardada en el dispositivo (service worker para la página; citas, tiempo y luz en localStorage).

Sin sincronización, todo se guarda **solo en el dispositivo** (localStorage, clave `marco-v5.`). Si pegas la URL y la clave en Ajustes, el marco habla con **tu** Apps Script: los calendarios los lee él (con tu cuenta) y la compra, el menú, las estrellas y las citas hechas se guardan en las propiedades de ese script. La URL y la clave no van en el repositorio.

## Cómo probarlo en local

```bash
cd marco-v5
python3 serve.py              # abre http://127.0.0.1:8080
python3 serve.py --host 0.0.0.0 --port 8080   # para abrirlo desde la tablet en la misma wifi
```

Para simular una fecha: `http://127.0.0.1:8080/?fecha=2026-10-24T10:00`. Para ir directo a una pantalla: `#calendario`, `#ninos`, `#compra`, `#menu`, `#salud`, `#casa` (o `#luz`, `#dinero`, `#plazos` para abrir Casa en esa pestaña).

Pruebas automáticas (Chromium headless, Playwright):

```bash
python3 serve.py --port 8765 &
pip install playwright && python3 -m playwright install chromium
python3 tests/test_marco.py   # comprobaciones y capturas (con datos de ejemplo) en capturas/
node tests/test_plan.js && node tests/test_casa.js   # lógica sin navegador
# MARCO_SIN_RED=1 si la máquina no tiene salida a internet (simula el iCal tras el proxy)
# MARCO_AJUSTES=/ruta/privada.json para comprobar además tus ajustes reales (no hace capturas con ellos)
```

## Sincronización con Google (opcional)

Sirve para dos cosas, sin montar un servidor:

1. **Calendarios.** El script lee los calendarios de tu cuenta (`CalendarApp`) y devuelve las citas de unas 13 semanas (desde unos días antes de esta semana). El marco ya no necesita la dirección secreta iCal ni el proxy. Si la conexión falla y habías pegado un iCal, se usa ese de respaldo. Si no hay ni script ni iCal, sigue el modo demo.
2. **Datos compartidos** entre el marco y el móvil: lista de la compra, menú semanal, estrellas, tareas hechas, canjes y citas marcadas como hechas. Si los dos editan a la vez, no se pisan entero: cada cosa lleva una revisión y se queda la más nueva; un borrado es una marca para que no vuelva a aparecer. Si no hay red, se sigue con lo guardado en el dispositivo, sale el aviso de sin conexión o «Sin sincronizar» y se reintenta con el refresco de los calendarios (15 min). Tras un cambio local, se empuja al cabo de un par de segundos.

No se sincronizan los nombres de la familia, el PIN, los precios ni las direcciones. Las tareas (el catálogo) se definen en cada dispositivo, o las copias con Importar/Exportar; lo que viaja es quién las ha hecho y las estrellas. **«Haz la cesta» sigue igual:** copia los pendientes y abre el correo de Ajustes. El marco no entra en la tienda.

**Avisos de AEMET.** El mismo script pide los avisos oficiales (OpenData, formato CAP) del País Vasco y se queda con los **naranja y rojo** que afectan a Álava o a Vitoria-Gasteiz. La clave va en `AEMET_API_KEY` (Propiedades del script), nunca en el marco. Si no la pones, o si AEMET falla, no sale chip: el resto del marco sigue igual. Para verlos de verdad hay que publicar una **versión nueva** del Apps Script. En local, `?aviso=muestra` pinta un chip de ejemplo (no es un aviso real).

**Mochila.** En Niños (y en la franja «Hoy toca» y en «lo primero de mañana» del reloj nocturno) se leen los títulos de las citas de hoy y de mañana. Las reglas por defecto están en español: baloncesto → equipación, educación física → chándal, piscina → toalla, excursión → almuerzo, y «sin cole» o un festivo → día libre. Las cambias en Ajustes. Un festivo de fecha fija (nacionales, San Prudencio, Santiago, Virgen Blanca, Viernes Santo y Lunes de Pascua) pone la etiqueta **Festivo** y alimenta esa regla. No hay calendario escolar en el código. La luz no cambia: sigue usando solo los festivos nacionales de fecha fija.

**Salud** (sueño, batería corporal, VFC, pasos, pulso en reposo, peso y los últimos entrenos) sale de la API personal de Garmin, leída por el mismo script. Arriba, la franja **Hoy** resume el sueño y la batería (mínimo, máximo y, si el resumen diario ya lo trae, la energía de ahora) y el tipo de entreno que eliges en Ajustes. Debajo siguen las tendencias de **7 y 28 días** (valor de ahora, media del periodo y cambio respecto al periodo anterior). Un día sin medida es un corte, no un cero. El marco la pide al arrancar y cada 30 minutos, y guarda la última copia en el dispositivo para abrirla sin red. Si no configuras la sincronización, la pantalla enseña **datos de ejemplo** de 28 días, bien marcados. La clave de Garmin no baja al marco: va en `GARMIN_PERSONAL_API_KEY`, como explica `apps-script/README.md`. Para ver los 28 días y el peso de verdad hay que publicar una **versión nueva** del Apps Script (la URL no cambia).

Los calendarios **de fondo** se pueden fijar de dos maneras (vale cualquiera):

- en el script, con el nombre tal como sale en Google Calendar, en la lista `BACKGROUND_CALENDARS` de `Code.gs` (afecta a todos los dispositivos);
- en Ajustes, casilla «De fondo» de cada calendario de Google (solo ese dispositivo; pisa la lista del script).

En Google Calendar, un calendario desmarcado (no visible en tu lista) no se envía.

### Cómo montarlo

1. Entra en [script.google.com](https://script.google.com) con la cuenta de Google cuyos calendarios quieres leer. **Nuevo proyecto**.
2. Borra el `Código.gs` de ejemplo y pega el contenido de `marco-v5/apps-script/Code.gs`. En el engranaje → **Editor de manifiesto** (`appsscript.json`), pega `marco-v5/apps-script/appsscript.json` (o deja el que cree el editor y no te preocupes: lo importante es la zona `Europe/Madrid`).
3. Si quieres turnos o trabajo siempre de fondo, escribe sus nombres en `BACKGROUND_CALENDARS`.
4. Engranaje → **Propiedades del script** → añade `MARCO_KEY` con una clave larga (16 caracteres o más; letras y números). No la pegues dentro de `Code.gs` ni en el repositorio. Para la sección **Salud**, en la misma pantalla añade `GARMIN_PERSONAL_API_KEY` (la clave de la API personal de Garmin, tampoco en el código). Sin esa propiedad el resto del marco sigue igual y Salud dice «Sin datos de Garmin». Para los **avisos de AEMET**, añade `AEMET_API_KEY` (la clave de [opendata.aemet.es](https://opendata.aemet.es/centrodedescargas/inicio); tampoco en el código). Sin ella no hay chip de aviso. Opcional: `AEMET_AREA` (por defecto `eus`, País Vasco). El detalle está en `apps-script/README.md`.
5. En el editor, elige la función `probar` y pulsa ▶. La primera vez Google pide permiso para ver tus calendarios. Acéptalo. En el registro debe salir «Clave configurada» y la lista de calendarios. El script solo lee citas; CalendarApp no ofrece un permiso más estrecho, por eso la pantalla de Google habla del calendario en general.
6. **Implementar → Nueva implementación → Tipo: Aplicación web.**
   - **Ejecutar como:** Yo (`USER_DEPLOYING`). Así lee tus calendarios, no los de quien abre la página.
   - **Quién tiene acceso:** Cualquier persona (`ANYONE_ANONYMOUS`). El marco y el móvil no inician sesión en Google.
   - Implementa y copia la URL que acaba en `/exec`.
7. En el marco (y otra vez en el móvil): **Ajustes → Sincronización con Google**. Pega la URL y la misma clave. **Guardar y probar.** Tiene que decir que está conectado y listar los calendarios. Eso queda solo en `localStorage` (`marco-v5.settings`), en ese aparato.
8. Cada vez que cambies `Code.gs`, haz **Nueva implementación** (o edita la que ya tienes y súbele la versión). La URL `/exec` de «Administrar implementaciones» es la que hay que pegar; la de `/dev` no vale para el marco.

Para probar la clave en el navegador puedes abrir la URL con `?action=ping&key=TU_CLAVE` y ver `{"ok":true,"service":"marco-v5"}`. Hazlo en una ventana privada: la clave se queda en el historial.

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
css/app.css           estilo (escala sola: 16 px a 1280×800, 24 px a 1920×1200; menú a la izquierda)
js/config.js          valores por defecto genéricos (sin datos personales ni secretos)
js/util.js            fechas en español, almacenamiento local
js/custody.js         custodia por semanas alternas
js/calendar.js        descarga y análisis de iCal + calendario demo
js/sync.js            mezcla y envío al Apps Script (no hace nada si Ajustes está vacío)
js/salud.js           datos de ejemplo y formato de la sección Salud
js/mochila.js         reglas de la mochila y formato de los avisos
js/casa.js           salida, cole, pasillos, sol y texto del atajo
js/outfit.js          outfit de mañana (ejemplo y formato del payload)
js/weather.js         Open-Meteo (día y hora) y aviso de lluvia o frío junto a la cita
js/luz.js             periodos 2.0TD y PVPC de REE
js/plan.js            entreno de hoy: semáforo y semana tipo
js/core.js            configuración, estado, cargas de datos y piezas comunes
js/screens/*.js       una pantalla por fichero: hoy, calendario, ninos, compra, menu, salud, casa, ajustes
js/main.js            navegación, eventos, reloj, refrescos y arranque (se carga el último)
apps-script/          Code.gs (incluye el atajo de la compra), appsscript.json, ATAJO.md, OUTFIT.md y README para pegar en script.google.com (no está desplegado)
vendor/ical.min.js    ical.js 2.2.1 (MPL-2.0)
proxy/cloudflare-worker.js  proxy CORS opcional (no desplegado)
serve.py              servidor local + proxy opcional
tests/test_marco.py   pruebas con Playwright (test_plan.js y test_casa.js, con Node)
capturas/             capturas a 1280×800 (y 1920×1200 y móvil), con datos de ejemplo
```

## Avisos y siguientes pasos

- **Qué pantalla comprar:** vale cualquier tablet Android con un navegador moderno y una app de quiosco (Fully Kiosk Browser es la habitual).
  Los «calendarios familiares» cerrados (Skylight, Dragon Touch…) suelen no dejar abrir una web propia. Los marcos que usan
  Wes Bos y leontdi (Allwinner A133, Android 10, root) sirven, pero hacerles root requiere ADB por USB desde un ordenador.
  Comprueba antes de comprar que el navegador sea Chrome/WebView reciente (el CSS usa `color-mix`, Chrome 111+).
- **Alojamiento:** esta versión se publica en GitHub Pages bajo `/podcasts/marco-v5/` (rutas relativas y service worker con alcance solo de esa carpeta). El marco en uso sigue en `/podcasts/marco/`.
  Es **público**: por eso el código no lleva datos personales; tus ajustes viven solo en el dispositivo. Alternativas privadas:
  `serve.py` en un PC o Raspberry Pi de casa, o Cloudflare Pages con Access.
- La lista de la compra, el menú, las estrellas y las citas hechas se comparten **si** configuras el Apps Script de arriba. Si no, siguen siendo de ese dispositivo. «Haz la cesta» copia los pendientes y abre un `mailto:` al correo de Ajustes (`eroskiNotifyEmail`, vacío por defecto) con asunto «Haz la cesta». El marco no entra en la tienda: Grok Bot rellena la cesta fuera de esta página. Eso no depende de la sincronización.
- Los precios de tu tarifa no vienen: cópialos de tu factura en Ajustes si quieres verlos. El PVPC es solo referencia, sin IVA ni impuesto eléctrico
  (el «con impuestos» es una estimación).
- El PIN se guarda en el dispositivo: es un candado para niños, no seguridad fuerte.
- Festivos: para la luz y la jornada solo cuentan los nacionales de fecha fija. La mochila, además, etiqueta San Prudencio (Álava), Santiago (País Vasco), Virgen Blanca (Vitoria-Gasteiz), Viernes Santo y Lunes de Pascua. No incluye el calendario de tu cole: «sin cole» sale de una cita o de esas etiquetas.

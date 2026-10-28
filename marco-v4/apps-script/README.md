# Apps Script del marco (v4)

La compra desde un Atajo de iOS está en `AtajoCompra.gs` y `ATAJO.md`. El outfit de mañana está en `OUTFIT.md` (acción `outfit`, la misma `MARCO_KEY`). Una foto guardada en Drive se enseña sin hacer el archivo público: el bot manda `imageDriveId` y el marco sigue usando `imageUrl`. La propiedad `MARCO_OUTFIT_DRIVE_FOLDER` es opcional. Hay que pegar `Code.gs` (y el manifiesto, que ahora pide permiso de Drive) y publicar una **versión nueva**. La URL `/exec` no cambia.

# Apps Script del marco (detalle)

Se pega en [script.google.com](https://script.google.com). El marco llama a la aplicación web con la clave `MARCO_KEY`. Cómo publicarla está en el README principal de `marco-v4/`.

Ni `MARCO_KEY` ni las claves de Garmin o de AEMET van en este código ni en el repositorio. Solo en **Propiedades del script**.

## Propiedades del script

Engranaje del proyecto → **Propiedades del script** → **Añadir propiedad**.

| Propiedad | Obligatoria | Para qué |
| --- | --- | --- |
| `MARCO_KEY` | Sí | Candado de todas las acciones (`ping`, `calendars`, `sync`, `salud`, `avisos`). La misma que pegas en Ajustes del marco. 16 caracteres o más. |
| `GARMIN_PERSONAL_API_KEY` | Solo si quieres Salud | Clave de la API personal de Garmin. Sin ella, la acción `salud` responde sin datos y el marco enseña «Sin datos de Garmin». |
| `AEMET_API_KEY` | Solo si quieres avisos | Clave de AEMET OpenData. Sin ella, la acción `avisos` responde sin avisos y el marco no pinta chip. |
| `AEMET_AREA` | No | Área CAP. Por defecto `eus` (País Vasco). El marco se queda con lo naranja y lo rojo de Álava / Vitoria-Gasteiz. |
| `MARCO_OUTFIT_DRIVE_FOLDER` | No | Id de la carpeta de Drive del lookbook. Si está, `imageDriveId` solo vale si el archivo cuelga de esa carpeta. Sin ella, el script no comprueba la carpeta. Ver `OUTFIT.md`. |

Los nombres se escriben tal cual, en mayúsculas. El valor de Garmin es el que te da tu cuenta (API personal de Garmin Connect), no un token temporal: el script pide el token él mismo y no lo guarda en el código.

Después de cambiar una propiedad no hace falta una implementación nueva. Después de cambiar `Code.gs` o `appsscript.json`, sí: **Implementar → Administrar implementaciones → editar → nueva versión**. La primera vez que el script llame a Garmin o a AEMET, Google pedirá permiso para conectarse a un servicio externo (`script.external_request`). Acéptalo. `probar` en el editor dice si las propiedades de Garmin y de AEMET están presentes y **no imprime** ni la clave ni ningún token.

**Esta versión del script hay que publicarla otra vez para los avisos.** La acción `avisos` está en `Code.gs`. Si la aplicación web sigue en una versión anterior, el marco no recibe avisos (no sale chip; el resto sigue igual). No hace falta una implementación nueva ni cambiar la URL del marco: **Implementar → Administrar implementaciones → lápiz de la aplicación web → Versión: Nueva versión → Implementar**. Antes, en Propiedades del script, crea `AEMET_API_KEY` con la clave de [opendata.aemet.es](https://opendata.aemet.es/centrodedescargas/inicio). La dirección que acaba en `/exec` se queda igual.

## Qué hace la acción `avisos`

El marco la pide al abrir y cada 30 minutos, con la misma `MARCO_KEY` en el cuerpo (nunca en la URL). El script:

1. Lee `AEMET_API_KEY` de las propiedades. Si no está, responde `{ "ok": true, "alerts": [] }` y el marco no pinta nada.
2. Pide `https://opendata.aemet.es/opendata/api/avisos_cap/ultimoelaborado/area/eus` (o el área de `AEMET_AREA`) y luego la dirección `datos` que devuelve AEMET. El aviso llega en CAP (XML).
3. Se queda con nivel **naranja** o **rojo** que nombre Álava, Araba o Vitoria-Gasteiz, o que cubra el País Vasco entero. Un aviso solo de Bizkaia o de Gipuzkoa no sale. El amarillo tampoco.
4. Devuelve un JSON corto: `level`, `event`, `headline`, `text`, `area`, `until`. La clave no va dentro. Lo guarda unos 30 minutos.
5. Si AEMET falla, `{ "ok": false }` sin el texto de error crudo (por si mencionara la clave). El marco esconde el chip.

Para probar el chip sin clave, abre el marco con `?aviso=muestra`. Ese aviso es de ejemplo y lo dice en el texto.

**Esta versión del script hay que publicarla otra vez.** Las tendencias de 28 días y el peso están en `Code.gs`. Si la aplicación web sigue en una versión anterior, el marco solo recibe 7 días y sin peso. No hace falta una implementación nueva ni cambiar la URL del marco: **Implementar → Administrar implementaciones → lápiz de la aplicación web → Versión: Nueva versión → Implementar**. La dirección que acaba en `/exec` se queda igual. En el marco, pulsa **Actualizar** (la copia de este dispositivo se renueva en ese momento, o sola a los 30 minutos).

## Qué hace la acción `salud`

El marco la pide al abrir y cada 30 minutos, con la misma `MARCO_KEY` en el cuerpo (nunca en la URL). El script:

1. Lee `GARMIN_PERSONAL_API_KEY` de las propiedades.
2. Pide un JWT con `POST https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token` y la cabecera `Authorization: ApiKey …`. El cuerpo de la respuesta es el token en texto. Lo deja en `CacheService` hasta unos 5 minutos antes de la fecha `exp` del JWT.
3. Con `Authorization: Bearer …` pide los **últimos 28 días** y, solo para calcular la variación, los 28 anteriores (no viajan día a día). Son el resumen diario (pasos y pulso en reposo: `/usersummary-service/v2/dailysummaries`), el sueño (como mucho 31 días por llamada, por eso van en dos tandas), la VFC (`/hrv-service/hrv/daily/…`), el peso (`/weight-service/weight/range/…`, en gramos) y hasta unas 100 actividades.
4. Devuelve un JSON corto: `days` (28 fechas, de la más antigua a hoy), `previous.avg` (medias del periodo anterior) y los últimos entrenos. Si un día no tiene medida, **ese campo no viene**: el marco deja un corte en la línea y no pinta un cero. El peso del día es el último pesaje (`weightGrams`). El sueño y la batería corporal (mínimo y máximo) salen de esas mismas respuestas. Si el resumen diario ya trae `chargedValue`, `currentValue` o `mostRecentValue` dentro de `bodyBattery`, el script lo reenvía como `bodyBatteryCharged`. No hay otra llamada a Garmin: la franja Hoy del marco usa esos campos y, si no vienen, enseña un hueco.
5. Guarda esa respuesta unos 30 minutos (`CacheService`) y una copia en las propiedades por si Garmin falla después (`GARMIN_SALUD_N` y `GARMIN_SALUD_0`…). Si Garmin falla, devuelve la última respuesta buena con `"stale": true`. Si no hay ninguna, `{ "ok": false, "error": "Sin datos de Garmin" }`.

La clave y el token no se escriben en el registro ni se mandan al marco. El marco guarda el JSON en el dispositivo (`marco-v4.cache.salud`) para poder abrirlo sin red. Para olvidar la copia del script, borra `GARMIN_SALUD_N`, `GARMIN_SALUD_0`, `GARMIN_SALUD_1`… y, si aún existe, `GARMIN_SALUD_LAST`.

Sin pesajes en Garmin Connect, la gráfica de peso sale con cortes. El resto de Salud sigue igual.

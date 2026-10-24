# Apps Script del marco (v2)

Se pega en [script.google.com](https://script.google.com). El marco llama a la aplicación web con la clave `MARCO_KEY`. Cómo publicarla está en el README principal de `marco-v2/`.

Ni `MARCO_KEY` ni la clave de Garmin van en este código ni en el repositorio. Solo en **Propiedades del script**.

## Propiedades del script

Engranaje del proyecto → **Propiedades del script** → **Añadir propiedad**.

| Propiedad | Obligatoria | Para qué |
| --- | --- | --- |
| `MARCO_KEY` | Sí | Candado de todas las acciones (`ping`, `calendars`, `sync`, `salud`). La misma que pegas en Ajustes del marco. 16 caracteres o más. |
| `GARMIN_PERSONAL_API_KEY` | Solo si quieres Salud | Clave de la API personal de Garmin. Sin ella, la acción `salud` responde sin datos y el marco enseña «Sin datos de Garmin». |

Los nombres se escriben tal cual, en mayúsculas. El valor de Garmin es el que te da tu cuenta (API personal de Garmin Connect), no un token temporal: el script pide el token él mismo y no lo guarda en el código.

Después de cambiar una propiedad no hace falta una implementación nueva. Después de cambiar `Code.gs` o `appsscript.json`, sí: **Implementar → Administrar implementaciones → editar → nueva versión**. La primera vez que el script llame a Garmin, Google pedirá permiso para conectarse a un servicio externo (`script.external_request`). Acéptalo. `probar` en el editor dice si la propiedad de Garmin está presente y **no imprime** ni la clave ni ningún token.

**Esta versión del script hay que publicarla otra vez.** Las tendencias de 28 días y el peso están en `Code.gs`. Si la aplicación web sigue en una versión anterior, el marco solo recibe 7 días y sin peso. No hace falta una implementación nueva ni cambiar la URL del marco: **Implementar → Administrar implementaciones → lápiz de la aplicación web → Versión: Nueva versión → Implementar**. La dirección que acaba en `/exec` se queda igual. En el marco, pulsa **Actualizar** (la copia de este dispositivo se renueva en ese momento, o sola a los 30 minutos).

## Qué hace la acción `salud`

El marco la pide al abrir y cada 30 minutos, con la misma `MARCO_KEY` en el cuerpo (nunca en la URL). El script:

1. Lee `GARMIN_PERSONAL_API_KEY` de las propiedades.
2. Pide un JWT con `POST https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token` y la cabecera `Authorization: ApiKey …`. El cuerpo de la respuesta es el token en texto. Lo deja en `CacheService` hasta unos 5 minutos antes de la fecha `exp` del JWT.
3. Con `Authorization: Bearer …` pide los **últimos 28 días** y, solo para calcular la variación, los 28 anteriores (no viajan día a día). Son el resumen diario (pasos y pulso en reposo: `/usersummary-service/v2/dailysummaries`), el sueño (como mucho 31 días por llamada, por eso van en dos tandas), la VFC (`/hrv-service/hrv/daily/…`), el peso (`/weight-service/weight/range/…`, en gramos) y hasta unas 100 actividades.
4. Devuelve un JSON corto: `days` (28 fechas, de la más antigua a hoy), `previous.avg` (medias del periodo anterior) y los últimos entrenos. Si un día no tiene medida, **ese campo no viene**: el marco deja un corte en la línea y no pinta un cero. El peso del día es el último pesaje (`weightGrams`). El sueño y la batería corporal (mínimo y máximo) salen de esas mismas respuestas. Si el resumen diario ya trae `chargedValue`, `currentValue` o `mostRecentValue` dentro de `bodyBattery`, el script lo reenvía como `bodyBatteryCharged`. No hay otra llamada a Garmin: la franja Hoy del marco usa esos campos y, si no vienen, enseña un hueco.
5. Guarda esa respuesta unos 30 minutos (`CacheService`) y una copia en las propiedades por si Garmin falla después (`GARMIN_SALUD_N` y `GARMIN_SALUD_0`…). Si Garmin falla, devuelve la última respuesta buena con `"stale": true`. Si no hay ninguna, `{ "ok": false, "error": "Sin datos de Garmin" }`.

La clave y el token no se escriben en el registro ni se mandan al marco. El marco guarda el JSON en el dispositivo (`marco-v2.cache.salud`) para poder abrirlo sin red. Para olvidar la copia del script, borra `GARMIN_SALUD_N`, `GARMIN_SALUD_0`, `GARMIN_SALUD_1`… y, si aún existe, `GARMIN_SALUD_LAST`.

Sin pesajes en Garmin Connect, la gráfica de peso sale con cortes. El resto de Salud sigue igual.

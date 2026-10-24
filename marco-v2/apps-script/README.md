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

## Qué hace la acción `salud`

El marco la pide al abrir y cada 30 minutos, con la misma `MARCO_KEY` en el cuerpo (nunca en la URL). El script:

1. Lee `GARMIN_PERSONAL_API_KEY` de las propiedades.
2. Pide un JWT con `POST https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token` y la cabecera `Authorization: ApiKey …`. El cuerpo de la respuesta es el token en texto. Lo deja en `CacheService` hasta unos 5 minutos antes de la fecha `exp` del JWT.
3. Con `Authorization: Bearer …` lee los últimos 7 días (sueño, resumen diario, VFC y hasta 10 actividades) y devuelve un JSON corto.
4. Guarda esa respuesta unos 30 minutos. Si Garmin falla, devuelve la última respuesta buena con `"stale": true`. Si no hay ninguna, `{ "ok": false, "error": "Sin datos de Garmin" }`.

La clave y el token no se escriben en el registro ni se mandan al marco. El marco guarda el JSON en el dispositivo (`marco-v2.cache.salud`) para poder abrirlo sin red. Para olvidar la copia del script, borra la propiedad `GARMIN_SALUD_LAST`.

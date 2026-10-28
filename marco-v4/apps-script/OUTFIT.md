# Outfit de mañana

El bot Outfit propone **un** conjunto para el día siguiente (catálogo `p001`–`p027`) y lo deja en este Apps Script. El marco lo pinta en Hoy y en la pestaña Outfit. La clave sigue siendo `MARCO_KEY`, la misma de Ajustes.

Hay que pegar el `Code.gs` de esta carpeta y el `appsscript.json` (ahora pide permiso de Drive). Publica **una versión nueva**: Implementar → Administrar implementaciones → lápiz → Versión: Nueva versión. La URL `/exec` no cambia. Si Google pide acceso a Drive, acéptalo: el script solo lee la foto del lookbook, no la comparte.

## Qué manda el bot

El bot sube el PNG o JPEG a Drive (carpeta «Marco/Outfit», o la que uses). **No hace falta** «cualquiera con el enlace»: ese permiso no está disponible y el archivo sigue privado. Luego hace POST a la URL `/exec`, cuerpo JSON, con `imageDriveId` (el id del archivo), las piezas, el porqué, la fecha y la clave:

```json
{
  "action": "outfit",
  "key": "TU_MARCO_KEY",
  "forDate": "2026-10-29",
  "updatedAt": "2026-10-28T21:00:00+01:00",
  "why": "Fresquito y planta Basquevolt",
  "imageDriveId": "ID_DEL_ARCHIVO",
  "pieces": [
    { "id": "p011", "name": "camiseta Nike negra ATHLETE", "slot": "arriba" },
    { "id": "p007", "name": "sudadera cerrada negra", "slot": "capa" },
    { "id": "p002", "name": "chino azul grisáceo", "slot": "pantalón" },
    { "id": "p019", "name": "New Balance 327", "slot": "calzado" },
    { "id": "p006", "name": "softshell Jack & Jones", "slot": "exterior" }
  ]
}
```

- `forDate`: el día para el que vale, `AAAA-MM-DD`.
- `why`: una línea (tiempo + plan).
- `imageDriveId`: opcional. Id del PNG o JPEG que el bot acaba de subir. El script lo guarda, crea un `imageToken` largo y pone en `imageUrl` la URL de esta aplicación: `…/exec?action=outfitImg&tok=…`. Esa URL **no** lleva `MARCO_KEY`.
- `imageUrl`: opcional, como hasta ahora, si no mandas `imageDriveId`. Una URL `https` que el marco pueda cargar, o un data URL de imagen si el JSON cabe (unos 48 KB).
- `pieces`: lista. Cada pieza lleva `id` (`p` + 3 cifras), `name` y `slot`.
- Huecos: `arriba`, `capa` (opcional), `pantalón`, `calzado`, `exterior` (opcional). `pantalon` sin acento también se acepta.
- Cada POST **sustituye** el outfit anterior. No se mezcla con la compra ni con el menú.
- La clave va en el cuerpo, no en la URL. No la pegues en el repositorio.

`updatedAt` puede ir con zona (`+01:00`). Si lo omites, el script pone la hora de Europe/Madrid.

## Cómo se ve la foto

El marco sigue usando `imageUrl`. Pide `action=outfitImg&tok=…` sin clave (el tok es el secreto) y pinta el JPEG o el PNG.

Google no deja que la aplicación web marque la respuesta como `image/jpeg`: solo puede devolver texto. El script manda los bytes en un data URL (`image/jpeg` o `image/png`) y el marco los pone en el `<img>`. Un tok que no vale responde el texto `404` (Apps Script no puede poner el código HTTP 404) y el marco deja el hueco de la camiseta.

Opcional: propiedad `MARCO_OUTFIT_DRIVE_FOLDER` con el id de la carpeta. Si está, el script solo acepta una foto cuyo padre sea esa carpeta. Si no está, no comprueba la carpeta.

## Cómo lo lee el marco

Con la misma URL y la misma `MARCO_KEY`:

- `POST` o `GET` con `action=outfit` y sin piezas devuelve `{ "ok": true, "outfit": { … } }` o `outfit: null` si aún no hay nada.
- La acción `sync` devuelve ese mismo `outfit` junto al resto de datos compartidos. El marco no lo reenvía: solo lo lee.

En el marco, **Actualizar**. Tiene que salir en Hoy («Outfit de mañana») y en la pestaña Outfit. En el reloj nocturno, una línea corta si hay datos.

Sin URL ni clave, el marco enseña un outfit de ejemplo (camiseta, sudadera, chino, New Balance y softshell) marcado como ejemplo. No llama al script.

Lo guardado vive en las propiedades `MARCO_OUTFIT_N` y `MARCO_OUTFIT_0`… La foto usa además `MARCO_OUTFIT_IMG` (tok → id de Drive). Para borrarlo, elimina esas propiedades. No toques `MARCO_STATE_*` (compra, menú, estrellas).

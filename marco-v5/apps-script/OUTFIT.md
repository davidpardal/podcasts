# Outfit de mañana

El bot Outfit propone **un** conjunto para el día siguiente (catálogo `p001`–`p029`) y lo deja en este Apps Script. El marco lo pinta en Hoy y en la pestaña Outfit. La clave sigue siendo `MARCO_KEY`, la misma de Ajustes.

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

## Buzón de Drive (sin clave)

Si el bot no puede hacer el POST (no tiene la URL o la `MARCO_KEY`), le basta con dejar dos archivos en la carpeta **Marco/Outfit** de Drive:

- `look-AAAA-MM-DD.json` con el porqué y las piezas:

```json
{
  "why": "Fresquito y planta Basquevolt",
  "pieces": [
    { "id": "p015", "name": "camiseta Nike azul marino", "slot": "arriba" },
    { "id": "p001", "name": "chino beige", "slot": "pantalón" },
    { "id": "p019", "name": "New Balance 327", "slot": "calzado" },
    { "id": "p006", "name": "softshell Jack & Jones", "slot": "exterior" }
  ]
}
```

- `look-AAAA-MM-DD.jpg` (o `.png`), la foto. Opcional.

A las **21:30** el script busca `look-<mañana>.json`; si está, lo guarda con su foto igual que un POST y no elige nada él. `outfitAhora` también mira primero el buzón (de hoy antes de las 15:00, de mañana después). Sin JSON no usa la foto, porque no casaría con las prendas que elige el script. Si la foto falla, guarda el outfit sin foto.

La carpeta es la de la propiedad `MARCO_OUTFIT_DRIVE_FOLDER` si existe; si no, la carpeta «Outfit» que cuelga de «Marco». El bot solo necesita poder escribir en esa carpeta: nada de URL ni de clave.

## Outfit automático (sin bot)

Si el bot no manda nada, el script lo elige él. Cada noche hacia las **21:30** mira si ya hay outfit para mañana; si no lo hay, elige uno con:

- el catálogo `CATALOGO_OUTFIT` de `Code.gs` (copia de `WARDROBE.md`, p001–p029 sin p013, que es de vestir);
- el tiempo de mañana en Vitoria (Open-Meteo, sin clave): con menos de 17 °C añade sudadera o jersey; con menos de 10 °C, el plumas; con lluvia (50 % o más) o mínima por debajo de 6 °C, el softshell; con lluvia no elige ante ni lona;
- la «última vez» de cada prenda: no repite camiseta, pantalón ni calzado y prefiere lo que lleva más días sin ponerse. Cada outfit guardado, del bot o automático, cuenta como puesto ese día (propiedad `MARCO_OUTFIT_USADO`);
- el día: el jogger solo en fin de semana.

Sale sin foto. Si el bot manda el suyo antes de las 21:30, se respeta.

**Instalar (una vez):** pega `Code.gs` y `appsscript.json` (ahora pide permiso para programar tareas), publica una versión nueva y, en el editor, ejecuta `instalarOutfitAutomatico` (▶). Acepta los permisos. Si no había outfit vigente, pone uno en ese momento.

- `outfitAhora`: pone ya uno (de hoy antes de las 15:00, de mañana después) y sustituye al que haya.
- `quitarOutfitAutomatico`: borra el aviso de las 21:30.

Prenda nueva: añádela a `CATALOGO_OUTFIT` con `id`, `name`, `slot`, `color` y, si no aguanta la lluvia, `lluvia: false`.

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

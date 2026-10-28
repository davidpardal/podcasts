# Outfit de mañana

El bot Outfit propone **un** conjunto para el día siguiente (catálogo `p001`–`p027`) y lo deja en este Apps Script. El marco lo pinta en Hoy y en la pestaña Outfit. No hace falta una propiedad nueva: la clave sigue siendo `MARCO_KEY`, la misma de Ajustes.

Hay que pegar el `Code.gs` de esta carpeta (trae la acción `outfit`) y publicar **una versión nueva**: Implementar → Administrar implementaciones → lápiz → Versión: Nueva versión. La URL `/exec` no cambia.

## Qué manda el bot

POST a la URL `/exec`, cuerpo JSON:

```json
{
  "action": "outfit",
  "key": "TU_MARCO_KEY",
  "forDate": "2026-10-29",
  "updatedAt": "2026-10-28T21:00:00+01:00",
  "why": "Fresquito y planta Basquevolt",
  "imageUrl": "https://ejemplo.invalid/lookbook.png",
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
- `imageUrl`: opcional. Mejor una URL `https` que el marco pueda cargar. Un data URL de imagen también vale si el JSON cabe (unos 48 KB). Si no cabe, el script responde error: quita la imagen o usa `https`.
- `pieces`: lista. Cada pieza lleva `id` (`p` + 3 cifras), `name` y `slot`.
- Huecos: `arriba`, `capa` (opcional), `pantalón`, `calzado`, `exterior` (opcional). `pantalon` sin acento también se acepta.
- Cada POST **sustituye** el outfit anterior. No se mezcla con la compra ni con el menú.
- La clave va en el cuerpo, no en la URL. No la pegues en el repositorio.

`updatedAt` puede ir con zona (`+01:00`). Si lo omites, el script pone la hora de Europe/Madrid.

## Cómo lo lee el marco

Con la misma URL y la misma `MARCO_KEY`:

- `POST` o `GET` con `action=outfit` y sin piezas devuelve `{ "ok": true, "outfit": { … } }` o `outfit: null` si aún no hay nada.
- La acción `sync` devuelve ese mismo `outfit` junto al resto de datos compartidos. El marco no lo reenvía: solo lo lee.

En el marco, **Actualizar**. Tiene que salir en Hoy («Outfit de mañana») y en la pestaña Outfit. En el reloj nocturno, una línea corta si hay datos.

Sin URL ni clave, el marco enseña un outfit de ejemplo (camiseta, sudadera, chino, New Balance y softshell) marcado como ejemplo. No llama al script.

Lo guardado vive en las propiedades `MARCO_OUTFIT_N` y `MARCO_OUTFIT_0`… Para borrarlo, elimina esas propiedades. No toques `MARCO_STATE_*` (compra, menú, estrellas).

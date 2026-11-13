# Atajo de iOS → Compra

Añade a la lista compartida cosas como `leche` o `comprar pilas`, desde un Atajo del iPhone. El marco no lleva la clave: va en el atajo y en las Propiedades del script (`MARCO_KEY`), la misma de Ajustes.

Hace falta el `Code.gs` de esta carpeta (tiene el gancho) y `AtajoCompra.gs` en el mismo proyecto. Después, **Implementar → Administrar implementaciones → lápiz → Versión: Nueva versión**. La URL `/exec` no cambia.

## Qué acepta

- JSON: `{ "action": "compra", "key": "TU_CLAVE", "text": "leche" }`
- Varias cosas: `leche, pilas` o una por línea
- `comprar pilas` se guarda como `Pilas`
- Texto plano en el cuerpo, con la clave en el JSON o en `?key=` (mejor no: se queda en historiales)

Si el nombre ya está, se vuelve a marcar como pendiente. No borra el resto de la lista.

## Atajo (unos 2 minutos)

1. Abre **Atajos** → **+**.
2. Añade **Pedir texto**. En la pregunta: `¿Qué hay que comprar?`
3. Añade **Obtener contenido de URL**.
   - URL: la de tu aplicación web, la que acaba en `/exec`
   - Método: **POST**
   - Cabecera: `Content-Type` = `application/json`
   - Cuerpo: **JSON**, con
     - `action`: `compra`
     - `key`: tu `MARCO_KEY` (no la pegues en el marco ni en git)
     - `text`: el texto que acabas de pedir
4. Opcional: **Mostrar resultado** para ver `added`.
5. Ponle un nombre corto, por ejemplo `Compra`, y añádelo a la pantalla de inicio o a la parte de atrás del iPhone.

Prueba con `leche`. En el marco, **Actualizar**: tiene que salir en Compra (pasillo Lácteos, si no has cambiado el orden).

Si responde que la clave no vale, revisa `MARCO_KEY` y que hayas publicado una versión nueva después de pegar `AtajoCompra.gs`.

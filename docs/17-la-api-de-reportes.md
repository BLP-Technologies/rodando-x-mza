# La API de reportes

> Documento temático. Define el contrato de C010 —reportar un obstáculo— y el de la
> subida de la imagen que lo acompaña: qué recibe, qué valida, qué devuelve y qué no
> hace. Es el estado vivo de esas decisiones: se edita en su lugar cuando cambian. Se
> complementa con [09-modelo-de-datos.md](09-modelo-de-datos.md), que define el
> reporte y su relación con el obstáculo, con
> [04-errores-y-mensajes.md](04-errores-y-mensajes.md), que define la forma del
> error, y con [03-despliegue-y-operacion.md](03-despliegue-y-operacion.md), que
> define dónde viven los archivos en producción.

## 1. Alcance

Este documento responde:

- **Con qué entrada** se crea un reporte, y por qué el tipo es un código (§2).
- **Qué devuelve**, y por qué sólo eso (§3).
- **Cómo viaja la foto**, y dónde quedan los bytes (§4).
- **Cómo se rechaza** un pedido (§5).
- **Por qué el reporte no tiene autor** todavía (§6).

La API de reportes son **dos endpoints que hacen una cosa cada uno**:

- `POST /api/reports` guarda el reporte.
- `POST /api/reports/images` guarda una imagen y devuelve su URL.

No crea el obstáculo: eso es la moderación (#47), y hasta que exista, un reporte no
cambia el mapa ni el ruteo ([09 §4.5](09-modelo-de-datos.md)). Tampoco lista los
reportes (#65), no autentica (Fase 3) y no agrupa duplicados.

**El punto no se valida contra `service_areas`.** El ruteo rechaza una punta fuera
del perímetro porque el pedido es "llevenme de A a B"
([13 §4.1](13-api-de-ruteo.md#41-la-red-de-seguridad)); acá el pedido es "esto está
roto en esta esquina", y quien reporta puede estar fuera del piloto. El reporte se
guarda igual y el moderador decide con el mapa adelante.

## 2. El pedido

`POST /api/reports`

El contrato se publica generado desde los esquemas Zod en `GET /api/openapi.json`
([02 §6](02-stack-y-estructura.md#6-contrato-de-la-api)): el Zod es la fuente y el
documento es su lectura.

```json
{
  "type": "POTHOLE",
  "severity": "MODERATE",
  "description": "Pozo profundo en la esquina",
  "geom": { "lon": -68.8444, "lat": -32.8897 },
  "image_url": "http://localhost:3001/uploads/2f1c6c1e-0f6c-4a4e-9d3a-0c5b1b2f7a11.jpg"
}
```

| Campo | Para qué |
| --- | --- |
| `type` | Qué le pareció ver a quien reporta, por **código** del catálogo `obstacle_types` (`POTHOLE`, `OTHER`, …) |
| `severity` | Cuánto le parece que molesta: `MINOR`, `MODERATE` o `CRITICAL` |
| `description` | Qué pasa, en palabras de quien reporta. Obligatoria, hasta 300 caracteres |
| `geom` | Dónde está el problema, en WGS 84, con `lon` y `lat` por nombre |
| `image_url` | Opcional: la URL que devolvió la subida (§4) |

Cuatro decisiones detrás de esa forma:

- **El tipo viaja como código y no como `id`.** El `id` de `obstacle_types` es un
  artefacto de la base: exponerlo ataría al cliente a una numeración que nadie
  prometió, igual que pasa con los nodos del grafo
  ([13 §3](13-api-de-ruteo.md#3-el-pedido)). El código es el nombre estable del
  catálogo y el que ya está en la documentación del dominio.
- **El catálogo no se copia en Zod.** El esquema no enumera los códigos válidos: la
  lista vive en la base y la resuelve el `INSERT ... SELECT` (§3). Una copia acá
  sería una segunda fuente que se desincroniza cada vez que se agrega un tipo, y el
  rechazo ya tiene dónde ocurrir.
- **`image_url` es opcional.** Un reporte sin foto es un reporte completo: la foto
  ayuda al moderador y no es la prueba de nada. La columna es `varchar(300)`, así que
  el tope del contrato es el mismo.
- **El cuerpo es estricto.** Un campo que el contrato no tiene es un `400` que lo
  nombra, en vez de algo que se descarta en silencio: un cliente que manda
  `photo` en lugar de `image_url` tiene que enterarse
  ([04 §4](04-errores-y-mensajes.md#4-catálogo-de-códigos)).

`geom` va como objeto y no como dos campos sueltos por la misma razón que en el
ruteo: `lon` y `lat` se confunden a simple vista, y nombrarlos dentro de un objeto
hace visible cuál es cuál.

## 3. La respuesta

`201` con el reporte creado:

```json
{ "id": 1, "type": "POTHOLE", "severity": "MODERATE", "status": "PENDING" }
```

| Campo | Para qué |
| --- | --- |
| `id` | La referencia del reporte recién guardado, sin la que el cliente no puede volver a pedirlo ni nombrarlo |
| `type` | El código que se guardó, para que el cliente no tenga que recordar qué mandó |
| `severity` | La severidad guardada, igual que el tipo |
| `status` | El estado con el que nace: siempre `PENDING` |

**Esos cuatro y ninguno más.** `created_at` y el resto del reporte son del listado y
de la ficha del portal (#65): mandarlos acá adelantaría la forma de un recurso que
todavía no se puede leer, y el `POST` tiene que devolver lo justo para confirmar que
se guardó.

**El reporte nace `PENDING`.** El `status` lo pone la base con su default y la
respuesta lo devuelve tal como quedó guardado, no como el código supone que quedó.
El ciclo de vida —aprobar, marcar duplicado, resolver— es de la moderación (#47),
que además crea el obstáculo en la transición a `APPROVED`
([09 §4.5](09-modelo-de-datos.md#45-reporte-y-obstáculo)).

**Una sola consulta.** El catálogo se resuelve en el mismo `INSERT ... SELECT` que
escribe la fila, así que no hay carrera entre chequear que el código existe y
guardar, y **cero filas devueltas significa exactamente una cosa**: no hay ningún
tipo activo con ese código.

## 4. Las imágenes

La foto viaja en **dos pasos**, y en ese orden:

1. `POST /api/reports/images` con la imagen en multipart, campo `file`.
2. `POST /api/reports` con la `url` que devolvió el paso anterior en `image_url`.

`201` de la subida:

```json
{ "url": "http://localhost:3001/uploads/2f1c6c1e-0f6c-4a4e-9d3a-0c5b1b2f7a11.jpg" }
```

**Por qué son dos pasos y no un multipart del reporte.** El archivo y la fila no
comparten vida: subir primero deja al reporte con un cuerpo JSON, que es lo que el
cliente tipado ya sabe mandar, y una foto sin reporte es un archivo huérfano en vez
de una transacción que hay que deshacer. También permite reintentar el reporte sin
volver a mandar los bytes (y perder el archivo si el pedido se corta a mitad de
camino).

**Los límites.**

| Regla | Valor | Por qué |
| --- | --- | --- |
| Tamaño | 5 MB | Una foto de teléfono entra; el tope evita que un error del cliente llene el disco |
| Formatos | PNG, JPEG, WebP | Los tres que produce cualquier cámara o captura |
| Cantidad | Un archivo, campo `file` | `limits.files: 1`: no hay galería en un reporte |

**SVG queda afuera.** Un SVG es un documento —puede llevar `<script>` y enlaces— y
se sirve desde el mismo dominio que el portal, así que abrirlo sería ejecutar código
ajeno con los permisos de la página. PNG, JPEG y WebP son mapas de bits: se dibujan
y no se ejecutan.

**Cómo se guarda.** En disco, en `UPLOAD_DIR`, con un nombre que arma el servidor:
un UUID y la extensión que corresponde al MIME (`image/png` → `png`,
`image/jpeg` → `jpg`, `image/webp` → `webp`). El nombre que manda el cliente no se
usa para nada: no hay forma de escribir fuera del directorio ni de que dos pedidos se
pisen. Los bytes se guardan tal como llegaron —no se comprimen ni se redimensionan—,
así que el archivo que se sirve es el que se validó.

**Quién sirve los bytes.** Hoy el backend, en `/uploads`: un `express.static` fuera
de `/api`, porque son archivos y no un recurso de la API. Los nombres son únicos y no
se reescriben, así que se cachean un año. La URL se arma con `UPLOAD_BASE_URL` y es
la que queda guardada en `reports.image_url`.

Nada de eso está grabado en el contrato: mañana `/uploads` puede servirlo nginx, un
CDN o un gestor de archivos. **Cambiar de disco a un gestor es escribir otro
adaptador** del puerto `ImageStorage` y cambiar `UPLOAD_BASE_URL`; ni el endpoint ni
la base se tocan. El costo asumido es que las URLs viejas apuntan al dominio viejo:
si algún día se migra, se migran las filas o se deja una redirección.

## 5. Cómo se rechaza

| Situación | Status | Respuesta |
| --- | --- | --- |
| Falta un campo del pedido | 400 | `VALIDATION_ERROR` con `details: [{ field, code: "REQUIRED" }]` |
| Un valor presente pero inválido (severidad fuera del enum, `image_url` que no es URL) | 400 | `VALIDATION_ERROR` con `details: [{ field, code: "INVALID" }]` |
| La descripción está vacía o pasa de 300 caracteres | 400 | `VALIDATION_ERROR` con `details: [{ field: "description", code: "INVALID" }]` |
| `geom.lon` o `geom.lat` mal formada o fuera de rango | 400 | `VALIDATION_ERROR` con `details: [{ field: "geom.lon" o "geom.lat", code: "INVALID" }]` |
| Un campo de más en el cuerpo | 400 | `VALIDATION_ERROR` con `details: [{ field: "<la clave>", code: "INVALID" }]` |
| El código de tipo no existe, o existe inactivo | 400 | `VALIDATION_ERROR` con `details: [{ field: "type", code: "INVALID" }]` |
| La subida no trae archivo | 400 | `VALIDATION_ERROR` con `details: [{ field: "file", code: "REQUIRED" }]` |
| La subida trae un formato no permitido, un archivo de más de 5 MB o un multipart roto | 400 | `VALIDATION_ERROR` con `details: [{ field: "file", code: "INVALID" }]` |
| Cualquier fallo de la base o del disco | 500 | `INTERNAL_ERROR`, sin detalles ([04 §5](04-errores-y-mensajes.md#5-errores-esperables-y-no-esperables)) |

`field` es la ruta del campo en el cuerpo (`type`, `geom.lon`), y puede haber más de
un `detail` en el mismo error.

**Un solo `INVALID` para el tipo inexistente y el inactivo.** Para el cliente la
acción es la misma —elegir otro tipo del catálogo— y distinguirlos no le cambiaría el
mensaje, así que no hay un motivo propio
([04 §4](04-errores-y-mensajes.md#4-catálogo-de-códigos)). Por la misma razón el
formato no permitido y el archivo demasiado grande comparten `file` / `INVALID`: se
resuelven eligiendo otro archivo.

También `REQUIRED` es aparte: no es un archivo que no sirve, es uno que no vino.

## 6. El reporte anónimo

`reports.user_id` es **nullable**, y hoy se escribe siempre en `NULL`.

La columna nació `NOT NULL` con FK a `users`, pero la autenticación es Fase 3
([07 §3](07-plan-de-trabajo.md)) y no hay una sola fila en `users`: exigir el autor
haría imposible el único caso que existe, que alguien reporte un pozo sin tener
cuenta. Un reporte anónimo es legítimo mientras no haya login, y el dato que importa
—qué, dónde, cuán grave— está completo igual.

La alternativa descartada fue sembrar un usuario "ciudadano" y apuntarle todos los
reportes: deja una fila de mentira que después hay que deshacer con un `UPDATE`
masivo, y mientras tanto miente sobre quién reportó.

**Cuando exista el auth**, el reporte autenticado vuelve a completar el campo y el
anónimo sigue siendo posible o se rechaza, según lo decida el caso de uso. Nada de
este contrato cambia: el autor no viaja en el cuerpo, sale de la sesión.

## 7. Lo que este documento no decide

- **La autenticación y el autor del reporte.** Es Fase 3; hoy no hay usuario
  ([07 §3](07-plan-de-trabajo.md)).
- **La moderación y las transiciones de `status`.** Aprobar, rechazar, marcar
  duplicado y crear el obstáculo son de #47
  ([09 §4.5](09-modelo-de-datos.md#45-reporte-y-obstáculo)).
- **La lista de reportes del portal.** `GET /api/reports` es #65; por eso la
  respuesta del `POST` no adelanta su forma (§3).
- **Agrupar duplicados.** El MVP no detecta dos reportes del mismo pozo; el moderador
  aprueba uno y rechaza el resto ([09 §4.5](09-modelo-de-datos.md#45-reporte-y-obstáculo)).
- **Un límite de pedidos por IP.** No hay rate limit: hoy no hay tráfico que lo pida,
  y es una decisión de operación cuando lo haya
  ([03](03-despliegue-y-operacion.md)).
- **El almacenamiento definitivo.** Hoy es disco en `UPLOAD_DIR`, que en producción
  es un volumen persistente ([03 §6](03-despliegue-y-operacion.md#6-archivos-y-almacenamiento));
  moverlo a un gestor de archivos es otro adaptador de `ImageStorage` (§4).
- **Borrar o reemplazar imágenes, comprimirlas o redimensionarlas.** No hay borrado
  ni postproceso: lo que se sube se sirve tal cual.
- **La validación del contenido del archivo.** Se confía en el MIME declarado: no se
  abren los bytes para verificar que el PNG sea un PNG.

## 8. Documentos relacionados

- [09-modelo-de-datos.md](09-modelo-de-datos.md): el reporte, el obstáculo y su
  relación.
- [04-errores-y-mensajes.md](04-errores-y-mensajes.md): la forma de la respuesta de
  error y el catálogo de códigos.
- [03-despliegue-y-operacion.md](03-despliegue-y-operacion.md): dónde viven los
  archivos en producción y qué se respalda.
- [13-api-de-ruteo.md](13-api-de-ruteo.md): el contraste entre validar un punto
  contra el perímetro y no validarlo (§1).
- [14-la-api-del-grafo.md](14-la-api-del-grafo.md): el otro contrato de escritura de
  la API.
- [07-plan-de-trabajo.md](07-plan-de-trabajo.md): fases y casos de uso.

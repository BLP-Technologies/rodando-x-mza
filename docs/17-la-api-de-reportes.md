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
- **Cómo se leen** los reportes que ya están guardados (§7).
- **Cómo se moderan**: qué crea un obstáculo, qué descarta el reporte y en qué orden se
escribe (§7.1).

La API de reportes son **cinco endpoints que hacen una cosa cada uno**:

- `POST /api/reports` guarda el reporte.
- `POST /api/reports/images` guarda una imagen y devuelve su URL.
- `GET /api/reports` lista los reportes de un estado (§7).
- `POST /api/reports/{id}/approve` publica el obstáculo y marca el reporte (§7.1).
- `POST /api/reports/{id}/reject` descarta el reporte (§7.1).

Un reporte **no cambia el mapa ni el ruteo por sí solo**: lo hace la aprobación, que crea el
obstáculo ([09 §4.5](09-modelo-de-datos.md#45-reporte-y-obstáculo)). El alta, la lectura y el
cierre del obstáculo son de [18](18-la-api-de-obstaculos.md); acá quedan las dos acciones
que se toman sobre el reporte. La API no autentica (Fase 3) ni agrupa duplicados.

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
de la ficha del portal (#65, §7): repetirlos acá sería un segundo contrato del mismo
dato, y el `POST` tiene que devolver lo justo para confirmar que se guardó.

**El reporte nace `PENDING`.** El `status` lo pone la base con su default y la
respuesta lo devuelve tal como quedó guardado, no como el código supone que quedó.
El ciclo de vida —aprobar, descartar— es la moderación (§7.1), que crea el obstáculo en
la transición a `APPROVED`
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

## 7. La lectura de reportes

`GET /api/reports?status=PENDING`

Es la otra mitad del recurso: el `POST` guarda la percepción de quien reporta y esta
lectura la devuelve para que el moderador la vea sin entrar a `psql`. La forma es la
misma que la del grafo —una `FeatureCollection` de GeoJSON con `truncated` al lado de
`type`— porque el consumidor es el mismo portal que ya sabe leer una
([14 §5](14-la-api-del-grafo.md)).

```json
{
  "type": "FeatureCollection",
  "truncated": false,
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-68.8444, -32.8897] },
      "properties": {
        "id": 1,
        "status": "PENDING",
        "type": "POTHOLE",
        "type_name": "Pozo",
        "severity": "MODERATE",
        "description": "Pozo profundo en la esquina",
        "image_url": "http://localhost:3001/uploads/2f1c6c1e-0f6c-4a4e-9d3a-0c5b1b2f7a11.jpg",
        "obstacle_id": null,
        "created_at": "2026-02-27T15:03:51.123Z"
      }
    }
  ]
}
```

| Campo | Para qué |
| --- | --- |
| `type` | `FeatureCollection`, igual que el grafo |
| `truncated` | Si la respuesta trae todos los reportes del estado o sólo los más nuevos (§7, el tope) |
| `features[].geometry` | El punto reportado, vía `ST_AsGeoJSON`, en orden `[lon, lat]` |
| `features[].properties.id` | La referencia del reporte, la misma que devolvió el `POST` (§3) |
| `features[].properties.status` | El estado guardado: el enum completo, no sólo el que se pidió |
| `features[].properties.type` | El **código** del catálogo (`POTHOLE`), para el cliente: es lo que se puede comparar y programar |
| `features[].properties.type_name` | El nombre en español (`Pozo`), para la persona que modera: sin él, la tabla mostraría códigos |
| `features[].properties.severity` | La severidad que percibió quien reporta |
| `features[].properties.description` | Lo que escribió quien reporta, entero: recortarlo al listarlo es del cliente |
| `features[].properties.image_url` | La foto, o `null` si el reporte no tiene: un reporte sin foto es completo (§2) |
| `features[].properties.obstacle_id` | El obstáculo que creó la aprobación, o `null` mientras no se aprobó (§7.1). Es lo que el portal muestra como "obstáculo #N" |
| `features[].properties.created_at` | La fecha, en ISO 8601 con zona: el cliente no tiene que interpretar la zona horaria del driver |

**El código y el nombre viajan juntos, y no es redundancia.** `type` es el nombre
estable del catálogo, el que ya usa el `POST` (§2) y el que un cliente compara; `type_name`
es el texto que la persona lee. Mandar sólo el código obligaría a cada cliente a
replicar la traducción, y una segunda copia del catálogo se desincroniza cada vez que
se agrega un tipo.

**El filtro por estado es del servidor.** `status` va en la consulta y no se descarta
en el cliente: la lectura devuelve un estado por vez porque traerlos todos y filtrar en
el navegador crecería con lo que la moderación acumule, y la pantalla de reportes
necesita un estado por vez de todas formas. El default es `PENDING`, que es la cola de
trabajo del moderador: lo que alguien reportó y nadie miró todavía es lo que la
pantalla abre sin pedir nada.

**La query es estricta.** Un estado fuera del enum, un `?status=` vacío o un parámetro
que el contrato no tiene (`?staus=PENDING`) son `400 VALIDATION_ERROR` con el campo
nombrado (§5). Aceptar el parámetro mal escrito y devolver los pendientes sería peor
que un error: quien lo escribió creería que el filtro se aplicó.

**El tope y el recorte son los del grafo.** La respuesta trae como mucho **2000**
features y avisa con `"truncated": true` cuando había más
([14 §5.1](14-la-api-del-grafo.md)). El número no es una regla de negocio —la cola real
son decenas de reportes— sino la misma red: que un pedido no arme una respuesta de
decenas de megabytes. El orden es **determinístico**, `created_at DESC, id DESC`: de
él depende qué entran cuando la respuesta se recorta, así que dos pedidos iguales
recortan en el mismo lugar y lo que se ve primero es siempre lo más nuevo.

**No hay `bbox`.** El grafo lo tiene porque la unidad de trabajo del moderador es el
área; la de los reportes es la fila: se revisan en una lista y uno por vez. El mapa los
dibuja sólo como capa y sólo los `PENDING` ([16 §5.8](16-el-portal.md#58-el-panel-de-capas)),
que es la cola de trabajo, y para eso no hace falta área. Se revisa el día que la lista
deje de ser una cola de un solo estado y haya que mirar reportes de una zona: ahí el área
vuelve a tener sentido y se pide como en el grafo.

**Los dados de baja no aparecen, en ningún estado y sin parámetro.** La baja de un
reporte es `deleted_at`, no un estado del enum ([09 §4.5](09-modelo-de-datos.md)), así
que la consulta la excluye siempre: un reporte dado de baja no es "otro estado del
reporte", es un reporte que ya no está. No hay `?include_deleted`: nadie lo pidió y
sería una segunda forma de leer lo mismo.

**La lectura no escribe nada.** No hay caché ni tabla intermedia: dos pedidos iguales
devuelven lo mismo mientras el dato no cambie. Las transiciones de estado son de la
moderación (§7.1), y son ellas las que invalidan la lista del portal
([16 §8](16-el-portal.md#8-las-pantallas-el-mapa-de-la-aplicación)).

**`obstacle_id` viaja con el reporte y no es redundancia.** Es la columna que escribe la
aprobación y lo único que une un reporte `APPROVED` con el obstáculo que creó: sin ella, el
portal tendría que adivinar cuál de los obstáculos del elemento es el de este reporte. Un
reporte que nunca se aprobó la lleva en `null`.

### 7.1 La moderación

Son las dos transiciones que el moderador toma sobre un reporte, y el único camino por el
que un reporte llega al ruteo. El detalle —el pegamento al elemento del grafo, el orden de
las escrituras y la forma de la respuesta de la aprobación— está en
[18 §6](18-la-api-de-obstaculos.md#6-el-puente-de-un-reporte-a-un-obstáculo); acá queda el
contrato de la transición:

| Acción | Pedido | Respuesta | Qué escribe |
| --- | --- | --- | --- |
| Aprobar | `POST /api/reports/{id}/approve` con `{ type, severity }` | `201` con `{ obstacle, report: { id, status, obstacle_id } }` | Crea el obstáculo en el punto del reporte y marca `APPROVED` con `obstacle_id` |
| Descartar | `POST /api/reports/{id}/reject`, sin cuerpo | `200` con `{ id, status: 'REJECTED', obstacle_id: null }` | Marca `REJECTED` y no crea nada |

**El cuerpo de la aprobación es la clasificación del moderador**, no la del ciudadano: el
`type` no acepta `OTHER` y el punto sale del reporte, porque aprobar clasifica lo que
alguien reportó y no mueve el pin ([09 §4.5](09-modelo-de-datos.md#45-reporte-y-obstáculo)).

**Los errores son los mismos en las dos acciones**: `404` si el reporte no existe o está
dado de baja, y `409 CONFLICT` si su estado ya no es `PENDING`. La decisión se toma una sola
vez, así que repetirla no es idempotente: es una segunda decisión sobre lo mismo. La
excepción que sí es un `400` y no un `409` es un punto sin ningún elemento del grafo cerca:
el reporte sigue `PENDING` y el moderador lo descarta o lo revisa
([18 §6](18-la-api-de-obstaculos.md#6-el-puente-de-un-reporte-a-un-obstáculo)).

**Los dos estados no se sincronizan.** Resolver el obstáculo no toca el reporte, que sigue
`APPROVED`, y `UNDER_REPAIR` y `RESOLVED` quedan sin uso en el MVP. Es un límite conocido
([09 §4.5](09-modelo-de-datos.md#45-reporte-y-obstáculo),
[18 §8](18-la-api-de-obstaculos.md#8-lo-que-este-documento-no-decide)).

## 8. Lo que este documento no decide

- **La autenticación y el autor del reporte.** Es Fase 3; hoy no hay usuario
  ([07 §3](07-plan-de-trabajo.md)).
- **El detalle de la moderación.** Cómo se pega el punto al grafo y en qué orden se
escribe está en [18 §6](18-la-api-de-obstaculos.md#6-el-puente-de-un-reporte-a-un-obstáculo);
este documento sólo fija la transición (§7.1).
- **Volver a moderar un reporte ya moderado.** `APPROVED` y `REJECTED` son finales; no hay
  endpoint que deshaga la decisión.
- **El detalle de un reporte como recurso propio.** El portal muestra lo que devuelve
  la lectura (§7); un `GET /api/reports/{id}` con el historial de moderación no
  existe todavía.
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

## 9. Documentos relacionados

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
- [18-la-api-de-obstaculos.md](18-la-api-de-obstaculos.md): el obstáculo que crea la
  aprobación, su lectura y su cierre.
- [16-el-portal.md](16-el-portal.md): la pantalla que lee esta lista (§7).
- [07-plan-de-trabajo.md](07-plan-de-trabajo.md): fases y casos de uso.

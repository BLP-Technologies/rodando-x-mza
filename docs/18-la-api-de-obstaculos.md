# La API de obstáculos

> Documento temático. Define el contrato de C012 y C013 —publicar y resolver un obstáculo—
> y el puente que los crea a partir de un reporte: qué recibe cada endpoint, qué valida, qué
> devuelve y qué no hace. Es el estado vivo de esas decisiones: se edita en su lugar cuando
> cambian. Se complementa con [09-modelo-de-datos.md](09-modelo-de-datos.md), que define el
> reporte y el obstáculo y el costo de las aristas, con
> [17-la-api-de-reportes.md](17-la-api-de-reportes.md), que define el reporte ciudadano, con
> [04-errores-y-mensajes.md](04-errores-y-mensajes.md), que define la forma del error, y con
> [16-el-portal.md](16-el-portal.md), que define las pantallas que los usan.

## 1. Alcance

Este documento responde:

- **Qué es un obstáculo** y cómo se cierra (§2).
- **Cómo se publica** uno nuevo, y quién decide a qué elemento del grafo se cuelga (§3).
- **Qué devuelve** la lectura, campo por campo, y qué filtra (§4).
- **Cómo se resuelve**, y por qué repetirlo no es un error (§5).
- **Cómo se crea desde un reporte**, en qué orden se escribe y qué pasa cuando falla (§6).
- **Cómo se rechaza** un pedido (§7).

La API de obstáculos son **tres endpoints sobre el obstáculo** y dos sobre el reporte que
lo origina:

- `GET /api/obstacles` lee los obstáculos de un estado (§4).
- `POST /api/obstacles` publica uno (§3).
- `POST /api/obstacles/{id}/resolve` lo cierra (§5).
- `POST /api/reports/{id}/approve` y `POST /api/reports/{id}/reject` son la moderación, que
  crea el obstáculo o descarta el reporte (§6).

No decide la forma del grafo —es de [11](11-grafo-peatonal.md)—, ni el envío de un reporte
—es de [17](17-la-api-de-reportes.md)—, ni el catálogo de errores, que es de
[04](04-errores-y-mensajes.md). Tampoco autentica: el `PATCH` del nivel y estas escrituras
siguen sin pedir credenciales hasta la Fase 3 ([07 §3](07-plan-de-trabajo.md)).

**Ninguna de estas escrituras toca el grafo.** El obstáculo es un evento que la vista
`walkable_edges` lee al calcular el costo: publicarlo no actualiza ninguna arista y
resolverlo no revierte nada ([09 §4.7](09-modelo-de-datos.md#47-el-costo-de-las-aristas-se-calcula-no-se-guarda)).

## 2. Qué es un obstáculo, y cómo se cierra

Un obstáculo es una **barrera puntual** que el moderador publica: un pozo, una obra, una
rampa que falta. Tiene tipo, severidad, un punto y un vínculo con **un** elemento del grafo
—vereda, cordón o cruce—, y esa combinación es la que entra en el costo del ruteo
([09 §4.5](09-modelo-de-datos.md#45-reporte-y-obstáculo)).

**El estado es una fecha, no un booleano.** `obstacles.resolved_at` es `NULL` mientras la
barrera está en la calle y tiene la fecha del cierre cuando se resolvió:

| `resolved_at` | Estado | Qué hace en el ruteo |
| --- | --- | --- |
| `NULL` | Activo | Suma su penalización, o bloquea si es `CRITICAL` |
| con fecha | Resuelto | No cuenta |

Un booleano `is_resolved` al lado de la fecha sería la misma verdad escrita dos veces, y la
vista tendría que leer las dos. Por eso no existe: **un obstáculo activo es el que tiene
`resolved_at IS NULL`** ([09 §4.5 y §4.7](09-modelo-de-datos.md#47-el-costo-de-las-aristas-se-calcula-no-se-guarda)).

**El cierre es de una sola dirección.** Resolver escribe la fecha y no hay endpoint que la
borre: si la barrera vuelve a aparecer, se publica un obstáculo nuevo. Volver a abrir el
mismo registraría un cierre que ocurrió —el dato dejaría de ser histórico— para ahorrar una
fila.

**La baja no es un estado.** `obstacles.deleted_at` saca la fila del mapa y de la lectura,
pero no la borra; no hay endpoint de baja en el MVP ([09 §4.5](09-modelo-de-datos.md#45-reporte-y-obstáculo)).

## 3. El alta

`POST /api/obstacles`

El contrato se publica generado desde los esquemas Zod en `GET /api/openapi.json`
([02 §6](02-stack-y-estructura.md#6-contrato-de-la-api)): el Zod es la fuente y el documento
es su lectura.

```json
{ "type": "POTHOLE", "severity": "MODERATE", "geom": { "lon": -68.8444, "lat": -32.8897 } }
```

| Campo | Para qué |
| --- | --- |
| `type` | Qué barrera es, por **código** del catálogo `obstacle_types` |
| `severity` | Cuánto afecta al paso: `MINOR`, `MODERATE` o `CRITICAL` ([09 §4.7](09-modelo-de-datos.md#47-el-costo-de-las-aristas-se-calcula-no-se-guarda)) |
| `geom` | Dónde está, en WGS 84, con `lon` y `lat` por nombre |

Tres decisiones detrás de esa forma:

- **No hay `element` en el cuerpo.** El vínculo lo decide el servidor, pegando el punto al
  elemento más cercano (§3.1). El moderador elige dónde está la barrera, que es lo que sabe;
  cuál es la arista que corresponde es una cuenta que hace el servidor sobre el grafo.
- **`type` no acepta `OTHER`.** `OTHER` es la percepción del ciudadano y el moderador
  clasifica con el tipo que corresponde, así que un obstáculo nunca queda en `OTHER`
  ([09 §4.5](09-modelo-de-datos.md#45-reporte-y-obstáculo)). El catálogo se resuelve en el
  mismo `INSERT ... SELECT` que escribe la fila, igual que en los reportes: cero filas
  devueltas significa que no hay ningún tipo activo con ese código que no sea `OTHER`, y es
  un `400` con `field: "type"` ([17 §3](17-la-api-de-reportes.md#3-la-respuesta)).
- **El punto se guarda tal como llegó.** El pegamento decide el vínculo y **no mueve el
  pin**: el obstáculo está donde el moderador vio la barrera, no donde el mapa cree que está
  la vereda. Si el pin se moviera al elemento, dos clics distintos en la misma cuadra
  terminarían en el mismo lugar y el detalle dejaría de ser el que se eligió.

`201` con el obstáculo creado, en la **misma forma que una feature de la lectura** (§4):

```json
{
  "type": "Feature",
  "geometry": { "type": "Point", "coordinates": [-68.8444, -32.8897] },
  "properties": {
    "id": 7,
    "type": "POTHOLE",
    "type_name": "Pozo",
    "severity": "MODERATE",
    "resolved_at": null,
    "element_kind": "sidewalk",
    "element_id": 132,
    "reports_count": 0,
    "created_at": "2026-11-03T18:20:11.402Z"
  }
}
```

Devuelve el obstáculo entero y no un `201` con el `id`: el servidor decidió el vínculo y la
fecha, así que el cliente necesita ver qué quedó guardado para dibujarlo sin volver a pedir
la colección.

### 3.1 El pegamento: el elemento más cercano

El alta busca el elemento del grafo **más cercano** al punto y escribe **una** de las tres
columnas del vínculo —`sidewalk_id`, `kerb_node_id` o `crossing_id`—, así el
`CHECK obstacles_element_check` nunca ve dos.

- **Las tres clases compiten en la misma consulta.** Gana la que esté más cerca, medida con
  `ST_Distance(...::geography)`: **metros reales**, no grados, por el mismo motivo que el
  costo ([09 §4.7](09-modelo-de-datos.md#47-el-costo-de-las-aristas-se-calcula-no-se-guarda)).
  Filtrar primero por clase dejaría un `kerb_node` a un metro perdiendo contra una vereda a
  veinte.
- **A igual distancia gana el más chico: el cordón antes que la arista.** Un punto que cae
  justo sobre una esquina está a distancia cero de las dos veredas que salen de ahí, del
  cruce y del cordón. Sin un orden explícito, el mismo pin daría un obstáculo distinto en
  cada alta; y el cordón es el dueño natural de lo que pasa en la esquina —`MISSING_RAMP`
  vive ahí— ([09 §4.5](09-modelo-de-datos.md#45-reporte-y-obstáculo)). El desempate completo
  es distancia, clase e `id`, así que es determinístico.
- **El radio es una constante, no un contrato.** Hoy son **30 m**
  (`GLUE_RADIUS_METERS` en `obstacles.sql.ts`): cubren una vereda y la calzada de al lado,
  que es donde cae el pin cuando alguien apunta a una esquina. Es un **punto de partida** y
  se ajusta midiendo altas reales; lo que no cambia con el número es la forma del rechazo
  (§7).
- **Sin elemento cerca, no hay obstáculo.** Un obstáculo sin vínculo no cambia ningún costo,
  y el modelo ya no lo permite como caso normal: el alta falla con `NO_NEARBY_ELEMENT` y no
  escribe nada. Es la única razón de dominio nueva de este contrato
  ([04 §4](04-errores-y-mensajes.md#4-catálogo-de-códigos)).

El orden de los dos chequeos es **primero el punto, después el tipo**: si el pedido no tiene
ni elemento cerca ni un tipo válido, el cliente recibe el error del punto, que es el que
suele requerir mover el pin en el mapa.

**El pegamento se reusa.** La aprobación de un reporte crea su obstáculo con esta misma
función y el punto del reporte (§6), así que las dos puertas de alta se comportan igual.

## 4. La lectura

`GET /api/obstacles?status=ACTIVE|RESOLVED|ALL`

La forma es la del grafo —una `FeatureCollection` de GeoJSON con `truncated` al lado de
`type`— porque el consumidor es el mismo portal que ya sabe leer una
([14 §5](14-la-api-del-grafo.md#5-la-respuesta)).

```json
{
  "type": "FeatureCollection",
  "truncated": false,
  "obstacle_types": [{ "code": "POTHOLE", "name": "Pozo" }],
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-68.8444, -32.8897] },
      "properties": {
        "id": 7,
        "type": "POTHOLE",
        "type_name": "Pozo",
        "severity": "MODERATE",
        "resolved_at": null,
        "element_kind": "sidewalk",
        "element_id": 132,
        "reports_count": 3,
        "created_at": "2026-11-03T18:20:11.402Z"
      }
    }
  ]
}
```

| Campo | Para qué |
| --- | --- |
| `type` | `FeatureCollection`, igual que el grafo |
| `truncated` | Si la respuesta trae todos los obstáculos del estado o sólo los más nuevos (§4.1) |
| `obstacle_types` | Los tipos que un obstáculo puede tener: activos y sin `OTHER`, para el formulario del portal (§4.2) |
| `features[].geometry` | El punto donde se publicó, vía `ST_AsGeoJSON`, en orden `[lon, lat]` |
| `features[].properties.id` | La referencia del obstáculo: la misma que devolvió el alta |
| `features[].properties.type` | El **código** del catálogo, para el cliente |
| `features[].properties.type_name` | El nombre en español, para la persona que modera |
| `features[].properties.severity` | La severidad que decidió el moderador |
| `features[].properties.resolved_at` | La fecha del cierre, en ISO, o `null` si sigue activo. Es el único dato de estado |
| `features[].properties.element_kind` | De qué clase es el elemento al que está pegado: `sidewalk`, `crossing` o `kerb` |
| `features[].properties.element_id` | El `id` de ese elemento. Junto con `element_kind` es la clave del elemento del grafo |
| `features[].properties.reports_count` | Cuántos reportes lo apuntan sin baja y sin estar rechazados |
| `features[].properties.created_at` | La fecha de publicación, en ISO con zona |

**`element_kind` y `element_id` traducen las tres columnas a un par.** En la base el vínculo
son tres columnas nullables ([09 §4.5](09-modelo-de-datos.md#45-reporte-y-obstáculo));
exponerlas así obligaría a cada cliente a preguntar cuál está escrita. El par usa los
**mismos nombres que una feature del grafo**, así que comparar un obstáculo con el elemento
que el mapa ya tiene es una igualdad y no una traducción
([14 §5](14-la-api-del-grafo.md#5-la-respuesta)).

**`reports_count` cuenta lo que sigue vigente**: los reportes que apuntan al obstáculo, sin
baja y con `status <> 'REJECTED'`. Un reporte descartado no es un aviso de la calle, y
contarlo inflaría la cifra que el moderador usa para decidir si el obstáculo es real
([09 §4.5](09-modelo-de-datos.md#45-reporte-y-obstáculo)).

**El filtro por estado es del servidor**, con `ACTIVE` por defecto: lo que está en la calle
es lo que la pantalla abre sin pedir nada, y `ALL` existe para que la ficha de un elemento
muestre también su historia ([16 §5.6](16-el-portal.md#56-la-ficha-y-la-edición-del-nivel)).
La query es **estricta**: un estado fuera del enum, un `?status=` vacío o un parámetro que
el contrato no tiene son `400 VALIDATION_ERROR` con el campo nombrado, igual que en los
reportes ([17 §7](17-la-api-de-reportes.md#7-la-lectura-de-reportes)). Aceptar el parámetro
mal escrito y devolver todo sería peor que un error: quien lo escribió creería que el filtro
se aplicó.

**Los dados de baja no aparecen, en ningún estado.** `deleted_at` no es un estado más: es
una fila que ya no está ([09 §4.5](09-modelo-de-datos.md#45-reporte-y-obstáculo)).

**No hay `bbox`.** El obstáculo es puntual y la pantalla que lo mira es la zona entera; el
área tiene sentido para el grafo, que se dibuja por partes ([14 §3](14-la-api-del-grafo.md#3-el-pedido)).

### 4.1 El tope y el recorte

La respuesta trae como mucho **2000** obstáculos y avisa con `"truncated": true` cuando
había más, con la misma mecánica que el grafo y los reportes: se pide una fila de más para
distinguir "entraron justo 2000" de "había más"
([14 §5.1](14-la-api-del-grafo.md#51-el-tope-de-2000-y-el-aviso-de-que-se-recortó)). El orden
es determinístico —`created_at DESC, id DESC`—, así que dos pedidos iguales recortan en el
mismo lugar y lo que se ve primero es lo más nuevo. El número no es una regla de negocio: es
la misma red contra una respuesta de decenas de megabytes.

### 4.2 El catálogo del formulario

`obstacle_types` es **hermano de `features`**, con el mismo criterio que `service_areas` en
la lectura del grafo: no es un obstáculo, no lo recorta el tope y el formulario lo necesita
entero ([14 §5.2](14-la-api-del-grafo.md#52-el-área-de-servicio)).

Son los tipos **activos y distintos de `OTHER`**, resueltos en la misma lectura: el portal
no copia el catálogo en el cliente ni hace un segundo viaje, y una copia en el navegador se
desincronizaría cada vez que se agrega un tipo al catálogo.

## 5. Resolver

`POST /api/obstacles/{id}/resolve` — sin cuerpo.

Escribe `resolved_at` y devuelve `200` con el obstáculo resuelto, en la misma forma de la
lectura. Desde la consulta siguiente deja de sumar en el ruteo, sin recalcular nada
([09 §4.7](09-modelo-de-datos.md#47-el-costo-de-las-aristas-se-calcula-no-se-guarda)).

- **Es idempotente.** Resolver un obstáculo ya resuelto responde `200` con el mismo
  obstáculo y **no toca `resolved_at`**, que conserva la fecha del primer cierre. No hay un
  `409` porque el segundo pedido no quiere otra cosa que el obstáculo esté resuelto: es el
  mismo caso que un reintento de red, y castigarlo obligaría al cliente a distinguir "ya
  estaba" de "falló".
- **`404` si el id no existe o está dado de baja.** Para quien pregunta, ese obstáculo no
  está.
- **Resolver no toca `reports`.** El estado del reporte y el del obstáculo no se
  sincronizan en el MVP (§8).

## 6. El puente: de un reporte a un obstáculo

La moderación son dos acciones sobre un reporte, y son el único camino por el que un reporte
se convierte en algo que el ruteo cobra.

`POST /api/reports/{id}/approve` con la clasificación del moderador:

```json
{ "type": "POTHOLE", "severity": "MODERATE" }
```

**El punto no viaja: sale del reporte.** El reporte dijo dónde está el problema y el
moderador decide qué es y cuán grave; aprobar no mueve el pin. El cuerpo es estricto, así
que mandar `geom` es un `400` que lo nombra.

`201` con los dos recursos que cambiaron:

```json
{
  "obstacle": { "type": "Feature", "geometry": { "…": "…" }, "properties": { "…": "…" } },
  "report": { "id": 1, "status": "APPROVED", "obstacle_id": 7 }
}
```

**Una transacción, y en este orden:**

1. Leer el reporte con `FOR UPDATE` y sin `deleted_at`: `404` si no está.
2. `409` si su estado no es `PENDING`: ya se moderó.
3. Pegar el punto **del reporte** al elemento más cercano (§3.1). Si no hay ninguno, el
   pedido falla con `NO_NEARBY_ELEMENT` y **el reporte sigue `PENDING`**, porque la
   transacción se deshace entera.
4. Insertar el obstáculo.
5. `UPDATE reports SET status = 'APPROVED', obstacle_id = <id>`.

Las tres escrituras van juntas para que no quede un reporte `APPROVED` sin obstáculo ni un
obstáculo huérfano de una aprobación que falló a la mitad. El bloqueo de la fila es lo que
hace que dos moderaciones simultáneas no creen dos obstáculos: la segunda espera, ve el
estado que dejó la primera y responde `409`
([09 §4.5](09-modelo-de-datos.md#45-reporte-y-obstáculo)).

**La respuesta vuelve a leer el obstáculo después de marcar el reporte**, para que
`reports_count` incluya el reporte recién aprobado y la respuesta no se contradiga con la
fila que devuelve al lado.

`POST /api/reports/{id}/reject` — sin cuerpo. En una transacción, bloquea el reporte, exige
`PENDING` (`404` y `409` como arriba) y escribe `REJECTED`. Responde `200` con
`{ "id": 1, "status": "REJECTED", "obstacle_id": null }`: rechazar no crea nada.

**Aprobar es la única forma de crear un obstáculo desde un reporte, y el camino es de un
solo sentido.** No hay endpoint que deshaga una moderación, y `REJECTED` y `APPROVED` son
finales: para revisar una decisión se cambia el estado en la base, que es una decisión de
operación y no del contrato.

## 7. Cómo se rechaza

| Situación | Status | Respuesta |
| --- | --- | --- |
| Falta un campo del alta o está mal formado | 400 | `VALIDATION_ERROR` con `details: [{ field, code: "REQUIRED" \| "INVALID" }]` |
| Un campo de más en el cuerpo | 400 | `VALIDATION_ERROR` con `details: [{ field: "<la clave>", code: "INVALID" }]` |
| El código de tipo no existe, está inactivo o es `OTHER` | 400 | `VALIDATION_ERROR` con `details: [{ field: "type", code: "INVALID" }]` |
| No hay ningún elemento del grafo dentro del radio de pegamento | 400 | `VALIDATION_ERROR` con `details: [{ field: "geom", code: "NO_NEARBY_ELEMENT" }]` |
| `status` fuera del enum, vacío, o un parámetro de más | 400 | `VALIDATION_ERROR` con `details: [{ field: "status" \| "<la clave>", code: "INVALID" }]` |
| El `id` de la ruta no es un entero positivo | 400 | `VALIDATION_ERROR` con `details: [{ field: "id", code: "REQUIRED" \| "INVALID" }]` |
| El obstáculo o el reporte no existe, o está dado de baja | 404 | `NOT_FOUND`, sin detalles |
| El reporte ya no está `PENDING` | 409 | `CONFLICT`, sin detalles |
| Cualquier fallo de la base | 500 | `INTERNAL_ERROR`, sin detalles ([04 §5](04-errores-y-mensajes.md#5-errores-esperables-y-no-esperables)) |

`NO_NEARBY_ELEMENT` es el único motivo de dominio nuevo, y va en el catálogo de
[04 §4](04-errores-y-mensajes.md#4-catálogo-de-códigos). Es aparte de `INVALID` porque no
dice "este campo está mal": dice **qué hacer** —elegir un punto más cerca del recorrido
peatonal—, y el portal lo traduce con ese texto.

**Un solo `INVALID` para el tipo inexistente, el inactivo y `OTHER`.** Para el cliente la
acción es la misma —elegir otro tipo del catálogo— y distinguirlos no le cambiaría el
mensaje, igual que en los reportes ([17 §5](17-la-api-de-reportes.md#5-cómo-se-rechaza)).

## 8. Lo que este documento no decide

- **La desincronización entre el estado del reporte y el del obstáculo.** Resolver un
  obstáculo no toca el reporte que lo originó, y los estados `UNDER_REPAIR` y `RESOLVED` del
  enum de reportes quedan sin uso. Un reporte `APPROVED` cuyo obstáculo ya se resolvió sigue
  diciendo `APPROVED`, que es lo que ocurrió —se aprobó— y no el estado de la barrera. Si
  algún día se quiere la historia completa en un solo lugar, se agrega una escritura al
  resolver; hoy serían dos fuentes que hay que mantener de acuerdo para una pantalla que no
  la necesita.
- **La autenticación y quién publica.** Es Fase 3 ([07 §3](07-plan-de-trabajo.md)).
- **La baja de un obstáculo.** `deleted_at` existe en el esquema pero no hay endpoint: el
  camino normal es resolverlo. Borrar es para un obstáculo cargado por error.
- **Volver a activar un obstáculo resuelto.** Se publica uno nuevo (§2).
- **Editar el tipo, la severidad, el punto o el vínculo de un obstáculo ya publicado.** Hoy
  se resuelve y se publica otro; una edición necesita su propio contrato y su propio
  historial.
- **El filtro por elemento, por tipo o por severidad en la lectura.** El cliente filtra lo
  que ya recibió, que es gratis: la ficha de un elemento lo hace así
  ([16 §5.6](16-el-portal.md#56-la-ficha-y-la-edición-del-nivel)). Se agrega como parámetro
  cuando haya que pedir sólo una parte.
- **Partir la arista en el punto del obstáculo.** Bloquear bloquea la cuadra entera; el
  arreglo correcto está descrito y descartado por ahora en
  [09 §4.7](09-modelo-de-datos.md#47-el-costo-de-las-aristas-se-calcula-no-se-guarda).
- **Los índices parciales de obstáculos activos.** Los que hay filtran por `IS NOT NULL`,
  no por estado ([09 §4.7](09-modelo-de-datos.md#47-el-costo-de-las-aristas-se-calcula-no-se-guarda));
  se agregan con la medición a la vista.
- **El texto que ve el moderador.** Lo escribe el portal a partir de los códigos
  ([04 §6](04-errores-y-mensajes.md#6-el-texto-que-ve-el-usuario)).

## 9. Documentos relacionados

- [09-modelo-de-datos.md](09-modelo-de-datos.md): el obstáculo, su relación con el reporte y
  el costo que deriva la vista.
- [17-la-api-de-reportes.md](17-la-api-de-reportes.md): el reporte ciudadano y la moderación
  que lo convierte en obstáculo.
- [04-errores-y-mensajes.md](04-errores-y-mensajes.md): la forma del error y el catálogo de
  motivos, incluido `NO_NEARBY_ELEMENT`.
- [14-la-api-del-grafo.md](14-la-api-del-grafo.md): la lectura del grafo, de donde salen los
  elementos a los que se pega un obstáculo.
- [16-el-portal.md](16-el-portal.md): la pestaña de obstáculos y la ficha del elemento.
- [07-plan-de-trabajo.md](07-plan-de-trabajo.md): las fases y los casos de uso C012 y C013.

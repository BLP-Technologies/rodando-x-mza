# La API del grafo

> Documento temático. Define el contrato de la API del grafo: qué área recibe la lectura,
> cómo la valida, qué devuelve, cómo se escribe el nivel de un elemento y qué no hace.
> Es el estado vivo de esas decisiones: se edita en su lugar cuando cambian. Se
> complementa con [09-modelo-de-datos.md](09-modelo-de-datos.md), que define los enums de
> accesibilidad, con [11-grafo-peatonal.md](11-grafo-peatonal.md), que define las tablas y
> la vista del grafo, y con [04-errores-y-mensajes.md](04-errores-y-mensajes.md), que
> define la forma del error.

## 1. Alcance

Este documento responde:

- **Con qué entrada** se lee el grafo, y por qué un bbox (§3).
- **Qué significa "interseca"** en el filtro (§4).
- **Qué devuelve**, campo por campo, cómo avisa que recortó y qué área de servicio activa
  incluye (§5), y por qué esa área tiene además su propio endpoint (§5.2).
- **Cómo se rechaza** un pedido (§6).
- **Cómo se escribe** el nivel de un elemento, y qué queda verificado (§7).

No decide la forma del grafo —es de [11](11-grafo-peatonal.md)—, ni qué significa cada
nivel —es de [09 §4.1](09-modelo-de-datos.md)—, ni el catálogo de errores, que es de
[04](04-errores-y-mensajes.md).

**La lectura no escribe nada.** No hay caché, ni tiles, ni una tabla intermedia: es una
lectura del grafo del momento, y por eso dos pedidos iguales devuelven lo mismo mientras
el dato no cambie. La única escritura de la API es el `PATCH` de §7, y escribe una sola
columna en una sola tabla.

## 2. Los dos límites que ordenan el diseño

1. **Sin ver no se puede moderar.** El portal tiene que poder dibujar veredas, cruces y
   cordones antes de tocar nada, y hoy la única forma de verlos es `psql`, pgAdmin o QGIS.
   Por eso lo que se lee es el grafo **entero de una zona**, no un elemento por vez: la
   unidad de trabajo del portal es el mapa, no la fila.
2. **La respuesta es GeoJSON, no una forma propia.** La geometría ya la guarda PostGIS y
   cualquier cliente de mapas lee `FeatureCollection` sin traducirla. Inventar una forma
   más plana obligaría al cliente a reconstruir geometrías con lo que ya viaja armado.

De ahí sale el resto: el área es la entrada porque **no hay geocoder ni búsqueda por
nombre de calle** ([13 §2](13-api-de-ruteo.md)), y el piloto entero son ~1000 elementos
(§5), así que no hace falta paginar.

## 3. El pedido

`GET /api/graph?bbox=<minLon>,<minLat>,<maxLon>,<maxLat>`

El contrato se publica generado desde los esquemas Zod en `GET /api/openapi.json`
([02 §6](02-stack-y-estructura.md)): el Zod es la fuente y el documento es su lectura.

- **Cuatro números separados por coma, en WGS 84 (SRID 4326), en orden
  `minLon,minLat,maxLon,maxLat`** —oeste, sur, este, norte—. Es el orden de un bbox de
  GeoJSON, no el `[lat, lon]` del pedido de ruteo
  ([13 §3](13-api-de-ruteo.md)): el que lo escribe lo está copiando de un mapa, y ahí el
  orden ya es ese.
- **`GET` y no `POST`**: lo único que viaja es el área, entra en la URL, y así el pedido
  se puede repetir con `curl` o desde la barra del navegador. Que no haya cuerpo no
  depende de que el endpoint escriba o no: no escribe (§1).
- **Un solo parámetro.** No hay `kind`, `level` ni `zoom`: el cliente filtra al dibujar,
  que es gratis, y un parámetro que nadie pidió es un contrato más que mantener (§7).
- **Se validan cuatro cosas**: que haya `bbox`, que sean cuatro números, que cada
  coordenada esté en rango (`lon` en −180…180, `lat` en −90…90) y que las esquinas sean
  coherentes (`minLon < maxLon`, `minLat < maxLat`). Lo que no cumple eso es
  `VALIDATION_ERROR` con el campo `bbox` (§6).
- **El área no se valida contra `service_areas`.** El ruteo rechaza una punta fuera del
  perímetro porque el pedido es "llevenme de A a B" ([13 §4.1](13-api-de-ruteo.md)); acá
  el pedido es "mostrame lo que hay", y el búfer del extracto también es grafo que el
  moderador tiene que poder ver.

## 4. Qué se filtra, y por qué alcanza

Se devuelven los elementos cuya geometría **interseca** el bbox. El filtro es el operador
`&&` contra la columna `geom`, que compara las cajas de las dos geometrías: es el que usa
el índice GiST, y las tres tablas tienen uno
([11](11-grafo-peatonal.md), migración `create-graph-tables`).

Una consecuencia explícita: **un elemento cuya caja pisa el área pero cuya geometría no
pasa por ella entra igual**. Es un caso de esquina —una diagonal larga contra la esquina
del bbox— y devolverlo de más no rompe el dibujo, porque el cliente recorta al dibujar;
filtrar de menos sí dejaría huecos. A cambio, la consulta es de índice, que es lo que
pide un endpoint que el mapa llama en cada paneo.

**Los cordones son puntos y entran por el borde.** `&&` incluye el contacto, así que un
cordón justo en el borde del área aparece: es el vértice donde se juntan dos veredas, y
dejar afuera un extremo rompería la unión que el cliente necesita dibujar.

**Una sola consulta por pedido.** Las tres tablas son la misma pregunta —qué hay de esta
clase en esta área— así que van en un `UNION ALL` con su `ORDER BY` (§5), no en tres
consultas que el servicio tenga que juntar.

## 5. La respuesta

`200` con el grafo del área:

```json
{
  "type": "FeatureCollection",
  "truncated": false,
  "service_areas": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "geometry": {
          "type": "Polygon",
          "coordinates": [
            [
              [-68.84788777, -32.8852519],
              [-68.83923548, -32.88685409],
              [-68.84113316, -32.89416301],
              [-68.84980259, -32.89256194],
              [-68.84788777, -32.8852519]
            ]
          ]
        },
        "properties": { "id": 1, "name": "Zona piloto Fase 1" }
      }
    ]
  },
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-68.843969355, -32.893218907],
          [-68.844202692, -32.894110973],
          [-68.84423142, -32.89422089]
        ]
      },
      "properties": {
        "element_kind": "sidewalk",
        "element_id": 5,
        "level": null,
        "is_verified": false,
        "street_name": "Patricias Mendocinas"
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-68.843969, -32.893219] },
      "properties": {
        "element_kind": "kerb",
        "element_id": 3,
        "level": null,
        "is_verified": false
      }
    }
  ]
}
```

| Campo | Para qué |
| --- | --- |
| `type` | `FeatureCollection`, para que un cliente de GeoJSON lo lea sin condicionales |
| `truncated` | Si la respuesta trae **todas** las features del área o sólo las primeras (§5.1). No es parte de GeoJSON |
| `service_areas` | Las áreas de servicio activas, como su propia `FeatureCollection` (§5.2). No consume el tope de §5.1 ni se filtra por bbox. Es la misma colección que sirve `GET /api/service-areas` |
| `features[].geometry` | La geometría guardada, vía `ST_AsGeoJSON`, en orden `[lon, lat]`: `LineString` en veredas y cruces, `Point` en cordones |
| `features[].properties.element_kind` | De qué clase es el elemento: `sidewalk`, `crossing` o `kerb` |
| `features[].properties.element_id` | El `id` de su fila. Es la clave con la que el portal pide o edita el elemento: junto con `element_kind` identifica un elemento del grafo (§7) |
| `features[].properties.level` | El nivel **guardado** del elemento: `FULL`, `PARTIAL`, `NONE`, o `null` si nadie lo relevó ([09 §4.1](09-modelo-de-datos.md)) |
| `features[].properties.is_verified` | Si alguien miró lo que decidió ese nivel ([09 §4.1](09-modelo-de-datos.md)) |
| `features[].properties.street_name` | El nombre de la calle. **Sólo en veredas**, y puede ser `null`: hay filas del import sin nombre |
| `service_areas.features[].geometry` | El perímetro del área activa, vía `ST_AsGeoJSON`: siempre un `Polygon`, en orden `[lon, lat]` |
| `service_areas.features[].properties.id` | El `id` de la fila en `service_areas`. Es la clave estable del área en la respuesta |
| `service_areas.features[].properties.name` | El nombre del área, el mismo que la operación usa para nombrarla |

Cinco decisiones detrás de esa forma:

- **`street_name` existe sólo en la vereda.** Un cruce y un cordón no tienen nombre de
  calle en el modelo: mandar `street_name: null` en las tres clases diría que el dato
  podría estar y no está cargado, que es otra cosa.
- **`level` es el del elemento, no el derivado.** En un cruce, el nivel que cobra el
  ruteo sale de sus dos esquinas ([09 §4.7](09-modelo-de-datos.md)); acá se devuelve
  `crossings.accessibility_level` tal como está guardado. Son dos preguntas distintas: el
  ruteo quiere saber cuánto cuesta pasar, el portal quiere ver **qué dato hay** para
  corregirlo.
- **No se filtra por nivel.** Un elemento `NONE` también se devuelve, cuando exista: el
  portal tiene que poder mostrar el paso infranqueable para arreglarlo, a diferencia del
  ruteo, que lo saca del grafo ([13 §2](13-api-de-ruteo.md)).
- **No se expone el largo ni el costo.** Los metros de una arista y su costo son del
  ruteo ([09 §4.7](09-modelo-de-datos.md)); si el cliente necesita un largo, lo mide de
  la geometría que ya tiene.
- **El área de servicio es hermana de `type`, no una feature más.** No es un elemento del
  grafo: no la recorta el tope de 2000 (§5.1), no la filtra el bbox (§4) y el cliente la
  dibuja distinto. Metida en `features`, el cliente tendría que separarla por tipo antes
  de dibujar y el recorte podría dejarla afuera (§5.2).

### 5.1 El tope de 2000, y el aviso de que se recortó

La respuesta trae **como mucho 2000 features**. Si el área tiene más, devuelve las
primeras y `"truncated": true`.

El tope es de `features` y no alcanza a `service_areas`: el área activa viaja siempre,
entera, aunque el grafo venga recortado (§5.2).

- **El tope no es una regla de negocio, es una red.** El piloto entero son 977 features
  (329 veredas, 270 cruces, 378 cordones) y en un pedido normal no se llega; el número
  está para que un bbox de media provincia no arme una respuesta de decenas de megabytes
  contra un cliente que la va a dibujar igual de mal.
- **El aviso va al lado de `type`, no adentro de las features.** GeoJSON no tiene dónde
  decir "esto está incompleto", y una `FeatureCollection` recortada en silencio miente.
  Un campo extra en la raíz es lo que un cliente de GeoJSON ignora sin romperse y un
  humano ve de una.
- **Las primeras son un conjunto definido.** El orden es determinístico —primero
  veredas, después cruces y al final cordones; dentro de cada clase por `id`— así que dos
  pedidos iguales recortan en el mismo lugar. Sin eso, "las primeras" dependería del
  plan de la consulta.
- **No hay paginación ni cursor.** Con este tamaño, un cursor sería un contrato que hay
  que mantener para un caso que no ocurre. Si algún día ocurre, el cliente parte el área
  en áreas más chicas, que es lo que ya sabe hacer un mapa (§7).

**Medido.** Sobre el grafo del piloto, un pedido de todo el piloto —977 features, 230 KB
de JSON— tarda **del orden de 15 a 30 ms** de punta a punta por HTTP, y un bbox del
microcentro —131 features, 30 KB— **unos 6 a 10 ms en caliente**. La consulta en sí es de
**menos de 1 ms** (`EXPLAIN ANALYZE` sobre las tres tablas usa el índice GiST y devuelve 131
filas): el cuello es armar y transferir la respuesta, no la base. Es el costo aceptado de
devolver geometría real, y no hay caché que lo esconda (§1). Los números dependen de la
máquina; se vuelven a medir con el backend arriba y un `curl -w '%{time_total}'`.

### 5.2 El área de servicio

`service_areas` devuelve **las áreas de servicio activas**, con su polígono y su nombre.
La fila es la de [09 §4.8](09-modelo-de-datos.md): el perímetro dentro del que el ruteo
acepta las puntas de una consulta, que hoy es la zona piloto corrida 50 m hacia afuera.

El mismo conjunto se lee por **dos lados, con la misma forma**:

- **`GET /api/graph`**, en el campo `service_areas` de §5. Es lo que usa el portal, que ya
  pide el grafo: el área viaja en la respuesta que de todos modos está en camino.
- **`GET /api/service-areas`**, sin parámetros. Es lo que usa el mobile, que no pide el
  grafo: dibuja el polígono para decir si el pin de origen o destino está dentro de la
  zona, y para eso no necesita las ~1000 features ni tiene un bbox que mandar.

Las dos respuestas arman la colección con **la misma función** del backend —`readServiceAreas`,
en `backend/src/service-areas/`—: el dato es uno y no puede tener dos verdades, así que la
forma, el filtro y el orden salen de un solo lugar.

- **Se devuelven las activas, y se filtra por `is_active` y no por `id`.** El `id` de la
  zona vigente puede cambiar sin que el cliente se entere: reemplazar un perímetro es
  desactivar el viejo y activar el nuevo, y filtrar por `id` obligaría a fijar de antemano
  cuál es la fila buena ([09 §4.8](09-modelo-de-datos.md)).
- **Una colección vacía es válida.** Una base sin área activa no rompe ninguna de las dos
  lecturas: el grafo se devuelve igual y `service_areas.features` llega vacío, y el
  endpoint propio responde `features: []`. El ruteo sí la necesita y responde `500` sin
  ella ([13](13-api-de-ruteo.md)).
- **El endpoint propio no lleva parámetros ni autenticación.** Sin entrada que validar, el
  único caso es `200` (o `500` si falla la base). Es lo que necesita un cliente que no pide
  el grafo: el perímetro y nada más, sin un bbox de relleno.
- **No agrega encabezados de caché.** El MVP no resuelve caché (§8), así que la respuesta no
  lleva `Cache-Control` ni `Last-Modified` propios. Sí llega el `ETag` débil que Express le
  pone a **toda** respuesta JSON de la API, igual que en `GET /api/graph`: no es de este
  endpoint y el cliente no tiene que aprovecharlo. Apagarlo sólo acá sería una excepción sin
  motivo; si algún día molesta, la decisión es de la app entera.
- **Si algún día hay muchas zonas, se filtra por bbox y se pagina aparte.** Hoy hay una y
  el cliente las dibuja todas; cuando sean muchas, el recorte por área vuelve a tener
  sentido y el dato se pide solo.

## 6. Cómo se rechaza

| Situación | Status | Respuesta |
| --- | --- | --- |
| Falta `bbox` | 400 | `VALIDATION_ERROR` con `details: [{ field: "bbox", code: "REQUIRED" }]` |
| `bbox` que no son cuatro números | 400 | `VALIDATION_ERROR` con `details: [{ field: "bbox", code: "INVALID" }]` |
| Una coordenada fuera de rango | 400 | `VALIDATION_ERROR` con `details: [{ field: "bbox", code: "INVALID" }]` |
| Esquinas invertidas o de área cero | 400 | `VALIDATION_ERROR` con `details: [{ field: "bbox", code: "INVALID" }]` |
| El área no tiene grafo | 200 | Una `FeatureCollection` con `features: []`. No es un error |
| No hay área activa en `service_areas` | 200 | `service_areas.features: []`; el grafo se devuelve igual |
| No hay área activa, en `GET /api/service-areas` | 200 | `features: []`. No es un error, y es el único caso posible además de `500` (§5.2) |
| Cualquier fallo de la base | 500 | `INTERNAL_ERROR`, sin detalles ([04 §5](04-errores-y-mensajes.md)) |

**Un solo `INVALID` para los tres motivos, y no un `INVALID_RANGE` propio.** Los cuatro
chequeos son la misma pregunta con distinta respuesta —"¿este bbox sirve?"— y la acción
del cliente es la misma en los tres casos: rehacerlo. Distinguir "está al revés" de "se
fue de rango" no le cambia el mensaje ni la salida a quien lo arma, y
[04 §4](04-errores-y-mensajes.md#4-catálogo-de-códigos) pide no inventar motivos que no
cambien nada. `REQUIRED` sí es aparte: no es un bbox malformado, es uno que no vino.

Todo eso sigue [04](04-errores-y-mensajes.md): el backend no manda texto, manda códigos.

## 7. La edición del nivel

`PATCH /api/graph/elements/<kind>/<id>`

Escribe `accessibility_level` de un elemento y devuelve **el elemento**, con la misma
forma que una feature de la lectura (§5). Es la edición manual de C014, desde la ficha
del portal.

`kind` es `sidewalk`, `crossing` o `kerb`, y `id` el de su tabla: juntos son la
identidad de un elemento del grafo, la misma que ya viaja en `element_kind` y
`element_id`. Una clase fuera del enum, un `id` que no es entero positivo o un cuerpo que
no cumple el contrato son `VALIDATION_ERROR`; un `id` que no existe es `NOT_FOUND`, sin
importar que ese número exista en otra tabla.

**El cuerpo tiene un solo campo, y es obligatorio:**

```json
{ "level": "FULL" }
```

| `level` | Qué escribe |
| --- | --- |
| `FULL`, `PARTIAL`, `NONE` | El nivel, y el elemento queda **verificado** |
| `null` | "Sin dato": el nivel vuelve a `NULL` y el elemento queda **sin verificar** |

Tres decisiones detrás de esa forma:

- **`level` es obligatorio y nullable, y no `optional`.** El cuerpo tiene un campo solo,
así que no hay manera de distinguir "no lo mandé" de "lo mando en `null`" — y esa
distinción no puede quedar librada a una omisión, porque `null` borra el nivel. Omitirlo
es `400` con `field: "level"`, no un "no toques nada".
- **`is_verified` no viaja.** La escribe el servidor en la misma escritura, como
`level IS NOT NULL`: un nivel guardado es un nivel que alguien miró, y "sin dato" no es
un valor confirmado ([09 §4.1](09-modelo-de-datos.md),
[12 §8.2](12-relevamiento-de-accesibilidad.md)). El cuerpo es estricto, así que mandarlo
no se ignora en silencio: es `400` y el `details` nombra la clave.
- **Devuelve el elemento y no `204`.** El servidor decide la verificación, así que el
cliente necesita ver qué quedó guardado; devolver la feature con la misma forma de la
lectura le permite repintarla sin traducir nada.

**No recalcula nada.** El costo del ruteo se deriva de la vista
([09 §4.7](09-modelo-de-datos.md)), así que la próxima consulta de un recorrido ya cobra
el nivel nuevo, sin invalidar caché ni recalcular una tabla. Lo que sí cambia es
`updated_at`, que mueve el trigger de la tabla.

**El endpoint todavía no pide autenticación**: cualquiera que llegue a la API puede
escribir el nivel, aunque la autenticación ya exista ([20](20-autenticacion.md)). Es
coherente con el resto del MVP —ningún endpoint de negocio exige el token todavía
([20 §7](20-autenticacion.md))— y queda dicho acá para que nadie lea el `PATCH` como
protegido. Cuando se proteja, el permiso de moderador se valida en este mismo endpoint.

## 8. Lo que este documento no decide

- **El detalle de un elemento.** No hay `GET /api/graph/:kind/:id`: el mapa pide el área
y la ficha se arma con la feature que ya llegó (§5). Se agrega cuando haya un cliente que
necesite una ficha sin mapa.
- **La edición de otra cosa que el nivel.** `street_name` y la geometría no se editan
([16 §5.6](16-el-portal.md)); si alguna vez se edita la geometría, es otra tarea y otro
contrato.
- **La concurrencia.** Dos moderadores que guardan el mismo elemento: gana el último. No
hay versión ni `If-Match`, y agregarlos no es del MVP.
- **La auditoría de quién escribió.** El MVP no guarda autor
  ([09 §4.1](09-modelo-de-datos.md)).
- **La paginación, los tiles y la caché.** Hoy el tope avisa y el cliente parte el área
  si le importa (§5.1). Se revisa cuando aparezca un caso medido: el piloto entero entra
  en una respuesta.
- **El filtro por clase, por nivel o por "sin relevar".** El cliente filtra lo que ya
  recibió. Se agrega como parámetro cuando el área empiece a ser mucho más grande que lo
  que el portal dibuja.
- **El nivel derivado de un cruce.** Se devuelve el guardado (§5); si el portal necesita
  el que se cobra, es una consulta del ruteo
  ([09 §4.7](09-modelo-de-datos.md)), no un campo más acá.
- **La proyección y el estilo del mapa.** Cada cliente decide cómo lo dibuja; la API no
  manda colores ni simplificación.
- **El filtro de las áreas por bbox.** Se devuelven todas las activas: el área es el
  contexto de la zona y no un elemento del área pedida (§5.2).
- **Las áreas multiparte.** El tipo es `Polygon` y no `MultiPolygon`: una zona partida
  sería una migración **y** un cambio de tipo en el contrato, y hoy rompería la validación
  con un `500` porque el esquema Zod no la acepta.
- **El texto que ve el moderador.** Lo escribe el portal a partir de los códigos y de los
  elementos ([04 §6](04-errores-y-mensajes.md)).

## 9. Documentos relacionados

- [09-modelo-de-datos.md](09-modelo-de-datos.md): los enums de accesibilidad y el costo de
  las aristas.
- [11-grafo-peatonal.md](11-grafo-peatonal.md): las tablas del grafo, sus índices y la
  vista `walkable_edges`.
- [13-api-de-ruteo.md](13-api-de-ruteo.md): el otro consumidor del grafo, y el contraste
  entre el nivel guardado y el que se cobra.
- [04-errores-y-mensajes.md](04-errores-y-mensajes.md): la forma de la respuesta de error.
- [10-datos-y-zona-piloto.md](10-datos-y-zona-piloto.md): el recorte y el perímetro del
  piloto, que acá no se aplica como validación (§3).

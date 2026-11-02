# La API de ruteo

> Documento temático. Define el contrato de C003 —planificar un recorrido accesible—
> y de C004 —ver su detalle—: qué recibe, qué valida, qué devuelve y qué no hace. Es
> el estado vivo de esas decisiones: se edita en su lugar cuando cambian. Se
> complementa con [09-modelo-de-datos.md](09-modelo-de-datos.md), que define el costo
> de las aristas, con [11-grafo-peatonal.md](11-grafo-peatonal.md), que define la
> vista `walkable_edges` y las consultas de ruteo, y con
> [10-datos-y-zona-piloto.md](10-datos-y-zona-piloto.md), que define el perímetro de
> búsqueda.

## 1. Alcance

Este documento responde:

- **Con qué entrada** se pide un recorrido, y por qué son coordenadas (§3).
- **Cómo se validan y a qué se pegan** las dos puntas (§4).
- **Cómo se calcula** el recorrido (§5).
- **Qué pasa cuando no hay** recorrido accesible (§6).
- **Qué devuelve**, campo por campo (§7).
- **Cómo se rechaza** un pedido (§8).
- **Por qué el detalle es la misma respuesta** y no un recurso (§9).

No decide el costo de las aristas —vive en [09 §4.7](09-modelo-de-datos.md), y acá sólo
se consume—, ni cómo se deriva el grafo ([11](11-grafo-peatonal.md)), ni el catálogo de
errores, que es de [04](04-errores-y-mensajes.md).

**El endpoint no escribe nada.** Ni una fila, ni un contador, ni un caché: es una
consulta. Todo su estado es el grafo y los obstáculos del momento ([09 §4.7](09-modelo-de-datos.md)),
y por eso dos pedidos iguales devuelven lo mismo mientras el dato no cambie.

## 2. Los tres límites que ordenan el diseño

Antes del contrato, tres límites que explican casi todas las decisiones de abajo:

1. **La accesibilidad es binaria donde importa.** Un elemento relevado como `NONE` es
   intransitable y el recorrido **no pasa por ahí**, punto. No se encarece, no se
   penaliza, no se ofrece como alternativa: `walkable_edges` la cobra `-1` y pgRouting
   la saca del grafo ([09 §4.7](09-modelo-de-datos.md)). Una ruta que atraviesa un paso
   infranqueable es peor que la ausencia de ruta, porque manda a la persona hasta el
   obstáculo.
2. **No hay geocoder.** Nadie traduce "Necochea 120" a una coordenada: no hay servicio
   de direcciones y Google está descartado por licencia ([12 §7](12-relevamiento-de-accesibilidad.md)).
   Los puntos los produce el cliente con un pin sobre el mapa o con el GPS, y la API
   recibe coordenadas.
3. **El recorrido empieza y termina en un cordón.** La geometría que se devuelve es la
   de las aristas, no una prolongación hasta el punto pedido: extenderla afirmaría que
   ese tramo inventado también es accesible, y nadie lo relevó (§4.2).

## 3. El pedido

`POST /api/routes/calculate`

El contrato se publica generado desde los esquemas Zod en `GET /api/openapi.json`
([02 §6](02-stack-y-estructura.md)): el Zod es la fuente y el documento es su lectura.

```json
{
  "origin": { "lat": -32.889727, "lon": -68.844499 },
  "destination": { "lat": -32.892960, "lon": -68.842028 }
}
```

- **Coordenadas sueltas, en WGS 84 (SRID 4326), `lat` y `lon` por nombre.** El orden se
  nombra justamente porque el par anónimo se confunde: en la geometría GeoJSON de la
  respuesta el orden es el inverso —`[lon, lat]`—, y la asimetría se documenta en los dos
  lados.
- **Sin texto, sin ids de nodo, sin "mi ubicación".** Buscar por nombre de calle es otra
  funcionalidad, no está en ninguna fase y no la necesita C003 (§10). Y aceptar el `id` de
  un cordón ataría al cliente a la numeración interna, que es un artefacto del import
  ([11 §4](11-grafo-peatonal.md)): el `id` se devuelve como referencia, no se pide.
- **`POST` y no `GET`** porque el pedido lleva dos puntos en el cuerpo; el endpoint no
  escribe nada igual (§1).
- **Se validan las dos presencias y los rangos** (`lat` en −90…90, `lon` en −180…180) con
  un esquema Zod, que es también la fuente del OpenAPI ([02 §6](02-stack-y-estructura.md)).
  Lo que no cumple eso es `VALIDATION_ERROR` con el `field` que falló.

## 4. Las puntas

### 4.1 La red de seguridad

Cada punta se valida **tal como se pidió**, no el nodo al que después se pega, contra el
perímetro activo de `service_areas` ([09 §4.8](09-modelo-de-datos.md),
[10 §2.1](10-datos-y-zona-piloto.md)). Es lo que evita el peor defecto de un ruteo: que
una coordenada de otra provincia se pegue al borde del grafo y devuelva un camino con
toda la apariencia de ser válido.

Un punto afuera se rechaza con `VALIDATION_ERROR` y el detalle
`{ "field": "origin", "code": "OUTSIDE_SERVICE_AREA" }` —o `destination`—: es un
problema de la entrada, no un recurso que no existe, y el catálogo de
[04 §4](04-errores-y-mensajes.md) no necesita un código nuevo para eso. Los `details`
no traen la distancia al perímetro: el dato útil para el cliente es que la punta está
fuera, y el texto que explica qué hacer lo arma él ([04 §6](04-errores-y-mensajes.md)).

**El borde de la zona no es el borde del grafo.** El extracto trae un búfer de 130 m y la
red de seguridad 50 m: un pedido hecho cerca del borde puede pegarse a un cordón que está
fuera del perímetro, y eso es correcto, porque lo que se valida es el pedido
([10 §2.1](10-datos-y-zona-piloto.md)).

### 4.2 El pegado, y por qué no se extiende la geometría

A cada punta se le busca el cordón más cercano por índice GiST (`ORDER BY geom <-> punto
LIMIT 1`, [11 §5.2](11-grafo-peatonal.md)). Ese nodo es el extremo real del recorrido.

**No se agrega un tramo desde el punto pedido hasta el nodo.** Ese tramo no existe en el
grafo, nadie lo relevó, y dibujarlo afirmaría que se puede caminar: es el mismo argumento
por el que el importador no inventa un nivel ([11 §2](11-grafo-peatonal.md)). Lo que se
hace es **decir cuánto se movió la punta**: la respuesta trae, por cada extremo, el nodo
en el que empezó el recorrido y la distancia a la que quedó del punto pedido (§7). El
cliente es quien muestra esa diferencia, y sin ese dato no puede mostrarla.

## 5. El cálculo

La consulta es la de [11 §5.2](11-grafo-peatonal.md), sin agregados: `pgr_dijkstra` sobre
`walkable_edges` con `directed := false` —para el peatón toda calle se camina en los dos
sentidos— y la unión de vuelta a la vista para recuperar el detalle de cada arista.

Tres detalles que el código tiene que respetar y que la documentación ya fija:

- **`LEFT JOIN` y no `JOIN`** al unir el resultado con `walkable_edges`: la última fila de
  `pgr_dijkstra` es el nodo de llegada, trae `edge = -1` y con un `JOIN` común se cae.
- **El costo es el de la vista**, no una copia: `metros × factor_nivel + penalizaciones`,
  con el nivel del cruce derivado del peor de sus dos esquinas ([09 §4.7](09-modelo-de-datos.md)).
- **El nivel que se devuelve por tramo es el que se cobró** (`walkable_edges.level`), no el
  de la tabla del elemento: en un cruce puede venir de las esquinas, y mostrar el de
  `crossings.accessibility_level` —casi siempre `NULL`— sería mostrar otro dato.

**Medido.** Con el grafo de la zona piloto (329 veredas, 270 cruces, cero obstáculos) la
consulta de un recorrido de ~400 m tarda **~30 ms** `EXPLAIN ANALYZE` adentro y ~16 ms de
punta a punta por HTTP en caliente. Es el costo aceptado de derivar el precio en cada
consulta ([09 §4.7](09-modelo-de-datos.md)); si algún día molesta, la salida es la vista
materializada, no los índices parciales de obstáculos, que hoy no tendrían nada que
indexar.

## 6. Cuando no hay recorrido

**No es un error: es una respuesta.** El pedido está bien formado, las dos puntas están
en zona, y simplemente no hay camino: responde **200** con `found: false`.

Y hay casos reales, no teóricos: el grafo del extracto tiene diez componentes conectados y
nueve son retazos del búfer ([11 §5.1](11-grafo-peatonal.md)), así que un destino ahí
puede quedar inalcanzable sin que haya nada raro en el pedido. Con el relevamiento cargado
se suma el caso legítimo: dos puntos que sólo se conectan cruzando una esquina `NONE`
(§2).

**Cómo se detecta.** No hace falta una consulta aparte: `pgr_dijkstra` devuelve **cero
filas** cuando el destino no es alcanzable, y eso ya es la respuesta. `pgr_connectedComponents`
([11 §5.1](11-grafo-peatonal.md)) queda como la herramienta para diagnosticar *por qué* un
grafo quedó partido —es una consulta de validación, no de cada pedido— porque correrla en
cada consulta paga el grafo entero para responder lo que el ruteo ya contestó.

**Lo que no se hace:** volver a rutear las aristas `NONE` con un costo alto para "dar la
mejor ruta disponible", y decir cuál obstáculo corta el paso. Lo primero se descartó por
principio: puede devolver un paso infranqueable. Lo segundo es un diagnóstico que hoy no
tiene dato —una arista `NONE` no dice por qué— y que se puede agregar cuando el portal
pueda vincular obstáculos a tramos.

## 7. La respuesta

`200` con un recorrido:

```json
{
  "found": true,
  "origin": {
    "node": { "id": 68, "lat": -32.889941, "lon": -68.843276 },
    "distance_m": 116.9
  },
  "destination": {
    "node": { "id": 59, "lat": -32.892419, "lon": -68.842447 },
    "distance_m": 71.7
  },
  "summary": { "meters": 136.3, "cost": 272.6, "crossings": 1, "unverified_meters": 121.3 },
  "legs": [
    {
      "element_kind": "sidewalk",
      "element_id": 42,
      "level": null,
      "is_verified": false,
      "meters": 121.3,
      "geometry": {
        "type": "LineString",
        "coordinates": [[-68.84441, -32.88971], [-68.84439, -32.88980]]
      }
    },
    {
      "element_kind": "crossing",
      "element_id": 88,
      "level": "PARTIAL",
      "is_verified": true,
      "meters": 15.0,
      "geometry": {
        "type": "LineString",
        "coordinates": [[-68.84439, -32.88980], [-68.84440, -32.88993]]
      }
    }
  ]
}
```

`200` sin recorrido, que es la mitad alternativa de la unión discriminada por `found`:

```json
{
  "found": false,
  "origin": { "node": { "id": 12, "lat": -32.88969, "lon": -68.84445 }, "distance_m": 8.4 },
  "destination": { "node": { "id": 150, "lat": -32.88470, "lon": -68.84719 }, "distance_m": 31.7 }
}
```

| Campo | Para qué |
| --- | --- |
| `found` | Discrimina las dos respuestas. `false` no trae `summary` ni `legs` |
| `origin`, `destination` | Dónde empezó y terminó el recorrido de verdad: el nodo y a cuántos metros quedó del punto pedido (§4.2) |
| `summary.meters` | La suma de los metros de los tramos: lo que la persona camina |
| `summary.cost` | La suma de los costos, en **metros equivalentes**: el número con el que el motor eligió este camino ([09 §4.7](09-modelo-de-datos.md)) |
| `summary.crossings` | Cuántos cruces tiene el recorrido |
| `summary.unverified_meters` | Los metros del recorrido que se apoyan en elementos que **nadie miró**. Es el número con el que el cliente avisa que el recorrido está sin relevar |
| `legs[].element_kind`, `element_id` | De qué elemento del grafo es cada tramo, para poder volver a la ficha. El `id` es el único identificador que tiene un elemento derivado ([11 §4](11-grafo-peatonal.md)), así que es lo que se expone |
| `legs[].level` | El nivel que se cobró: `FULL`, `PARTIAL` o `NULL` (sin dato, cobrado como `PARTIAL`). Un tramo `NONE` no puede aparecer |
| `legs[].is_verified` | Si alguien miró lo que decidió ese nivel. En un cruce, vale también cuando las **dos esquinas** de las que sale su nivel están relevadas, porque el valor derivado se apoya en dato relevado ([09 §4.7](09-modelo-de-datos.md)) |
| `legs[].meters` | El largo de ese tramo |
| `legs[].geometry` | La geometría del tramo, en GeoJSON, orden `[lon, lat]` |

Cinco decisiones detrás de esa forma:

- **`legs` viene en orden de recorrido**, pero cada `LineString` conserva la dirección en
  que está guardada en la base. Orientarlas es trabajo del cliente y no agrega
  información: los tramos ya están en orden.
- **No hay una geometría única fusionada.** La geometría es una sola cosa —los tramos— y
  duplicarla en un `LineString` armado en el servidor da dos fuentes para el mismo dato,
  que es lo que [09 §4.3](09-modelo-de-datos.md) corrigió para el lado de la vereda.
- **`cost` se expone junto a `meters`.** Un recorrido que no se puede descomponer no se
  puede explicar ni revisar: "este camino de 1.570 m costó 3.140 metros equivalentes" es
  la frase que hace visible que todo el grafo está sin relevar ([09 §4.7](09-modelo-de-datos.md)).
- **El aviso de "sin relevar" es un dato, no un campo de advertencias.** Sale de los
  tramos: `is_verified` dice cuáles se apoyan en una suposición y su `geometry` permite
  resaltarlos en el mapa; `unverified_meters` lo resume para el cartel. Hoy el grafo entero
  está en `NULL`, así que el número es igual a los metros totales y el aviso se enciende
  solo. Lo que no hay —y no hace falta— es un tiempo estimado: si el cliente quiere
  minutos, son metros por una velocidad peatonal.

**Dos puntas que se pegan al mismo cordón** devuelven `found: true` con `legs` vacío y
`summary` en cero. No es un error: el pedido es válido y el recorrido es de cero metros.

## 8. Cómo se rechaza

| Situación | Status | Respuesta |
| --- | --- | --- |
| Falta un campo del pedido | 400 | `VALIDATION_ERROR` con `details: [{ field, code: "REQUIRED" }]` |
| Un valor presente pero inválido (tipo o rango) | 400 | `VALIDATION_ERROR` con `details: [{ field, code: "INVALID" }]` |
| Una punta está fuera de la red de seguridad | 400 | `VALIDATION_ERROR` con `details: [{ field, code: "OUTSIDE_SERVICE_AREA" }]` |
| No hay perímetro activo en `service_areas` | 500 | `INTERNAL_ERROR`: es una base mal inicializada, no un pedido inválido |
| Cualquier fallo del ruteo | 500 | `INTERNAL_ERROR`, sin detalles ([04 §5](04-errores-y-mensajes.md)) |

`field` es la ruta del campo en el cuerpo (`origin`, `origin.lat`, `destination`), y puede
haber más de un `detail` en el mismo error: dos puntas fuera de zona son un solo 400.
`REQUIRED` e `INVALID` son los motivos genéricos de cualquier cuerpo; `OUTSIDE_SERVICE_AREA`
es el de dominio de este caso de uso ([04 §4](04-errores-y-mensajes.md#4-catálogo-de-códigos)).

Todo eso sigue [04](04-errores-y-mensajes.md): el backend no manda texto, manda códigos.

## 9. C004 es la misma respuesta

**Ver el detalle del recorrido no es un recurso.** No hay tabla de rutas: `saved_routes`
guarda sólo los extremos, a propósito, para que una ruta guardada no mande a nadie por un
camino que dejó de ser transitable ([09 §4.6](09-modelo-de-datos.md)). Sin fila, no hay
`GET /api/routes/:id` que consultar.

Así que el detalle viaja en la respuesta de C003 (§7) y C004 es, del lado de la API, **el
mismo contrato**: la app abre la ficha del recorrido con lo que ya recibió. Si alguna vez
una ruta guardada tiene que reabrirse con su detalle, se recalcula con los mismos dos
puntos, que es exactamente lo que el modelo quiere que pase.

## 10. Lo que este documento no decide

- **La calibración del costo.** Los factores y las penalizaciones viven en
  [09 §4.7](09-modelo-de-datos.md); acá sólo se consumen.
- **La distancia máxima de pegado.** Hoy la acota la red de seguridad indirectamente. Si
  aparece un caso de una punta aceptada que se pega lejísimos, se acota acá.
- **Los obstáculos por tramo.** El detalle no los enumera: hoy no hay obstáculos cargados,
  y su efecto ya está en el costo. Se agrega cuando el portal pueda vincularlos.
- **Buscar por dirección o por nombre de calle.** Es una funcionalidad propia, no está en
  ninguna fase y no la necesita C003 (§2).
- **La degradación cuando la base no responde.** El diagrama de actividades la muestra;
  se resuelve con el `INTERNAL_ERROR` de §8 y la política de operación
  ([03](03-despliegue-y-operacion.md)), no con un contrato propio.
- **El texto que ve la persona.** Lo escribe cada cliente a partir de los códigos y de los
  tramos ([04 §6](04-errores-y-mensajes.md)).

## 11. Documentos relacionados

- [09-modelo-de-datos.md](09-modelo-de-datos.md): el costo de las aristas y las áreas de
  servicio.
- [11-grafo-peatonal.md](11-grafo-peatonal.md): la vista `walkable_edges` y las consultas
  de ruteo y de validación.
- [10-datos-y-zona-piloto.md](10-datos-y-zona-piloto.md): el recorte y el perímetro de
  búsqueda.
- [04-errores-y-mensajes.md](04-errores-y-mensajes.md): la forma de la respuesta de error.
- [12-relevamiento-de-accesibilidad.md](12-relevamiento-de-accesibilidad.md): de dónde sale
  el nivel que el costo cobra.
- [07-plan-de-trabajo.md](07-plan-de-trabajo.md): fases y casos de uso.

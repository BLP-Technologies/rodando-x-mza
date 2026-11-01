# Datos y zona piloto

> Documento temático. Define qué área entra en el piloto de la Fase 1, de dónde salen
> los datos crudos, en qué formato se obtienen, qué queda versionado y qué se deriva del
> extracto. Es el estado vivo de esas decisiones: se edita en su lugar cuando cambian.
> El relevamiento de campo tiene documento propio
> ([12](12-relevamiento-de-accesibilidad.md)); acá queda la zona, que es su unidad de
> trabajo. Se complementa con [09-modelo-de-datos.md](09-modelo-de-datos.md), que define
> el esquema, y con [02-stack-y-estructura.md](02-stack-y-estructura.md), que define el
> acceso a datos.

## 1. Alcance

Este documento responde:

- **Qué área** es la zona piloto y por qué ese recorte, y hasta dónde se acepta una consulta (§2).
- **De dónde y en qué formato** salen los datos crudos (§3).
- **Qué se versiona** y qué no (§4).
- **Qué contiene** el extracto, medido (§5).
- **Qué obliga a derivar** este extracto (§6).
- **Cuál es la unidad de trabajo** del relevamiento de campo (§7).

No decide el modelo del grafo ni las reglas de conversión —eso es
[11-grafo-peatonal.md](11-grafo-peatonal.md)—, ni la topología de pgRouting ni el
importador, que son #12 y #13. Tampoco las convenciones del esquema, que están en
[09](09-modelo-de-datos.md). Este documento describe la zona, la fuente y el relevamiento; las reglas con las que el
extracto se convierte en grafo viven en `11`, porque son el modelo del grafo y no una
propiedad del recorte.

## 2. La zona

Un cuadrante de **6 × 6 manzanas del microcentro de la Ciudad de Mendoza**, delimitado por
las líneas centrales de cuatro calles:

| Lado | Calle (nombre en OSM) |
| --- | --- |
| Norte | `Mariano Necochea` |
| Sur | `San Lorenzo` |
| Oeste | `Perú` |
| Este | `9 de Julio` |

Los vértices y la geometría están en [`data/pilot-zone.geojson`](../data/pilot-zone.geojson),
y el método para obtenerlos en [`data/README.md`](../data/README.md). Medido sobre esos
vértices: **~730 m por lado y 53 ha (0,53 km²)**, con 7 calles en cada dirección y 36
manzanas de ~122 m.

El damero no está alineado con los cardinales: las calles norte-sur se desvían **14,7°** y
las este-oeste **-10,5°**. Por eso la zona se delimita con un polígono y no con una caja de
mínimos y máximos: la caja que lo envuelve mide 869 × 872 m, **142 % del área real**.

**Las cinco plazas.** Cuatro están a una cuadra de cada vértice —Chile, San Martín, Italia
y España, a 83-88 m del cruce— y la quinta, Plaza Independencia, ocupa el centro con unos
265 m por lado (~2,2 manzanas). Como referencia para pruebas y demos, sus centros según
OSM:

| Plaza | Latitud, longitud |
| --- | --- |
| Chile (NO) | -32.886429, -68.846980 |
| San Martín (NE) | -32.887642, -68.840650 |
| Italia (SO) | -32.891810, -68.848419 |
| España (SE) | -32.892960, -68.842028 |
| Independencia (centro) | -32.889727, -68.844499 |

**Por qué esta zona.** Es céntrica y de alto tránsito, con edificios públicos y comercios,
que es el escenario donde un recorrido accesible importa. Pero el argumento que decide es
el del piloto: **se puede relevar y verificar a ojo**. 36 manzanas se recorren en una
jornada, y ~340 aristas se revisan en un mapa sin perderse. Además el recorte contiene, sin
buscarlos, los tres casos que el modelo tiene que resolver: cruces con y sin semáforo, una
avenida con boulevard (Bartolomé Mitre) y una calle peatonal (Sarmiento).

**Los nombres, como están en OSM.** `Perú` y `9 de Julio` figuran sin "Avenida", y `9 de
Julio` está clasificada como `residential`. Cualquier filtro por "Avenida Perú" no
encuentra nada.

### 2.1 La red de seguridad del piloto

La zona que se acaba de definir es el recorte; **la red de seguridad es el perímetro de
búsqueda**: hasta dónde se aceptan las coordenadas de una consulta de ruteo. Son dos cosas
distintas y conviene no confundirlas.

Es la zona piloto corrida **50 m hacia afuera, con las esquinas en ángulo recto**
(`join=mitre`): los lados quedan a 50 m y las esquinas se estiran ~71 m en diagonal. La
esquina recta mantiene la forma de la zona —cuatro lados y cuatro vértices— en lugar de
cambiar los vértices por arcos, y deja llegar un poco más lejos por las diagonales
(688.617 m² contra 686.419 m² de la versión redondeada).

**Por qué existe.** El extracto ([§3](#3-fuente-y-formato)) usa un búfer de 130 m sobre las
cuatro calles del perímetro, y eso es para otra cosa: el búfer trae vías completas para que
las veredas del lado de afuera existan y el grafo no quede cortado en el borde. La red de
seguridad responde otra pregunta: **qué lejos del piloto se acepta un pedido**. Sin ella, el
ruteo pega cualquier coordenada del mundo al cordón más cercano y devuelve un camino que
empieza en el borde del grafo, como si fuera válido. Un pedido que arranca en un borde del
piloto tiene que poder hacerse, y uno que arranca en otra provincia no.

Los dos márgenes no coinciden a propósito. Las intersecciones del búfer, como **Las Heras y
Perú**, quedan afuera de la búsqueda: el extracto las trae para que el grafo no muera en el
borde, pero una consulta que empieza ahí está a 124 m de la zona y se rechaza. Hoy el
perímetro deja adentro 199 de los 505 cordones del grafo.

El polígono vive en la tabla `service_areas`
([09 §4.8](09-modelo-de-datos.md#48-las-áreas-de-servicio)) y no en una variable de
configuración, porque cuando el piloto crezca el área no va a ser un rectángulo corrido:
va a ser la unión de varias zonas, con forma irregular, y agregar una es un `INSERT`.

## 3. Fuente y formato

Los datos crudos son de **OpenStreetMap**, descargados con **Overpass** en formato **`.osm`
(XML)** por `scripts/fetch-pilot-zone-osm.mjs`, que escribe `data/pilot-zone.osm`.

| Decisión | Por qué |
| --- | --- |
| Overpass y no un extracto de Geofabrik | La zona son 0,5 km²: pedir el área es inmediato, mientras que el `.pbf` de Argentina pesa cientos de MB para recortar medio kilómetro |
| `.osm` (XML) y no `.pbf` | ~200 KB, legible y sin dependencias para leerlo. El `.pbf` se justifica cuando la zona crezca a la ciudad |
| `out body; >; out skel qt;` y no `out geom` | `out geom` **recorta las geometrías en el borde y omite los nodos de afuera**, y con eso se pierden los nodos que hacen de intersección. La recursión trae los nodos de cada vía completa |
| Búfer de 130 m (una cuadra) | Sin búfer, las vías del perímetro quedan cortadas y las veredas del lado de afuera de cada calle perimetral no existen |
| Reintentos con espera | Overpass devuelve 502 y 504 seguido; una descarga que falla en silencio deja el import a medias |

El script **falla con un mensaje explícito** si el archivo no trae las cuatro calles del
perímetro o las cinco plazas, así que una descarga incompleta no pasa por buena.

**Licencia.** OpenStreetMap es ODbL 1.0: los datos se pueden usar y redistribuir con
atribución. La aplicación tiene que mostrar "© OpenStreetMap contributors" donde muestra
datos del mapa ([03](03-despliegue-y-operacion.md)). No se toman coordenadas de Google
Maps: sus términos no permiten reutilizar datos derivados, y además el borde correcto sale
de la geometría de las calles, no de mirar una imagen.

## 4. Qué se versiona

| Se versiona | No se versiona |
| --- | --- |
| `data/pilot-zone.geojson` (el recorte) | `data/pilot-zone.osm` (el extracto) |
| `scripts/fetch-pilot-zone-osm.mjs` (cómo se obtiene) | |
| La procedencia: fecha, endpoint, conteos y hash | |

El criterio del issue decía "por tamaño", y el tamaño no es el argumento: son 204 KB. El
argumento es que el extracto es **un artefacto derivado y mutable**. Versionarlo daría un
archivo que dice una cosa y una realidad de OSM que dice otra tres meses después, y no
habría forma de saber cuál es cuál. El recorte y el script no cambian solos; el extracto
sí. Está en `.gitignore`.

## 5. Qué hay en la zona

Inventario del extracto del **2026-10-31** (332 vías y 1.468 nodos, con el búfer), que es
lo que las reglas de conversión ([11](11-grafo-peatonal.md)) necesitan como insumo:

| Qué | Cuánto |
| --- | --- |
| Vías con `highway` | 320 |
| Vías con etiqueta `sidewalk` (`=both` 37, `:both=separate` 4) | 41 |
| **Veredas mapeadas como geometría (`footway=sidewalk`)** | **0** |
| `footway=crossing` | 18 |
| `footway` sin subtipo (senderos de plazas y pasajes) | 153 |
| Nodos con `highway=crossing` | 128 |
| **Nodos con `kerb` dentro del polígono** | **0** |
| Nodos con `kerb` en el búfer | 4 (un cruce semaforizado al este de 9 de Julio, todos `kerb=lowered` y `tactile_paving=no`) |
| Áreas de esparcimiento (`leisure`) | 12, de las cuales 7 tienen nombre: las 5 plazas, el Paseo Estado de Israel y el Club de Gimnasia y Esgrima |

Por clase de vía: `footway` 171, `residential` 49, `service` 34, `tertiary` 21, `secondary`
19, `steps` 9, `primary` 8, `cycleway` 5, `path` 2, `pedestrian` 1, `living_street` 1.

**La conclusión que importa: en la zona piloto no hay veredas ni cordones dibujados.** Lo
único que OSM aporta del lado peatonal son 18 cruces, que no alcanzan para 49
intersecciones, y 4 cordones en el búfer.

## 6. Qué se deriva del extracto

Lo único que OpenStreetMap aporta del lado peatonal es el **esqueleto** (§5): qué
calles existen, por dónde pasan, cómo se llaman y de qué clase son. Las veredas, las
esquinas y los cruces los construye el importador sobre ese esqueleto, y no se pueden
importar porque en el extracto no existen.

Las reglas de conversión —qué se lee y a qué columna va, cómo se derivan los nodos y
los tramos, cómo se identifica cada elemento para que reimportar no duplique, y qué
casos de OSM no se pueden modelar— están en
[11-grafo-peatonal.md](11-grafo-peatonal.md). Viven ahí y no acá porque son el modelo
del grafo, no una propiedad del recorte.

Lo que sí queda acá, porque depende del extracto:

- **La zona obliga a derivar.** Si mañana llegara un extracto con `footway=sidewalk` y
  `kerb` dibujados, la decisión de seguir derivando en lugar de importar se revisaría
  en este documento.
- **La fuente manda la precisión.** Las coordenadas del extracto son las de OSM, y de
  ahí sale la tolerancia con la que se reconocen los nodos entre corridas
  ([11 §4](11-grafo-peatonal.md)).
- **Los casos especiales del recorte** —el boulevard de Bartolomé Mitre, la calle
  peatonal Sarmiento, los senderos de las plazas— son los de esta zona. El modelo
  explica cómo los trata; este documento dice dónde están.

## 7. El relevamiento de campo

El importador aporta **dónde** está cada vereda; el relevamiento aporta **cómo está**.
Es la única fuente de accesibilidad del MVP, porque OpenStreetMap no trae ni veredas ni
cordones (§5): sin relevamiento, el grafo existe con todo en `NULL`.

Qué se releva, con qué criterio se decide cada nivel, cómo se registra y qué queda
fuera del MVP está en
[12-relevamiento-de-accesibilidad.md](12-relevamiento-de-accesibilidad.md). Acá queda
lo que depende de este documento: **la zona es la unidad de trabajo del relevamiento**.
Son 36 manzanas, del orden de 180 veredas y 192 esquinas, y eso es lo que hace que una
jornada de campo alcance y que el resultado se pueda verificar a ojo (§2).

## 8. Lo que este documento no decide

- **El modelo del grafo y las reglas de conversión.** Viven en
  [11-grafo-peatonal.md](11-grafo-peatonal.md).
- **El importador.** El código que las aplica: #12.
- **La topología de pgRouting.** Construirla y validarla con una consulta: #13.
- **El relevamiento de campo.** Qué se releva, el criterio de cada nivel y la
  planilla de campo: [12-relevamiento-de-accesibilidad.md](12-relevamiento-de-accesibilidad.md).
- **El ancho exacto de cada calle.** [11 §3.4](11-grafo-peatonal.md) es una aproximación
  por clase, con `lanes` cuando existe. Se revisa con el mapa delante.
- **Modelar áreas caminables.** Hoy no existe en el esquema; es lo que haría falta para
  incluir las plazas como destino interior ([11 §6](11-grafo-peatonal.md)).

## 9. Documentos relacionados

- [09-modelo-de-datos.md](09-modelo-de-datos.md): el esquema que estos datos van a poblar.
- [11-grafo-peatonal.md](11-grafo-peatonal.md): cómo se convierte este extracto en el grafo.
- [12-relevamiento-de-accesibilidad.md](12-relevamiento-de-accesibilidad.md): qué aporta el
  relevamiento, el criterio de cada nivel y la planilla de campo.
- [02-stack-y-estructura.md](02-stack-y-estructura.md): acceso a datos y convenciones.
- [03-despliegue-y-operacion.md](03-despliegue-y-operacion.md): atribución y operación.
- [07-plan-de-trabajo.md](07-plan-de-trabajo.md): fases y definición de terminado.
- [`data/README.md`](../data/README.md): el polígono y la procedencia del extracto.

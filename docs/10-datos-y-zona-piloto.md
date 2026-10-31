# Datos y zona piloto

> Documento temático. Define qué área entra en el piloto de la Fase 1, de dónde salen
> los datos crudos, en qué formato se obtienen, qué queda versionado y qué se deriva del
> extracto. Es el estado vivo de esas decisiones: se edita en su lugar cuando cambian. Se
> complementa con [09-modelo-de-datos.md](09-modelo-de-datos.md), que define el esquema,
> y con [02-stack-y-estructura.md](02-stack-y-estructura.md), que define el acceso a
> datos.

## 1. Alcance

Este documento responde:

- **Qué área** es la zona piloto y por qué ese recorte (§2).
- **De dónde y en qué formato** salen los datos crudos (§3).
- **Qué se versiona** y qué no (§4).
- **Qué contiene** el extracto, medido (§5).
- **Qué se deriva** de él y qué se ignora (§6).

No decide el modelo del grafo, la topología de pgRouting ni el importador: eso es #10,
#12 y #13. Tampoco las convenciones del esquema, que están en
[09](09-modelo-de-datos.md). Las reglas de §6 sí viven acá porque dependen de lo que el
extracto contiene, y dejarían de ser ciertas si se cambiara la fuente.

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
lo que #10 necesita para escribir sus reglas:

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

**La conclusión que importa: en la zona piloto no hay veredas ni cordones dibujados.** No
alcanza con importar: hay que **derivar**. Lo único que OSM aporta del lado peatonal son 18
cruces, que tampoco alcanzan para 49 intersecciones, y 4 cordones en el búfer.

## 6. Qué se deriva y qué se ignora

### 6.1 El esqueleto: vías de tránsito general

El grafo peatonal se construye sobre las **vías de circulación general**: `primary`,
`secondary`, `tertiary`, `residential`, `unclassified` y `living_street`. El resto queda
fuera, y cada exclusión tiene su motivo:

| Se excluye | Por qué |
| --- | --- |
| `service` | Entradas de auto, pasillos de playa de estacionamiento, accesos a edificios. Derivarles veredas inventa veredas sobre una cochera |
| `footway`, `path` | Senderos de plazas y pasajes internos: sin jerarquía, sin cordón y sin dato de accesibilidad (ver §6.6) |
| `steps` | Escaleras: no son una calle. Quedan anotadas como barrera para marcarlas como obstáculo más adelante |
| `cycleway` | No son peatonales |

De OSM se toma el **esqueleto**: qué calles existen, su geometría central, su nombre (va al
`street_name` de la vereda) y su clase (define el ancho, §6.2). Todo lo demás —veredas,
cordones, cruces y topología— lo construye el importador.

### 6.2 Las veredas: dos por calzada, una por lado

**Cada `way` vehicular es una calzada y aporta dos veredas**, una por lado, a una distancia
del eje que depende del ancho. La geometría no se inventa de cero: se corre la línea central
hacia cada lado.

| Clase | Offset desde el eje (media calzada + media vereda) |
| --- | --- |
| `primary` | 10 m |
| `secondary` | 8,5 m |
| `tertiary` | 7,5 m |
| `residential`, `unclassified`, `living_street` | 6,5 m |

Cuando la vía trae `lanes`, gana sobre la clase: `offset = lanes × 3 m / 2 + 1,5 m`. Los
números son un **punto de partida** y se revisan a ojo una vez sobre el mapa: la clase no
siempre coincide con lo que se ve —`9 de Julio` está como `residential` y no es angosta—,
así que la tabla admite excepciones por calle.

Lo que no se hace es medir el ancho desde los edificios: en las plazas no hay edificios
justo donde el borde es la vereda, y el dato sería desparejo en el lugar más visible.

**El corte es por intersección, no por `way`.** Una `way` de OSM puede estar partida por
motivos ajenos a una esquina y dos tramos consecutivos pueden no compartir nodo. Una
"cuadra" es el tramo entre dos intersecciones consecutivas, y se corta ahí.

### 6.3 Nodos y cruces

- **Un `kerb_node` por esquina**, en la intersección de las dos líneas de vereda. Con eso,
  cada esquina tiene cuatro aristas: las dos veredas de cada calle y los dos cruces.
- **Un cruce por brazo de intersección**: cuatro en las interiores, tres en las de borde,
  dos en las de vértice. Son ~168 en toda la zona.
- **Los 18 cruces de OSM y sus 128 nodos no se leen.** Si se mezclaran, la mitad de las
  intersecciones quedaría sin cruce y el grafo no cerraría.

### 6.4 El boulevard: dos calzadas y una mediana

Cuando dos calzadas de la misma vía corren paralelas a menos de 25 m, en sentidos opuestos
y con el mismo nombre, se tratan como **un boulevard**: dos veredas exteriores y **una
franja caminable en la mediana**, con dos cruces por brazo (uno por calzada).

Modelar la mediana como una sola arista y no como dos veredas pegadas es lo que la hace
funcionar: caminar a lo largo del boulevard cuenta una vez, y cruzar cuesta dos cruces más
la mediana, que es lo real. La mediana es una vereda más: arranca con `accessibility_level`
en `NULL` como todo lo demás.

En la zona, el caso es **Bartolomé Mitre**: OSM la tiene como dos `way` de sentido único
separadas 13-16 m (consistente en 14 cortes a lo largo de toda la avenida). Justo afuera
hay otra: **Manuel Belgrano**, a 21-24 m. No es un caso único de la ciudad, es un caso
único de este recorte.

### 6.5 La calle peatonal: una sola arista

`highway=pedestrian` **sin `area=yes`** es una calle peatonal y entra como **una sola
arista** sobre su línea central: no hay calzada en el medio, así que derivar dos lados
crearía dos aristas paralelas sobre un lugar donde se camina en todo el ancho, y un cruce
falso entre ellas. Con `area=yes` es una plaza, y queda fuera (§6.6).

En la zona, **Sarmiento** entre Patricias Mendocinas y 9 de Julio es peatonal, y la corta
**España**, que sí tiene tránsito. Por eso no es una arista de dos cuadras sino dos, unidas
por un cruce sobre España: peatonal (9 de Julio → España) → nodo → cruce → nodo → peatonal
(España → Patricias Mendocinas). El peatón tiene prioridad, pero el cruce existe porque los
vehículos pasan.

### 6.6 Lo que se deja afuera, y por qué

- **Los senderos de las plazas** (153 `footway` sin subtipo). No son paralelos a ninguna
  calle, no tienen cordón, no tienen rampa y no traen ningún dato de accesibilidad: entrarían
  como aristas de nivel `NULL` que además hay que enganchar a mano con la vereda del borde.
  El modelo, además, no tiene "área caminable": solo conoce aristas entre cordones. El ruteo
  termina en el nodo del borde más cercano al destino, que es lo mismo que hace falta para
  pegar un origen a mitad de cuadra. **Se revisa cuando el relevamiento cubra los senderos.**
- **Las `service`** (§6.1): veredas sobre cocheras no son veredas.
- **Los cruces de OSM** (§6.3): no alcanzan y mezclarlos rompe la uniformidad.

Los senderos y las `service` siguen en el extracto; lo que se decide acá es que el
importador **no los lee**.

### 6.7 La clave para reimportar, pendiente

Los elementos derivados no tienen identificador externo: una vereda no viene de ninguna
`way`, así que `osm_way_id` queda `NULL` y reimportar significa **reconstruir** el grafo. Eso
choca con los obstáculos, que cuelgan de `sidewalk_id` con `ON DELETE RESTRICT`: reconstruir
deja obstáculos huérfanos o los borra.

La salida es una **clave determinista** —la `way` de origen, el lado y el tramo— y un *upsert*
por esa clave. La columna concreta se decide en #10/#12; lo que no se deja para después es la
propiedad que tiene que cumplir y las tres protecciones:

1. **Upsert, no borrar y recrear.** La clave sale de datos que OSM no cambia seguido.
2. **Reanclaje por geometría** cuando la clave no aparece (vereda más cercana al `geom` del
   obstáculo, a menos de ~5 m) y, si no hay ninguna, el obstáculo queda **sin vínculo**.
3. **Reporte de la corrida**: cuántos elementos se crearon, se actualizaron, se reanclaron y
   cuántos quedaron sin vínculo.

Perder el vínculo no es perder el dato: en `09` §4.5, colgar un obstáculo de cero elementos
es válido y su `geom` es la fuente de verdad. Por eso la falla es degradable, y por eso el
requisito se puede verificar con un test barato: importar dos veces y comprobar que los ids
no cambiaron y que los obstáculos conservan sus vínculos.

## 7. Lo que este documento no decide

- **El modelo del grafo y la topología.** Cómo se numeran los nodos, cómo se arma la tabla
  de aristas para `pgr_dijkstra` y cómo se valida: #10 y #13.
- **El importador.** El código que aplica §6: #12.
- **El ancho exacto de cada calle.** §6.2 es una aproximación por clase, con `lanes` cuando
  existe. Se revisa con el mapa delante.
- **Modelar áreas caminables.** Hoy no existe en el esquema; es lo que haría falta para
  incluir las plazas como destino interior (§6.6).

## 8. Documentos relacionados

- [09-modelo-de-datos.md](09-modelo-de-datos.md): el esquema que estos datos van a poblar.
- [02-stack-y-estructura.md](02-stack-y-estructura.md): acceso a datos y convenciones.
- [03-despliegue-y-operacion.md](03-despliegue-y-operacion.md): atribución y operación.
- [07-plan-de-trabajo.md](07-plan-de-trabajo.md): fases y definición de terminado.
- [`data/README.md`](../data/README.md): el polígono y la procedencia del extracto.

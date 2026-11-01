# El grafo peatonal

> Documento temático. Define cómo se convierte el extracto de OpenStreetMap en el
grafo peatonal: qué se lee, cómo se derivan los nodos y las aristas, cómo se
identifican y qué no se puede modelar. Es el estado vivo de esas decisiones: se
edita en su lugar cuando cambian. Se complementa con
[09-modelo-de-datos.md](09-modelo-de-datos.md), que define el esquema y el costo de
las aristas, y con [10-datos-y-zona-piloto.md](10-datos-y-zona-piloto.md), que
define la zona y la fuente de los datos.

## 1. Alcance

Este documento responde:

- **Qué se lee** de OpenStreetMap y a qué tabla y columna va cada cosa (§2).
- **Cómo se deriva** el grafo: nodos, tramos, veredas y cruces, en qué orden (§3).
- **Cómo se identifica** cada elemento derivado, para que reimportar no duplique (§4).
- **Qué forma tiene** la relación que recorre `pgr_dijkstra` (§5).
- **Qué casos de OSM no se pueden modelar** y qué se hace con ellos (§6).

El punto de partida es que **el grafo no se importa: se deriva**. En la zona piloto
no hay veredas ni cordones dibujados en OpenStreetMap —cero `footway=sidewalk`, cero
nodos con `kerb` dentro del polígono—, así que lo único que aporta OSM es el
esqueleto: qué calles existen, por dónde pasan, cómo se llaman y de qué clase son.
Las veredas, las esquinas y los cruces los construye el importador sobre ese
esqueleto.

No decide el código del importador (#12) ni la construcción y validación de la
topología con una consulta real (#13). Tampoco el costo de las aristas, que vive en
[09 §4.7](09-modelo-de-datos.md): acá se define la forma de la relación, no la
fórmula. Los números de las tablas son un punto de partida y se revisan con el mapa
delante.

## 2. Qué se lee

### 2.1 Qué `way` entra al grafo

Entran las **vías de circulación general**: `primary`, `secondary`, `tertiary`,
`residential`, `unclassified` y `living_street`; y entra la **calle peatonal**,
`highway=pedestrian` sin `area=yes`. El resto queda afuera, y cada exclusión tiene su
motivo en §6. En el extracto de la zona piloto eso son 320 vías con `highway`, de las
cuales entran 99: 49 `residential`, 21 `tertiary`, 19 `secondary`, 8 `primary`,
1 `pedestrian` y 1 `living_street`.

De esas 99, el importador de la grilla excluye antes las **15 calzadas de boulevard**
(§3.6) y deja la peatonal para #34: deriva **83**. Los números de la corrida van al
reporte (§4).

Una `way` **no es una calle ni una cuadra**: puede empezar y terminar en la mitad de
una, y dos tramos consecutivos de la misma calle pueden ser dos `way` que comparten
un nodo. Por eso el grafo no se arma por `way` sino por **línea caminable cortada en
nodos** (§3).

### 2.2 El mapeo

**De los tags a las columnas.** Lo que se lee de una `way`, y lo que se ignora:

| Tag de OSM | Destino |
| --- | --- |
| `highway` | Qué entra (§2.1) y el offset de la vereda (§3.4) |
| `id` de la `way` | `sidewalks.osm_way_id`, para trazabilidad. **No es único**: una `way` produce varias veredas, y una vereda de un tramo hecho de varias `way` lleva el id de la que contiene su punto medio |
| `name` | `sidewalks.street_name` |
| `lanes` | Offset, cuando existe: gana sobre la clase (§3.4) |
| `oneway` | Detección de boulevard: se buscan dos calzadas en sentidos opuestos (§3.6) |
| Geometría (la línea central) | Base de la derivación: de ahí salen los nodos y las líneas corridas |
| `area=yes` | Excluye: con `highway=pedestrian` y `area=yes` es una plaza, no una calle |

Y lo que OSM trae en la zona y **no se lee**, con el motivo:

| Tag de OSM | Hay en la zona | Por qué no se lee |
| --- | --- | --- |
| `sidewalk=both` / `sidewalk:both=separate` | 41 vías | Se derivan siempre las dos veredas (§3.4). El tag no dice dónde están ni cómo están |
| `footway=sidewalk` | 0 | Sería la fuente de la geometría de la vereda, y no existe. Si apareciera, se ignora igual: el criterio del MVP es derivar, no depender de que OSM lo tenga dibujado |
| `footway=crossing` | 18 vías | No alcanzan (hacen falta 192) y mezclarlas rompe la uniformidad (§3.7) |
| `highway=crossing` (nodo) | 128 | Ídem: marcan algunos cruces, no todos, y no tienen geometría |
| `kerb`, `tactile_paving` | 4 nodos, todos en el búfer | Es dato de accesibilidad, y la accesibilidad la aporta el relevamiento ([12](12-relevamiento-de-accesibilidad.md)) |
| `foot`, `access`, `sidewalk=no` | 0 | El MVP asume que en la zona piloto se camina por los dos lados de toda calle (§6) |
| `bridge`, `tunnel`, `layer` | 0 | El modelo no tiene altura (§6) |

**De las columnas a su origen.** Al revés, qué llena cada columna del grafo:

| Columna | Origen |
| --- | --- |
| `kerb_nodes.geom` | Intersección de dos líneas caminables derivadas. **Nunca** un nodo de OSM |
| `kerb_nodes.accessibility_level` | `NULL`: nadie lo relevó. OSM no lo trae |
| `sidewalks.start_node_id`, `end_node_id` | Los dos nodos entre los que corre el tramo |
| `sidewalks.geom` | La línea caminable corrida, cortada en los nodos (§3.4) |
| `sidewalks.street_name` | `name` de la `way`, sin normalizar (§3.8) |
| `sidewalks.osm_way_id` | `id` de la `way` de la que salió la línea |
| `sidewalks.accessibility_level` | `NULL` |
| `crossings.geom` | Recta entre dos esquinas enfrentadas (§3.7) |
| `crossings.accessibility_level` | `NULL` |

`accessibility_level` e `is_verified` quedan en su valor de import en **todos** los
elementos: el importador no inventa un nivel
([09 §4.1](09-modelo-de-datos.md#41-enums)). Un grafo recién importado dice "no sé"
en todas partes, que es la verdad.

## 3. Cómo se deriva

### 3.1 Las líneas caminables

La unidad de trabajo no es la `way` sino la **línea caminable**: una polilínea por la
que se camina, paralela a un eje. Cada eje produce una o más:

| Eje | Líneas que produce |
| --- | --- |
| Una calzada (cualquier clase de §2.1) | **Dos**, una por lado, corridas a una distancia del eje (§3.4) |
| Un boulevard (dos calzadas en sentidos opuestos) | **Tres**: una exterior por calzada y **una** mediana caminable, que ocupa el lugar de las dos interiores (§3.6) |
| Una calle peatonal | **Una**, sobre el eje: no hay calzada en el medio (§3.5) |

En todos los casos la geometría **sale del eje**: se corre la línea central hacia cada
lado. No se mide desde los edificios, porque en las plazas no hay edificios justo
donde el borde es la vereda.

### 3.2 Los nodos

Un `kerb_node` es **la intersección de dos líneas caminables** de calles distintas, o
el extremo de una línea en el borde del extracto. Nada más crea un nodo.

| Situación | Nodos | Aristas por nodo |
| --- | --- | --- |
| Dos calles se cruzan (X, cuatro brazos) | 4: cada una de las dos líneas de una calle contra las dos de la otra | 4 |
| Una calle termina en otra (T, tres brazos) | 4: los mismos pares de líneas, prolongando la que termina a través de la que pasa | 4 y 3: los dos del lado donde no hay esquina quedan sobre la vereda continua, y ahí empieza el cruce |
| Fin de calle en el borde del extracto | 1 por línea: la vereda termina donde termina el extracto | 1 |
| La misma calle doblada, sin otra que la cruce | **Ninguno**: el quiebre es geometría de la línea, no un nodo | — |

Esta regla es la que explica el grafo de la esquina de
[09 §4.4](09-modelo-de-datos.md#44-el-modelo-en-la-calle): cuatro nodos y, alrededor,
las veredas que salen y los cruces que los unen. Y explica por qué en un cruce de
cuatro brazos **cada nodo tiene cuatro aristas**: dos veredas (una por calle) y dos
cruces.

Un cruce **en L** —dos calles que se encuentran y terminan— daría cuatro puntos de
los cuales sólo dos son esquinas, porque las líneas de una de las calles no existen
del otro lado. No aparece en la zona piloto: el búfer convierte los vértices del
polígono en cruces de cuatro brazos. Si apareciera, hay que decidir qué cuadrantes
existen, y eso es una regla nueva, no un ajuste.

**Cómo se detecta una intersección.** En OpenStreetMap, dos calles que se cruzan
**comparten el nodo**, y eso es confiable. Entonces: es intersección todo nodo del
extracto con **grado 3 o más** entre las `way` que entran al grafo, contando cada
extremo de `way` que incide en él. Dos tramos de la misma calle que comparten nodo
tienen grado 2 y no son una intersección, así que no se corta ahí.

Un chequeo geométrico con tolerancia (~2 m) recorre el extracto buscando **cruces de
geometría sin nodo compartido**, y **sólo los reporta**: no inventa la intersección.
Una imperfección de OSM se ve en el reporte de la corrida, y no como dos calles que se
tocan en el mapa y no en el grafo.

**Los nodos que no son de esquina.** Dos casos: el fin de calle del extracto y el
cambio de nombre (§3.8). En el primero, la vereda termina sin cruce: en el borde del
extracto no se deriva un cruce, porque la calle sigue y no sabemos qué hay del otro
lado. Es un artefacto conocido y aceptado, y es el motivo por el que el extracto se
trae con búfer ([10 §3](10-datos-y-zona-piloto.md#3-fuente-y-formato)).

**La T, y la vereda que sigue de largo.** En una T las dos calles que pasan son **la
misma recta**, así que sus líneas de vereda son colineales: no se cruzan y no producen
esquina. Pero la T igual tiene cuatro nodos, y los que faltan los pone la calle que
termina:

```
            Calle Corta (el brazo que termina)
                   |
   ----------------┼----------------  calle que pasa
      vereda   [nodo]  [nodo]   vereda
                    ↑
            vereda en frente de la boca
```

- **Del lado donde llega el brazo** hay dos esquinas normales, y entre ellas el cruce
  sobre el brazo.
- **Del lado opuesto** —el de la boca de la T— hay dos nodos que **no son
  intersecciones de dos líneas de vereda**: son donde aterrizan los dos cruces sobre
  la calle que pasa, y salen de prolongar las líneas del brazo que termina hasta la
  vereda del lado opuesto.
- Entre esos dos nodos va **una vereda más**, la que corre en frente de la boca. Es una
  arista como cualquier otra y es lo que cierra el grafo: sin ella, la vereda del lado
  opuesto queda partida en dos y sin conexión.

**En la zona piloto la corrida encuentra nueve T.** El cuadro original de esta sección
partía del mapa con el boulevard y la peatonal ya derivados: cuatro T, todas contra
Plaza Independencia, que ocupa 2,2 manzanas y corta las calles que la cruzarían. Con
las `way` de la grilla —sin las 15 calzadas de boulevard y sin la peatonal— la regla
del grado 3 encuentra estas nueve:

| T | El brazo que termina |
| --- | --- |
| Sarmiento × Chile | Sarmiento, calle común: **la deriva el importador de la grilla** |
| Chile × Avenida Colón | Chile |
| Infanta Mercedes de San Martín × Perú (dos nodos) | Infanta Mercedes de San Martín |
| Estado de Israel × Santiago de Liniers | Estado de Israel |
| Don Bosco, José Garibaldi y San Lorenzo × Avenida General San Martín | cada uno de los tres |
| Los Tulipanes × una calle sin `name` | Los Tulipanes |

Dos de las cuatro T del cuadro original —Mitre × Gerónimo Espejo y Mitre × Rivadavia—
no aparecen acá porque el brazo que termina es Mitre, que es boulevard: sus calzadas
están fuera de la grilla (§3.6) y esas T vuelven con ellas en #34. La cuarta, la
peatonal, también es #34. Y quedan **tres nodos de tres brazos donde ninguno es el que
termina** —una calle que se abre en Y, dos que se tocan en un punto—: ésos se reportan
y no se derivan, porque no son ni un cruce ni una T.

Una de las nueve —Chile × Avenida Colón— **no deriva su vereda de la boca**: la calle
que pasa cambia de ancho en el nodo, así que el lado opuesto tiene cuatro esquinas en
lugar de dos y no hay un segmento que cierre la boca sin decidir algo nuevo. La corrida
lo reporta con el nodo y el grafo queda con las dos veredas del lado opuesto sueltas.

Un brazo que termina y es un boulevard, o una peatonal, tiene más o menos líneas que
dos: el lado opuesto recibe entonces más de dos nodos y más de una vereda de la boca.
Eso se resuelve en #34, junto con esas vías.

### 3.3 El corte en tramos

Cada línea caminable se corta **en cada nodo que cae sobre ella**. El resultado es el
**tramo**: la parte de la línea entre dos nodos consecutivos, que es lo que la tabla
llama una vereda.

El corte es por nodo, no por `way` ni por manzana. Una `way` partida por motivos ajenos
a una esquina se une; una calle que ocupa varias cuadras se corta en cada
intersección. Y si un nodo apareciera a mitad de cuadra, la vereda se corta ahí
también: es la condición para que la topología no quede desconectada en ese punto
([09 §4.4](09-modelo-de-datos.md#44-el-modelo-en-la-calle)).

### 3.4 Las veredas

Cada línea se corre del eje a una distancia que depende del ancho de la calzada y de
la vereda:

| Clase | Offset desde el eje |
| --- | --- |
| `primary` | 10 m |
| `secondary` | 8,5 m |
| `tertiary` | 7,5 m |
| `residential`, `unclassified`, `living_street` | 6,5 m |

Cuando la `way` trae `lanes`, gana sobre la clase: `offset = lanes × 3 m / 2 + 1,5 m`.
Los números son un punto de partida: la clase no siempre coincide con lo que se ve
(`9 de Julio` está como `residential` y no es angosta), así que la tabla admite
excepciones por calle.

**La geometría no se inventa de cero**: es el eje corrido, con la misma forma. Por eso
un tramo de vereda mide prácticamente lo mismo que su calzada, y por eso el error del
offset no se acumula a lo largo de la cuadra, sólo en el ancho.

### 3.5 La calle peatonal

`highway=pedestrian` **sin `area=yes`** entra como **una sola arista sobre su línea
central**, sin offset: no hay calzada en el medio, así que derivar dos lados crearía
dos aristas paralelas donde se camina en todo el ancho, y un cruce falso entre ellas.

La consecuencia en un cruce: en el eje de la peatonal hay **una línea** en lugar de
dos, así que las veredas de la calle que la corta terminan en el **eje** de la
peatonal y no en su borde. El cruce sobre esa calle mide el ancho de la calzada
cruzada, como corresponde, y las dos esquinas quedan ~1,5 m más adentro de lo real.
Se acepta: es más chico que el error del offset.

### 3.6 El boulevard

Cuando dos calzadas de la misma vía corren paralelas a **menos de 25 m**, en sentidos
opuestos (`oneway`) y con el **mismo `name`**, son un boulevard:

- Cada calzada aporta **su vereda exterior**, con el offset de su clase. La interior no
  se deriva como vereda: la ocupa la mediana.
- La mediana es **una sola franja caminable**, sobre la línea equidistante entre las
dos calzadas. No son dos veredas pegadas: modelarla como una sola arista es lo que
hace que caminar a lo largo cuente una vez.
- Cada brazo de la intersección tiene **dos cruces, uno por calzada**, que se encuentran
en un nodo de mediana. Cruzar el boulevard cuesta dos cruces y la mediana, que es lo
real.

La mediana es una vereda más: arranca con `accessibility_level` en `NULL`, se corta en
sus nodos y tiene su `street_name`. Su `osm_way_id` queda en `NULL`: no sale de una
`way` sino de las dos.

**La primera corrida detecta dos boulevards, no uno:** 13 pares de calzadas y 15 vías
fuera de la grilla. Bartolomé Mitre es el caso que este documento describía —dos `way`
separadas 13,4 a 14,6 m en 14 cortes a lo largo de la avenida—, y **Manuel Belgrano**
aparece con el mismo patrón entre 19,7 y 23,6 m, también `tertiary` y en calzadas de
sentido único dibujadas en sentidos opuestos.

Belgrano **no está dentro del polígono del piloto**: entra sólo por el búfer de 130 m,
y resulta ser la calle del extremo oeste del extracto. Por eso aparece en los números
de la corrida aunque el cuadrante de las plazas termine en Perú; cualquier recuento
sobre "la zona" tiene que decir si cuenta el búfer, porque el búfer no es el piloto
([10 §3](10-datos-y-zona-piloto.md)).

Con el umbral de 25 m las dos entran como boulevard y sus calzadas quedan fuera de la
grilla hasta #34, que es lo que el umbral pide. Las dos están verificadas: Mitre por el
relevamiento de este documento y Belgrano mirando el mapa. Si alguna vez aparece un
caso dudoso, la corrección es una excepción por calle, como las de los offsets (§3.4),
y no un umbral distinto para todas.

**El umbral es una detección, no una certeza.** Dos calzadas en el mismo sentido
separadas por una mediana no se detectan como boulevard: el importador les deriva
cuatro veredas, sin mediana, y la corrida lo reporta. Se corrige con una excepción por
calle, como los offsets.

### 3.7 Los cruces

Un cruce es una arista que atraviesa una calzada y une **dos esquinas enfrentadas**.
Se deriva **uno por brazo** de la intersección: cuatro en un cruce de cuatro brazos,
tres en una T. En la zona piloto son **267**: 60 intersecciones de cuatro brazos por
cuatro cruces, más las 9 T por tres. Contra los 18 que trae OSM, es otra cosa. (El
recuento anterior de 192 salía de estimar 45 cruces y 4 T mirando el mapa; con las
`way` de la grilla y la regla del grado 3 son 69 intersecciones.)

Su geometría es la **recta entre los dos nodos**, así que su largo sale de los del
offset de la calle cruzada: no hay un ancho de calzada que inventar por separado, y
un cruce sobre una avenida es más largo que uno sobre una calle interna.

`crossings` no tiene `street_name`: un cruce pertenece a la calle que cruza, y esa
calle tiene dos nombres posibles. El nombre del tramo sale de la vereda que lo
precede, que es lo que necesita la etiqueta humana (§4).

### 3.8 El nombre de la calle

`street_name` se copia del `name` de la `way`, **sin normalizar**: el callejero tiene
la misma calle con dos nombres según el tramo (`4 Norte / Sarmiento`) y abreviaturas
que no coinciden con OSM, y homologarlas es trabajo del emparejamiento con el
relevamiento ([12 §8](12-relevamiento-de-accesibilidad.md)).

Si la `way` no tiene `name`, `street_name` queda en `NULL`: no se hereda del tramo
vecino ni se inventa. Y si una cuadra está mapeada como dos `way` con **distinto
nombre**, la vereda se corta donde cambia el nombre, con un nodo que no es esquina:
`street_name` es una sola columna y no puede representar dos nombres. En la zona
piloto los cambios de nombre están en las esquinas, así que no debería agregar nodos a
mitad de cuadra; la primera corrida lo confirma o lo reporta.

## 4. La identidad de los elementos derivados

Los elementos derivados no tienen identificador externo: no vienen de una fila de
OSM, así que **no se inventa una numeración**. Los códigos por manzana o por eje
sirven para hablar y para las fichas de campo, y no se guardan como clave: si el
recorte se corre una cuadra, `M001` pasa a ser otra manzana aunque ninguna vereda se
haya movido. Un identificador tiene que poder derivarse del extracto, y de OSM no
salen manzanas: `M001` no se genera, se tipea.

**La identidad es geométrica, y ya está en las columnas:**

| Elemento | Clave |
| --- | --- |
| `kerb_nodes` | La coordenada, normalizada a **7 decimales** (~1 cm, la precisión del extracto): índice único sobre `ST_X` y `ST_Y` |
| `sidewalks` y `crossings` | El par de nodos en **orden canónico** (`least`/`greatest`): caminar es no dirigido, y A→B es la misma arista que B→A |

Las coordenadas que el importador **deriva** —esquinas y extremos de línea— se normalizan
además a **6 decimales** (~10 cm) antes de buscar su fila. La misma esquina calculada
desde dos pares de líneas distintos puede diferir en centímetros, porque el eje de los
dos tramos de la calle que pasa no coincide exactamente en el nodo: sin esa
normalización, la misma esquina entra como dos cordones a un centímetro de distancia y
la vereda de la boca de una T no encuentra sus dos nodos. Las coordenadas del extracto
no se tocan: ésas ya vienen con su precisión.

No hace falta una columna `key`. El par de nodos ya está en la tabla, y un hash
guardado sería un dato derivado que hay que recalcular y que depende de la función de
hash, no del grafo. La restricción que lo vuelve clave está en
`infra/migrations/1793486697815_add-graph-unique-indexes.sql`, con su
`Down Migration` ([#30](https://github.com/BLP-Technologies/rodando-x-mza/issues/30)), y
es lo que el importador usa para el `ON CONFLICT`.

El par de nodos es la clave **dentro de cada tabla**: una vereda y un cruce pueden
unir las mismas dos esquinas sin colisionar, porque cada tabla tiene su índice.

**La etiqueta humana se genera, no se guarda.** "Necochea, entre Perú y 25 de Mayo, lado
sur" se calcula desde el grafo —la calle, las dos esquinas de los extremos y el lado—
y es el mismo lenguaje que puede usar una ficha de campo, que es lo que permite
empezar el relevamiento antes que el importador
([12 §8](12-relevamiento-de-accesibilidad.md)).
El lado sale de la dirección de la marcha y de la geometría, no de una columna
([09 §4.3](09-modelo-de-datos.md#43-los-campos-que-se-eliminan)).

**La escritura es upsert, no borrar y recrear.** El importador nunca vacía las
tablas: inserta lo que no existe y actualiza lo que sí, por esas claves. Con eso los
`id` no cambian entre corridas, y con ellos sobreviven los obstáculos y los niveles de
accesibilidad que cuelgan de cada elemento —que es todo el punto de que la clave sea
estable.

Las tres protecciones que acompañan al upsert:

1. **Reanclaje por geometría.** Si un obstáculo apunta a un elemento que la nueva
   corrida no generó, se busca la vereda más cercana a su `geom` (a menos de ~5 m).
2. **Sin vínculo antes que vínculo falso.** Si no hay ninguna cerca, el obstáculo
   queda sin vínculo: en [09 §4.5](09-modelo-de-datos.md#45-reporte-y-obstáculo)
   colgar un obstáculo de cero elementos es válido y su `geom` es la fuente de verdad.
3. **Reporte de la corrida.** Cuántos nodos, veredas y cruces se crearon, se
   actualizaron y se reanclaron, cuántos quedaron sin vínculo, y los avisos de §3.2 y
   §3.6. Es lo que convierte una imperfección del extracto en algo visible.

**El test es barato:** importar dos veces sobre la misma base y comprobar que los ids
no cambiaron, que no hay filas nuevas y que los obstáculos conservan sus vínculos.

### 4.1 Cómo se corre

El importador es un comando del backend, y todo lo que escribe va en una sola
transacción:

```bash
cd backend
cp .env.example .env                      # DATABASE_URL, NODE_ENV, PORT
pnpm migrate                              # las migraciones del grafo y sus índices
pnpm import:osm [ruta]                    # por defecto ../data/pilot-zone.osm
```

La base es la del `docker compose -f infra/docker-compose.yml up -d db`, que ya trae
PostGIS y pgRouting. El extracto **no se versiona** (10 §4): se genera con
`node scripts/fetch-pilot-zone-osm.mjs`. Si la ruta no existe o el archivo no trae
vías, el comando falla con un mensaje que dice eso, y no deja nada escrito.

El **reporte de la corrida** sale por la salida estándar con el logger del backend, y
es lo que hay que leer antes de mirar el grafo: vías leídas, incluidas y descartadas por
clase, calzadas de boulevard fuera de la grilla, tramos, intersecciones por tipo,
cordones y veredas creados y reusados, líneas que `ST_OffsetCurve` devolvió partidas o
vacías, y una advertencia por cada intersección que no se derivó o T que quedó sin su
vereda de la boca. Correrlo dos veces seguidas tiene que dar `created: 0` en cordones y
veredas, y es lo que hace el test de integración con el extracto de prueba.

## 5. El grafo para pgRouting

`pgr_dijkstra` necesita **una sola relación** con `id`, `source`, `target` y `cost`,
y el grafo tiene dos tablas de aristas cuyos `id` se pisan. La vista
`walkable_edges` resuelve eso y es donde se escribe una sola vez el costo
([09 §4.7](09-modelo-de-datos.md#47-el-costo-de-las-aristas-se-calcula-no-se-guarda)):

| Columna | Contenido |
| --- | --- |
| `id` | **Sintético y determinista**: `2 × id` para una vereda, `2 × id + 1` para un cruce |
| `source`, `target` | `start_node_id` y `end_node_id` |
| `cost` | La fórmula de [09 §4.7](09-modelo-de-datos.md#47-el-costo-de-las-aristas-se-calcula-no-se-guarda) |
| `geom` | La geometría de la arista, para reconstruir el recorrido |
| `element_kind`, `element_id` | Qué fila de qué tabla es, para volver de la arista al elemento |

Dos consecuencias:

- **La topología ya está resuelta por el modelo.** `pgr_createTopology` existe para
deducir `source` y `target` de una tabla de geometrías sueltas; acá los nodos son
filas y las aristas los referencian por FK. Construirla y validarla con una consulta
es #13, y el resultado esperado es que no haya nada que deducir.
- **Caminar es no dirigido.** Alcanza con `cost` y `directed => false`: no hace falta
  `reverse_cost`. Una vereda `NONE` no se filtra con un `WHERE`, se cobra `-1`
  ([09 §4.7](09-modelo-de-datos.md#47-el-costo-de-las-aristas-se-calcula-no-se-guarda)).

El identificador sintético no colisiona y no depende de una secuencia: la misma base
importada dos veces da los mismos ids, y una consulta guardada en un log se puede
volver a leer.

## 6. Lo que OSM no puede modelar

| Caso | Por qué no entra | Qué se hace |
| --- | --- | --- |
| **Senderos de plazas** (153 `footway`) | No son paralelos a ninguna calle, no tienen cordón ni dato de accesibilidad, y el modelo no tiene "área caminable" | Fuera del MVP. El ruteo termina en el nodo del borde más cercano al destino. Se revisa cuando el relevamiento cubra los senderos |
| **Plazas como destino interior** (`area=yes`) | Lo mismo: entrar y salir de una plaza necesita un área, no una arista entre cordones | Fuera del MVP, y documentado en la ficha de campo |
| **Cruces a mitad de cuadra** (18 `footway=crossing`, 128 nodos `highway=crossing`) | Se derivan los cruces por brazo; los de OSM no alcanzan y mezclarlos deja intersecciones sin cruce | No se leen. Consecuencia explícita: **el grafo no tiene nodos a mitad de cuadra**; el caso de [09 §4.4](09-modelo-de-datos.md#44-el-modelo-en-la-calle) aparece sólo si el portal crea uno, y eso está fuera del MVP |
| **Cordones por nodo** (`kerb`, 4 en el búfer) | Es accesibilidad, no geometría, y hay 4 en toda la zona | No se leen: `kerb_nodes.accessibility_level` nace en `NULL` y lo llena el relevamiento |
| **Ancho real de cada calle** | OSM casi nunca lo trae, y relevar anchos no está en el alcance | Offset por clase y `lanes` (§3.4). Es aproximado; el largo del tramo no depende de él |
| **Dos calzadas en el mismo sentido** | La detección de boulevard pide sentidos opuestos (§3.6) | Se derivan cuatro veredas sin mediana, y la corrida lo reporta |
| **Altura: puentes, túneles, `layer`** | El modelo es plano: dos calles que se cruzan a distinto nivel se derivan como intersección | No hay caso en la zona; si lo hubiera, se excluye la `way` del nivel superior y se reporta |
| **Restricciones peatonales** (`foot=no`, `access=no`, `sidewalk=no`) | El MVP asume que en la zona piloto se camina por los dos lados de toda calle | No se leen. Un cierre real de calle es un obstáculo `CRITICAL`, no un tag |
| **Escaleras** (9 `steps`) | No son una calle | Fuera del grafo; quedan anotadas como barrera para marcarlas como obstáculo más adelante |
| **`service`** (34) | Entradas de auto, playas, accesos: derivarles veredas inventa veredas sobre una cochera | Fuera del grafo |
| **El tercer sentido de una vía** | `oneway` describe el tránsito vehicular, no el peatonal | Se ignora: para el peatón toda calle se camina en los dos sentidos |

La lista no es un catálogo de defectos: cada fila es una decisión de alcance con un
disparador para revisarla, y el disparador más frecuente es el relevamiento.

## 7. Lo que este documento no decide

- **El importador.** El código que aplica §2 a §4, y su forma: script por lotes,
  transacción, reporte. Es #12.
- **La construcción y validación de la topología.** Que las aristas queden
  efectivamente conectadas y que una consulta devuelva un recorrido entre dos puntos
  conocidos: #13.
- **Los índices únicos** de §4 ya existen; #12 los usa para el upsert.
- **El valor de los offsets** (§3.4) y del umbral de boulevard (§3.6). Son puntos de
  partida, y se ajustan mirando el mapa de la zona piloto.
- **La fórmula del costo.** Vive en [09 §4.7](09-modelo-de-datos.md#47-el-costo-de-las-aristas-se-calcula-no-se-guarda).
- **La normalización de nombres** de calle: es del emparejamiento con el relevamiento
  ([12 §8](12-relevamiento-de-accesibilidad.md)).

## 8. Documentos relacionados

- [09-modelo-de-datos.md](09-modelo-de-datos.md): el esquema que estos datos pueblan,
  y el costo de las aristas.
- [10-datos-y-zona-piloto.md](10-datos-y-zona-piloto.md): la zona y el extracto.
- [12-relevamiento-de-accesibilidad.md](12-relevamiento-de-accesibilidad.md): de dónde
  sale la accesibilidad de estas veredas y esquinas.
- [01-diagramas.md](01-diagramas.md): el DER y los diagramas del modelo en la calle.
- [07-plan-de-trabajo.md](07-plan-de-trabajo.md): fases y definición de terminado.
- [`data/README.md`](../data/README.md): el polígono y la procedencia del extracto.

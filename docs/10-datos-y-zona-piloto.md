# Datos y zona piloto

> Documento temático. Define qué área entra en el piloto de la Fase 1, de dónde salen
> los datos crudos, en qué formato se obtienen, qué queda versionado, qué se deriva del
> extracto y qué aporta el relevamiento de campo. Es el estado vivo de esas decisiones: se
> edita en su lugar cuando cambian. Se complementa con
> [09-modelo-de-datos.md](09-modelo-de-datos.md), que define el esquema,
> y con [02-stack-y-estructura.md](02-stack-y-estructura.md), que define el acceso a
> datos.

## 1. Alcance

Este documento responde:

- **Qué área** es la zona piloto y por qué ese recorte (§2).
- **De dónde y en qué formato** salen los datos crudos (§3).
- **Qué se versiona** y qué no (§4).
- **Qué contiene** el extracto, medido (§5).
- **Qué obliga a derivar** este extracto (§6).
- **Qué aporta el relevamiento** de campo, con qué datos, y qué queda fuera del MVP (§7).

No decide el modelo del grafo ni las reglas de conversión —eso es
[11-grafo-peatonal.md](11-grafo-peatonal.md)—, ni la topología de pgRouting ni el
importador, que son #12 y #13. Tampoco las convenciones del esquema, que están en
[09](09-modelo-de-datos.md). Este documento describe la zona, la fuente y el
relevamiento; las reglas con las que el extracto se convierte en grafo viven en `11`,
porque son el modelo del grafo y no una propiedad del recorte.

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

## 7. El relevamiento: qué entra a la base

El importador aporta **dónde** está cada vereda; el relevamiento de campo aporta **cómo
está**. Sin él, el grafo existe con todo en `NULL` y el ruteo no distingue una vereda rota de
una nueva. Es la única fuente de accesibilidad de la que va a disponer el MVP, porque OSM no
trae ni veredas ni cordones (§5).

### 7.1 Qué tiene que producir cada ficha

Por **vereda**, identificada por su geometría ([11 §4](11-grafo-peatonal.md)):

| Dato | Cómo se registra |
| --- | --- |
| Nivel de accesibilidad | `FULL`, `PARTIAL`, `NONE` o **sin relevar**, que es un valor válido del sistema y no un casillero vacío |
| Verificación | Si el dato salió de una imagen o de una visita, con **fecha de la imagen** y **fecha de la revisión** por separado (`is_verified` solo es verdadero con visita) |
| Obstáculos | Tipo del catálogo de once (`docs/09` §4.2) y severidad (`MINOR`, `MODERATE`, `CRITICAL`); la descripción libre va aparte |
| Rampas | **En la esquina**, no en el cruce: un cruce tiene dos esquinas, y cada una su nivel |

`is_verified` es un eje distinto del nivel (`docs/09` §4.1): una vereda puede estar `PARTIAL`
según una imagen y seguir sin verificar. Un registro "visto en una foto" no es una
verificación, y esa distinción es la que evita que el ruteo mienta.

**La geometría no hace falta que la produzca el relevamiento**: la deriva el importador
([11 §3.4](11-grafo-peatonal.md)). Pedirla otra vez duplicaría el dato y garantizaría que
las dos versiones discrepen.

### 7.2 Cómo se cruza con el grafo, sin bloqueo mutuo

El relevamiento no necesita esperar al importador. Su unidad —el tramo entre dos
intersecciones con sus dos veredas enfrentadas— es la misma que la del grafo, así que puede
empezar escribiendo la clave en palabras ("Necochea, Perú → 25 de Mayo, lado sur"). Cuando
exista el grafo, ese texto se empareja una sola vez con las veredas generadas, y las que no
matcheen marcan un error en alguno de los dos lados: es una verificación barata y útil, no un
retrabajo.

**Los nombres son un problema real.** El callejero tiene la misma calle con dos nombres
según el tramo (`4 Norte / Sarmiento`) y abreviaturas que no coinciden con OSM (`Av. España`
es `España`; `General Espejo` es `Gral. Gerónimo Espejo`). Para emparejar hace falta una
forma canónica por calle, y conviene que sea la de OSM, que es de donde sale la geometría.

### 7.3 Lo que queda fuera del MVP

| Dato | Por qué no entra ahora | Qué hacer con él mientras tanto |
| --- | --- | --- |
| Alturas domiciliarias | No hay dónde guardarlas: el esquema no tiene numeración de puerta | Registrarlas **vinculadas a la vereda**, en la misma hoja. Importarlas después es un join, no un segundo relevamiento |
| Lugares de interés | El MVP no tiene tabla de lugares ni los usa en la ruta | Igual: vinculados a la vereda que los enfrenta |
| Senderos de plaza y la conexión a través de Plaza Independencia | El modelo solo conoce aristas entre cordones: no existe la "área caminable" ([11 §6](11-grafo-peatonal.md)) | Relevar la continuidad peatonal es útil, pero la app no va a rutear por adentro de la plaza. Es la primera extensión a evaluar cuando el MVP esté cerrado |

Ninguna de las tres se descarta: se **saca del alcance del MVP** y se deja el dato en la
misma hoja, para que el trabajo de campo no se repita. Lo que no se hace es prometer en la
app lo que el modelo no puede mostrar.

## 8. Lo que este documento no decide

- **El modelo del grafo y las reglas de conversión.** Viven en
  [11-grafo-peatonal.md](11-grafo-peatonal.md).
- **El importador.** El código que las aplica: #12.
- **La topología de pgRouting.** Construirla y validarla con una consulta: #13.
- **El ancho exacto de cada calle.** [11 §3.4](11-grafo-peatonal.md) es una aproximación
  por clase, con `lanes` cuando existe. Se revisa con el mapa delante.
- **Modelar áreas caminables.** Hoy no existe en el esquema; es lo que haría falta para
  incluir las plazas como destino interior (§7.3 y [11 §6](11-grafo-peatonal.md)).

## 9. Documentos relacionados

- [09-modelo-de-datos.md](09-modelo-de-datos.md): el esquema que estos datos van a poblar.
- [11-grafo-peatonal.md](11-grafo-peatonal.md): cómo se convierte este extracto en el grafo.
- [02-stack-y-estructura.md](02-stack-y-estructura.md): acceso a datos y convenciones.
- [03-despliegue-y-operacion.md](03-despliegue-y-operacion.md): atribución y operación.
- [07-plan-de-trabajo.md](07-plan-de-trabajo.md): fases y definición de terminado.
- [`data/README.md`](../data/README.md): el polígono y la procedencia del extracto.

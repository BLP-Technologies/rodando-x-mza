# El portal de moderación

> Documento temático. Define el portal como aplicación: qué resuelve hoy, cómo
> está armado por dentro, cómo consigue la sesión, cómo habla con la API y cómo
> dibuja el mapa. Es el estado vivo de esas decisiones: se edita en su lugar
> cuando cambian. Se complementa con
> [15-integracion-con-el-cliente.md](15-integracion-con-el-cliente.md), que
> define la integración con la API, con
> [14-la-api-del-grafo.md](14-la-api-del-grafo.md), que define lo que el mapa
> lee, con [18-la-api-de-obstaculos.md](18-la-api-de-obstaculos.md), que define el alta y el
> cierre de un obstáculo, y con [05-desarrollo.md](05-desarrollo.md), que tiene los comandos.

## 1. Alcance

Este documento responde:

- **Qué hace hoy** el portal y qué todavía no (§2).
- **Dónde vive cada cosa** dentro de la aplicación, y por qué (§3).
- **De dónde sale** el "soy moderador", que hoy es falso (§4).
- **Cómo el mapa** lee el grafo, lo dibuja y avisa lo que no puede mostrar (§5).
- **De dónde salen** los tipos del contrato y la dirección de la API (§6).
- **Cómo se corre** y dónde están los comandos (§7).
- **Qué pantalla sirve a cada objeto de trabajo** —el grafo, los reportes, los obstáculos—
  y por qué son pantallas distintas (§8).

No decide el contrato de cada endpoint —es de
[14](14-la-api-del-grafo.md) y de [13](13-api-de-ruteo.md)—, ni las reglas de
la integración —URL como configuración, CORS y traducción de errores, que son de
[15](15-integracion-con-el-cliente.md)—, ni la puesta en marcha completa, que es
de [05 §4](05-desarrollo.md).

## 2. Qué hace hoy: el grafo, los reportes y los obstáculos

El portal es una aplicación **aparte del backend**, en `portal/`: Next.js 16,
React 19, Tailwind 4 y TypeScript (`package.json`). Se sirve en el puerto 3000 y
habla con la API por HTTP, igual que va a hacerlo la app mobile.

Hoy resuelve tres de las preguntas del moderador en la zona piloto —**qué hay y cómo
está**, **corregir el nivel** y **publicar o cerrar una barrera**— y abre la cola de
reportes para revisarla, con estas cosas:

- **Dibuja el grafo** que devuelve `GET /api/graph`: veredas y cruces como
  líneas, cordones como puntos, y el nivel de accesibilidad como color (§5.3).
- **Selecciona un elemento** con un clic y muestra sus propiedades
  —`element_kind`, `element_id`, `level`, `is_verified`, `street_name`— en un
  panel al costado. Las propiedades vienen en la respuesta del grafo; lo único que el
  panel pide aparte son los obstáculos del elemento (§5.6), porque las lee otra
  lectura ([18 §4](18-la-api-de-obstaculos.md#4-la-lectura)). Tampoco hay endpoint de
  detalle de un elemento ([14 §8](14-la-api-del-grafo.md#8-lo-que-este-documento-no-decide)).
- **Edita el nivel** de un elemento desde la ficha: `FULL`, `PARTIAL`, `NONE` o "sin
  dato", con un `PATCH` que escribe una sola columna y deja el elemento verificado
  (§5.6).
- **Avisa** cuando la API recortó la respuesta por el tope de 2000 (§5.4) y
  cuando no responde.
- **Dibuja el borde del área de servicio activa** como una línea de guiones, con
  su nombre en una leyenda, para que el moderador vea dónde termina la zona (§5.7).
- **Lista los reportes ciudadanos** en una pantalla propia, `/reports`: una tabla del
  estado elegido —tipo, severidad, fecha— y, al costado, el detalle del seleccionado
  con su foto y un minimapa del punto (§8). El mapa del grafo **no** los dibuja: son
  otro objeto de trabajo. Desde ese detalle se **aprueba** el reporte —lo que crea el
  obstáculo con el punto que alguien reportó— o se **descarta** (§8.1).
- **Publica y cierra obstáculos** en otra pantalla propia, `/obstacles`: un mapa con los
  obstáculos como puntos de color por severidad, el detalle al costado y el alta inline
  con un clic en el mapa (§8.2). El obstáculo cargado afecta el ruteo desde la consulta
  siguiente; resolverlo lo saca del costo ([09 §4.7](09-modelo-de-datos.md#47-el-costo-de-las-aristas-se-calcula-no-se-guarda)).
- **Muestra los obstáculos de un elemento** en su ficha del mapa del grafo, activos
  primero y resueltos después (§5.6).

Lo que **no** hace todavía: calcular recorridos —no hay pantalla de ruta, `/routes`—,
buscar una calle y autenticar personas (la sesión es simulada, §4). Tampoco edita un
obstáculo ya publicado: se resuelve y se publica otro
([18 §8](18-la-api-de-obstaculos.md#8-lo-que-este-documento-no-decide)).

**Por qué el mapa y no una tabla.** La unidad de trabajo del portal es el área,
no la fila: quien modera mira dónde está el paso y cómo está el resto del
recorrido alrededor. Por eso el mapa es la pantalla y el panel de propiedades es
su consecuencia, y no al revés ([14 §2](14-la-api-del-grafo.md)).

## 3. Estructura de la aplicación

Igual que en el backend, el código se organiza **por funcionalidad** y no por
capa técnica ([02 §3](02-stack-y-estructura.md)):

```
portal/src/
├── app/        # rutas: orquestan, no implementan
├── api/        # el cliente HTTP tipado y el contrato generado
├── map/        # la funcionalidad del mapa
├── reports/    # la pantalla de reportes
├── obstacles/  # la pantalla de obstáculos
├── session/    # la sesión del portal
└── config.ts   # la URL de la API y la caja del piloto
```

| Pregunta | Destino |
| --- | --- |
| ¿Es una ruta o un layout? | `app/` |
| ¿Es la pantalla del mapa o una parte suya? | `map/` |
| ¿Es la pantalla de reportes o una parte suya? | `reports/` |
| ¿Es la pantalla de obstáculos o una parte suya? | `obstacles/` |
| ¿Habla con la API? | `api/` |
| ¿Responde quién es la persona que modera? | `session/` |
| ¿Es un valor que cambia entre entornos? | `config.ts` |

Los componentes de `app/` **orquestan**: el layout resuelve la sesión, monta el
proveedor de datos (`providers.tsx`) y la página monta el panel del mapa. La
lógica de Leaflet, los estilos y el panel de propiedades viven en `map/`, así que
una segunda pantalla puede reusar el mapa sin copiarlo.

**El estado de datos del cliente es de [TanStack Query](https://tanstack.com/query)**
(§5.4). Una sola caché de queries para todo el grupo `(portal)`, montada en
`app/(portal)/providers.tsx`: va ahí y no en el layout raíz porque `(auth)` no
hace ninguna consulta.

### Los dos grupos de rutas

```
portal/src/app/
├── layout.tsx        # layout raíz: <html>, fuentes, metadatos
├── (auth)/           # login, register, reset-password
└── (portal)/         # layout con la barra + page con el mapa, en "/"
```

Los paréntesis son grupos de rutas: **organizan sin agregar un segmento a la
URL**, así que `(portal)/page.tsx` responde en `/`. Los dos grupos conviven
porque resuelven rutas distintas —`(auth)` sólo define `/login`, `/register` y
`/reset-password`—; dos grupos que definieran la misma URL serían un error de
Next. Está verificado en la documentación que trae el propio paquete
(`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`),
no de memoria: ahí dice, textual, que rutas de grupos distintos no deben resolver
a la misma URL y que, sin layout raíz compartido, el `/` va dentro de uno de los
grupos.

`(auth)` es trabajo de otra tanda y este documento no lo decide: el portal sólo
comparte el layout raíz con esas pantallas.

## 4. La sesión: un módulo, un consumidor

`src/session/session.ts` es el único lugar donde el portal responde "quién está
moderando":

- Exporta `Session` —`id`, `name`, `email`, `isModerator`— con la forma que va a
  tener la tabla `users` ([09](09-modelo-de-datos.md)).
- Exporta `getSession(): Promise<Session | null>`, y hoy devuelve **un moderador
  literal** de mentira.

**Por qué `async` y por qué puede ser `null` desde hoy.** El mock nunca es
`null`, pero el día que `getSession` consulte el auth real va a leer una cookie,
esperar y poder no encontrar a nadie. Si la firma cambiara ese día, todos los
llamadores cambiarían con ella; como ya es la definitiva, el reemplazo es el
cuerpo de la función y nada más.

**Un solo consumidor.** `app/(portal)/layout.tsx` llama a `getSession()` una vez,
hace `if (!session) redirect('/login')` y le pasa el moderador a la barra. Ese
`if` es la costura del auth real y **la única guarda del portal**: no hay
`middleware.ts`, ni contexto de React, ni cookies de mentira, ni un login
simulado, ni un `redirect` a `/login` desde ningún otro lado.

**Cómo se reemplaza.** Se reescribe el cuerpo de `getSession` para leer la sesión
del auth real; cuando devuelva `null`, la redirección ya está escrita y el resto
del portal no se entera. Lo único que hay que sacar ese día es la marca de
"sesión simulada" de la barra.

**La marca es parte del diseño.** La barra dice **"sesión simulada"** al lado del
nombre justamente para que nadie confunda estas pantallas con un login real
mientras no haya auth ([07](07-plan-de-trabajo.md), Fase 3).

**Lo que no se hace, y por qué.** Nada fuera de `session/` consulta ni deduce la
sesión: ni los componentes del mapa, ni el cliente de la API, ni las páginas. Lo
caro de la sesión falsa no es el módulo —son treinta líneas—, es repartir el "soy
moderador" por componentes y guardas: ahí el reemplazo deja de ser un archivo.

## 5. El mapa

### 5.1 Librería

**Leaflet 1.9 y tiles raster de OpenStreetMap**, sin claves de API. Un mapa de
vectores (MapLibre, OpenLayers) resolvería cosas que acá no hacen falta —estilos
por capa desde un servidor de tiles, millones de features, proyecciones
exóticas— a cambio de una configuración que el piloto no paga: lo que se dibuja
son ~1000 elementos sobre un recorte de 0,5 km².

**El mapa se monta a mano, sin `react-leaflet`.** La librería envolvía bien el
caso de "un mapa que se dibuja y no se toca", pero su `MapContainer` crea el mapa
una vez y lo destruye en el cleanup de su efecto **sin volver a crearlo** cuando
React re-monta el componente: como `Map.remove()` vacía los panes de Leaflet, las
capas que se le seguían agregando reventaban en `getPane(...).appendChild` al
volver al grafo desde otra pantalla. Con el ciclo en nuestras manos, cada montaje
crea un mapa y lo destruye al desmontarse
([`graph-map.tsx`](../portal/src/map/graph-map.tsx)), y las capas se dibujan en
efectos sobre esa instancia: no hay un mapa que sobreviva a su propio `remove()`.
El costo es una veintena de líneas de `new L.Polyline(...)` en vez de componentes.

### 5.2 Leaflet no existe en el servidor

Leaflet lee `window` cuando se importa, así que su módulo no puede evaluarse en
el servidor, y Next prerenderiza las páginas en el build. Las dos piezas que lo
resuelven:

- **`src/map/map-panel.tsx`** es un componente de cliente que monta el mapa con
  `next/dynamic` y `ssr: false`.
- **`src/map/graph-map.tsx`** es el que importa Leaflet, y por eso sólo se carga
  en el navegador.

El `ssr: false` **sólo se admite dentro de un componente de cliente**: en un
componente de servidor Next falla el build. Eso es lo que hace que exista un
`map-panel` de tres líneas en vez de montar el mapa directamente desde la
página. Está en la documentación del paquete
(`node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`).

El contenedor del mapa y la atribución, en cambio, **sí** salen en el HTML del
servidor: la página se puede leer y auditar sin JavaScript.

**El mapa se monta y se destruye con el montaje del componente.** No hay una
instancia que viva más que el efecto que la creó: al desmontar se vacían las
capas, se sueltan los listeners y se llama a `map.remove()`
([16 §5.1](#51-librería)). Eso es lo que hace que volver al grafo desde otra
pantalla arme un mapa sano, que era lo que fallaba con `react-leaflet`.

**Los datos se piden desde el navegador.** El build del portal corre en CI, donde
no hay backend: un `fetch` del grafo en el servidor fallaría el build o —peor—
dejaría un mapa vacío cacheado. La página queda estática (`○ /` en la salida de
`next build`) y el mapa se llena en el navegador cuando Leaflet está listo.

### 5.3 El estilo por nivel

| `level` | Color | Qué significa |
| --- | --- | --- |
| `FULL` | verde | accesible |
| `PARTIAL` | ámbar | accesible con dificultad |
| `NONE` | rojo | no accesible |
| `null` | gris | **nadie lo relevó** |

`null` no es un cuarto nivel del enum: es la ausencia de dato, y es el caso más
común del grafo importado ([09 §4.1](09-modelo-de-datos.md)). Por eso el gris es
un color propio y no se confunde con el rojo de `NONE`: pintar lo no relevado
como "no accesible" sería el peor error posible en una aplicación de
accesibilidad. Hoy **todo** el piloto está en `NULL` —nadie relevó todavía—, así
que el mapa se ve gris: es el dato, no una falla del dibujo.

Las veredas y los cruces se dibujan como líneas de cuatro píxeles y los cordones
como puntos chicos, porque un cordón es un vértice y no un tramo. Un elemento
seleccionado engrosa el trazo y sube la opacidad: alcanza para encontrarlo sin
tapar el resto del grafo.

### 5.4 La vista, el refetch y el tope

Los datos del mapa son **una query por área**: `useQuery` con la clave
`['graph', minLon, minLat, maxLon, maxLat]` y `readGraph(bbox)` como `queryFn`.
La clave es el área, así que pedir otra área es pedir otra entrada de caché y no
hay que coordinar nada a mano.

- **La vista inicial es la caja del piloto**, con las cuatro esquinas de
  [`data/pilot-zone.geojson`](../data/pilot-zone.geojson)
  ([10 §2](10-datos-y-zona-piloto.md)) como constantes en `src/config.ts`. La
  API ya expone `service_areas`, pero la constante se queda: el primer pedido
  necesita un bbox antes de tener cualquier respuesta, y el área activa es la
  zona corrida 50 m hacia afuera, no la caja del piloto. Encima, encuadrar al
  área metería en pantalla un borde que el grafo no llena.
- **La primera respuesta reencuadra el mapa** al grafo recibido, una sola vez por
  montaje. Después manda el usuario: reencuadrar en cada paneo haría imposible
  panear. El `fitBounds` suprime el `moveend` que él mismo dispara, o se pediría
  dos veces la misma área.
- **Al terminar un paneo o un zoom se vuelve a pedir el área visible**, con una
  espera de 300 ms para no pedir una vez por cada cuadro del arrastre, y el bbox
  se redondea a 5 decimales (~1 m) para que dos paneos que terminan en el mismo
  lado compartan clave. El pedido es el `bbox` de la vista y no el del piloto: al
  acercarse, el grafo se ve completo aunque el área sea más chica.
- **Lo que la librería no hace, y por eso sigue escrito a mano**: el debounce del
  `moveend`, el `fitBounds` inicial y la supresión del `moveend`. Tampoco la
  selección, que es estado de interfaz y no del servidor: meterla en la caché
  sería el error clásico.
- **`placeholderData: keepPreviousData`**: mientras llega el área nueva el mapa
  sigue dibujando la anterior, en vez de vaciarse en cada paneo.
- **`gcTime` de un minuto**: cada área deja su colección (30–230 KB), así que una
  sesión de paneo acumularía decenas con el default de cinco minutos. Al minuto
  se liberan, y volver a la vista anterior sigue siendo instantáneo.
- **Un reintento y no tres**: el default de la librería espera ~7 s antes de
  mostrar el error, y con la API caída el mapa se quedaría en "Cargando el
  grafo…" todo ese rato.
- **El tope de 2000 se avisa en pantalla** ([14 §5.1](14-la-api-del-grafo.md)):
  si la API devuelve `truncated: true`, el mapa lo dice y propone acercarse.
  Recortar en silencio mentiría sobre lo que hay en la zona.
- **Si la API no responde, el mapa lo dice**: un cartel con el motivo en español
  y un botón de reintentar que vuelve a pedir la misma área. No hay pantalla rota
  ni un error que sólo exista en la consola.

**`cacheComponents` y las queries.** Next 16 prerenderiza también los componentes
de cliente, y una query activa durante el prerender lee el reloj y puede romper el
build (`blocking-prerender-current-time`). La del mapa no corre ese riesgo porque
vive debajo de un `ssr: false` ([§5.2](#52-leaflet-no-existe-en-el-servidor)): nunca
se renderiza en el servidor. Si alguna vez una `useQuery` sale de ahí —un panel de
detalle sin mapa, por ejemplo—, tiene que quedar detrás de un `Suspense`.

### 5.5 La atribución

El mapa muestra **"© OpenStreetMap contributors"** en el control de atribución
de Leaflet, alimentado por el `attribution` de la capa de tiles, y además como
leyenda al pie. No es cortesía: los datos son ODbL 1.0 y la atribución es
obligatoria ([10 §3](10-datos-y-zona-piloto.md), [15 §7](15-integracion-con-el-cliente.md)).

### 5.6 La ficha y la edición del nivel

El panel del elemento (`map/feature-details.tsx`) muestra las propiedades que ya vienen
en la respuesta del grafo, la lista de obstáculos que cuelgan de él y, debajo, el
formulario del nivel (`map/level-form.tsx`): cuatro opciones —`FULL`, `PARTIAL`, `NONE` y
"sin dato"— y un botón que se habilita sólo si el valor cambió.

**Los obstáculos del elemento** son lo único que la ficha pide aparte: la lectura del grafo
no los trae ([18 §4](18-la-api-de-obstaculos.md#4-la-lectura)). Se leen **una vez** con
`status=ALL` —la misma clave de caché que usa la pantalla de obstáculos, así las dos
comparten la entrada— y se filtran en el cliente por `element_kind` y `element_id`, que es
el par que la respuesta ya trae ([18 §4](18-la-api-de-obstaculos.md#4-la-lectura)).

- **Activos primero, resueltos después.** Lo que sigue en la calle es lo que importa; un
  obstáculo resuelto queda como historia del elemento y se marca como tal.
- **No hay filtro por elemento en la API.** Agregarlo sería un parámetro para un caso que
  el mapa resuelve con lo que ya recibió: la zona tiene decenas de obstáculos, no miles.
- **No puede romper la ficha.** Mientras la lectura está en curso, o si falla, la lista no
  se dibuja y el resto del panel —las propiedades y el nivel— funciona igual. La ficha no
  depende de una segunda consulta para lo que sí resolvía antes.
- **No se edita desde acá.** Resolver y publicar se hacen en `/obstacles`; la ficha del
  grafo sólo muestra, para no tener dos lugares donde se escribe el mismo dato.

- **Escribe con un `PATCH`** a `/api/graph/elements/<kind>/<id>`
  ([14 §7](14-la-api-del-grafo.md)), con la identidad que ya está en las propiedades del
elemento: el formulario no arma ni adivina ninguna clave.
- **`is_verified` no se manda.** Lo decide el servidor como `level IS NOT NULL`, así que
  guardar un nivel verifica el elemento y "sin dato" lo desverifica
  ([12 §8.2](12-relevamiento-de-accesibilidad.md)). Por eso la ficha no necesita
  advertir nada al elegir "sin dato": lo que muestra es el resultado, que es el
  `is_verified` que devolvió el servidor después de guardar.
- **Después de guardar se invalida el grafo** (`invalidateQueries` sobre el prefijo
`['graph']`): sólo el área que está en pantalla se vuelve a pedir, la arista se repinta
con su color nuevo y la ficha muestra el `is_verified` que puso el servidor. No hace
falta tocar la selección: se resuelve por `element_kind:element_id`, así que sobrevive al
refetch.
- **Mientras guarda** el botón dice "Guardando…" y el formulario queda deshabilitado; si
falla, el texto sale del mismo mapeo `código → español`, con los mensajes de guardado
separados de los de lectura ([15 §6](15-integracion-con-el-cliente.md)).
- **No hay campos para `street_name` ni geometría**: no están decididos y no se editan
([14 §8](14-la-api-del-grafo.md)). Tampoco hay confirmación aparte por pisar dato
relevado: la edición **es** el forzado explícito
([12 §8.2](12-relevamiento-de-accesibilidad.md)).

### 5.7 El área de servicio

El mapa dibuja el **borde del área activa** con una línea de guiones azul, sin relleno
(`serviceAreaStyle()` en `map/feature-style.ts`), y su nombre en una leyenda arriba a la
izquierda. El dato viene en `service_areas` de la respuesta del grafo
([14 §5.2](14-la-api-del-grafo.md)).

- **Azul, 4 px, guiones, sin relleno.** El azul es el quinto color, fuera de la paleta de
  niveles (§5.3), para que el borde no se lea como un dato de accesibilidad: es el límite
  de la zona, no el estado de un elemento.
- **Va por debajo del grafo.** En Leaflet el orden en que se agregan las capas es el
  orden de pintado, así que el área se agrega antes que las líneas y los puntos. El área
  es contexto: no puede tapar lo que el moderador tiene que mirar.
- **`interactive: false` es lo que hace que no capture clics.** Leaflet le pone
  `pointer-events: none` a la capa, así el clic sigue llegando a la vereda de abajo o al
  fondo del mapa, que es el que suelta la selección. Por eso la leyenda es un `<p>` del
  contenedor y no un tooltip: un tooltip exigiría una capa interactiva.
- **La leyenda muestra el nombre.** Arriba a la izquierda, fuera del centro donde viven el
  cartel de carga y el de error, con `pointer-events-none` para no tapar el mapa. Se
  dibuja sólo si hay al menos un área. Con varias, el texto las lista separadas por coma.
- **No entra en el encuadre inicial.** El `fitBounds` y el aviso de tope miran sólo las
  features del grafo (§5.4): el área es la zona corrida 50 m hacia afuera, y encuadrarla
  achicaría el grafo sin motivo.
- **Se dibujan todas, sin conmutación por capa.** Prender y apagar capas desde una lista es
  trabajo de otra tarea; hoy el único control del mapa es el paneo.

## 6. El cliente HTTP y el contrato

- **Los tipos no se escriben a mano.** `openapi-typescript` es una dependencia de
  desarrollo y `pnpm api:types` regenera `src/api/schema.d.ts` desde
  `http://localhost:3001/api/openapi.json` ([15 §2](15-integracion-con-el-cliente.md)).
- **El archivo generado se commitea**, porque el build de CI no tiene un backend
  levantado al que preguntarle el contrato.
- **El archivo generado no se edita a mano.** No se le agregan tipos, ni
  parches, ni `eslint-disable`: `eslint.config.mjs` lo ignora como código de
  terceros. Si algo está mal ahí, el error está en el esquema Zod del backend y
  la solución es corregirlo y regenerar.
- **`src/api/client.ts`** es el envoltorio de `fetch`: toma la URL base de
  configuración, traduce el sobre de error `{ error: { code, details? } }` a un
  `ApiError` con `code` y `details`, y deja que un código desconocido llegue
  igual —quien lo muestre cae al mensaje genérico
  ([15 §6](15-integracion-con-el-cliente.md))—.
- **`src/api/graph.ts`** es la única función que conoce `GET /api/graph`: recibe
  el bbox y devuelve las features, `truncated` y las áreas activas, tipados con el esquema
  generado.
- **`src/api/error-messages.ts`** es el mapeo `código → texto en español`, que es
  trabajo de cada cliente ([04](04-errores-y-mensajes.md)).
- **La dirección de la API es configuración**: `NEXT_PUBLIC_API_URL`
  ([15 §3](15-integracion-con-el-cliente.md)), documentada en
  `portal/.env.example`. Ningún componente la conoce: sale de `src/config.ts`.
  Si falta, `src/config.ts` cae al backend de desarrollo
  (`http://localhost:3001`), para que el build de CI no dependa de un `.env`.
  Como Next **inlinea las variables `NEXT_PUBLIC_*` en el momento del build**, el
  build de producción tiene que definirla o el bundle queda apuntando a
  `localhost`.

## 7. Cómo se corre

El portal necesita el backend arriba y, en el backend, `CORS_ORIGINS` con
`http://localhost:3000` —sin ese encabezado el navegador bloquea la respuesta
aunque la API conteste `200`—. Los pasos completos, con la base y el backend,
están en [05 §4](05-desarrollo.md); los del portal solo, en
[`portal/README.md`](../portal/README.md).

## 8. Las pantallas: el mapa de la aplicación

El portal no tiene una pantalla que hace todo: tiene **una por objeto de trabajo**, y cada
una decide su superficie y sus valores por defecto. Las que existen hoy:

| Ruta | Objeto de trabajo | Superficie | Query |
| --- | --- | --- | --- |
| `/` | El grafo | Mapa | `['graph', bbox]`, el área que se está mirando |
| `/reports` | Los reportes ciudadanos | Tabla con detalle al costado | `['reports', status]`, `PENDING` por defecto |
| `/obstacles` | Los obstáculos publicados | Mapa | `['obstacles', status]`, `ACTIVE` por defecto |
| `/routes` | Un recorrido | Mapa | Todavía no existe |

**Cada pantalla elige su superficie.** El grafo y los obstáculos son mapas porque la pregunta
es dónde está la cosa; los reportes son una lista porque la pregunta es cuál miro ahora. Los
reportes **no se dibujan sobre el mapa del grafo**: son puntos que esperan una decisión, se
revisan de a uno y su estado no es un dato de accesibilidad, así que meterlos ahí mezclaría
dos escalas de trabajo y una capa más que apagar (§5.7).

**Cada pantalla elige sus valores por defecto y su query.** El grafo abre en la caja del
piloto (§5.4); los reportes abren en `PENDING`, que es la cola de trabajo; los obstáculos
abren en `ACTIVE`, que es lo que está en la calle. Ninguna hereda el estado de la otra: son
listas distintas, con claves de caché distintas, y cambiar el filtro de una no toca a las
demás.

**La barra sólo muestra las pantallas que existen.** Hoy son tres —grafo, reportes y
obstáculos—; `/routes` no está porque una entrada que se clickea y no lleva a nada es peor
que una que no está. Entra cuando exista su pantalla.

**El puente reporte → obstáculo es una acción del panel y va en un solo sentido.** Desde el
detalle de un reporte `PENDING` se crea el obstáculo o se descarta el reporte (§8.1); desde
la pantalla de obstáculos se cierra, pero **nunca** se vuelve a tocar el reporte. No hay una
acción en `/obstacles` que modere un reporte ni una en `/reports` que resuelva un obstáculo:
cada pantalla escribe lo del objeto que muestra ([18 §6](18-la-api-de-obstaculos.md#6-el-puente-de-un-reporte-a-un-obstáculo)).

### 8.1 La pantalla de reportes

`/reports` es la cola de reportes y `/` sigue siendo el mapa del grafo, sin cambios
([17 §7](17-la-api-de-reportes.md)).

**La tabla y el detalle.** La pantalla es una tabla a la izquierda y un detalle de 320
píxeles al costado (`reports/reports-screen.tsx`):

- **Arriba de la tabla**, el selector de estado —los cinco—, el orden por fecha y el
  contador de reportes. El estado es estado de interfaz y no del servidor: cambiarlo
  cambia la clave de la query y trae esa cola.
- **Cada fila se selecciona con un botón** en su primera celda: una tabla no admite un
  control que abarque celdas, así que el botón es la acción de la fila. La tabla es un
  `<table>` real con `<thead>`/`<tbody>`, se recorre con el teclado, el foco se ve y la
  fila elegida se marca con fondo y su botón con `aria-current`.
- **La descripción se recorta al dibujar**, con `truncate` sobre el texto completo: el
  dato viaja entero y el detalle lo muestra entero. Recortarlo en el servidor obligaría
  a una segunda lectura para leerlo.
- **La fecha se formatea en el navegador**, con `Intl.DateTimeFormat('es-AR')` sobre el
  ISO que devuelve la API: es componente de cliente, así que no hay desajuste de
  hidratación, y el servidor no tiene que saber en qué zona lee la persona.
- **El detalle** (320 px, `reports/report-details.tsx`) muestra el tipo con su nombre en
  español, el `id`, la severidad, el estado, la fecha completa, la descripción entera y
  la foto si hay (`alt` que describe el reporte). Aclara en una línea que la severidad es
  la **percepción del ciudadano**, no la decisión del moderador
  ([09 §4.5](09-modelo-de-datos.md)): sin eso, el detalle se lee como un diagnóstico.
  Si el reporte está `APPROVED`, muestra además **obstáculo #N**, que es el `obstacle_id`
  que devuelve la lectura ([17 §7](17-la-api-de-reportes.md#7-la-lectura-de-reportes)).
- **La moderación vive en el detalle**, no en la tabla: sobre un reporte `PENDING` hay dos
  acciones inline —"Crear obstáculo" y "Descartar"— (§8.1.1).

**La frontera `ssr: false`, otra vez.** `reports/reports-panel.tsx` es un componente de
cliente que monta la pantalla con `next/dynamic` y `ssr: false`, exactamente como
`map-panel.tsx` (§5.2). No es por Leaflet —la tabla no lo necesita— sino por la misma
razón de fondo: el build corre en CI sin backend, y una `useQuery` prerenderizada lee el
reloj y puede romper el build (`cacheComponents`, §5.4). Así `/reports` queda estática
(`○`) y los datos se piden desde el navegador, igual que el grafo.

**La segunda query.** `reports/reports-screen.tsx` usa `useQuery` con la clave
`['reports', status]` (`reportQueryKey` en `api/reports.ts`) y `readReports(status)`
como `queryFn`, con `placeholderData: keepPreviousData` y `retry: 1` como el mapa: al
cambiar de estado la tabla anterior se queda hasta que llega la nueva, y con la API
caída el error aparece en un par de segundos. `REPORTS_QUERY_PREFIX` es el prefijo que
invalida la moderación después de aprobar o descartar, junto con el de obstáculos, igual
que `['graph']` después de guardar un nivel (§5.6).

**El minimapa no dibuja el grafo ni el área de servicio.** `reports/report-minimap.tsx`
es un mapa chico y quieto —`h-56`, zoom 17, `scrollWheelZoom={false}`, tiles de OSM con
la atribución obligatoria (§5.5)— con un `CircleMarker` en el punto reportado. Se
remonta con `key` sobre el `id` del reporte, que es la forma más simple de recentrarlo:
mover la vista en un efecto sería código para deshacer lo que el remontaje ya hace. El
grafo y el área no entran porque acá el punto es lo único que se pregunta ([17 §7]).

#### 8.1.1 La moderación desde el detalle

Sobre un reporte `PENDING`, el detalle tiene **dos acciones**, y ninguna abre un diálogo:

- **"Crear obstáculo"** despliega un formulario inline con el tipo y la severidad
  **precargados desde el reporte**. El punto no se toca: es el del reporte
  ([18 §6](18-la-api-de-obstaculos.md#6-el-puente-de-un-reporte-a-un-obstáculo)). Si el
  reporte vino como `OTHER`, el select arranca **sin elegir**: `OTHER` es la percepción del
  ciudadano y el moderador clasifica ([09 §4.5](09-modelo-de-datos.md#45-reporte-y-obstáculo)).
- **"Descartar"** marca el reporte `REJECTED` sin más preguntas.

Los dos salen del mismo mapeo `código → español` que el resto de las escrituras del portal,
con el motivo de dominio cuando lo hay (`NO_NEARBY_ELEMENT` tiene su propio texto:
"elegí un punto sobre el recorrido peatonal")
([04 §4](04-errores-y-mensajes.md#4-catálogo-de-códigos)).

**Después de moderar se invalidan las dos listas**: la cola de reportes, porque la fila
cambia de estado, y los obstáculos, porque acaba de aparecer uno. No se recarga la página ni
se manipula la caché a mano: `invalidateQueries` sobre los dos prefijos, igual que en `/`
después de guardar un nivel (§5.6).

**El formulario está en el detalle y no en la tabla** porque moderar necesita ver lo que
reportó la persona —la descripción entera y la foto—, que es lo que la tabla recorta para
poder leerse de un vistazo.

### 8.2 La pantalla de obstáculos

`/obstacles` es el mapa de lo que ya está publicado (`obstacles/obstacles-screen.tsx`): un
mapa a la izquierda y un panel de 320 píxeles al costado, con el detalle o el alta.

**El mapa no dibuja el grafo.** Se ven los tiles y los obstáculos, nada más. El control de
capas y la capa de obstáculos dentro del mapa del grafo son de otra tarea: mientras tanto,
esta pantalla es también el "grafo apagado por defecto" (§5.7), y mezclar las dos cosas acá
volvería a juntar dos escalas de trabajo que §8 separa a propósito.

- **Un `CircleMarker` por obstáculo**, con el color de su severidad —los mismos colores de
  los badges— y en gris si está resuelto: lo que ya no cuenta no se confunde con una
  barrera activa. Se dibuja a mano, como el mapa del grafo, con el mismo ciclo de vida
  (§5.1).
- **La selección es un clic en el marcador** y se suelta con un clic en el fondo del mapa.
  El detalle muestra tipo, severidad, estado, a qué elemento está pegado, cuántos reportes
  lo apuntan y las fechas.
- **Resolver es una acción del detalle**, sólo si el obstáculo está activo. Después de
  escribir se invalida el prefijo de obstáculos y el mapa se repinta: el punto pasa a gris
  y, desde la consulta siguiente de ruteo, deja de costar
  ([18 §5](18-la-api-de-obstaculos.md#5-resolver)).
- **El filtro de estado va arriba del panel**, con `Activos` por defecto. Cambiarlo cambia
  la clave de la query —como el selector de la cola de reportes— y suelta la selección,
  porque el detalle no puede seguir mostrando algo que ya no está en el mapa.
- **El tope de 2000 se avisa en pantalla**, igual que en el grafo (§5.4).

**El alta es inline y tiene dos pasos.** "Nuevo obstáculo" deja el mapa en modo **"elegí el
punto"**: el próximo clic sobre el mapa fija un marcador provisorio —celeste y con guiones—
y abre el formulario con el punto ya escrito. El formulario pide **tipo** y **severidad** y
nada más: el elemento del grafo lo decide el servidor
([18 §3](18-la-api-de-obstaculos.md#3-el-alta)).

- **Sin diálogos.** Es el mismo patrón del formulario del nivel (§5.6): el panel es el
  lugar donde se escribe, y el mapa queda visible mientras se completa.
- **El catálogo sale de la lectura.** El select de tipos se llena con `obstacle_types` de la
  respuesta, que ya viene sin `OTHER` y sin los inactivos: el cliente no copia el catálogo
  ([18 §4.2](18-la-api-de-obstaculos.md#42-el-catálogo-del-formulario)).
- **Mientras se elige el punto, los obstáculos publicados no capturan el clic**: el punto se
  elige sobre el mapa y no sobre lo que ya está dibujado.
- **Si no hay elemento cerca, se lee el motivo.** La API responde `NO_NEARBY_ELEMENT` y el
  texto dice que hay que elegir un punto sobre el recorrido peatonal; el formulario queda
  abierto con lo cargado para mover el pin.
- **Después de publicar** se invalida el prefijo de obstáculos, el filtro vuelve a `Activos`
  —el obstáculo nace activo— y el detalle muestra el recién creado.

## 9. Lo que este documento no decide

- **El contrato de la API.** Vive en cada documento de caso de uso, hoy
  [14](14-la-api-del-grafo.md) y [13](13-api-de-ruteo.md).
- **La URL de cada entorno y la allowlist de CORS.** Son configuración de
  despliegue ([15 §3](15-integracion-con-el-cliente.md),
  [03](03-despliegue-y-operacion.md) §7).
- **El auth real.** Cómo se registra, se guarda y se valida una sesión es la Fase
  3 ([07](07-plan-de-trabajo.md)); acá sólo queda la costura donde va a entrar.
- **La edición de otra cosa que el nivel.** `street_name` y la geometría no se editan
  ([14 §8](14-la-api-del-grafo.md)). Los obstáculos tienen su propio contrato
  ([18](18-la-api-de-obstaculos.md)) y su pantalla: desde la ficha del grafo no se publica
  ni se resuelve nada (§5.6).
- **El texto de los errores.** El portal traduce los códigos, pero el catálogo es
  de [04](04-errores-y-mensajes.md).
- **La puesta en marcha completa.** Es de [05](05-desarrollo.md).

## 10. Documentos relacionados

- [02-stack-y-estructura.md](02-stack-y-estructura.md): el stack y la estructura
  interna de cada aplicación.
- [05-desarrollo.md](05-desarrollo.md): levantar la base, el backend y el portal.
- [09-modelo-de-datos.md](09-modelo-de-datos.md): qué significa cada `level` y
  `is_verified`.
- [10-datos-y-zona-piloto.md](10-datos-y-zona-piloto.md): la zona piloto y la
  atribución de OSM.
- [14-la-api-del-grafo.md](14-la-api-del-grafo.md): el contrato que el mapa lee.
- [17-la-api-de-reportes.md](17-la-api-de-reportes.md): la cola de reportes y su moderación.
- [18-la-api-de-obstaculos.md](18-la-api-de-obstaculos.md): el alta, la lectura y el cierre
  de un obstáculo.
- [15-integracion-con-el-cliente.md](15-integracion-con-el-cliente.md): el
  contrato generado, la URL como configuración y CORS.

# El portal de moderación

> Documento temático. Define el portal como aplicación: qué resuelve hoy, cómo
> está armado por dentro, cómo consigue la sesión, cómo habla con la API y cómo
> dibuja el mapa. Es el estado vivo de esas decisiones: se edita en su lugar
> cuando cambian. Se complementa con
> [15-integracion-con-el-cliente.md](15-integracion-con-el-cliente.md), que
> define la integración con la API, con
> [14-la-api-del-grafo.md](14-la-api-del-grafo.md), que define lo que el mapa
> lee, y con [05-desarrollo.md](05-desarrollo.md), que tiene los comandos.

## 1. Alcance

Este documento responde:

- **Qué hace hoy** el portal y qué todavía no (§2).
- **Dónde vive cada cosa** dentro de la aplicación, y por qué (§3).
- **De dónde sale** el "soy moderador", que hoy es falso (§4).
- **Cómo el mapa** lee el grafo, lo dibuja y avisa lo que no puede mostrar (§5).
- **De dónde salen** los tipos del contrato y la dirección de la API (§6).
- **Cómo se corre** y dónde están los comandos (§7).

No decide el contrato de cada endpoint —es de
[14](14-la-api-del-grafo.md) y de [13](13-api-de-ruteo.md)—, ni las reglas de
la integración —URL como configuración, CORS y traducción de errores, que son de
[15](15-integracion-con-el-cliente.md)—, ni la puesta en marcha completa, que es
de [05 §4](05-desarrollo.md).

## 2. Qué hace hoy: el grafo en pantalla

El portal es una aplicación **aparte del backend**, en `portal/`: Next.js 16,
React 19, Tailwind 4 y TypeScript (`package.json`). Se sirve en el puerto 3000 y
habla con la API por HTTP, igual que va a hacerlo la app mobile.

Hoy resuelve la primera pregunta del moderador —**qué hay y cómo está** en la
zona piloto— con tres cosas:

- **Dibuja el grafo** que devuelve `GET /api/graph`: veredas y cruces como
  líneas, cordones como puntos, y el nivel de accesibilidad como color (§5.3).
- **Selecciona un elemento** con un clic y muestra sus propiedades
  —`element_kind`, `element_id`, `level`, `is_verified`, `street_name`— en un
  panel al costado. Todo viene en la respuesta del grafo: el panel no pide nada
  más, porque todavía no hay endpoint de detalle
  ([14 §7](14-la-api-del-grafo.md)).
- **Avisa** cuando la API recortó la respuesta por el tope de 2000 (§5.4) y
  cuando no responde.

Lo que **no** hace todavía: editar un elemento (C012–C014), listar o resolver
reportes, buscar una calle y autenticar personas (la sesión es simulada, §4).

**Por qué el mapa y no una tabla.** La unidad de trabajo del portal es el área,
no la fila: quien modera mira dónde está el paso y cómo está el resto del
recorrido alrededor. Por eso el mapa es la pantalla y el panel de propiedades es
su consecuencia, y no al revés ([14 §2](14-la-api-del-grafo.md)).

## 3. Estructura de la aplicación

Igual que en el backend, el código se organiza **por funcionalidad** y no por
capa técnica ([02 §3](02-stack-y-estructura.md)):

```
portal/src/
├── app/       # rutas: orquestan, no implementan
├── api/       # el cliente HTTP tipado y el contrato generado
├── map/       # la funcionalidad del mapa
├── session/   # la sesión del portal
└── config.ts  # la URL de la API y la caja del piloto
```

| Pregunta | Destino |
| --- | --- |
| ¿Es una ruta o un layout? | `app/` |
| ¿Es la pantalla del mapa o una parte suya? | `map/` |
| ¿Habla con la API? | `api/` |
| ¿Responde quién es la persona que modera? | `session/` |
| ¿Es un valor que cambia entre entornos? | `config.ts` |

Los componentes de `app/` **orquestan**: el layout resuelve la sesión y la
página monta el panel del mapa. La lógica de Leaflet, los estilos y el panel de
propiedades viven en `map/`, así que una segunda pantalla puede reusar el mapa
sin copiarlo.

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

**Leaflet 1.9 con `react-leaflet` 5** y tiles raster de OpenStreetMap, sin
claves de API. Un mapa de vectores (MapLibre, OpenLayers) resolvería cosas que
acá no hacen falta —estilos por capa desde un servidor de tiles, millones de
features, proyecciones exóticas— a cambio de una configuración que el piloto no
paga: lo que se dibuja son ~1000 elementos sobre un recorte de 0,5 km².

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

- **La vista inicial es la caja del piloto**, con las cuatro esquinas de
  [`data/pilot-zone.geojson`](../data/pilot-zone.geojson)
  ([10 §2](10-datos-y-zona-piloto.md)) como constantes en `src/config.ts`. Es una
  constante y no una consulta porque la API no expone `service_areas`: cuando lo
  haga, la caja se lee y la constante se va.
- **La primera respuesta reencuadra el mapa** al grafo recibido. Después manda el
  usuario: reencuadrar en cada paneo haría imposible panear.
- **Al terminar un paneo o un zoom se vuelve a pedir el área visible**, con una
  espera de 300 ms para no pedir una vez por cada cuadro del arrastre. El pedido
  es el `bbox` de la vista y no el del piloto: al acercarse, el grafo se ve
  completo aunque el área sea más chica. Una respuesta que llega tarde, cuando ya
  hay un pedido más nuevo, se descarta.
- **El tope de 2000 se avisa en pantalla** ([14 §5.1](14-la-api-del-grafo.md)):
  si la API devuelve `truncated: true`, el mapa lo dice y propone acercarse.
  Recortar en silencio mentiría sobre lo que hay en la zona.
- **Si la API no responde, el mapa lo dice**: un cartel con el motivo en español
  y un botón para reintentar. No hay pantalla rota ni un error que sólo exista en
  la consola.

### 5.5 La atribución

El mapa muestra **"© OpenStreetMap contributors"** en el control de atribución
de Leaflet, alimentado por el `attribution` de la capa de tiles, y además como
leyenda al pie. No es cortesía: los datos son ODbL 1.0 y la atribución es
obligatoria ([10 §3](10-datos-y-zona-piloto.md), [15 §7](15-integracion-con-el-cliente.md)).

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
  el bbox y devuelve las features y `truncated`, tipados con el esquema
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

## 8. Lo que este documento no decide

- **El contrato de la API.** Vive en cada documento de caso de uso, hoy
  [14](14-la-api-del-grafo.md) y [13](13-api-de-ruteo.md).
- **La URL de cada entorno y la allowlist de CORS.** Son configuración de
  despliegue ([15 §3](15-integracion-con-el-cliente.md),
  [03](03-despliegue-y-operacion.md) §7).
- **El auth real.** Cómo se registra, se guarda y se valida una sesión es la Fase
  3 ([07](07-plan-de-trabajo.md)); acá sólo queda la costura donde va a entrar.
- **La edición de un elemento.** Es C012–C014, y trae su propio contrato
  (`GET`/`PATCH` del elemento, [14 §7](14-la-api-del-grafo.md)).
- **El texto de los errores.** El portal traduce los códigos, pero el catálogo es
  de [04](04-errores-y-mensajes.md).
- **La puesta en marcha completa.** Es de [05](05-desarrollo.md).

## 9. Documentos relacionados

- [02-stack-y-estructura.md](02-stack-y-estructura.md): el stack y la estructura
  interna de cada aplicación.
- [05-desarrollo.md](05-desarrollo.md): levantar la base, el backend y el portal.
- [09-modelo-de-datos.md](09-modelo-de-datos.md): qué significa cada `level` y
  `is_verified`.
- [10-datos-y-zona-piloto.md](10-datos-y-zona-piloto.md): la zona piloto y la
  atribución de OSM.
- [14-la-api-del-grafo.md](14-la-api-del-grafo.md): el contrato que el mapa lee.
- [15-integracion-con-el-cliente.md](15-integracion-con-el-cliente.md): el
  contrato generado, la URL como configuración y CORS.

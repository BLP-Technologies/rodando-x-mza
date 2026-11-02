# La integración con el cliente

> Documento temático. Define cómo un cliente —la app mobile o el portal— se conecta a la
> API: de dónde saca el contrato, con qué lo genera, cómo configura el destino y qué
> convenciones del contrato no son obvias. No describe el contrato de cada caso de uso:
> eso vive en el documento de cada uno, hoy [13](13-api-de-ruteo.md).

## 1. Alcance

Responde:

- **De dónde** saca el cliente el contrato y con qué lo convierte en código (§2).
- **A dónde** apunta, sin hardcodear nada (§3).
- **Qué puede hacer** un cliente hoy y qué todavía no (§4).
- **Qué no es obvio** del contrato de ruteo y se programa mal en la primera pasada (§5).
- **Qué hace** el cliente con un error (§6) y con el mapa (§7).

No decide el contrato de cada caso de uso ([13](13-api-de-ruteo.md)), ni el despliegue
([03](03-despliegue-y-operacion.md)), ni el texto que ve la persona, que lo escribe cada
cliente a partir de los códigos ([04 §6](04-errores-y-mensajes.md)).

## 2. El contrato se lee, no se transcribe

El contrato completo está en **`GET /api/openapi.json`**: lo genera el backend desde los
esquemas Zod, así que no puede desincronizarse del código que valida
([02 §6](02-stack-y-estructura.md)).

Un cliente genera su cliente HTTP tipado a partir de ese documento y **no escribe los
tipos a mano**. Cuando cambia un esquema del backend, el cliente se regenera: es el único
paso manual, y conviene tenerlo como comando del proyecto de cada cliente.

El contrato también se puede leer como página navegable en **`GET /api/docs`**, sin
abrir el JSON.

## 3. La URL es configuración

La dirección de la API **nunca va en el código**: es un valor de configuración del
cliente, con un valor de desarrollo y un valor de despliegue. Esto no es una preferencia
de estilo; es la diferencia entre cambiar una variable y recomponer una app.

Dos cosas prácticas de desarrollo que no son del contrato pero se pagan igual:

- **Desde un teléfono físico, `localhost` es el teléfono**, no la máquina donde corre el
  backend. En desarrollo hay que apuntar a la máquina del equipo en la red local; en Expo,
  la opción de host de la LAN resuelve el caso. La dirección concreta depende de cada red y
  no se documenta acá.
- **El backend todavía no responde CORS.** Un cliente nativo no lo necesita —el `fetch` de
  React Native no lo aplica—, pero si el cliente corre en un navegador, las peticiones
  fallan sin ese encabezado y el error no menciona CORS por ningún lado. Está en §8.

## 4. Qué puede hacer un cliente hoy

| Capacidad | Estado |
| --- | --- |
| Consultar un recorrido accesible | `POST /api/routes/calculate` ([13](13-api-de-ruteo.md)) |
| Leer el contrato | `GET /api/openapi.json` |
| Saber si el servicio está arriba | `GET /api/health`, `GET /api/health/ready` |
| Leer el grafo —veredas, cruces, cordones— | No existe todavía (#45) |
| Registrarse, iniciar sesión | No existe ([07 §3](07-plan-de-trabajo.md), Fase 3) |
| Guardar rutas y lugares frecuentes | No existe (C006 a C009) |
| Reportar un obstáculo | No existe (C010) |

**Hoy no hay autenticación**: la API está abierta y ningún endpoint la pide. Un cliente que
planifique contra un token que todavía no existe está planificando contra la nada.

## 5. Lo que no es obvio del contrato de ruteo

- **`found: false` llega con `200` y no es un error.** Es un pedido válido que no tiene
  camino, y es el caso que más fácil se programa mal: un `if (!response.ok)` lo convierte en
  un falso "no se pudo conectar" cuando en realidad no hay recorrido accesible.
- **Las coordenadas tienen dos órdenes según dónde estén.** En el pedido van `lat` y `lon`
  por nombre; en la geometría GeoJSON de la respuesta, el orden es `[lon, lat]`.
- **El recorrido no empieza donde está el pin.** Empieza y termina en el cordón más cercano,
  y `origin`/`destination` traen ese nodo y `distance_m`. Si la app no muestra esa
  diferencia, la persona ve una ruta que nace en una esquina ajena y no entiende por qué.
- **`unverified_meters` y `legs[].is_verified` son el aviso de "tramos sin relevar".** Hoy
  todo el grafo está sin relevar, así que el número es igual a los metros totales: el aviso
  se enciende solo y el cliente no tiene que inventar nada.
- **`legs` viene en orden de recorrido**, pero cada geometría conserva la dirección en la que
  está guardada: sirve para dibujar, no para animar flechas.
- **`element_kind` + `element_id`** identifican el elemento del grafo de cada tramo, y son lo
  que el cliente guarda si después quiere pedir algo sobre él.

## 6. El cliente traduce el error, no lo muestra

El backend nunca manda texto para la persona: manda `{ "error": { "code", "details?" } }`
([04](04-errores-y-mensajes.md)). Cada cliente mantiene su mapeo `código → mensaje` en
español, y un código que no conoce cae al mensaje genérico: no rompe nada.

Los `details` de `VALIDATION_ERROR` traen `{ field, code }`. `REQUIRED` e `INVALID` son
genéricos; los demás son de dominio y el mensaje útil depende de cada uno — por ejemplo
`OUTSIDE_SERVICE_AREA` significa "el punto está fuera de la zona del piloto", que es un
texto distinto de "revisá los datos".

## 7. El mapa se atribuye

Donde el cliente muestre datos del mapa, muestra **"© OpenStreetMap contributors"**. No es
una cortesía: los datos son ODbL 1.0 y la atribución es obligatoria
([10 §3](10-datos-y-zona-piloto.md)).

## 8. Lo que este documento no decide

- **El contrato de cada caso de uso.** Vive en su documento; hoy [13](13-api-de-ruteo.md).
- **CORS.** Si un cliente corre en un navegador, hace falta decidir qué orígenes se permiten
  y quién los configura. Hoy no hay ningún cliente web y por eso no está resuelto; el
  disparador es el primero que lo sea.
- **La autenticación.** Cómo se registra, cómo se guarda el token y cómo lo manda el cliente
  es la Fase 3.
- **La versión de la API.** No hay `/v1`: el contrato cambia y los clientes se regeneran. Si
  en algún momento hay clientes que no se pueden regenerar juntos, se versiona.

## 9. Documentos relacionados

- [13-api-de-ruteo.md](13-api-de-ruteo.md): el contrato del recorrido, campo por campo.
- [04-errores-y-mensajes.md](04-errores-y-mensajes.md): la forma del error y quién escribe el
  texto.
- [02-stack-y-estructura.md](02-stack-y-estructura.md): el contrato en Zod y el OpenAPI.
- [05-desarrollo.md](05-desarrollo.md): levantar el backend y probarlo a mano.
- [10-datos-y-zona-piloto.md](10-datos-y-zona-piloto.md): la zona y la atribución.
- [07-plan-de-trabajo.md](07-plan-de-trabajo.md): qué fase trae cada capacidad.

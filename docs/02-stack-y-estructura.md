# Stack y estructura del proyecto

> Documento temático. Define con qué tecnologías se construye Rodando x MZA y
> cómo se organiza el código. Es el estado vivo de esas decisiones: se edita en
> su lugar cuando cambian. Se complementa con
> [00-reglas-documentacion.md](00-reglas-documentacion.md), que define las reglas
> generales de la documentación, y con [01-diagramas.md](01-diagramas.md), que
> describe los diagramas que modelan el sistema.

## 1. Alcance

Este documento responde cuatro preguntas y no las repite en ningún otro lado:

- **Con qué** se construye: lenguajes, frameworks y librerías, con sus versiones.
- **Dónde** vive cada cosa: la estructura de carpetas del repositorio.
- **Cómo** se escribe el código: idioma, nombres y convenciones (§5).
- **Por qué**, cuando hubo una decisión real que tomar (y qué la haría cambiar).

No describe el dominio ni los casos de uso: eso está en
[01-diagramas.md](01-diagramas.md) y sus fuentes en `docs/diagrams/`.

## 2. Stack y versiones

Las versiones son las últimas estables al momento de escribir este documento.
Se fija la **versión mayor** en cada `package.json` (`^`) y se actualiza de forma
deliberada, no automática.

| Componente | Tecnología | Versión |
| --- | --- | --- |
| Runtime | Node.js | 22 LTS |
| Gestor de paquetes | pnpm | 10+ |
| Lenguaje | TypeScript | 6.0 (`strict`) |
| Backend | Express | 5 |
| Acceso a datos | Kysely | 0.29 |
| Driver Postgres | pg | 8 |
| Migraciones | node-pg-migrate | 9 |
| Validación y contrato | Zod | 4 |
| OpenAPI | @asteasolutions/zod-to-openapi | 9 |
| Base de datos | PostgreSQL + PostGIS + pgRouting | contenedor |
| Portal web | Next.js | 16 |
| UI web | React | 19 |
| App mobile | Expo (SDK) / React Native | 57 / 0.87 |
| Linter | ESLint + typescript-eslint | 10 / 8 |
| Tests | Vitest | 5 |

> **TypeScript 6.0, no 7.** La última versión es la 7, pero `typescript-eslint`
> 8.71 declara `typescript >=4.8.4 <6.1.0`, así que con la 7 el lint falla al
> arrancar (`does not support TS 7.0`). Se fija la 6.0.3, la estable más nueva
> dentro de ese rango. Se sube cuando `typescript-eslint` anuncie soporte para la 7.

## 3. Estructura de carpetas

Se comienza **sin monorepo**: carpetas independientes en la raíz, cada una con su
propio `package.json`.

```
rodando-x-mza/
├── backend/      # API REST: Express 5 + TypeScript
├── portal/       # Portal de moderación: Next.js
├── mobile/       # App principal: Expo React Native
├── infra/        # docker-compose, aprovisionamiento (initdb/) y migraciones SQL
├── docs/         # documentación del proyecto (este directorio)
└── scripts/      # herramientas de desarrollo (render de diagramas, etc.)
```

### Por qué no un monorepo (todavía)

Un workspace con pnpm resuelve bien un problema real: compartir el contrato de la
API en un paquete único. Pero ese beneficio solo existe cuando hay **dos clientes**
consumiéndolo, y el proyecto se construye **backend primero**. Mientras tanto, el
monorepo agrega configuración (hoisting, resolución de tipos entre paquetes, Metro
de Expo sobre workspaces) sin un consumidor que la aproveche.

El mismo beneficio —una sola fuente de verdad del contrato— se logra sin workspace:
el contrato vive en el backend como esquemas Zod y de ahí sale un OpenAPI (§6), del
que cada cliente genera su cliente tipado.

**Condición de revisión:** cuando arranque el segundo cliente (web o mobile), y el
contrato empiece a duplicarse o a desincronizarse, se evalúa convertir el repo en
workspace de pnpm. Es barato de agregar y barato de deshacer.

### Estructura interna de cada aplicación

Dentro de cada aplicación el código se organiza **por funcionalidad**, no por capa
técnica. Cada caso de uso vive en su propia carpeta con todo lo que necesita; las
pocas piezas transversales (`http/`, `db/`) quedan aparte.

```
backend/src/
├── index.ts      # arranque del proceso
├── app.ts        # construye la app Express
├── config.ts     # variables de entorno validadas con Zod
├── logger.ts     # logger pino
├── routes.ts     # compone los routers de cada funcionalidad
├── http/         # capa de transporte compartida (no es una funcionalidad)
├── db/           # conexión y tipos de la base
└── auth/         # una funcionalidad (p. ej. C001/C002)
```

Regla para decidir dónde va un archivo:

| Pregunta | Destino |
| --- | --- |
| ¿Habla HTTP/Express pero no del dominio? | `http/` |
| ¿Es una capacidad del negocio? | su carpeta de funcionalidad (`auth/`, `reports/`, …) |
| ¿Es acceso a datos genérico? | `db/` |

Dentro de una funcionalidad, el rol del archivo se marca en el nombre:
`auth.router.ts`, `auth.schemas.ts`, `auth.service.ts`, `auth.repository.ts`. El
test va junto al archivo que prueba (`auth.router.test.ts`).

## 4. TypeScript y calidad

TypeScript en las tres aplicaciones, en modo estricto. La opción `strict` sola no
alcanza; se habilitan también las banderas que atrapan los errores más comunes:

| Opción | Efecto |
| --- | --- |
| `strict` | Conjunto base de chequeos estrictos |
| `noUncheckedIndexedAccess` | Acceso a índices y mapas devuelve `T \| undefined` |
| `noImplicitAny` | Prohíbe `any` implícito |
| `exactOptionalPropertyTypes` | Distingue `prop?: T` de `prop: T \| undefined` |
| `target` / `module` | `ES2022` / `NodeNext` en backend |

**`any` prohibido.** Se aplica con ESLint
(`@typescript-eslint/no-explicit-any` en `error` junto con las reglas
`no-unsafe-*`), no por convención. En los bordes donde entra un dato sin tipo
—la fila cruda que devuelve PostGIS/pgRouting en `$queryRaw`— se usa `unknown` y se
valida con Zod; nunca `any`.

## 5. Convenciones

### Idioma

El idioma depende de quién lee cada cosa. Código e interno en inglés; lo que ve el
usuario final, en español.

| Qué | Idioma |
| --- | --- |
| Identificadores, nombres de archivos, tipos | Inglés |
| Comentarios de código | Español |
| Mensajes para desarrolladores (logs, `Error.message` internos, validación de configuración) | Inglés |
| Valores de máquina de la API: códigos de error, estados | Inglés |
| Texto que ve el usuario final | Español, y lo produce **cada cliente** |

### Nombres de archivos

- `kebab-case`: `error-handler.ts`.
- Dentro de una funcionalidad, `funcionalidad.rol.ts`: `auth.service.ts`.

### Errores y mensajes al usuario

El contrato de errores —forma de la respuesta, catálogo de códigos y quién escribe
el texto que ve el usuario— está en
[04-errores-y-mensajes.md](04-errores-y-mensajes.md). Regla corta: el backend nunca
manda texto para el usuario; manda un código, y cada cliente lo traduce al español.

## 6. Contrato de la API

El contrato es una sola cosa y vive en un solo lugar: **esquemas Zod en el
backend**. De ahí salen dos consumidores:

1. Los **tipos** que usa el propio backend.
2. Un documento **OpenAPI** generado
   (`@asteasolutions/zod-to-openapi`), a partir del cual cada cliente genera su
   cliente HTTP tipado.

Esto evita mantener a mano la forma de la API en tres lugares. Cuando cambia un
esquema, cambia el OpenAPI y los clientes se regeneran.

Los **errores** también son parte del contrato, y se describen en
[04-errores-y-mensajes.md](04-errores-y-mensajes.md).

## 7. Acceso a datos

Se usa **Kysely + migraciones SQL** (`node-pg-migrate`), no un ORM como Prisma.

### Por qué no Prisma

Casi toda entidad del modelo tiene una columna `geometry` (ver
[`01-DER.mmd`](diagrams/01-DER.mmd)): `user_places`, `saved_routes`, `kerb_nodes`,
`sidewalks`, `crossings`, `obstacles`, `reports`. Prisma no soporta PostGIS de forma
nativa y esas columnas quedan como `Unsupported("geometry")`:

- Las columnas `Unsupported` **no aparecen en el cliente generado**, así que no se
  pueden leer con la API normal de Prisma.
- Las consultas espaciales (`ST_DWithin`, `ST_Intersects`, …) van por `$queryRaw`.
- pgRouting es siempre SQL crudo: `pgr_dijkstra` es una función de conjunto.
- Prisma Migrate no expresa `geometry(Point, 4326)`, índices GiST ni las
  extensiones `postgis` / `pgrouting`; habría que editar el SQL a mano igual.

Solo la parte plana del modelo (usuarios, tutoriales) se aprovecharía; todo lo
geoespacial, que es lo que hace útil a la aplicación, quedaría en SQL crudo de
todos modos, pagando el motor de Prisma y su paso de `generate` sin beneficio.

### Por qué Kysely

Kysely es un constructor de SQL tipado, no un ORM que esconde la base. Eso encaja
con un proyecto cuyo trabajo no trivial es geoespacial:

- Los tipos de tabla se generan **introspeccionando la base real**
  (`kysely-codegen`), así que las columnas `geometry` se tipan como corresponde,
  sin `any`.
- Las consultas se escriben en SQL (con la etiqueta `sql`), que es exactamente el
  lenguaje que necesitan PostGIS y pgRouting.
- Las migraciones son **SQL puras**, donde `geometry`, GiST y `pgrouting` se
  definen en su forma natural.

Drizzle es una alternativa válida si en algún momento se prefiere definir el schema
en código; la diferencia práctica es que Kysely gana cuando la mayoría del trabajo
no trivial es SQL crudo, que es este caso.

## 8. Entorno de desarrollo

La puesta en marcha (requisitos, comandos, verificación y problemas comunes) está
en [05-desarrollo.md](05-desarrollo.md). Reglas que sí son de este documento:

- **Migraciones**: en `infra/`, versionadas en git, aplicadas con `node-pg-migrate`.
  Un cambio de schema no está terminado hasta que su migración está en el commit.
- **Variables de entorno**: sin secretos versionados; se documentan en el
  `.env.example` y cada desarrollador provee el valor real.

## 9. Verificación

Corre en CI —en cada pull request y en cada push a `main`, mediante
`.github/workflows/backend.yml`— y conviene correrlo también antes de cada commit:

- `eslint` (incluye la prohibición de `any`),
- `tsc --noEmit` (chequeo de tipos),
- `vitest` (tests),
- render de diagramas cuando cambia un `.mmd` (ver
  [01-diagramas.md](01-diagramas.md) §7).

Un cambio no está terminado hasta que estos pasos pasan y la documentación
afectada está actualizada ([00-reglas-documentacion.md](00-reglas-documentacion.md) §6).

## 10. Decisiones descartadas

| Decisión | Estado | Razón | Revisar cuando |
| --- | --- | --- | --- |
| Monorepo con workspaces | Diferida | No hay segundo cliente que consuma el contrato | Arranca web o mobile |
| Prisma como ORM | Descartada | No soporta PostGIS/pgRouting nativamente (§7) | PostGIS deje de ser central |
| Texto de usuario desde el backend | Descartada | El cliente traduce códigos al español ([04](04-errores-y-mensajes.md)) | Nunca |

## 11. Documentos relacionados

- [00-reglas-documentacion.md](00-reglas-documentacion.md): reglas de la
documentación.
- [01-diagramas.md](01-diagramas.md): diagramas del sistema (DER, casos de uso,
  secuencias, componentes).
- [03-despliegue-y-operacion.md](03-despliegue-y-operacion.md): despliegue y
  operación en producción.
- [04-errores-y-mensajes.md](04-errores-y-mensajes.md): contrato de errores y
  mensajes al usuario.
- [05-desarrollo.md](05-desarrollo.md): puesta en marcha y problemas comunes.
- [06-windows-wsl.md](06-windows-wsl.md): trabajar desde Windows con WSL2.

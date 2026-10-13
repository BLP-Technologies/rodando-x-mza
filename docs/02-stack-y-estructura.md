# Stack y estructura del proyecto

> Documento temático. Define con qué tecnologías se construye Rodando x MZA y
> cómo se organiza el código. Es el estado vivo de esas decisiones: se edita en
> su lugar cuando cambian. Se complementa con
> [00-reglas-documentacion.md](00-reglas-documentacion.md), que define las reglas
> generales de la documentación, y con [01-diagramas.md](01-diagramas.md), que
> describe los diagramas que modelan el sistema.

## 1. Alcance

Este documento responde tres preguntas y no las repite en ningún otro lado:

- **Con qué** se construye: lenguajes, frameworks y librerías, con sus versiones.
- **Dónde** vive cada cosa: la estructura de carpetas del repositorio.
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
| Lenguaje | TypeScript | 7 (`strict`) |
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

> **TypeScript 7.** Es la versión más reciente. Si alguna herramienta del
> ecosistema (ESLint, Next, Expo) todavía no la acompaña, se fija la última 5.x
> y el resto del documento no cambia.

## 3. Estructura de carpetas

Se comienza **sin monorepo**: carpetas independientes en la raíz, cada una con su
propio `package.json`.

```
rodando-x-mza/
├── backend/      # API REST: Express 5 + TypeScript
├── web/          # Portal de moderación: Next.js
├── mobile/       # App principal: Expo React Native
├── infra/        # docker-compose (PostGIS + pgRouting) y migraciones SQL
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
el contrato vive en el backend como esquemas Zod y de ahí sale un OpenAPI (§5), del
que cada cliente genera su cliente tipado.

**Condición de revisión:** cuando arranque el segundo cliente (web o mobile), y el
contrato empiece a duplicarse o a desincronizarse, se evalúa convertir el repo en
workspace de pnpm. Es barato de agregar y barato de deshacer.

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

## 5. Contrato de la API

El contrato es una sola cosa y vive en un solo lugar: **esquemas Zod en el
backend**. De ahí salen dos consumidores:

1. Los **tipos** que usa el propio backend.
2. Un documento **OpenAPI** generado
   (`@asteasolutions/zod-to-openapi`), a partir del cual cada cliente genera su
   cliente HTTP tipado.

Esto evita mantener a mano la forma de la API en tres lugares. Cuando cambia un
esquema, cambia el OpenAPI y los clientes se regeneran.

## 6. Acceso a datos

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

## 7. Entorno de desarrollo

- **Base de datos**: `infra/docker-compose.yml` levanta PostgreSQL con las
  extensiones `postgis` y `pgrouting`. Requiere contenedores (Docker o Podman).
- **Migraciones**: en `infra/`, versionadas en git, aplicadas con `node-pg-migrate`.
  Un cambio de schema no está terminado hasta que su migración está en el commit.
- **Variables de entorno**: sin secretos versionados; se documentan en un
  `.env.example` y cada desarrollador provee el valor real.

## 8. Verificación

Corre en CI y antes de cada commit:

- `eslint` (incluye la prohibición de `any`),
- `tsc --noEmit` (chequeo de tipos),
- `vitest` (tests),
- render de diagramas cuando cambia un `.mmd` (ver
  [01-diagramas.md](01-diagramas.md) §7).

Un cambio no está terminado hasta que estos pasos pasan y la documentación
afectada está actualizada ([00-reglas-documentacion.md](00-reglas-documentacion.md) §6).

## 9. Decisiones descartadas

| Decisión | Estado | Razón | Revisar cuando |
| --- | --- | --- | --- |
| Monorepo con workspaces | Diferida | No hay segundo cliente que consuma el contrato | Arranca web o mobile |
| Prisma como ORM | Descartada | No soporta PostGIS/pgRouting nativamente (§6) | PostGIS deje de ser central |

## 10. Documentos relacionados

- [00-reglas-documentacion.md](00-reglas-documentacion.md): reglas de la
documentación.
- [01-diagramas.md](01-diagramas.md): diagramas del sistema (DER, casos de uso,
  secuencias, componentes).

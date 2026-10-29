# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

Rodando x MZA: app para planificar recorridos peatonales accesibles en Mendoza y reportar obstáculos. Tres piezas independientes (sin monorepo, cada carpeta con su propio `package.json`/pnpm):

- `backend/` — API REST: Express 5 + TypeScript + Kysely + Zod, sobre PostgreSQL/PostGIS/pgRouting. Es lo más avanzado (hoy solo existe `/api/health`).
- `mobile/` — app Expo SDK 57 / React Native, TypeScript. Pantallas de auth en `mobile/src/auth/`; la navegación es un `useState` de pantalla actual en `App.tsx` (todavía sin librería de navegación ni cliente HTTP).
- `web/` — portal de moderación Next.js: planeado, todavía no existe.
- `infra/` — `docker-compose.yml` (solo la base va en contenedor), `initdb/` (habilita extensiones) y `migrations/` (SQL de `node-pg-migrate`).
- `docs/` — documentación viva; los diagramas son Mermaid en `docs/diagrams/*.mmd` con PNG generados en `docs/diagrams/imgs/` (`scripts/render-diagrams.sh`).

## Comandos

Base de datos (desde `infra/`): `docker compose up -d` (esperar `healthy`), `docker compose down -v` para empezar de cero. Puertos 5432 y 3001 libres.

Backend (desde `backend/`, Node 22, pnpm 10+; copiar `.env.example` a `.env` la primera vez):

- `pnpm dev` — API con recarga en `http://localhost:3001`
- `pnpm test` — Vitest (`src/**/*.test.ts`, junto al archivo probado); uno solo: `pnpm vitest run src/app.test.ts` o `-t "nombre"`
- `pnpm lint` / `pnpm typecheck` / `pnpm build`
- `pnpm migrate` / `pnpm migrate:down` — migraciones desde `../infra/migrations`

Mobile (desde `mobile/`): `pnpm start` (`android`, `ios`, `web`). No hay lint ni tests configurados.

Antes de dar un cambio por terminado en backend: `eslint`, `tsc --noEmit` y `vitest` deben pasar.

## Arquitectura del backend

- `app.ts` construye la app (`createApp()`, separada de `index.ts` para poder testearla con supertest); `routes.ts` compone los routers bajo `/api`.
- Código organizado **por funcionalidad** (`auth/`, `reports/`, …), no por capa; archivos `funcionalidad.rol.ts` (`auth.router.ts`, `.schemas.ts`, `.service.ts`, `.repository.ts`). `http/` es transporte compartido, `db/` es conexión y tipos.
- `config.ts` valida las variables de entorno con Zod (falla al arrancar si falta `.env`).
- **Contrato de la API = esquemas Zod** en el backend, de donde sale el OpenAPI (zod-to-openapi) y los clientes tipados.
- **Acceso a datos con Kysely + migraciones SQL**, no Prisma (las columnas `geometry` y pgRouting requieren SQL crudo). Los tipos de tabla se generan con `kysely-codegen` desde la base real. Un cambio de schema no está terminado sin su migración en el commit.
- **Errores**: el backend nunca manda texto al usuario. Responde `{ "error": { "code": "UPPER_SNAKE", "details"? } }` con códigos de `http/error-codes.ts` lanzando `HttpError(status, code, message, details)`; el `message` es solo para logs. Todo status ≥ 500 sale como `INTERNAL_ERROR` sin `details`. Cada cliente traduce el código a español. Catálogo y reglas en `docs/04-errores-y-mensajes.md`.

## Convenciones

- TypeScript estricto con `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`. **`any` está prohibido** (lo impone ESLint); datos sin tipo entran como `unknown` y se validan con Zod. TypeScript se fija en 6.0.x porque `typescript-eslint` aún no soporta la 7.
- Idioma: identificadores, archivos, logs y códigos de máquina en **inglés**; comentarios de código en **español**; texto que ve el usuario en **español** y lo produce el cliente. Archivos en `kebab-case`. (Las pantallas de `mobile/` hoy usan nombres en español, p. ej. `bienvenida.tsx`.)
- Imports relativos del backend llevan extensión `.js` (ESM, `module: NodeNext`).

## Documentación

La documentación es el estado vivo del proyecto (`docs/00-reglas-documentacion.md`): se **edita en el lugar**, no se crean documentos que reemplacen a otros, y un cambio no está terminado hasta que la documentación afectada está actualizada. Un tema, un documento; numeración `NN-` por orden de incorporación. Si cambia un `.mmd`, hay que regenerar los PNG. Puesta en marcha detallada en `docs/05-desarrollo.md`; en Windows se trabaja desde WSL2 (`docs/06-windows-wsl.md`).

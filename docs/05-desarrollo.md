# Puesta en marcha

> Documento temático. Explica cómo levantar el proyecto en una máquina local, de
> cero y paso a paso, y cómo resolver los problemas más comunes. Es el estado vivo
> de ese procedimiento: se edita en su lugar cuando cambia. Se complementa con
> [00-reglas-documentacion.md](00-reglas-documentacion.md) y
> [02-stack-y-estructura.md](02-stack-y-estructura.md).

## 1. Alcance

Los comandos exactos para pasar de un repositorio clonado a la API respondiendo, el
porqué de la base en un contenedor, cómo reiniciarla desde cero cuando algo queda a
medio camino, cómo consultarla, y el catálogo de problemas frecuentes. No repite las
decisiones de stack ni la estructura del código: eso está en
[02-stack-y-estructura.md](02-stack-y-estructura.md).

## 2. Requisitos previos

| Herramienta | Versión | Para qué |
| --- | --- | --- |
| Node.js | 22 LTS | correr el backend |
| pnpm | 12.4.1 (fijada en `packageManager`) | gestor de paquetes |
| Git | — | clonar y versionar |
| Docker (con Compose v2) | — | levantar la base |

Todos los comandos de esta guía usan la forma **`docker compose`** (Compose v2, con
espacio). Si en el sistema solo existe `docker-compose` (v1, con guion), conviene
instalar el plugin v2 en lugar del viejo.

### Docker según el sistema operativo

| Sistema | Instalación | Notas |
| --- | --- | --- |
| Windows | Docker Desktop con backend **WSL2** | los comandos se ejecutan dentro de WSL2 (Ubuntu) y el repo se clona en el sistema de archivos de WSL (`~`), no en `/mnt/c`. Si no se conoce WSL, empezar por [06-windows-wsl.md](06-windows-wsl.md) |
| macOS | Docker Desktop | — |
| Debian / Ubuntu / Mint | Docker Engine + plugin Compose | el paquete `docker-compose` de la distro suele ser v1; conviene el plugin v2 |
| Otros Linux | Docker Engine + plugin Compose | si se prefiere podman, funciona como reemplazo y los comandos son los mismos |

Puertos que deben estar libres: **5432** (base de datos) y **3001** (API).

> Los comandos de esta guía están escritos para una terminal tipo Unix (bash). En
> Windows, WSL2 la provee; en PowerShell hay que tener en cuenta las diferencias (por
> ejemplo `cp` → `Copy-Item`).

## 3. ¿Por qué Docker en desarrollo?

Se podría instalar Postgres, PostGIS y pgRouting directo en el sistema. No lo
hacemos por estas razones, en orden de peso:

- **Versiones consistentes.** La imagen fija Postgres 16 + PostGIS 3.5 + pgRouting
  4.0 en un solo artefacto: todos trabajan con exactamente lo mismo.
- **Instalación frágil.** PostGIS y pgRouting deben coincidir con la versión mayor
  de Postgres. En Debian/Ubuntu dependen del repositorio PGDG (que aparece y
  desaparece según la distro y la versión); en Windows y macOS pgRouting casi no se
  distribuye. El contenedor evita todo ese problema.
- **Windows.** Sin contenedores no hay un camino cómodo hacia pgRouting.
- **Onboarding.** Un `docker compose up -d` en lugar de un instructivo por sistema
  operativo.
- **Sin conflictos con lo existente.** No pelea por el puerto 5432 con un Postgres
  ya en uso para otro proyecto.
- **Empezar de cero** es `docker compose down -v`.

Los costos son reales pero chicos: consume algo de RAM/CPU y agrega latencia de
arranque.

La clave del equilibrio: **solo la base va en un contenedor.** El backend corre
nativo (`pnpm dev`) para conservar recarga automática y debugger. Así hay
reproducibilidad donde importa (la base) y velocidad donde importa (el código).

## 4. Puesta en marcha

```sh
git clone git@github.com:BLP-Technologies/rodando-x-mza.git
cd rodando-x-mza

# 1) Base de datos: Postgres + PostGIS + pgRouting
cd infra
docker compose up -d
docker compose ps          # esperar a que el estado sea "healthy"

# 2) Backend
cd ../backend
pnpm install
cp .env.example .env       # el .env no se versiona; los valores por defecto
                           # ya coinciden con el compose
pnpm migrate               # aplica las migraciones de la base
pnpm dev                   # API en http://localhost:3001
```

La base se **aprovisiona sola**: la primera vez que se inicializa el volumen, el
contenedor corre `infra/initdb/`, que habilita las extensiones `postgis` y
`pgrouting`. Por eso no forma parte de las migraciones.

`pnpm dev` y `pnpm migrate` toman las variables de `.env` automáticamente. En
PowerShell, el `cp` del paso 3 equivale a `Copy-Item .env.example .env`.

## 5. Reiniciar la base desde cero

En desarrollo el esquema cambia mucho: una migración a medio escribir, un archivo de
migración que se corrige después de aplicarlo, datos de prueba que estorban. La salida
rápida es tirar la base y reconstruirla.

> [!WARNING]
> Este procedimiento **borra todos los datos** de la base de desarrollo y no se puede
> deshacer. En producción nunca se hace así: ver
> [03-despliegue-y-operacion.md](03-despliegue-y-operacion.md).

```sh
cd infra
docker compose down -v      # -v borra el volumen: no queda nada
docker compose up -d        # vuelve a crear el contenedor y lo inicializa
docker compose ps           # esperar a que el estado sea "healthy"

cd ../backend
pnpm migrate                # volver a aplicar todas las migraciones
```

El último paso es el que más se olvida: **levantar la base no aplica las migraciones.**
Un volumen nuevo queda sin tablas hasta que corra `pnpm migrate`.

Qué hace exactamente `down -v`, y por eso es lo que arregla los problemas raros:

- Borra el volumen, no solo el contenedor.
- Al levantar de nuevo, el contenedor corre `infra/initdb/` una vez, que es donde se
  habilitan `postgis` y `pgrouting`. Esa es la razón por la que un volumen creado antes
  de agregar `initdb/` nunca tiene las extensiones: no hay forma de arreglarlo sin
  recrearlo.

Para confirmar que quedó limpia y migrada:

```sh
cd infra
docker compose exec db psql -U rodando -d rodando -c '\dt'
docker compose exec db psql -U rodando -d rodando -c 'select name, run_on from pgmigrations'
```

Si preferís no borrar el volumen, se puede deshacer migración por migración con
`pnpm migrate:down` (revierte la última) o
`pnpm exec node-pg-migrate down N --envPath .env -m ../infra/migrations` en `backend/`
(revierte las últimas `N`). Eso conserva lo que no hayan tocado esas migraciones.

## 6. Consultar la base

Las credenciales son las del compose y son **solo para desarrollo**:
`rodando` / `rodando`, base `rodando`, puerto `5432`.

Con `psql` dentro del contenedor, sin instalar nada:

```sh
cd infra
docker compose exec db psql -U rodando -d rodando
docker compose exec db psql -U rodando -d rodando -c '\dt'
```

Con un cliente gráfico como pgAdmin, DBeaver o TablePlus: host `localhost`, puerto
`5432`, base `rodando`, usuario `rodando`, contraseña `rodando`.

## 7. Verificación

```sh
curl http://localhost:3001/api/health        # {"status":"ok"}
curl http://localhost:3001/api/health/ready  # {"status":"ok","db":"up"}
```

- `/api/health` (liveness): el proceso está vivo. No toca la base.
- `/api/health/ready` (readiness): **además** la base responde. Es el que confirma
  que está todo bien.

## 8. Comandos frecuentes

Desde `backend/`:

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | API con recarga automática |
| `pnpm test` | tests (Vitest) |
| `pnpm lint` | ESLint (incluye la prohibición de `any`) |
| `pnpm typecheck` | chequeo de tipos |
| `pnpm build` | compila a `dist/` |
| `pnpm migrate` | aplica las migraciones pendientes |
| `pnpm migrate:down` | revierte la última migración |

Base de datos, desde `infra/`:

| Comando | Qué hace |
| --- | --- |
| `docker compose up -d` | levanta la base |
| `docker compose ps` | estado del contenedor |
| `docker compose logs -f db` | logs de la base |
| `docker compose down` | detiene el contenedor (conserva los datos) |
| `docker compose down -v` | además borra los datos: base de cero |
| `docker compose exec db psql -U rodando -d rodando` | abre `psql` en la base (§6) |

## 9. Problemas comunes

| Síntoma | Causa y solución |
| --- | --- |
| Al levantar la base, el motor busca la imagen en un registro equivocado (p. ej. un mirror de la distro) y da `manifest unknown` | la imagen del compose ya usa el prefijo `docker.io/`; verificar que el comando se ejecute desde `infra/` |
| `Invalid configuration: NODE_ENV: ...` al arrancar | falta el `.env`. Ejecutar `cp .env.example .env` |
| `/api/health/ready` devuelve `503 {"db":"down"}` | la base no responde. Revisar `docker compose ps` (¿`healthy`?) y que las credenciales del `.env` coincidan con las del compose |
| `pnpm migrate` imprime la ayuda del CLI y sale con error | falta la acción `up`; usar el script `pnpm migrate`, que ya la incluye |
| El puerto 5432 o 3001 está ocupado | hay otro servicio usándolo. Detener lo que lo usa o cambiar el puerto en el compose / `.env` |
| Se quiere empezar con la base de cero | `docker compose down -v`, `up -d` y después `pnpm migrate` (ver §5) |
| La app falla porque falta la extensión `postgis` o `pgrouting` | el volumen se creó antes de agregar `infra/initdb/`. Recrearla con `docker compose down -v` y `docker compose up -d` |
| `pnpm migrate` falla con `type "geometry" does not exist` | la base no tiene PostGIS habilitado. Pasa en una base creada a mano con `createdb`, porque las extensiones las pone `infra/initdb/` al inicializar el volumen. Recrear la base (§5) o correr `CREATE EXTENSION postgis; CREATE EXTENSION pgrouting;` en ella |
| En Fedora/RHEL el contenedor de la base no arranca y el log dice `Permission denied` sobre `/docker-entrypoint-initdb.d` | SELinux bloquea el bind mount. El montaje debe llevar el flag `z` (`:ro,z`, ya está en el compose); no quitarlo |

## 10. Documentos relacionados

- [00-reglas-documentacion.md](00-reglas-documentacion.md): reglas de la
  documentación.
- [02-stack-y-estructura.md](02-stack-y-estructura.md): stack, estructura y
  convenciones.
- [04-errores-y-mensajes.md](04-errores-y-mensajes.md): contrato de errores.
- [06-windows-wsl.md](06-windows-wsl.md): trabajar desde Windows con WSL2.
- [08-integracion-continua.md](08-integracion-continua.md): la verificación que corre
  en cada pull request, con los mismos comandos de §8.
- [09-modelo-de-datos.md](09-modelo-de-datos.md): convenciones del esquema y de las
  migraciones que aplica §4.

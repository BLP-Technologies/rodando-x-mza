# Guía de despliegue con Dokploy

> Documento operativo. Registra cómo se despliega cada pieza del sistema en el VPS
> con Dokploy: qué se configuró, qué se verificó y qué falló en el camino.
> Complementa a [03-despliegue-y-operacion.md](03-despliegue-y-operacion.md), que
> define la topología y las decisiones de operación, a
> [05-desarrollo.md](05-desarrollo.md), que cubre el entorno local, y a
> [08-integracion-continua.md](08-integracion-continua.md), que cubre la
> verificación automática. Es el estado vivo del despliegue: se edita en su lugar
> a medida que se suman piezas.

## 1. Alcance

Este documento responde:

- **Dónde** corre el sistema y con qué plataforma (§2).
- **Cómo** se despliega la base de datos, paso por paso (§3).
- **Cómo** se desplegarán el backend y el portal (§4 y §5).
- **Cómo** se obtiene el APK de la aplicación móvil (§6).
- **Qué** falta para completar el despliegue (§7).

| Pieza | Estado | Dónde corre |
| --- | --- | --- |
| Base de datos | Desplegada y verificada | Dokploy · Application |
| Backend | Pendiente | Dokploy · Application |
| Portal | Pendiente | Dokploy · Application |
| APK | Pendiente | Build de Expo, fuera del VPS |

Quedan fuera de este documento:

- **Migraciones y carga del grafo.** Se ejecutan desde el backend en producción,
  cuando exista: `pnpm migrate` forma parte del despliegue del backend (§4) y
  `pnpm import:osm` es una carga inicial que no se repite (§4.3).
- **Puesta en marcha local**, que está en
  [05-desarrollo.md](05-desarrollo.md).
- **Verificación automática del repositorio**, que está en
  [08-integracion-continua.md](08-integracion-continua.md).

## 2. La plataforma

Todo el sistema corre en **un único VPS** (x86\_64, Ubuntu, Docker) administrado con
**Dokploy**, un PaaS autoalojado: se conecta un repositorio, Dokploy construye la
imagen, crea el contenedor y, si se configura un dominio, lo publica con TLS. Es el
mismo modelo de trabajo que Heroku o Vercel, con la diferencia de que el build y la
ejecución ocurren en la máquina propia.

En Dokploy hay dos formas de desplegar:

| Tipo | Qué hace | Cuándo se usa acá |
| --- | --- | --- |
| **Application** | Un servicio, un contenedor. Construye desde un repo (Railpack, Nixpacks, Dockerfile) o desde una imagen. | Las tres piezas del sistema |
| **Compose** | Levanta un archivo `docker-compose.yml` completo | Solo en desarrollo, con `infra/docker-compose.yml` |

Las tres piezas se despliegan como **Applications**, no como Compose. Las razones:

1. **Build automático.** El backend y el portal no necesitan Dockerfile: Dokploy
   detecta el stack con Railpack o Nixpacks y construye la imagen. Con Compose, en
   cambio, cada servicio de código propio exige un Dockerfile.
2. **Despliegue independiente.** Cada pieza se actualiza y se reinicia sola.
3. **Red compartida.** Las Applications quedan en la red de Dokploy y se resuelven
   entre sí por el nombre del servicio, sin publicar puertos. Con Compose cada
   proyecto tiene su propia red y haría falta tender un puente.
4. **Un solo repositorio.** Las tres Applications clonan el mismo repositorio y
   cada una usa su directorio o su Dockerfile.

Que no se escriba un Dockerfile para el backend y el portal no significa que no se
contenericen: **todo corre en Docker**. Lo que se evita es escribirlo a mano.

> **Nota sobre el proxy.** [03 §2](03-despliegue-y-operacion.md) describe nginx como
> reverse proxy. En Dokploy ese rol lo cumple **Traefik**, que viene incluido y
> emite los certificados. La topología del resto de los componentes no cambia.

## 3. La base de datos

### 3.1 Imagen propia y por qué

PostgreSQL necesita **PostGIS** y **pgRouting**. La imagen oficial
`pgrouting/pgrouting:16-3.5-4.0` ya trae las dos extensiones compiladas: Postgres 16,
PostGIS 3.5 y pgRouting 4.0. No hay que compilar nada ni instalar paquetes.

Lo único que falta es **habilitar las extensiones**, que es parte de la plataforma y
no del esquema de la aplicación (ver
[03 §5](03-despliegue-y-operacion.md#5-base-de-datos-en-producción)). En desarrollo
eso lo hace `infra/initdb/01-extensions.sql` por bind mount; en el servidor se
resuelve con un Dockerfile mínimo que lo hornea en la imagen:

```dockerfile
FROM docker.io/pgrouting/pgrouting:16-3.5-4.0
COPY infra/initdb/01-extensions.sql /docker-entrypoint-initdb.d/01-extensions.sql
```

Vive en `infra/deploy/db.Dockerfile`. No hace falta publicar la imagen en ningún
registry: Dokploy la construye desde el repositorio en cada deploy.

El mecanismo es el del entrypoint oficial de Postgres: **los scripts de
`/docker-entrypoint-initdb.d` se ejecutan una sola vez, cuando el directorio de datos
está vacío**. Si el volumen ya contiene un cluster, el entrypoint lo ignora e
imprime `Skipping initialization`.

### 3.2 Configuración de la Application

| Campo | Valor |
| --- | --- |
| Nombre | `database` |
| Source | GitHub, `https://github.com/BLP-Technologies/rodando-x-mza.git` |
| Branch | `main` |
| Build type | Dockerfile |
| Build path | vacío |
| Dockerfile path | `infra/deploy/db.Dockerfile` |
| Docker context path | `.` |
| Build stage | vacío |
| Environment | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` |
| Volume | `rodando-db-data` → `/var/lib/postgresql/data` |
| Ports | ninguno |
| Domains | ninguno |
| Create environment file | por defecto |

**Rutas.** Dokploy resuelve el Dockerfile así:

```
<code>/<build path>/<dockerfile path>
```

El build path se **antepone**, no reemplaza. Con build path `infra` y Dockerfile path
`infra/deploy/db.Dockerfile` la ruta queda `code/infra/infra/deploy/db.Dockerfile` y
el build falla porque no existe. Por eso el build path va vacío y las dos rutas son
relativas a la raíz del repositorio. El context es la raíz, que es lo que necesita el
`COPY` para leer `infra/initdb/`.

**Variables.** Van en **Environment settings**, no en build-time arguments ni en
build-time secrets: el contenedor las necesita en ejecución, y los argumentos de
build solo existen durante el build. La imagen de Postgres no arranca sin
`POSTGRES_PASSWORD`.

La password conviene que use solo letras, números, `-` y `_`. Para el contenedor
cualquier caracter sirve, pero después se usa dentro de `DATABASE_URL`
(`postgres://usuario:password@host:5432/db`) y `%`, `{`, `}` y `#` obligan a
codificarla o rompen la cadena.

**Volumen.** Es un **volume mount** (volumen nombrado de Docker), no un bind mount ni
un file mount:

- el bind mount usa una ruta del host que Dokploy limpia y administra;
- el file mount es para archivos de configuración, no para datos;
- el volumen nombrado entra en los backups de Dokploy y sobrevive a los redeploys.

El nombre se usa tal cual, sin prefijo de la aplicación. El punto de montaje tiene
que ser exactamente `/var/lib/postgresql/data`, que es el `PGDATA` de la imagen.

### 3.3 Primer deploy y verificación

El log del deploy termina en `Docker build completed`. **Eso no prueba que la base
esté corriendo**: Dokploy transmite la fase de build y el estado del contenedor se
consulta aparte. En los logs del contenedor se busca:

```
running /docker-entrypoint-initdb.d/01-extensions.sql
CREATE EXTENSION
CREATE EXTENSION
PostgreSQL init process complete; ready for start up
database system is ready to accept connections
```

Verificación del servicio y de las extensiones. El nombre del servicio lo genera
Dokploy a partir del nombre de la app y del proyecto; en este servidor quedó así:

```bash
SERVICE=rodando-x-mza-databasae-eswxmc

docker service ls | grep "$SERVICE"          # 1/1, no 0/1
docker service ps "$SERVICE" --no-trunc      # la tarea nueva en Running

C=$(docker ps -q --filter name="$SERVICE" --filter status=running | head -n1)
docker exec "$C" psql -U rodando -d rodando -c \
  "select extname, extversion from pg_extension where extname in ('postgis','pgrouting');"
```

Resultado esperado:

| extname | extversion |
| --- | --- |
| postgis | 3.5.2 |
| pgrouting | 4.0.1 |

Si las dos filas aparecen, la base quedó lista. Si no aparecen y el log dice
`Skipping initialization`, el volumen ya tenía un cluster y el script no se ejecutó:
ver §3.4.

### 3.4 Errores que aparecieron

| Síntoma | Causa | Solución |
| --- | --- | --- |
| `failed to read dockerfile` o `The path ... does not exist` | El build path se anteponía al Dockerfile path | Build path vacío y Dockerfile path desde la raíz |
| `0/1` en `docker service ls`, sin contenedores en el panel, tareas `Rejected` con `invalid mount target, must be an absolute path:  /var/lib/postgresql/data` | El punto de montaje tenía un **espacio adelante**; el doble espacio del mensaje lo delata | Borrar el valor y reescribir la ruta a mano, sin espacios |
| `PostgreSQL Database directory appears to contain a database; Skipping initialization` y después `PANIC: could not locate a valid checkpoint record` | El volumen quedó a medio inicializar por una tarea interrumpida o solapada | Detener la app, borrar los contenedores que usan el volumen, borrar el volumen y redeployar (§3.5) |
| `No such container: <id>` al abrir la terminal o los logs | El panel apunta a una tarea vieja que Swarm ya reemplazó | Es un problema del panel, no de la base: recargar y elegir la tarea en ejecución |
| `No such container: psql` al usar `docker exec $(docker ps -q ...)` | El filtro no devolvió ningún contenedor y el shell pasó `psql` como nombre | Verificar que la tarea esté en `Running` y que el filtro devuelva un ID |

El panel de Dokploy muestra todas las tareas del servicio, incluidas las terminadas.
Eso explica que aparezcan varios contenedores "finalizados": es el historial de
Swarm, no instancias activas.

### 3.5 Recrear el volumen

Es el procedimiento para una base sin datos que quedó corrupta. **Borra todo lo que
hay en la base**: no usarlo con datos reales.

```bash
SERVICE=rodando-x-mza-databasae-eswxmc

# 1. detener la app desde Dokploy
# 2. borrar los contenedores que retienen el volumen
docker rm $(docker ps -aq --filter volume=rodando-db-data)

# 3. borrar el volumen
docker volume rm rodando-db-data

# 4. Deploy desde Dokploy: recrea el volumen vacío y corre initdb
```

Si `docker volume rm` responde `volume is in use`, quedan contenedores vivos o
detenidos que lo referencian: listarlos con
`docker ps -a --filter volume=rodando-db-data` y borrarlos antes.

### 3.6 Operación

- **Las extensiones no se vuelven a crear.** `initdb.d` corre una sola vez por
  volumen. Si hace falta una extensión nueva, se instala a mano con
  `CREATE EXTENSION IF NOT EXISTS ...` dentro del contenedor.
- **No redeployar mientras inicializa.** Un segundo Postgres sobre el mismo `PGDATA`
  mientras el primero escribe deja el cluster corrupto. Si en *Advanced → Swarm
  Settings* existe un *Update Order*, tiene que ser `stop-first`, no `start-first`.
- **Sin puerto publicado.** La base solo se alcanza desde la red de Dokploy, por el
  nombre del servicio, o por la terminal del contenedor. Para operar desde una
  máquina local se publica un puerto temporal (por ejemplo `15432 → 5432`) y se
  retira al terminar.
- **Volúmenes ajenos.** En el servidor conviven `dokploy` y `dokploy-postgres`, que
  pertenecen al panel. No se tocan. Tampoco se ejecuta `docker volume prune` ni
  `docker system prune --volumes`.
- **Backup.** Pendiente: el volumen `rodando-db-data` todavía no tiene respaldo
  configurado.

## 4. Backend (pendiente)

Decisión tomada, todavía no ejecutada:

| Campo | Valor previsto |
| --- | --- |
| Tipo | Application |
| Build type | Railpack (alternativa: Nixpacks) |
| Build path | `backend` |
| Puerto | `3001` |
| Dominio | `api.<dominio>` |
| Volumen | uno nombrado para `UPLOAD_DIR` |
| Variables | `NODE_ENV`, `DATABASE_URL`, `CORS_ORIGINS`, `UPLOAD_DIR`, `UPLOAD_BASE_URL` |

Notas:

- El build necesita fijar Node 22 y pnpm 12, que son las versiones del repositorio.
- `DATABASE_URL` usa como host el nombre del servicio de la base en Dokploy
  (`rodando-x-mza-databasae-eswxmc`), no una IP ni un puerto publicado. Se confirma
  al desplegar.
- `UPLOAD_BASE_URL` es la URL pública real de `/uploads` y queda guardada en
  `reports.image_url` ([03 §7](03-despliegue-y-operacion.md#7-configuración-y-secretos)).
- `NEXT_PUBLIC_API_URL` no aplica acá.

### 4.1 Migraciones

`pnpm migrate` aplica las migraciones de `infra/migrations` y forma parte del
despliegue del backend. Todavía no está definido cómo se integra a la cadena de
despliegue (paso previo al arranque o tarea aparte); se documenta cuando se resuelva.
No es un paso de la base: la base solo aporta el motor y las extensiones.

### 4.2 Carga del grafo

`pnpm import:osm` carga el extracto de la zona piloto
([11](11-grafo-peatonal.md)). Es una **carga inicial**, no un paso recurrente: se
corre una vez contra la base y se repite solo si se regenera el extracto. El archivo
`data/pilot-zone.osm` no se versiona; se genera con
`scripts/fetch-pilot-zone-osm.mjs` o se copia desde una máquina que ya lo tenga.

## 5. Portal (pendiente)

| Campo | Valor previsto |
| --- | --- |
| Tipo | Application |
| Build type | Railpack |
| Build path | `portal` |
| Puerto | `3000` |
| Dominio | `portal.<dominio>` |
| Variables | `NEXT_PUBLIC_API_URL` |

`NEXT_PUBLIC_API_URL` se inlinea en el build: tiene que estar cargada **antes** del
primer deploy y cualquier cambio de URL obliga a reconstruir.

## 6. APK (pendiente)

La aplicación móvil no se despliega en el servidor: se compila con Expo y se
distribuye como APK ([03 §8](03-despliegue-y-operacion.md#8-procedimiento-de-despliegue)).
Solo necesita que la API tenga una URL pública, que es la del backend del §4.

## 7. Estado y próximos pasos

- [x] VPS con Dokploy y proyecto creado.
- [x] Base de datos desplegada con PostGIS y pgRouting verificados.
- [ ] Volumen de la base con backup.
- [ ] Backend desplegado, con migraciones integradas al despliegue.
- [ ] Carga inicial del grafo.
- [ ] Portal desplegado.
- [ ] APK compilado contra la API de producción.

## 8. Documentos relacionados

- [03-despliegue-y-operacion.md](03-despliegue-y-operacion.md): topología,
  requisitos del servidor, respaldo y responsabilidades operativas.
- [05-desarrollo.md](05-desarrollo.md): entorno local y comandos de la base en
  desarrollo.
- [08-integracion-continua.md](08-integracion-continua.md): verificación previa a
  integrar un cambio.
- [11-grafo-peatonal.md](11-grafo-peatonal.md): qué carga `pnpm import:osm`.
- [09-modelo-de-datos.md](09-modelo-de-datos.md): esquema y migraciones.

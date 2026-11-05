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
- **Cómo** se opera la base por SSH cuando no hay un cliente SQL conectado (§3.7).
- **Cómo** se respalda la base mientras dura el MVP (§3.8).
- **Cómo** se actualiza la base sin corromperla y cómo se restaura un dump (§3.9).
- **Cómo** se despliega el backend, cómo se verifican sus migraciones, cómo se
  actualiza solo con cada push y cómo se leen sus logs (§4).
- **Cómo** se despliega el portal y qué necesita el servidor (§5).
- **Cómo** se compila el APK de la aplicación móvil en local (§6).
- **Qué** falta para completar el despliegue (§7).

| Pieza | Estado | Dónde corre |
| --- | --- | --- |
| Base de datos | Desplegada y verificada | Dokploy · Application |
| Backend | Desplegado y verificado | Dokploy · Application |
| Portal | Desplegado y verificado | Dokploy · Application |
| APK | Compilado y probado | Build local, fuera del VPS |

Quedan fuera de este documento:

- **El detalle del esquema.** Las migraciones y la carga del grafo se ejecutan en el
  servidor y se documentan acá (§4), pero su contenido está en
  [09](09-modelo-de-datos.md) y [11](11-grafo-peatonal.md).
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

### 2.1 Disco

**20 GB es el mínimo.** La base, el backend, el portal y el builder de Railpack tienen
que convivir en el mismo disco, y un build de Next necesita margen además de lo que
ocupan las imágenes ya construidas.

Al ampliar el disco en el proveedor, el filesystem se extiende al reiniciar; si no lo
hace, se crece la partición con `growpart` y el filesystem con `resize2fs` (o
`xfs_growfs`, o `lvextend` si hay LVM). El panel del proveedor puede mostrar más
espacio usado que `df` porque cuenta snapshots y la reserva del sistema: `df` es la
fuente de verdad.

Para diagnosticar:

```bash
df -h /
docker system df
```

La limpieza diaria de Docker se activa en **Settings → Web Server → Daily Docker
Cleanup**: poda contenedores detenidos, imágenes sin uso y build cache.

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
- **Actualizaciones con `stop-first`.** Un segundo Postgres sobre el mismo `PGDATA`
  corrompe el cluster. La configuración obligatoria del servicio y el procedimiento de
  recuperación están en §3.9.
- **Sin puerto publicado.** La base solo se alcanza desde la red de Dokploy, por el
  nombre del servicio, o por SSH al VPS (§3.7). Se evaluó publicar un puerto
  temporal para usar un cliente SQL desde una máquina local y se descartó: obliga a
  exponer Postgres sin TLS a Internet y el trabajo no lo justifica.
- **Volúmenes ajenos.** En el servidor conviven `dokploy` y `dokploy-postgres`, que
  pertenecen al panel. No se tocan. Tampoco se ejecuta `docker volume prune` ni
  `docker system prune --volumes`.
- **Backup.** Manual por ahora (§3.8): no hay respaldo automático programado.

### 3.7 Operación por SSH

La base no se publica en Internet. Para consultas sueltas o trabajo en lote se entra
por SSH al VPS y desde ahí al contenedor. Es el único camino de acceso desde fuera de
la red de Dokploy.

Entrar al servidor:

```bash
ssh usuario@IP_DEL_VPS
```

Identificar el contenedor en ejecución. El nombre incluye el identificador de la
tarea y cambia en cada redeploy, así que se resuelve por filtro en vez de
hardcodearlo:

```bash
C=$(docker ps -q --filter name=rodando-x-mza-databasae --filter status=running | head -n1)
echo "$C"
```

Sesión interactiva:

```bash
docker exec -it "$C" psql -U rodando -d rodando
```

Para aplicar un archivo `.sql` que está en el VPS, como una sola transacción y
cortando en el primer error:

```bash
docker exec -i "$C" psql -U rodando -d rodando \
  --single-transaction -v ON_ERROR_STOP=1 < operaciones.sql
```

`--single-transaction` hace que el archivo se aplique entero o no se aplique;
`ON_ERROR_STOP=1` evita que psql continúe después de un error. Sin las dos, un
archivo que falla a la mitad deja la base en un estado intermedio.

Exportar el resultado de una consulta a CSV:

```bash
docker exec -i "$C" psql -U rodando -d rodando -c \
  "\copy (select * from reports) to stdout csv header" > reports.csv
```

Advertencias:

- Los cambios de esquema van por una migración en `backend/migrations`. Ejecutar DDL a
  mano desincroniza producción del repositorio y de los tipos generados
  ([09](09-modelo-de-datos.md)).
- Antes de un `UPDATE` o `DELETE` masivo, correr el mismo `WHERE` con
  `select count(*)` y revisar el número.
- Si el servicio se recrea, el contenedor cambia: hay que volver a resolver `C`.

### 3.8 Respaldo manual

Mientras el sistema esté en el MVP el respaldo es manual: se hace antes de cualquier
operación riesgosa, como una carga masiva, un cambio de datos o una migración. No hay
backups automáticos configurados.

Generar el dump en el VPS, directamente en el home del usuario con el que se entra por
SSH:

```bash
DB=$(docker ps -q --filter name=rodando-x-mza-databasae --filter status=running | head -n1)
docker exec "$DB" pg_dump -U rodando -d rodando -Fc > ~/rodando-$(date +%F-%H%M).dump
ls -lh ~/rodando-*.dump
```

`-Fc` es formato custom comprimido: ocupa poco y se puede inspeccionar sin restaurar.
`pg_dump` toma una foto consistente aunque la API esté escribiendo, pero no incluye
roles ni contraseñas. Si el archivo se generó como root, se mueve al home del usuario y
se ajusta el dueño antes de copiarlo.

Copiar a la máquina de trabajo:

```bash
scp -P <puerto> usuario@IP_DEL_VPS:'~/rodando-*.dump' ~/backups/rodando/
```

`scp` usa **`-P` mayúscula** para el puerto; `ssh` usa `-p` minúscula. Si el servidor
escucha en el 22 se omite, pero acá el SSH está en un puerto distinto: sin `-P` la
conexión queda esperando y no avisa nada.

Verificar que el archivo sea un dump válido:

```bash
pg_restore -l ~/backups/rodando/rodando-*.dump | head
```

Tiene que listar el TOC: extensiones, tablas y la vista `walkable_edges`. Un archivo de
0 bytes o uno que `pg_restore` rechaza no es un respaldo.

Para probar la restauración, en una base descartable con PostGIS y pgRouting, como la
del compose de desarrollo:

```bash
createdb -h localhost -U rodando prueba_restore
pg_restore -h localhost -U rodando -d prueba_restore --no-owner ~/backups/rodando/rodando-*.dump
```

Alcance: cubre la base, no las imágenes de `backend-uploads`
([03 §9](03-despliegue-y-operacion.md#9-respaldo-y-restauración)). El respaldo
automático a un destino S3 queda diferido hasta que el sistema pase a producción
sostenida; ese día se configura con Volume Backups de Dokploy sobre
`rodando-db-data`, con el servicio apagado durante la copia.

### 3.9 Actualización y recuperación de la base

La base es el único servicio con estado. Un redeploy con `start-first` arranca la tarea
nueva antes de detener la anterior: dos postmasters sobre el mismo `PGDATA` corrompen el
cluster. La configuración obligatoria del servicio es:

| Ajuste | Valor |
| --- | --- |
| Update order | `stop-first` |
| Stop grace period | `60s` |
| Failure action | `rollback` |

Se configura en **Advanced → Cluster Settings → Update Config**. El formulario exige
`Parallelism`, que no puede quedar vacío; con `1` alcanza. Se verifica con:

```bash
docker service inspect rodando-x-mza-databasae-eswxmc \
  --format '{{json .Spec.UpdateConfig}}'
```

Tiene que devolver `"Order":"stop-first"`. **Se comprueba después de cada deploy de la
base**: si Dokploy reescribe el spec con el valor anterior, el riesgo vuelve.

Reglas de operación:

- No se redeploya la base sin motivo: un deploy solo reinicia el motor.
- Antes de reiniciar Docker, redeployar la base o tocar el volumen, se toma un dump
  (§3.8).
- El disco no puede llenarse: sin espacio para el WAL, el cluster queda inconsistente
  (§2.1).

#### Restaurar desde un dump

Si el cluster no arranca (`invalid checkpoint record`, `could not locate a valid
checkpoint record`), no se intenta reparar el volumen en producción. Se recrea y se
restaura el último dump:

1. Bajar backend y base:

```bash
docker service scale rodando-x-mza-backend-ymru8m=0
docker service scale rodando-x-mza-databasae-eswxmc=0
```

2. Recrear el volumen como en §3.5 y desplegar la base.
3. Recrear la base vacía, para que el dump cree extensiones y esquema:

```bash
DB=$(docker ps -q --filter name=rodando-x-mza-databasae --filter status=running | head -n1)
docker exec "$DB" psql -U rodando -d postgres -c 'DROP DATABASE rodando WITH (FORCE);'
docker exec "$DB" psql -U rodando -d postgres -c 'CREATE DATABASE rodando;'
```

4. Copiar el dump al contenedor y restaurarlo omitiendo los datos de `spatial_ref_sys`.
   `pg_restore` no tiene `--exclude-table-data`: se filtra la lista de TOC.

```bash
docker cp /root/rodando.dump "$DB":/tmp/rodando.dump
docker exec "$DB" sh -c "pg_restore -l /tmp/rodando.dump | grep -v 'TABLE DATA public spatial_ref_sys' > /tmp/toc.list"
docker exec "$DB" pg_restore -U rodando -d rodando -L /tmp/toc.list \
  --no-owner --no-privileges --exit-on-error /tmp/rodando.dump
```

5. Verificar conteos, migraciones y extensiones (§4.5).
6. Levantar el backend. `node-pg-migrate` no aplica nada: `pgmigrations` vino en el dump.

El dump restaura el estado hasta su fecha; todo lo posterior se pierde.

## 4. Backend

### 4.1 Configuración de la Application

| Campo | Valor |
| --- | --- |
| Nombre | `backend` |
| Source | Git, el mismo repositorio, branch `main` |
| Build type | Railpack |
| Build path | `backend` |
| Puerto | `3001` |
| Dominio | `rodando-api.201-32-133-8.sslip.io` |
| Volumen | `backend-uploads` → `/data/uploads` |
| Watch paths | `backend/**` |
| Auto Deploy | activado, con webhook manual (§4.6) |

Variables:

```text
NODE_ENV=production
PORT=3001
LOG_LEVEL=info
DATABASE_URL=postgres://rodando:<password>@rodando-x-mza-databasae-eswxmc:5432/rodando
CORS_ORIGINS=https://rodando-x-mza.201-32-133-8.sslip.io
UPLOAD_DIR=/data/uploads
UPLOAD_BASE_URL=https://rodando-api.201-32-133-8.sslip.io/uploads
RAILPACK_START_CMD=pnpm start:migrate
```

- `NODE_ENV` es obligatorio y no tiene valor por defecto.
- `DATABASE_URL` usa como host el nombre del servicio de la base, sin IP ni puerto
  publicado. La password tiene que ser válida en una URL: letras, números, `-` y `_`.
- `CORS_ORIGINS` es el origen exacto del portal, sin barra final ni path; la
  configuración rechaza cualquier otra forma al arrancar.
- `UPLOAD_DIR` es absoluto y coincide con el punto de montaje del volumen. Relativo,
  dependería del working directory de la imagen.
- `UPLOAD_BASE_URL` es la URL pública de `/uploads` y queda guardada en
  `reports.image_url` ([03 §7](03-despliegue-y-operacion.md#7-configuración-y-secretos)).
- `RAILPACK_START_CMD` es una variable de **build**: Railpack hornea el comando de
  arranque, así que un cambio exige reconstruir (§4.2).

### 4.2 Migraciones en el arranque

Las migraciones viven en `backend/migrations`, dentro del contexto de build, y
`node-pg-migrate` es una dependencia de producción. El script las aplica antes de
levantar la API:

```json
"start:migrate": "node-pg-migrate up && node --env-file-if-exists=.env dist/index.js"
```

Dokploy lo usa porque `RAILPACK_START_CMD` lo indica. Cada deploy aplica lo pendiente
y, si no hay nada, el `up` es una consulta y sigue.

Por qué es seguro:

- **Es idempotente**: la tabla `pgmigrations` registra lo aplicado.
- **Toma un advisory lock**: dos tareas simultáneas no migran a la vez.
- **El CI ya lo prueba**: [08](08-integracion-continua.md) corre `pnpm migrate` contra
  una base limpia en cada pull request, así que un error de sintaxis u orden no llega
  a `main`.

Si una migración falla en producción, el contenedor no arranca y el servicio queda
caído hasta corregir. Es intencional: es preferible a servir con un esquema
inconsistente. Con una réplica, `stop-first` es el orden de actualización adecuado;
`start-first` evitaría la caída pero exige migraciones compatibles hacia atrás
([03 §5](03-despliegue-y-operacion.md#5-base-de-datos-en-producción)).

### 4.3 Verificación

```bash
curl -i https://rodando-api.201-32-133-8.sslip.io/api/health
curl -i https://rodando-api.201-32-133-8.sslip.io/api/health/ready
```

El primero responde `{"status":"ok"}` si el proceso vive; el segundo agrega
`"db":"up"` y es el que prueba la conexión con la base. Por HTTP responde 301 hacia
HTTPS: el certificado lo emite Traefik aunque el panel advierta que sslip.io no
soporta TLS.

Un 503 con `"db":"down"` apunta a `DATABASE_URL` o a la red, no al dominio.

### 4.4 Acceso por SSH y psql

La base no se publica: se opera por SSH. El procedimiento completo —entrar al VPS,
resolver el contenedor, abrir `psql` y ejecutar archivos en lote— está en §3.7 y es el
mismo desde el backend. Para consultas sueltas alcanza con `\dt` para las tablas,
`\dv` para las vistas y `\q` para salir.

Los cambios de esquema **no** van por `psql`: van por una migración (§4.2).

### 4.5 Carga inicial del grafo

Es una carga única, no un paso del despliegue. El extracto se versiona, así que el
clone de Dokploy ya lo tiene. El nombre del servicio lo genera Dokploy y se consulta
con `docker service ls`:

```bash
SERVICE=$(docker service ls --format '{{.Name}}' | grep backend)
C=$(docker ps -q --filter name="$SERVICE" --filter status=running | head -n1)

docker cp /etc/dokploy/applications/"$SERVICE"/code/data/pilot-zone.osm "$C":/tmp/pilot-zone.osm
docker exec "$C" node dist/importer/importer.cli.js /tmp/pilot-zone.osm
```

Corre en una sola transacción: si falla, no deja nada escrito. La corrida del MVP leyó
332 vías, incluyó 84 y creó 329 veredas, 270 cruces y 378 cordones, con tres avisos de
intersecciones en T sin tronco que no se derivan. Se repite solo si se regenera el
extracto.

Verificación:

```bash
DB=$(docker ps -q --filter name=rodando-x-mza-databasae --filter status=running | head -n1)
docker exec "$DB" psql -U rodando -d rodando -c \
  "select (select count(*) from sidewalks) as veredas,
          (select count(*) from crossings) as cruces,
          (select count(*) from kerb_nodes) as cordones"

curl -s "https://rodando-api.201-32-133-8.sslip.io/api/graph?bbox=-68.849165,-32.893626,-68.839872,-32.885789" \
  | head -c 300
```

La consulta responde un `FeatureCollection` con features. Counts en 0 y
`features: []` significan que el import no escribió.

### 4.6 Actualización automática

El CI y el CD están separados: GitHub verifica el cambio y Dokploy despliega `main`.
Con `main` protegido por los checks de [08](08-integracion-continua.md), solo llega a
producción lo que pasó CI.

El webhook **no está en General**: se copia desde la pestaña **Deployments** de la app
y tiene esta forma:

```
https://dokploy-201-32-133-8.sslip.io/api/deploy/<refreshToken>
```

No tiene secret: el token de la URL es la credencial. Se configura en GitHub →
Settings → Webhooks, con `application/json`, evento push y sin secret. El `ping`
inicial responde 200.

Las entregas se interpretan así:

| Código | Significado |
| --- | --- |
| 200 | deploy encolado |
| 301 | el branch o los watch paths no coinciden |
| 400 | Auto Deploy está apagado |
| 404 | el token no corresponde a ninguna app |

`Watch Paths` en `backend/**` evita redeployar por cambios de documentación o del
portal: un push que no toca esa carpeta responde 301 y no despliega.

El orden importa al configurar `RAILPACK_START_CMD`: al ser una variable de build,
tiene que estar cargada **antes** del merge que la necesita; si no, el build sale con
el comando anterior.

### 4.7 Logs

La API registra cada request con `pino-http`: método, ruta, status, duración, IP del
cliente e id de correlación. El id va en el encabezado `x-request-id` y en el `req.log`
de la request, así que un error y su request se pueden unir por ese valor.

```json
{"level":40,"req":{"id":"…","method":"GET","url":"/api/no-existe"},"ip":"…","res":{"statusCode":404},"responseTime":3,"msg":"request completed"}
```

- Nivel: `info` para 2xx y 3xx, `warn` para 4xx, `error` para 5xx.
- No se loguean cuerpos; `authorization` y `cookie` salen redactados.
- `/api/health`, `/api/health/ready` y `/uploads` no se registran.
- `LOG_LEVEL` controla el nivel; en producción va `info`.

Para seguirlos:

```bash
SERVICE=$(docker service ls --format '{{.Name}}' | grep backend)
docker service logs -f "$SERVICE"
```

`docker service logs --since 24h "$SERVICE"` acota la consulta al último día. La misma
información aparece en el visor de logs de Dokploy.

**Rotación.** Docker guarda la salida en `json-file` sin límite por defecto. En el
servidor se configura en `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "20m", "max-file": "1" }
}
```

Si el archivo ya existe, se agregan esas claves sin reemplazar el resto. Después hay que
reiniciar Docker y redesplegar cada app para que las tareas nuevas usen la configuración.
El límite es **por tamaño, no por tiempo**: 20 MB por contenedor alcanzan para varios
días de este MVP, y `--since` se usa para acotar la consulta cuando hace falta.

## 5. Portal

### 5.1 Configuración de la Application

| Campo | Valor |
| --- | --- |
| Nombre | `frontend` |
| Source | Git, el mismo repositorio, branch `main` |
| Build type | Railpack |
| Build path | `portal` |
| Puerto | `3000` |
| Dominio | `rodando-x-mza.201-32-133-8.sslip.io` |
| Volumen | ninguno |
| Watch paths | `portal/**` |
| Auto Deploy | activado, con webhook manual |

Variables:

```text
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_API_URL=https://rodando-api.201-32-133-8.sslip.io
RAILPACK_PACKAGES=node@22
```

- `NEXT_PUBLIC_API_URL` es el **origen** de la API, sin `/api` y sin barra final: el
  cliente arma las rutas con `new URL(path, API_URL)`.
- Se inlinea en el bundle durante el build. Tiene que estar cargada antes del primer
  deploy y cualquier cambio de URL exige reconstruir.
- El host del portal es el que figura en el `CORS_ORIGINS` del backend (§4.1); si
  cambia uno, cambia el otro.
- No lleva volumen: las imágenes de los reportes las sirve el backend.

### 5.2 Build y verificación

Railpack detecta Next, usa pnpm 12.4.1 desde `packageManager` y Node 22 por
`RAILPACK_PACKAGES`. El build corre `next build` con Turbopack y prerenderiza las
rutas estáticas; el arranque es `next start` en el puerto 3000.

```bash
curl -i https://rodando-x-mza.201-32-133-8.sslip.io
docker service ls | grep frontend
```

Esperás un 200 con HTML y el servicio en `1/1`. La prueba real es en el navegador:
que el mapa cargue y traiga datos del grafo, sin errores de CORS en la consola.

## 6. APK

La aplicación móvil no se despliega en el servidor: se compila localmente y se
distribuye como APK ([03 §8](03-despliegue-y-operacion.md#8-procedimiento-de-despliegue)).
Se usa `expo prebuild` + Gradle, sin EAS: no requiere cuenta ni servicio externo.

### 6.1 Requisitos

- Node 22 y pnpm 12.4.1.
- **JDK 17**, que es el que soporta Expo SDK 57 / React Native 0.86. En una máquina con
  varios JDK hay que forzar `JAVA_HOME` y anteponer su `bin` al `PATH`.
- Android SDK con platform 36, build-tools 36.0.0, NDK 27.1.12297006 y CMake 3.22.1.
- Licencias del SDK aceptadas.

### 6.2 Configuración de la app

- `app.json`: `name` `Rodando x Mza` y `android.package`
  `com.blptechnologies.rodandoxmza`.
- `EXPO_PUBLIC_API_URL` define la API. Se deja en `mobile/.env`, que está en el
  `.gitignore`:

```text
EXPO_PUBLIC_API_URL=https://rodando-api.201-32-133-8.sslip.io
```

La variable se inlinea en el bundle: cambiarla exige reconstruir el APK.

### 6.3 Compilación

```bash
cd mobile
pnpm install

export JAVA_HOME=/usr/lib/jvm/temurin-17-jdk
export PATH="$JAVA_HOME/bin:$PATH"
java -version   # tiene que decir 17

pnpm exec expo prebuild --platform android --clean
cd android
./gradlew assembleRelease
```

El APK queda en `android/app/build/outputs/apk/release/app-release.apk`.

`prebuild` genera `android/`, que está en `.gitignore`: no se versiona y se regenera.
`--clean` descarta cualquier cambio manual hecho ahí, así que la configuración nativa
va en `app.json` o en config plugins. El primer build tarda unos diez minutos y descarga
Gradle y dependencias; los siguientes usan cache.

### 6.4 Firma

El proyecto generado firma el release con el **keystore de debug**. El APK instala y
sirve para probar, pero no para publicar en una tienda. Para distribución real hay que
generar un keystore propio y configurarlo en `android/app/build.gradle` o en
`~/.gradle/gradle.properties`, fuera del repositorio.

Consecuencia: si se cambia la clave, Android trata el APK como otra aplicación y hay que
desinstalar la versión anterior antes de instalar la nueva.

### 6.5 Instalación y prueba

Con el teléfono conectado y la depuración USB activada:

```bash
adb devices
adb install -r ~/Descargas/rodando-x-mza-1.0.0.apk
```

Para ver los logs de la app:

```bash
adb logcat -s ReactNativeJS
```

La app apunta a la API de producción; la prueba es navegar el mapa, calcular un
recorrido, enviar un reporte y usar lugares.

### 6.6 Tamaño

El APK incluye las cuatro arquitecturas y ronda los 80 MB. Para teléfonos reales alcanza
con arm64, y se puede pedir sin editar `android/`:

```bash
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

Eso baja el APK a unos 25–30 MB.

### 6.7 Integración continua

No hay workflow para `mobile/`: el CI no compila el APK y no cubre errores de React
Native. La verificación es este build local y la prueba en el dispositivo.

## 7. Estado y próximos pasos

- [x] VPS con Dokploy y proyecto creado.
- [x] Base de datos desplegada con PostGIS y pgRouting verificados.
- [x] Backend desplegado, con migraciones integradas al despliegue.
- [x] Carga inicial del grafo.
- [x] Auto-deploy de `main` con el webhook de Dokploy.
- [x] Portal desplegado y conectado a la API.
- [x] Limpieza diaria de Docker activada.
- [x] Respaldo manual de la base (dump y copia fuera del VPS).
- [x] Update order de la base en `stop-first`.
- [x] APK compilado y probado contra la API de producción.
- [ ] Respaldo automático (diferido; ver §3.8).

## 8. Documentos relacionados

- [03-despliegue-y-operacion.md](03-despliegue-y-operacion.md): topología,
  requisitos del servidor, respaldo y responsabilidades operativas.
- [05-desarrollo.md](05-desarrollo.md): entorno local y comandos de la base en
  desarrollo.
- [08-integracion-continua.md](08-integracion-continua.md): verificación previa a
  integrar un cambio.
- [11-grafo-peatonal.md](11-grafo-peatonal.md): qué carga `pnpm import:osm`.
- [09-modelo-de-datos.md](09-modelo-de-datos.md): esquema y migraciones.

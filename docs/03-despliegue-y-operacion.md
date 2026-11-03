# Despliegue y operación

> Documento temático. Define dónde y cómo corre Rodando x MZA fuera del entorno
> de desarrollo, y qué implica operarlo. Es el estado vivo de esas decisiones: se
> edita en su lugar cuando cambian. Se complementa con
> [00-reglas-documentacion.md](00-reglas-documentacion.md), que define las reglas
> generales de la documentación, [01-diagramas.md](01-diagramas.md), que describe
> los diagramas del sistema, y [02-stack-y-estructura.md](02-stack-y-estructura.md),
> que define las tecnologías y el entorno **de desarrollo**.

## 1. Alcance

Este documento responde cómo se pone en marcha y cómo se mantiene el sistema en
ejecución:

- **Dónde** corre cada componente en producción.
- **Cómo** se despliega una versión nueva.
- **Cómo** se respalda la información y cómo se restaura.
- **Qué** responsabilidades operativas asume el equipo.

No repite el stack ni la estructura de carpetas: eso está en
[02-stack-y-estructura.md](02-stack-y-estructura.md).

## 2. Topología

Todo el sistema corre en **un único servidor (VPS)**, con los procesos aislados
en contenedores y orquestados con Docker Compose. No hay servicios administrados
externos de cómputo ni de base de datos.

```
                    Internet
                       │
                       ▼
              ┌─────────────────┐
              │      nginx      │  reverse proxy · TLS
              │  api.<dominio>  │  HTTP → HTTPS
              │ portal.<dominio>│
              └────┬───────┬────┘
                   │       │
        ┌──────────▼──┐ ┌──▼──────────┐
        │   backend   │ │   portal    │
        │ Express 5   │ │  Next.js    │
        └──────┬──────┘ └─────────────┘
               │ SQL
        ┌──────▼───────────────────┐
        │  PostgreSQL + PostGIS    │
        │  + pgRouting  (volumen)  │
        └──────────────────────────┘

        ┌──────────────────────────┐
        │  uploads  (volumen)      │  imágenes, separadas de la base
        └──────────────────────────┘

            VPS · Docker Compose · `restart: unless-stopped`
```

| Componente | Artefacto                           | Expuesto                    |
| ---------- | ----------------------------------- | --------------------------- |
| `nginx`    | imagen oficial de nginx             | Sí (80 y 443)               |
| `backend`  | build del `backend/` (Express 5)    | No, solo por la red interna |
| `portal`   | build de `portal/` (Next.js)       | No, solo por la red interna |
| `db`       | PostgreSQL con PostGIS + pgRouting  | No, solo por la red interna |
| `uploads`  | volumen Docker montado en `backend` | No                          |

El único servicio con puertos publicados es `nginx`. El resto se alcanza por la
red interna de Compose, así que la base y la API no quedan expuestas a Internet
aunque el firewall del proveedor sea permisivo.

### Por qué un servidor propio y no servicios administrados

El sistema necesita tres cosas que los servicios administrados de cómputo no
ofrecen juntas:

1. **pgRouting.** Es el motor de ruteo y no está disponible en los proveedores
   administrados de PostgreSQL que se evaluaron. Sin pgRouting no hay cálculo de
   recorridos, así que la base termina siendo propia en cualquier escenario.
2. **Archivos en disco.** En un entorno sin servidor el sistema de archivos es
   efímero: guardar las imágenes de los reportes obliga a incorporar
   almacenamiento de objetos antes de tener el MVP.
3. **Reproducibilidad.** El Manual Técnico de la entrega final tiene que permitir
   que cualquier persona levante el proyecto siguiendo la documentación. Un
   `docker compose up` en una máquina es más simple de documentar y de verificar
   que una cadena de proveedores con tokens y variables por entorno.

Con el servidor propio, la infraestructura del MVP se resuelve sin costo (capa
gratuita permanente de un proveedor cloud) o con un VPS pequeño de bajo costo.
Las dos condiciones que se pagan con eso son que el equipo administra el servidor
y que la máquina es un punto único de falla (ver §11).

## 3. Requisitos de la máquina

| Recurso | Mínimo para el MVP                                |
| ------- | ------------------------------------------------- |
| CPU     | 1 vCPU (arquitectura ARM o x86)                   |
| Memoria | 2 GB (Next.js y PostgreSQL comparten la máquina)  |
| Disco   | 20 GB SSD, con el volumen de `uploads` separado   |
| Sistema | Linux x86\_64 o ARM64 con Docker y Docker Compose |
| Red     | IP pública, posibilidad de abrir 80 y 443         |

En una máquina de 1 GB el build de Next.js y PostgreSQL juntos quedan al límite;
no se recomienda. El crecimiento esperado lo absorbe primero el disco
(`uploads`), no la CPU.

## 4. Red, dominio y HTTPS

- **DNS.** Dos registros apuntan a la IP del servidor: `api.<dominio>` y
  `portal.<dominio>`. El dominio definitivo está pendiente de definición; el
  nombre no afecta ninguna otra decisión del documento.
- **TLS.** Los certificados se emiten con Let's Encrypt y se renuevan
  automáticamente. nginx redirige todo HTTP a HTTPS.
- **Reglas de exposición.** Solo 80 y 443 son alcanzables desde Internet. El
  acceso administrativo por SSH se restringe a clave pública, sin contraseña.
- **HSTS y redirección.** Se activan una vez que los certificados están en
  producción; en desarrollo local no aplican.

## 5. Base de datos en producción

- **Imagen.** La misma que en desarrollo: `pgrouting/pgrouting` (Postgres 16 +
  PostGIS 3.5 + pgRouting 4.0). Trae las dos extensiones ya compiladas, así que no
  hace falta un Dockerfile propio ni instalar nada por apt.
- **Extensiones.** `postgis` y `pgrouting` se habilitan en el **aprovisionamiento**
  (una sola vez, con un rol con privilegios), no en las migraciones: son parte de la
  plataforma, no del esquema que evoluciona con el código. Ver §8. En desarrollo eso
  lo hace el script `infra/initdb/` al inicializar el contenedor.
- **Usuario.** La API se conecta con un usuario **dueño del esquema y sin
  privilegios de superusuario**: puede crear y alterar sus tablas —lo que necesitan
  las migraciones— y operar la aplicación, pero no administra el cluster. A futuro,
  con usuarios reales, se separa en dos roles: `migrator` (dueño del esquema) y
  `app` (solo permisos de datos).
- **Puerto.** No se publica al exterior; se accede solo desde la red interna de
  Compose o por SSH con un túnel cuando hace falta operar a mano.
- **Migraciones.** Se aplican con `node-pg-migrate` como paso previo al arranque
  de la versión nueva (§8). Las migraciones se escriben **compatibles hacia
  atrás** (primero agregar, después migrar datos, recién después eliminar lo
  viejo), de modo que una migración no deje a la versión en ejecución sin
  funcionar mientras el contenedor se recrea.
- **Grafo.** El grafo peatonal y las tablas con columna `geometry`
  viven en el mismo esquema; la importación de datos de OpenStreetMap es un
  proceso por lotes que corre fuera del horario de uso, no una tarea del runtime.

## 6. Archivos y almacenamiento

- Las imágenes de los reportes se guardan en un **volumen Docker** montado en el
  servicio `backend`, en un directorio propio (`uploads/`).
- La base guarda **la referencia** al archivo, no el binario. Esa separación es
  la que permite mover los archivos a un servicio de objetos sin tocar el modelo
  de datos.
- El acceso a archivos está detrás de un **puerto del backend** (§2 del diagrama
  de componentes). Migrar de disco a bucket es cambiar el adaptador, no la
  aplicación.
- El volumen entra en el esquema de respaldo (§9): no se respalda "porque está en
  el servidor", se respalda explícitamente.

## 7. Configuración y secretos

- Cada componente toma su configuración de variables de entorno. El repositorio
  versiona un `.env.example` con las claves y sin valores.
- En el servidor los valores reales viven en un `.env` **fuera del repositorio**,
  con permisos restringidos al usuario que corre Compose.
- Secretos del MVP: contraseña de la base, cadena de conexión y el par
  usuario/clave del SSH administrativo. No hay claves de proveedores de mapas:
  las teselas se sirven por un servicio basado en OpenStreetMap que no requiere
  clave (ver §12).

## 8. Procedimiento de despliegue

**Primer despliegue (una sola vez).** Antes del primer arranque hay que aprovisionar
la base: crear la base y el rol de aplicación, y habilitar las extensiones `postgis`
y `pgrouting` con un rol con privilegios. En desarrollo esto lo hace el script
`infra/initdb/` cuando el contenedor inicializa el volumen; en el servidor se corre
el equivalente a mano una vez. Después no se repite.

1. Se integra el cambio en la rama principal del repositorio.
2. En el servidor: `git pull` y build de las imágenes afectadas.
3. **Migraciones** contra la base de producción (`node-pg-migrate up`), antes de
   levantar la versión nueva.
4. `docker compose up -d`, que recrea solo los contenedores con imagen nueva.
5. **Verificación**: `/api/health/ready` responde, los logs no muestran errores y
   el flujo principal del sistema funciona (consulta de recorrido y envío de un
   reporte).
6. Si algo falla, se vuelve a la imagen anterior y se evalúa la migración
   aplicada; por eso §5 exige migraciones compatibles hacia atrás.

La verificación automática del repositorio (`eslint`, `tsc`, `vitest`, render de
diagramas — [02-stack-y-estructura.md](02-stack-y-estructura.md) §9) corre antes
de integrar; el despliegue no reemplaza ese paso.

Una vez estable, este procedimiento puede automatizarse con CI por SSH. En el
MVP se hace a mano: son dos comandos y el equipo necesita ver el resultado.

**La aplicación móvil no se despliega en el servidor.** Se compila aparte, con
Expo, y la dirección de la API es parte de su configuración de entorno: el build
de prueba apunta a `api.<dominio>` en producción y a la máquina de desarrollo en
local. Las versiones que se distribuyen a los usuarios de prueba se generan como
APK desde la misma rama integrada, para que lo que se prueba sea lo documentado.

## 9. Respaldo y restauración

| Qué                  | Cómo                                                     | Frecuencia | Retención               |
| -------------------- | -------------------------------------------------------- | ---------- | ----------------------- |
| Base de datos        | `pg_dump` en formato comprimido, por cron                | Diaria     | 7 diarias + 4 semanales |
| Imágenes (`uploads`) | Copia incremental del volumen                            | Semanal    | 4 copias                |
| Configuración        | `.env` y `docker-compose` versionados fuera del servidor | Al cambiar | Última versión          |

- Las copias **no se dejan solo en el mismo disco** del servidor: se envían a otra
  ubicación (otra máquina del equipo o un servicio de objetos).
- **La prueba de restauración es parte del procedimiento, no una tarea
  opcional**: una vez al mes se restaura el último respaldo en una base local y se
  verifica que el sistema levante contra ella. Un respaldo que nunca se restauró
  no es un respaldo.
- Las imágenes se respaldan aparte porque son irreemplazables: la base guarda la
  referencia, no la foto.

## 10. Monitoreo y operación

- **Healthcheck.** El backend expone `/api/health/ready`, que además consulta la
  base; es al que le pega el monitoreo externo. `/api/health` (sin `ready`) es
  liveness: responde aunque la base esté caída. El healthcheck del propio Compose
  apunta al contenedor de la base (`pg_isready`), no a la API.
- **Reinicio automático.** Todos los servicios corren con
  `restart: unless-stopped`, así que sobreviven a un reinicio del servidor o a la
  caída de un proceso.
- **Aviso de caída.** Un chequeo externo gratuito golpea `/api/health/ready` y avisa
  por el canal de mensajería del equipo si no responde.
- **Logs.** Se consultan con `docker compose logs` y rotan por tamaño para no
  llenar el disco.
- **Disco.** Es el recurso que primero se agota (imágenes de reportes). Se controla
  su uso y se avisa al superar un umbral.
- **Mantenimiento.** Actualizaciones del sistema operativo y de las imágenes base
  en una ventana acordada, fuera del horario de uso, con aviso previo al equipo.

## 11. Responsabilidades operativas asumidas

Al correr sobre un servidor propio, el equipo asume lo que en un servicio
administrado vendría incluido. Es una decisión explícita, no un efecto colateral:

| Responsabilidad               | Cómo se cubre                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| Parcheo del sistema operativo | Actualizaciones periódicas en ventana de mantenimiento                                 |
| Certificados TLS              | Renovación automática + verificación del vencimiento                                   |
| Respaldos y restauración      | §9, con prueba mensual                                                                 |
| Disponibilidad                | `restart: unless-stopped`, healthcheck y aviso de caída                                |
| Firewall y accesos            | Solo 80/443 públicos; SSH por clave                                                    |
| Punto único de falla          | Aceptado para el MVP: una máquina, con respaldos que permiten reconstruir en otro host |

Lo último es el costo real de la decisión: si el servidor cae, el sistema queda
fuera de línea hasta que se recupere o se reconstruya en otra máquina. Para el
MVP de una zona piloto es asumible; para un servicio en producción con usuarios
reales habría que reevaluar (ver §12).

## 12. Decisiones descartadas

| Decisión                                          | Estado           | Razón                                                                                                                                                                                  | Revisar cuando                                                                         |
| ------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Cómputo sin servidor (serverless) para la API     | Descartada       | La base con pgRouting igual queda propia; en serverless el disco es efímero y las imágenes exigen almacenamiento de objetos desde el inicio; el Manual Técnico pierde reproducibilidad | El almacenamiento ya esté en objetos y exista un PostgreSQL administrado con pgRouting |
| Neon como plataforma de base de datos             | Descartada       | No ofrece pgRouting                                                                                                                                                                    | Ofrezca ruteo sobre grafo                                                              |
| PostgreSQL administrado en general                | Descartada (MVP) | Ninguno de los evaluados soporta las dos extensiones                                                                                                                                   | Alguno soporte PostGIS + pgRouting                                                     |
| Servicio de teselas con clave (MapTiler, Stadia)  | Descartada (MVP) | Se resuelve sin costo y sin clave con un servicio basado en OpenStreetMap                                                                                                              | El volumen o los términos del servicio lo exijan                                       |
| Almacenamiento de archivos en servicio de objetos | Diferida         | En el MVP el volumen del servidor alcanza; el acceso ya está detrás de un puerto                                                                                                       | Crecimiento de imágenes o migración de la API a otra plataforma                        |

## 13. Relación con el Manual Técnico

La entrega final pide un Manual Técnico con instrucciones que permitan a otra
persona descargar el proyecto, configurarlo y ejecutarlo. Las secciones §3 a §8 de
este documento son la base de ese manual en su parte de puesta en marcha: el
manual no debería explicar la infraestructura de despliegue por su cuenta, sino
referir a este documento y quedarse con los pasos concretos.

## 14. Documentos relacionados

- [00-reglas-documentacion.md](00-reglas-documentacion.md): reglas de la
  documentación.
- [01-diagramas.md](01-diagramas.md): diagramas del sistema, incluido el de
  componentes, que muestra los puertos y adaptadores de los que dependen §5 y §6.
- [02-stack-y-estructura.md](02-stack-y-estructura.md): tecnologías, versiones,
  estructura de carpetas y entorno de desarrollo.
- [09-modelo-de-datos.md](09-modelo-de-datos.md): convenciones del esquema y de las
  migraciones que se aplican en el procedimiento de §8.

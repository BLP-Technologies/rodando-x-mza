# Integración continua

> Documento temático. Define cómo el repositorio verifica el código automáticamente
> antes de integrar un cambio: qué es GitHub Actions, dónde vive la configuración,
> qué corre en cada corrida y qué reglas protegen `main`. Es el estado vivo de esas
> decisiones: se edita en su lugar cuando cambian. Se complementa con
> [07-plan-de-trabajo.md](07-plan-de-trabajo.md), que define cuándo un cambio está
> terminado, con [02-stack-y-estructura.md](02-stack-y-estructura.md), que define las
> herramientas que se verifican, y con [00-reglas-documentacion.md](00-reglas-documentacion.md).

## 1. Alcance

Este documento responde:

- **Qué es** GitHub Actions y cómo se ejecuta un workflow (§2).
- **Dónde** vive la configuración en el repositorio (§3).
- **Qué hace** cada workflow de este proyecto, paso por paso (§4 y §8).
- **Cuándo** se activa (§5).
- **Qué reglas** protegen `main` y cómo se comporta el merge (§6).
- **Cómo** leer un resultado en rojo y reproducirlo localmente (§7).
- **Cómo** está dividido por aplicación, y cómo se agrega `mobile/` (§8).
- **Qué** suele fallar y cuánto cuesta (§9 y §10).

No describe el despliegue —eso está en [03-despliegue-y-operacion.md](03-despliegue-y-operacion.md)—
ni la puesta en marcha local, que está en [05-desarrollo.md](05-desarrollo.md).

## 2. Qué es GitHub Actions

Es un servicio de GitHub que **ejecuta comandos en una máquina virtual cada vez que
ocurre un evento en el repositorio**. No hay servidor propio ni nada que instalar:
GitHub mira los archivos de configuración versionados en el repositorio y, cuando
pasa lo que esos archivos declaran, corre los comandos que indican.

Vocabulario, que conviene fijar porque los nombres se repiten en toda la interfaz:

| Término | Qué es | En este proyecto |
| --- | --- | --- |
| **Workflow** | Un archivo de configuración completo; se identifica por su `name` | `Backend`, `Portal` |
| **Evento** | Lo que dispara la corrida | un pull request, un push a `main` |
| **Job** | Un grupo de pasos que corre en una máquina; los jobs corren en paralelo entre sí | `Lint, tipos y tests`, `Lint y build` |
| **Step** | Un paso dentro del job: un comando o una acción ya publicada | `pnpm test` |
| **Runner** | La máquina virtual donde corre el job | Ubuntu, provista por GitHub |
| **Action** | Un paso empaquetado y reutilizable, referenciado con `@vN` | `actions/checkout@v4` |
| **Check** | El resultado que el workflow publica en el commit o el PR | `Lint, tipos y tests`, `Lint y build` |

Dos consecuencias de cómo está construido, que explican casi todo lo demás:

- **La máquina arranca vacía en cada corrida** y se destruye al terminar. No hay
  `node_modules`, no hay Node instalado, no queda nada de la corrida anterior. Por eso
  los primeros pasos siempre preparan el entorno, y por eso el cache (§4) importa.
- **Un paso que falla corta los siguientes.** Si `pnpm lint` falla, `pnpm test` no se
  ejecuta. Mirar siempre el primer paso en rojo, no el último.

Un workflow es, en el fondo, **los mismos comandos que uno corre a mano**, escritos
para que los corra un robot en una máquina limpia.

## 3. Dónde vive la configuración

En una ruta fija: `.github/workflows/`. Cada archivo `.yml` de esa carpeta es un
workflow. En este proyecto hay uno por aplicación: `backend.yml` y `portal.yml`.

```
.github/
├── workflows/
│   ├── backend.yml          # CI del backend (backend/src)
│   └── portal.yml           # CI del portal (portal/src)
└── ISSUE_TEMPLATE/
    └── tarea.md             # plantilla de tareas (07 §7)
```

Que sea un archivo versionado es la parte importante, y no es un detalle: **la
verificación viaja con el código**. Cualquiera que clone el repositorio ve qué se
corre y con qué versiones; un cambio en el workflow se revisa en un pull request como
cualquier otro cambio, y queda en el historial.

La ruta no es configurable: un archivo `.yml` fuera de `.github/workflows/` es un
archivo cualquiera que GitHub ignora, sin avisar.

## 4. Qué hace el workflow del backend

`.github/workflows/backend.yml`, completo:

```yaml
name: Backend

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

concurrency:
  group: backend-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verificar:
    name: Lint, tipos y tests
    runs-on: ubuntu-latest
    # Base efímera para comprobar que los tipos generados siguen al esquema.
    # La imagen es la misma del compose de desarrollo; las extensiones las crea
    # un paso más abajo, como hace infra/initdb/ al inicializar el volumen.
    services:
      db:
        image: docker.io/pgrouting/pgrouting:16-3.5-4.0
        env:
          POSTGRES_USER: rodando
          POSTGRES_PASSWORD: rodando
          POSTGRES_DB: rodando
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U rodando -d rodando"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 20
    env:
      DATABASE_URL: postgres://rodando:rodando@localhost:5432/rodando
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4

      # La versión de pnpm sale de packageManager en backend/package.json.
      - uses: pnpm/action-setup@v4
        with:
          package_json_file: backend/package.json

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: pnpm
          cache-dependency-path: backend/pnpm-lock.yaml

      - run: pnpm install --frozen-lockfile

      # kysely-codegen lee DATABASE_URL de .env; node-pg-migrate también.
      - name: Preparar la base
        run: |
          printf 'DATABASE_URL=%s\n' "$DATABASE_URL" > .env
          psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS postgis'
          psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS pgrouting'

      # Falla si alguien cambió el esquema y no regeneró src/db/types.ts.
      - name: Esquema y tipos al día
        run: |
          pnpm migrate
          pnpm db:types:verify

      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
```

Qué hace cada parte, y por qué está:

| Parte | Qué hace | Por qué |
| --- | --- | --- |
| `name: Backend` | Nombra el workflow | Es el prefijo que aparece en la interfaz y en el nombre del check |
| `on` | Declara los eventos (§5) | Sin esto el workflow no se dispara nunca |
| `permissions: contents: read` | Le da al token del workflow solo lectura | El workflow no escribe en el repo: no necesita más |
| `concurrency` + `cancel-in-progress` | Cancela la corrida anterior del mismo ref | Evita gastar tiempo verificando commits ya superados |
| `defaults.run.working-directory: backend` | Corre los `run` dentro de `backend/` | Es donde están `package.json` y `pnpm-workspace.yaml` |
| `actions/checkout@v4` | Copia la rama en la máquina | La máquina arranca vacía |
| `pnpm/action-setup@v4` | Instala pnpm, en la versión del `packageManager` | Una sola fuente de verdad para la versión |
| `actions/setup-node@v4` | Instala Node 22 y cachea el store de pnpm | Mismo runtime que `engines`; el cache ahorra la descarga |
| `pnpm install --frozen-lockfile` | Instala las dependencias exactas del lockfile | Si el lockfile no coincide con `package.json`, falla. Ver §9 |
| `services.db` | Levanta un Postgres efímero con la misma imagen del compose | Las migraciones necesitan PostGIS para crear las columnas `geometry` |
| Preparar la base | Escribe el `.env` y habilita `postgis` y `pgrouting` | Es lo que `infra/initdb/` hace al inicializar el volumen; en un servicio no se puede montar |
| `pnpm migrate` + `pnpm db:types:verify` | Aplica las migraciones y comprueba que `src/db/types.ts` coincide con el esquema | Falla si alguien cambió el esquema y no regeneró los tipos |
| `pnpm lint` / `typecheck` / `test` | La verificación en sí | Son los comandos de [02](02-stack-y-estructura.md) §9 |

`working-directory` aplica a los `run`; las acciones (`uses`) corren siempre desde la
raíz del repositorio. Por eso `package_json_file` y `cache-dependency-path` llevan la
ruta `backend/...` explícita: son las dos que miran dentro de la aplicación.

Los tres comandos de verificación corren en secuencia, no en paralelo, dentro de un
solo job. Con este tamaño de proyecto, dividirlos en tres jobs no ahorra tiempo
significativo (habría que instalar dependencias tres veces) y hace más difícil ver
cuál falló.

## 5. Cuándo se activa

| Evento | ¿Corre? | Por qué |
| --- | --- | --- |
| Pull request abierto o actualizado, contra cualquier rama | Sí | Es el caso normal: se verifica el cambio antes de integrarlo |
| Push a `main` | Sí | Verifica lo que efectivamente entró, incluido el merge de un PR |
| Push a una rama de trabajo | No | El PR ya lo verifica; correr en los dos lados duplica el trabajo |
| Edición por la web de un archivo | Sí, igual que cualquier push | GitHub lo trata como un commit más |
| Cambio en `docs/` | Sí | El workflow no filtra por rutas: se acepta el costo (unos 20 s) a cambio de no tener que mantener una lista de rutas |

Una corrida del job del backend dura del orden de **30 a 40 segundos**. La base de
servicio y el paso de migraciones suman unos 13 s sobre la preparación del entorno: la
medición de referencia es 34 s en el job completo (run `41136603246`).

El job del portal no tiene base de servicio ni migraciones, pero instala su propio
`node_modules` y compila: **32 s** en la primera corrida (run `41506145365`), del mismo
orden que el del backend.

## 6. Las reglas que protegen `main`

El workflow por sí solo **informa**; no impide mergear. Lo que impide mergear es el
**ruleset** `Main verification`, configurado en GitHub (Settings → Rules), que aplica
sobre `refs/heads/main`:

| Regla | Efecto |
| --- | --- |
| `pull_request` (0 aprobaciones) | Todo cambio entra por PR a una rama distinta de `main`, no por push directo |
| `required_status_checks` → `Lint, tipos y tests` y `Lint y build` | Los checks tienen que estar en verde para mergear |
| `strict_required_status_checks_policy` | El PR tiene que estar actualizado con `main` antes de mergear |
| `deletion` | `main` no se puede borrar |
| `non_fast_forward` | Nada de `git push --force` sobre `main` |
| Bypass: rol **Repository admin** | Un admin puede saltear las reglas, en modo `always` |

Consecuencias prácticas, que conviene tener presentes:

- **Cero aprobaciones no significa cero revisión.** Significa que nadie está
  *obligado* a aprobar: el requisito automático es el check. Si más adelante se quiere
  revisión obligatoria, se sube ese número a 1 en el ruleset.
- **`strict` agrega un paso.** Si `main` avanzó mientras el PR estaba abierto, GitHub
  pide "Update branch" y el check vuelve a correr. Es la fricción correcta: evita
  integrar combinaciones que nunca se probaron juntas.
- **El bypass es una salida de emergencia, no un atajo.** Su caso legítimo es
  destrabar el repositorio cuando el workflow mismo está roto (un PR que lo arregla
  tampoco podría mergear). Si se usa seguido, el check deja de significar algo.
- **Renombrar el job rompe el gate en silencio.** El ruleset exige el check por
  nombre (`Lint, tipos y tests`). Si alguien cambia `name:` del job, GitHub no
  encuentra el check requerido y los PR quedan trabados. Si hay que renombrarlo, se
  actualiza primero el ruleset.

## 7. Leer un resultado y reproducirlo

Una corrida en rojo se lee de arriba hacia abajo: se busca **el primer paso en rojo**
y se lee su salida. Es la misma que se obtiene localmente con el comando equivalente.

```sh
# Qué corridas hubo, con su estado
gh run list --limit 5

# Seguir una corrida en vivo
gh run watch <id>

# Ver solo lo que falló
gh run view <id> --log-failed
```

Reproducir el problema en local es correr los mismos comandos, en el mismo lugar:

```sh
cd backend
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test

cd ../portal
pnpm install --frozen-lockfile
pnpm lint && pnpm build
```

> **La reproducción más fiel es con la misma versión de Node y de pnpm que usa el
> workflow**: Node 22 y la versión de `packageManager`. Con otra versión, un rojo
> puede no reproducirse y un verde puede no significar nada.

## 8. El workflow del portal, y cómo se extiende

Cada aplicación con su `package.json` tiene **su workflow**, con su `working-directory`
y sus propios comandos. Es más simple de leer que un workflow único con un job por
carpeta, y deja que cada aplicación cambie lo que verifica sin tocar a las demás.

`.github/workflows/portal.yml`, completo:

```yaml
name: Portal

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

concurrency:
  group: portal-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verificar:
    name: Lint y build
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: portal
    steps:
      - uses: actions/checkout@v4

      # La versión de pnpm sale de packageManager en portal/package.json.
      - uses: pnpm/action-setup@v4
        with:
          package_json_file: portal/package.json

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: pnpm
          cache-dependency-path: portal/pnpm-lock.yaml

      - run: pnpm install --frozen-lockfile

      - run: pnpm lint

      # `next build` incluye el chequeo de tipos: no hace falta un `tsc` aparte.
      - run: pnpm build
```

Tres diferencias con el del backend, todas porque el portal no tiene base de datos:

- **Sin `services`**, así que no hay Postgres efímero ni pasos de migración.
- **`pnpm lint` y `pnpm build`, sin `tsc --noEmit` aparte**: `next build` ya corre el
  chequeo de tipos con la configuración del proyecto, y un `tsc` suelto verificaría lo
  mismo con otra configuración.
- **Un solo paso de verificación**: no hay `test` porque el portal todavía no tiene
  tests. Cuando los tenga, entra acá.

**Cada job nuevo se agrega a la lista de checks requeridos del ruleset** (§6), o su
resultado no bloquea nada. `Lint y build` está pendiente de agregar.

`mobile/` sigue el mismo camino cuando exista: `mobile.yml` con su `working-directory`,
su lockfile en el cache y sus comandos.

## 9. Detalles que muerden

| Síntoma | Causa | Solución |
| --- | --- | --- |
| `Cannot update ... with "frozen-lockfile"` | `package.json` cambió y el lockfile no | `cd backend && pnpm install` y commitear el lockfile |
| El lockfile crece al declarar `packageManager` | pnpm 12 registra su propia versión como dependencia (bloque `packageManagerDependencies`) | Es esperado: se commitea. `--frozen-lockfile` pasa a partir de ahí |
| `ERR_PNPM_UNSUPPORTED_ENGINE` | Node del workflow distinto del `engines` del `package.json` | Alinear `node-version` con `engines` |
| El workflow no aparece en la pestaña Actions | YAML inválido, o el archivo fuera de `.github/workflows/` | Validar el YAML; verificar la ruta |
| El PR dice que falta el check requerido | El job se renombró y el ruleset pide el nombre viejo | Actualizar el ruleset (§6) |
| Un pnpm local viejo no lee el lockfile | El lockfile lo escribió pnpm 12 | Usar la versión de `packageManager` |

## 10. Costo

El repositorio es público, así que las corridas de GitHub Actions son gratuitas y sin
cuota: no hay minutos que administrar. Lo único que cuesta es tiempo de espera, y por
eso el workflow corre un solo job con cache (§2, §4). Si el proyecto pasara a privado,
habría un límite mensual de minutos y este apartado se revisa.

## 11. Documentos relacionados

- [02-stack-y-estructura.md](02-stack-y-estructura.md): las herramientas que el
  workflow verifica (§9) y la estructura del repositorio (§3).
- [05-desarrollo.md](05-desarrollo.md): puesta en marcha local y verificación manual.
- [07-plan-de-trabajo.md](07-plan-de-trabajo.md): definición de terminado y flujo de
  pull requests (§4 y §5).
- [03-despliegue-y-operacion.md](03-despliegue-y-operacion.md): qué pasa después del
  merge, cuando una versión llega a producción.

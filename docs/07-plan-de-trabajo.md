# Plan de trabajo

> Documento temático. Define cómo se organiza el trabajo del equipo: las fases del
> proyecto, la definición de "terminado" y la convención del backlog. Es el estado
> vivo de esas decisiones: se edita en su lugar cuando cambian. Se complementa con
> [00-reglas-documentacion.md](00-reglas-documentacion.md), que define las reglas de
> la documentación, y con [02-stack-y-estructura.md](02-stack-y-estructura.md).

## 1. Alcance

Define el marco: en qué fases se ordena el trabajo, qué significa que una tarea esté
terminada, y cómo se clasifican y se toman las tareas. **No contiene las tareas
concretas**: esas viven en el tablero (§2).

## 2. Dónde vive cada cosa

El trabajo tiene dos ritmos distintos y por eso se guarda en dos lugares:

| | Qué es | Dónde | Cambia |
| --- | --- | --- | --- |
| Estable | Fases, definición de terminado, convención, plantilla | Este repositorio, versionado | Rara vez |
| Volátil | Tareas concretas, estado, responsable, bloqueos | Issues y Projects de GitHub | Todos los días |

Las tareas **no** se escriben en el repositorio: con cuatro personas editando el
mismo archivo, cada cambio sería un conflicto de merge. La plantilla (§7) sí vive
acá, versionada, y las tareas se crean a partir de ella.

## 3. Fases

| Fase | Objetivo | Casos de uso | Depende de |
| --- | --- | --- | --- |
| 0. Fundamentos | API base, infraestructura, decisiones y documentación | — | — |
| 1. Datos y grafo | Esquema completo del DER e importación de OpenStreetMap al grafo peatonal | — | Fase 0 |
| 2. Ruteo | Búsqueda de recorrido accesible y detalle del recorrido | C003, C004 | Fase 1 |
| 3. Autenticación | Registro, inicio de sesión y roles | C001, C002 | Fase 1 |
| 4. App mobile | Recorridos, tutoriales, guardados y reporte de obstáculos | C003–C010 | Fases 2 y 3 |
| 5. Portal de moderación | Gestión de reportes, obstáculos y accesibilidad | C011–C014 | Fase 3 |
| 6. Cierre | Despliegue, operación y Manual Técnico | — | Fases 4 y 5 |

Cada fase es un **milestone** en GitHub.

El **camino crítico** pasa por la Fase 1: hasta que exista el grafo peatonal ruteable
no hay C003, y C003 es el corazón del producto. Las fases 3 y 4 pueden avanzar en
paralelo con la 1 y la 2, porque la autenticación no depende del grafo.

Conviene tener presente un ciclo: crear un obstáculo (C012) o cambiar la accesibilidad
de un elemento (C014) modifica el costo de las veredas y, por lo tanto, el resultado
del ruteo (C003).

## 4. Definición de terminado

Una tarea está terminada cuando:

- [ ] El código pasa `pnpm lint`, `pnpm typecheck` y `pnpm test`.
- [ ] La documentación afectada está actualizada en el mismo cambio
      ([00](00-reglas-documentacion.md) §6).
- [ ] Si cambió un diagrama `.mmd`, la imagen se regeneró
      ([01](01-diagramas.md) §7).
- [ ] Los criterios de aceptación de la tarea se cumplen.
- [ ] El cambio se integró a `main` mediante un pull request que referencia la tarea.

El repositorio todavía no tiene verificación automática (CI); se agrega cuando exista
el flujo de pull requests.

## 5. Cómo se toma una tarea

1. Se elige una tarea de la columna **Backlog** que no tenga bloqueos pendientes.
2. Se mueve a **En curso** y se asigna a quien la va a hacer, antes de empezar.
3. Se implementa y se abre el pull request, con `Closes #<número>` en la descripción.
4. Al integrarse, la tarea pasa a **Terminado**.

Reglas:

- **Una tarea en curso por persona.** Así el resto ve de un vistazo qué está libre.
- **Sin criterios de aceptación, no se toma.** Primero se refina.
- Un bloqueo se marca de forma explícita (columna **Bloqueado** y la dependencia
  escrita en la tarea), no se deja en silencio.

## 6. Clasificación

- **Etiquetas por tipo**: `feature`, `chore`, `docs`, `spike`, `bug`.
- **Etiquetas por área**: `backend`, `mobile`, `portal`, `infra`, `data`.
- **Etiquetas por caso de uso**: `C001` a `C014`, cuando la tarea implementa uno.

El trabajo de documentación se marca con el tipo `docs`; por eso no existe una
etiqueta de área con ese nombre. El estado no es una etiqueta: es la columna del
tablero.

Un **spike** es una tarea de investigación con tiempo acotado y un entregable (una
decisión documentada), no código. Se usa donde hay incertidumbre, como el modelado
del grafo peatonal.

## 7. Anatomía de una tarea

La plantilla (`.github/ISSUE_TEMPLATE/tarea.md`) pide:

| Campo | Para qué |
| --- | --- |
| Contexto | Por qué existe la tarea |
| Entregable | Qué queda hecho cuando termina |
| Criterios de aceptación | Cómo se verifica, en una lista chequeable |
| Dependencias | Qué la bloquea |
| Clasificación | Área, tipo y caso de uso |

El criterio es simple: **una tarea que no se entiende sin preguntarle a quien la
escribió no sirve para tomarla.** Por eso los criterios de aceptación son
obligatorios y el entregable tiene que ser concreto.

## 8. Qué evita que el backlog se vuelva inútil

- **Tareas enormes**: no se pueden repartir. Se dividen hasta que duran una sesión o
  dos.
- **Refinar decenas de tareas antes de empezar**: se detalla la fase en curso y la
  siguiente; el resto queda como milestone.
- **Tareas escritas para uno mismo**: cualquier persona tiene que poder tomarlas.
- **Usar el repositorio como tablero**: conflictos de merge en cada edición.

## 9. Documentos relacionados

- [00-reglas-documentacion.md](00-reglas-documentacion.md): reglas de la
  documentación.
- [02-stack-y-estructura.md](02-stack-y-estructura.md): stack, estructura y
  convenciones.
- [03-despliegue-y-operacion.md](03-despliegue-y-operacion.md): despliegue y
  operación.
- [05-desarrollo.md](05-desarrollo.md): puesta en marcha.

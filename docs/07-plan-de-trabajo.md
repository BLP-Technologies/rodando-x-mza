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

Cada fase es un **milestone** en GitHub. Tener el milestone **no** implica tener las
tareas: las de cada fase se definen a medida que se avanza (§9).

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

El repositorio verifica estos pasos automáticamente: el workflow
`.github/workflows/backend.yml` corre `pnpm install --frozen-lockfile`, `pnpm lint`,
`pnpm typecheck` y `pnpm test` en cada pull request y en cada push a `main`, con las
versiones de Node y de pnpm declaradas en el repositorio. Un resultado en rojo
bloquea el merge solo si el chequeo `Lint, tipos y tests` figura como requerido en
la protección de la rama `main` (Settings → Rules → Require status checks).

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

El procedimiento para producir una tanda completa —no una tarea suelta— está en §8.

## 8. Cómo se derivan las tareas de una fase

Una tanda se deriva de la fase, no de la intuición. El procedimiento:

1. **Partir del objetivo de la fase** (§3) y de los casos de uso que habilita, más
   los diagramas: `02-casos_uso.mmd`, el DER y las secuencias.
2. **Dividir en unidades tomables.** Cada tarea tiene que poder terminarla una
   persona en una o dos sesiones. Si no, se parte.
3. **Separar lo incierto en *spikes*.** Donde no se sabe cómo se hace, la tarea no es
   código: es una investigación acotada con un entregable (una decisión escrita).
4. **Escribir criterios verificables.** Si un criterio no se puede chequear, no es un
   criterio.
5. **Marcar las dependencias** como referencias reales (`Bloqueado por #NN`), no como
   texto suelto.
6. **Clasificar** cada tarea: área, tipo y caso de uso (§6).
7. **Detallar solo la fase en curso y, como mucho, la siguiente.** El resto queda
   como milestone, sin tareas.

Los issues ya escritos son el ejemplo del nivel de detalle esperado: antes de
redactar una tanda nueva, conviene leer dos o tres.

## 9. Cómo cambia el backlog

Este documento define el marco; el backlog es **vivo**. Concretamente:

- **No hay un número fijo de tareas por fase.** La definición inicial de una fase es
  un punto de partida, no un contrato.
- Durante el trabajo **aparecen tareas nuevas**, una tarea puede **desdoblarse** (era
  dos cosas) o **fusionarse** con otra (era la misma). Cuando se descubre que una
  tarea ya está cubierta por otra, se cierra y se deja la nota.
- Por eso, que una fase tenga una lista inicial de quince tareas no significa que vaya
  a terminar con quince, ni que esas sean las únicas posibles: puede crecer y, más
  raramente, achicarse.

De ahí se desprende algo que conviene tener claro: **no es obligatorio definir las
tareas de la fase siguiente.** Se hace cuando hace falta, y en general sucede cuando
la fase en curso se está quedando sin trabajo disponible.

Para saber qué fase toca detallar, alcanza con mirar los milestones de §3: la primera
que todavía no tenga tareas definidas es la candidata. La materia prima ya está en la
documentación —los casos de uso en `02-casos_uso.mmd`, el modelo en el DER y el
alcance de la fase en §3—, así que no hace falta recuperar ninguna conversación.

## 10. Qué evita que el backlog se vuelva inútil

- **Tareas enormes**: no se pueden repartir. Se dividen hasta que duran una sesión o
  dos.
- **Tratar la lista inicial como un contrato**: las tareas aparecen, se desdoblan y
  se fusionan a medida que se trabaja (§9).
- **Tareas escritas para uno mismo**: cualquier persona tiene que poder tomarlas.
- **Usar el repositorio como tablero**: conflictos de merge en cada edición.

## 11. Documentos relacionados

- [00-reglas-documentacion.md](00-reglas-documentacion.md): reglas de la
  documentación.
- [02-stack-y-estructura.md](02-stack-y-estructura.md): stack, estructura y
  convenciones.
- [03-despliegue-y-operacion.md](03-despliegue-y-operacion.md): despliegue y
  operación.
- [05-desarrollo.md](05-desarrollo.md): puesta en marcha.

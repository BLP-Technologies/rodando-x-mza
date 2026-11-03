# El relevamiento de accesibilidad

> Documento temático. Define de dónde sale el dato de accesibilidad del MVP, qué
significa cada nivel en la calle, cómo se registra y qué se hace con lo que no se
puede modelar. Es el estado vivo de esas decisiones: se edita en su lugar cuando
cambian. Se complementa con [09-modelo-de-datos.md](09-modelo-de-datos.md), que
define los valores del esquema, con
[11-grafo-peatonal.md](11-grafo-peatonal.md), que define los elementos que se
relevan, y con [10-datos-y-zona-piloto.md](10-datos-y-zona-piloto.md), que define
la zona.

## 1. Alcance

Este documento responde:

- **Por qué** la accesibilidad no viene de OpenStreetMap (§2).
- **Qué** se releva y qué no, y por qué el cruce no se releva (§3).
- **Qué significa** cada nivel en la calle, con qué criterio se decide (§4).
- **Cómo** se registra la procedencia del dato (§5).
- **Con qué instrumento**, y qué columnas tiene (§6).
- **Qué no es fuente** de accesibilidad (§7).
- **Cómo** el dato llega a la base (§8).
- **Quién gana** cuando dos escrituras tocan el mismo elemento (§8.2).

El importador aporta **dónde** está cada vereda; el relevamiento aporta **cómo está**.
Son dos fuentes distintas para dos mitades del dato, y conviene no confundirlas: una
vereda existe en el grafo con nivel `NULL`, que es una respuesta válida —"no lo
miramos"— y no un casillero vacío.

No decide el mecanismo de carga ni ejecuta el primer relevamiento: eso es #14.
Tampoco la calibración del costo de ruteo, que vive en
[09 §4.7](09-modelo-de-datos.md).

## 2. Por qué no hay accesibilidad de OpenStreetMap

En la zona piloto OpenStreetMap no aporta **ningún** dato de accesibilidad:

| Qué | Cuánto |
| --- | --- |
| Veredas mapeadas (`footway=sidewalk`) | 0 |
| Nodos con `kerb` dentro del polígono | 0 |
| Nodos con `kerb` en el búfer | 4, todos `kerb=lowered` y `tactile_paving=no` |
| Rampas, ancho, pendiente, estado de superficie | No existe el tag en la zona |

Los 4 cordones del búfer **no se leen**: son cuatro esquinas de una calle que está
fuera, y tomarlas como "el resto está igual" sería el error del booleano de
accesibilidad ([09 §4.1](09-modelo-de-datos.md)) otra vez, con el agravante de que
una base que dice "sin dato" pasaría a decir "sin rampa" en todas las esquinas de la
zona.

**La consecuencia es la que manda el diseño:** el importador no inventa un nivel
([11 §2](11-grafo-peatonal.md)), así que un grafo recién importado tiene
`accessibility_level` en `NULL` e `is_verified` en falso en todas sus filas. Todo lo
que la aplicación sepa de accesibilidad sale del relevamiento, y de ningún otro lado.

## 3. Qué se releva

| Elemento | Se releva | Por qué |
| --- | --- | --- |
| **Vereda** (tramo entre dos esquinas) | Sí | Es la arista que se camina, y la que lleva los obstáculos |
| **Esquina** (`kerb_node`) | Sí | Es donde se sube y se baja de la vereda: la rampa vive acá |
| **Cruce** | **No** | Su nivel se **deriva** del peor de sus dos esquinas |
| Senderos de plaza, áreas caminables | No | No están en el grafo ([11 §6](11-grafo-peatonal.md)) |

**Por qué el cruce no tiene unidad propia.** Lo que hace accesible un cruce es poder
entrar y salir de él: la superficie del cruce mismo, en el microcentro, es asfalto
pintado y no varía tanto como la rampa de la esquina. Relevarlo aparte duplicaría el
trabajo de campo y abriría la puerta a que un cruce diga `FULL` con las dos esquinas
en `NONE`, que es una respuesta imposible.

**Cómo se deriva.** `crossings.accessibility_level` se queda en `NULL`, y el costo de
la arista toma el **peor** de sus dos esquinas
([09 §4.7](09-modelo-de-datos.md)). Eso cierra un hueco que el modelo tenía: un nodo
no tiene costo, así que una esquina `NONE` no bloqueaba nada. Con el derivado, una
esquina sin rampa deja en `NONE` los cruces que salen de ella —no se cruza por ahí—
pero deja caminable la vereda que la rodea, que es exactamente lo que pasa en la
calle.

La columna del cruce queda libre por si alguna vez alguien mira un cruce puntual. El
importador no la escribe, y el derivado no la pisa: si tiene valor, gana.

## 4. El criterio de cada nivel

**El relevamiento no mide.** No hay ancho mínimo, ni pendiente máxima, ni alto de
escalón: hay una observación y un juicio del relevador. Es una decisión de alcance del
MVP, y tiene una consecuencia que conviene asumir de frente: el criterio se sostiene
en **ejemplos ancla y una regla de desempate**, no en números.

La pregunta de fondo es una sola: **¿pasarías este tramo en silla de ruedas, sin bajar
y sin ayuda?**

| Nivel | Vereda (lo que pasa entre las esquinas) | Esquina (cómo se entra y se sale) |
| --- | --- | --- |
| `FULL` | Se pasa sin pensarlo: superficie continua, sin escalones, ancho para cruzarse con otra silla | Hay rampa o cordón rebajado, y el cruce está en buen estado |
| `PARTIAL` | Se pasa, pero con incomodidad o maniobra: baches, baldosas sueltas, un tramo angosto donde hay que esperar a que pase alguien, pendiente que cansa, raíces | Hay rampa pero angosta, rota o con desnivel; o hay rampa de un lado del cruce y del otro no |
| `NONE` | No se pasa en silla: escalón sin rampa, vereda cortada por una obra, ancho que no deja pasar | No hay rampa ni cordón rebajado: hay que bajar a la calzada |
| en blanco | No se visitó o no se pudo ver | Ídem |

`PARTIAL` es el valor que justifica el ternario
([09 §4.1](09-modelo-de-datos.md)): una vereda con baches no es intransitable, es
transitable con penalización. Y **el blanco es un dato**, no un olvido: es el `NULL`
que el import ya dejó, y no hay un tercer estado para "no se pudo relevar"; si hace
falta explicar por qué, va en la descripción.

Tres reglas que hacen que esto se pueda repetir sin instrumentos:

1. **La vereda se juzga entre las esquinas; la esquina, para entrar y salir.** Una
   vereda puede ser `FULL` con sus dos esquinas en `NONE`: se camina bien, pero no se
   sube. Sin este corte, el mismo cordón se castiga dos veces y el relevador no sabe
   qué anotar.
2. **Ante la duda se baja un nivel, pero `NONE` no se escribe dudando.** Duda entre
   `FULL` y `PARTIAL` → `PARTIAL`: cuesta el doble y el ruteo se equivoca poco. Duda
   entre `PARTIAL` y `NONE` → `PARTIAL` con el problema en la descripción. `NONE` se
   escribe cuando se **vio** lo que bloquea: es el único valor que saca la arista del
   grafo ([09 §4.7](09-modelo-de-datos.md)), y equivocarlo deja gente sin ruta.
3. **La esquina toma el peor caso** de sus rampas y de sus cruces, que ya es la regla
   del modelo ([09 §4.4](09-modelo-de-datos.md)). Si una rampa sirve y la otra no, el
   nodo entero es `PARTIAL` y la descripción dice cuál falla.

## 5. Procedencia y verificación

`accessibility_level` dice **cuánto** se puede pasar; `is_verified`, **de dónde salió
el dato** ([09 §4.1](09-modelo-de-datos.md)). Son ejes distintos y no se reemplazan.

`is_verified` es verdadero cuando **alguien del equipo miró el elemento**, sea en el
lugar o en una imagen: Street View, una foto, un video. Es verdadero con un
relevamiento desde el escritorio y falso con el import, que no mira nada. La pregunta
que responde no es "¿es cómodo ese tramo?" sino "¿alguien comprobó esto, o lo estamos
suponiendo?".

| Cómo se obtuvo | `is_verified` | Qué fecha se registra |
| --- | --- | --- |
| **Visita** al lugar | verdadero | La de la visita |
| **Imagen** (foto, Street View, video) | verdadero | La de la mirada, y aparte la de la imagen si se conoce |
| Import de OpenStreetMap | falso, siempre | La de la corrida |

**Por qué el MVP acepta imágenes.** Implica no apersonarse para tener el grafo con
datos, y con eso la red se releva en días en lugar de en jornadas de campo. La
contrapartida es concreta: **una imagen puede ser vieja**. Street View del microcentro
puede tener años, y una vereda rota en la foto puede estar arreglada —o al revés—. El
MVP acepta ese riesgo y lo deja visible de dos formas: la antigüedad de la imagen se
registra en la planilla (§6), y la descripción dice lo que se vio.

**La antigüedad es lo único que separa una imagen de una visita**, y no se corrige con
un booleano: por eso la planilla guarda la fuente y las dos fechas. Cuando la imagen
hace dudar, la regla 2 de §4 ya resuelve qué escribir: ante la duda se baja un nivel, y
`NONE` no se escribe dudando.

**Lo que esa decisión cuesta, dicho de frente.** En la práctica, toda fila relevada va
a quedar con `is_verified` en verdadero, así que el par (nivel, verificación) deja de
distinguir matices dentro de la base: lo que dice es "relevado" contra "importado", y
el cómo y el de cuándo quedan en la planilla. Se acepta por el MVP. El disparador para
revisarlo es concreto: la primera vez que un recorrido mande a alguien por una vereda
que la imagen mostraba bien y ya no lo está.

**La subjetividad se hace trazable, no se esconde.** La planilla lleva quién relevó y
cuándo. Si relevan dos personas, comparan la misma cuadra antes de arrancar —con
imágenes alcanza, y es más rápido que caminarla: se miran los mismos puntos y se
contrastan—. Es el único control que hay sin instrumento, es barato, y convierte una
discusión sobre definiciones en una corrección de dos fichas. El que releva es del
equipo, y en el MVP el equipo son los moderadores.

## 6. El instrumento

Dos planillas: **una fila por vereda** y **una fila por esquina**. La plantilla vacía
está versionada en [`data/relevamiento/`](../data/relevamiento/), con sus columnas y
una fila de ejemplo; el relevamiento completo no se versiona, vive en el Drive junto
con el resto de los documentos del proyecto (ver
[`data/relevamiento/README.md`](../data/relevamiento/README.md)).

| Columna (vereda) | Para qué |
| --- | --- |
| `calle`, `desde`, `hasta`, `lado` | La etiqueta humana del tramo: "Necochea, Perú → 25 de Mayo, lado sur" ([11 §4](11-grafo-peatonal.md)) |
| `nivel` | `FULL`, `PARTIAL`, `NONE` o en blanco |
| `verificacion`, `fecha`, `fecha_imagen`, `relevador` | Procedencia (§5): `visita` o `imagen`; cuándo se miró y cuándo se capturó la imagen |
| `tipo_obstaculo`, `severidad` | Del catálogo de once y de la escala de tres ([09 §4.2](09-modelo-de-datos.md)) |
| `descripcion` | Texto libre: qué se vio y por qué el nivel |
| `alturas`, `lugares_interes` | Fuera del MVP, pero se registran acá para no repetir el trabajo de campo |

| Columna (esquina) | Para qué |
| --- | --- |
| `calle_1`, `calle_2`, `cuadrante` | La esquina: dos calles y el cuadrante que las separa |
| `nivel`, `verificacion`, `fecha`, `fecha_imagen`, `relevador`, `descripcion` | Ídem |

Tres cosas que la planilla **no** tiene, a propósito:

- **Columnas de medición** (ancho, pendiente, alto de escalón). No se mide (§4).
- **Un "¿tiene rampa? sí/no"**. El nivel de la esquina ya lo dice, y un booleano al lado
  sería dos fuentes para la misma respuesta — el error que ya corregimos con
  `is_accessible` y con `has_traffic_light` ([09 §4.3](09-modelo-de-datos.md)).
- **Una fila por obstáculo con su propia clave**. Si una vereda tiene varios, se
  repiten las filas con la misma terna y distinto obstáculo: la planilla queda plana y
  la carga crea un obstáculo por fila.

En cambio sí tiene **`verificacion`** (`visita` o `imagen`) y **`fecha_imagen`**, que no
tienen columna en la base. Son el registro del operativo y sobreviven ahí: con datos
que pueden salir de una imagen de hace años, "cómo se obtuvo" y "de cuándo es" son la
forma de saber en qué confiar y qué volver a mirar.

`verificacion` es además lo que sostiene que `is_verified` signifique algo: la carga no
acepta una fila con nivel y sin ella (§8.2).

**La geometría no la produce el relevamiento**: la deriva el importador
([11 §3](11-grafo-peatonal.md)). Pedirla otra vez duplicaría el dato y garantizaría que
las dos versiones discrepen.

## 7. Qué no es fuente de accesibilidad

- **OpenStreetMap**, por lo dicho en §2.
- **Los reportes ciudadanos.** Crean un obstáculo con su severidad (C010 → C012); no
  cambian el nivel de una vereda por sí solos. Un reporte aprobado puede *motivar* que
  un moderador baje el nivel (C014), pero son dos datos distintos y dos tablas
  distintas ([09 §4.5](09-modelo-de-datos.md)).
- **Google Maps** y cualquier mapa propietario: sus términos no permiten reutilizar
  datos derivados ([10 §3](10-datos-y-zona-piloto.md)).
- **La altura del cordón deducida de la calzada.** El ancho del cruce sale del offset
  ([11 §3.4](11-grafo-peatonal.md)), pero eso no dice si hay rampa.

## 8. Cómo entra a la base

El dato existe en la planilla y tiene que llegar a `sidewalks.accessibility_level`,
`kerb_nodes.accessibility_level`, `is_verified` y `obstacles`. El mecanismo —semilla
SQL, importación de la planilla, o pantalla del portal— y quién lo usa es #14.

### 8.1 El emparejamiento

Lo que este documento sí fija es que **el relevamiento no espera al importador**. Su
unidad —el tramo entre dos esquinas— es la misma que la del grafo, así que puede
empezar escribiendo la etiqueta en palabras. Cuando exista el grafo, ese texto se
empareja una sola vez con las veredas generadas, y las que no matcheen marcan un error
en alguno de los dos lados: es una verificación barata, no un retrabajo.

**Los nombres son el punto frágil de ese emparejamiento.** El callejero tiene la misma
calle con dos nombres según el tramo (`4 Norte / Sarmiento`) y abreviaturas que no
coinciden con OSM (`Av. España` es `España`; `General Espejo` es `Gral. Gerónimo
Espejo`). La forma canónica es la de OSM, que es de donde sale la geometría
([11 §3.8](11-grafo-peatonal.md)).

### 8.2 La precedencia: lo relevado no se pisa

Dos caminos escriben `accessibility_level` sobre el mismo elemento: la carga del
relevamiento (#14) y la edición desde el portal (#49, C014). Sin regla, gana la última
escritura por accidente y nadie puede decir por qué un elemento quedó como quedó. El
importador no participa: no escribe el nivel ni `is_verified`, que conservan su valor de
import ([11 §2](11-grafo-peatonal.md)).

| Escritor | Escribe el nivel | Deja `is_verified` | Regla |
| --- | --- | --- | --- |
| Import de OpenStreetMap | no | no lo toca | no participa |
| Carga del relevamiento | sí | verdadero | **saltea lo verificado** |
| Portal (C014) | sí | `level IS NOT NULL` | **fuerza por definición** |

**La regla.** Un elemento con `is_verified` en verdadero **no se pisa**. `is_verified`
quiere decir que alguien del equipo miró el elemento (§5): no es un casillero vacío, y
una planilla no puede borrar ese trabajo sin dejar rastro. La carga escribe la fila
cuando el elemento no está verificado, y la saltea cuando lo está.

**La edición del portal no es una excepción: es el forzado.** Un moderador mirando el
elemento y guardando el nivel *es* el acto explícito. Por eso el portal no consulta la
regla ni pide una confirmación aparte por estar pisando dato relevado: escribir ahí es
responder por el cambio.

**Pero el forzado necesita un valor que forzar.** El portal escribe
`is_verified = (level IS NOT NULL)`: un nivel guardado queda verificado, y **"sin dato"
no**. Volver un elemento a "sin dato" no es afirmar una ausencia, es retirar el dato
anterior; el elemento queda como recién importado y la carga del relevamiento **sí** lo
puede completar. Si en cambio dejara `is_verified` en verdadero, ese clic lo blindaría
contra la planilla para siempre, y nadie sabría por qué la vereda nunca se actualiza
([14 §7](14-la-api-del-grafo.md)).

**Cómo se fuerza la carga.** Con `--force` en el comando de carga, que aplica todas las
filas aunque el elemento esté verificado y deja en el reporte el nivel que pisó. Forzar
es una decisión sobre la corrida —"esta planilla es más nueva que lo que hay en la
base"— y no sobre una fila, así que la planilla no gana una columna de forzado: una fila
suelta se corrige desde el portal, que es donde una persona mira el elemento.

**Qué reporta la carga.** Cada fila cae en una sola categoría, y el reporte da el conteo
y la lista de cada una:

| Categoría | Qué pasó | ¿Es error? |
| --- | --- | --- |
| aplicada | se escribió el nivel e `is_verified` en verdadero | no |
| ya estaba | el elemento está verificado y ya tiene ese nivel; no se escribe nada | no |
| salteada | el elemento está verificado y tiene otro nivel | no |
| sin nivel | la fila no trae nivel, así que no escribe el elemento | no |
| sin match | la etiqueta no emparejó ningún elemento (§8.1) y no se escribe nada | **sí** |

Correr la misma planilla dos veces da `aplicada: 0`: la segunda corrida cae en *ya
estaba*. *Salteada* tampoco es un error —es la regla trabajando— y la carga termina
bien, pero no en silencio: el conteo va en el resumen, y cada fila salteada se lista con
el nivel de la base y el de la planilla, para que se vea qué se estaba por pisar. Un
`NULL` en la base cuenta como un valor distinto. Y la fila salteada se saltea **entera,
obstáculos incluidos**: es una sola observación, y la que perdió la precedencia no sirve
tampoco para crear obstáculos. Si esa fila traía un obstáculo nuevo, entra por el portal.

**Una fila con nivel y sin `verificacion` es un error de fila, y no se escribe.**
`is_verified` es lo que le da sentido a toda esta regla: escribirlo en verdadero a partir
de una fila que no dice cómo se obtuvo sería inventar la procedencia.

### 8.3 Lo que la regla no resuelve

La regla protege el trabajo hecho, no la frescura del dato. La base no guarda **cuándo**
se miró un elemento —la fecha vive en la planilla (§6)—, así que no puede decidir cuál de
dos observaciones es más nueva: una planilla de hace un año, forzada, gana sobre una
edición del portal de ayer. Para el MVP se acepta, y el forzado queda en el reporte.

**No se agrega ninguna columna.** `is_verified` es todo lo que la regla necesita leer, y
la procedencia de una corrida vive en su reporte, igual que la del importador
([11 §4.1](11-grafo-peatonal.md)): un artefacto que se lee, no una columna que hay que
mantener. La autoría se decidió con el portal: **el MVP no la guarda**
([09 §4.1](09-modelo-de-datos.md)).
Si alguna vez hace falta contestar "quién cambió esto y cuándo", son dos columnas
—`verified_at timestamptz` y `verified_by integer` con FK a `users`, en `NULL` para lo
que venga de la planilla, que trae un nombre y no un id—, y se decide con una tarea
propia. Una migración es barata hasta ese día.

**Tampoco dice cuál de dos observaciones es más nueva**, y eso tiene una consecuencia
que conviene tener presente: un elemento que el portal volvió a "sin dato" queda sin
verificar y la planilla lo puede completar, pero un elemento que el portal puso en
`PARTIAL` la planilla lo va a saltear aunque la planilla sea posterior. La fecha está en
los dos lados —la del relevamiento en la planilla, la de la edición en `updated_at`— y
nadie las compara: para el MVP la regla es la precedencia explícita, no la cronología.

## 9. Lo que este documento no decide

- **El mecanismo de carga** y quién lo opera: #14. Su precedencia frente al portal ya
  está fijada (§8.2); lo abierto es con qué comando o pantalla se carga.
- **La autoría de un cambio de nivel.** Decidido en §8.3: el MVP no guarda quién lo
  cambió ni cuándo, y lo que pisó una carga forzada queda en el reporte de la corrida.
- **El valor de los factores de costo** de cada nivel: es calibración, y vive en
  [09 §4.7](09-modelo-de-datos.md).
- **Los umbrales físicos** (ancho, pendiente, escalón). Hoy no existen porque no se
  mide; si el relevamiento se vuelve más exigente, se agregan leyendo las
  descripciones, que se guardan justamente para eso.
- **La distinción visita/imagen en la base.** `is_verified` es un booleano y responde
  "¿alguien lo miró?"; la fuente y la antigüedad viven en la planilla (§6). Si alguna
  vez tiene que llegar a la base, es una columna con un enum de dos valores, no otro
  booleano.
- **La normalización de los nombres de calle**: se resuelve al emparejar (§8.1).

## 10. Documentos relacionados

- [09-modelo-de-datos.md](09-modelo-de-datos.md): los valores, su significado y el
  costo de las aristas.
- [11-grafo-peatonal.md](11-grafo-peatonal.md): las veredas y esquinas que se relevan.
- [10-datos-y-zona-piloto.md](10-datos-y-zona-piloto.md): la zona que se releva.
- [`data/relevamiento/README.md`](../data/relevamiento/README.md): la plantilla de
  campo.

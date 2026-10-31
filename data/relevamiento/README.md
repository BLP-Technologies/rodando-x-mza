# Plantilla del relevamiento

Formato de campo para la accesibilidad de la zona piloto. El criterio con el que se
llena —qué significa cada nivel, qué se releva y qué no— está en
[docs/12-relevamiento-de-accesibilidad.md](../../docs/12-relevamiento-de-accesibilidad.md),
y la zona, en [docs/10-datos-y-zona-piloto.md](../../docs/10-datos-y-zona-piloto.md).

| Archivo | Una fila por | Para qué |
| --- | --- | --- |
| `planilla-veredas.csv` | Tramo de vereda entre dos esquinas | El nivel de la vereda y los obstáculos que tiene |
| `planilla-esquinas.csv` | Esquina | El nivel de la esquina, donde están las rampas |

Los dos son **plantillas**: tienen el encabezado y una fila de ejemplo marcada
`ejemplo` en la columna `relevador`.

## Cómo se llena

- **En blanco es un dato**: nadie la miró. No se escribe `FULL` por defecto, ni un
  guión, ni "sin dato": la celda vacía.
- **`NONE` sólo se escribe si se vio lo que bloquea.** Es el único valor que saca la
  arista del ruteo, y equivocarlo deja gente sin recorrido.
- **La vereda se juzga entre las esquinas; la esquina, para entrar y salir.** Una
  vereda puede ser `FULL` con sus esquinas en `NONE`.
- **No se mide nada.** No hay columnas de ancho, pendiente ni alto de escalón, y no
  hay un "¿tiene rampa? sí/no": el nivel de la esquina ya lo dice. Lo que se vio va en
  `descripcion`.
- **Un obstáculo por fila.** Si una vereda tiene tres, son tres filas con la misma
  terna y distinto `tipo_obstaculo`. Los tipos y las severidades son los del catálogo
  ([docs/09 §4.2](../../docs/09-modelo-de-datos.md)).
- **`verificacion`**: `visita` (fuimos) o `imagen` (Street View, foto, video). Las dos
  cuentan como verificación: el dato lo miró alguien. Si salió de una imagen, `fecha`
  es cuando la miramos y `fecha_imagen` cuando se capturó (en Street View está abajo,
  junto al copyright). Una imagen de hace años describe una vereda que puede haber
  cambiado: si la antigüedad hace dudar, se aplica la regla de la duda y se baja un
  nivel.
- **`fecha`** va en `AAAA-MM-DD` y **`fecha_imagen`** en `AAAA-MM` (o vacía si no se
  sabe), y `relevador` es quien la llenó.
- **`alturas` y `lugares_interes` no entran al MVP**, pero se registran en la misma
  hoja: cargarlos después es un join, y repetir el trabajo de campo no.
- El archivo es **UTF-8 con separador coma**. Si se abre y se edita en Excel, conviene
  importarlo como UTF-8 para que no se rompan los acentos.

## Qué se versiona

Sólo la **plantilla**. El relevamiento completo vive en el Drive del equipo, junto con
el resto de los documentos del proyecto, y no se commitea: si alguien deja un archivo
acá, `data/relevamiento/relevamiento-*.csv` está en `.gitignore`.

Los archivos del relevamiento se nombran `relevamiento-veredas-AAAA-MM-DD.csv` y
`relevamiento-esquinas-AAAA-MM-DD.csv`, con la fecha en que se terminó de relevar.

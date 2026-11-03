# Errores y mensajes

> Documento normativo. Define cómo se comunican los errores en la API y quién
escribe el texto que ve el usuario final. Es el estado vivo de esa decisión: se
edita en su lugar cuando cambia. Se complementa con
[00-reglas-documentacion.md](00-reglas-documentacion.md) y
[02-stack-y-estructura.md](02-stack-y-estructura.md), que definen las convenciones
de idioma sobre las que se apoya.

## 1. Alcance

Cómo se devuelve un error desde el backend, qué se expone y qué no, y cómo cada
cliente convierte un error en un mensaje en español para el usuario. No describe
errores de un caso de uso puntual: cada funcionalidad documenta sus propios códigos
en el catálogo (§4).

## 2. Principio: el backend no manda texto al usuario

El backend **nunca** devuelve prosa destinada al usuario. Devuelve solo información
neutra al idioma:

- el **status HTTP**,
- un **código** de error estable, en inglés,
- opcionalmente **`details`** estructurados, también en inglés.

El texto en español lo produce **cada cliente**, traduciendo el código. Esto tiene
tres consecuencias buscadas:

- **No se filtra información por diseño.** Si el backend no manda texto, no puede
  filtrar un mensaje interno ni un stack por descuido.
- **El contrato es estable.** Cambiar una frase no requiere tocar el backend.
- **Cada cliente controla su presentación** (tono, formato, y a futuro idioma).

## 3. Forma de la respuesta de error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [{ "field": "email", "code": "INVALID_EMAIL" }]
  }
}
```

- `code`: obligatorio. `UPPER_SNAKE_CASE`, en inglés, del catálogo (§4).
- `details`: opcional. Valores de máquina en inglés, con la forma que defina cada
  código. Nunca contienen texto para mostrar ni información interna.

No existe un campo `message` en las respuestas de error. Si un cliente necesita
más que el `code`, usa `details`.

## 4. Catálogo de códigos

Códigos iniciales. Una funcionalidad agrega los suyos siguiendo §7.

| Código | HTTP | Significado |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | la entrada no cumple el contrato |
| `UNAUTHENTICATED` | 401 | falta autenticación o las credenciales son inválidas |
| `FORBIDDEN` | 403 | autenticado, pero sin permiso |
| `NOT_FOUND` | 404 | el recurso no existe |
| `CONFLICT` | 409 | conflicto con el estado actual (p. ej. email ya registrado) |
| `INTERNAL_ERROR` | 500 | error no esperado |

Los `details` de `VALIDATION_ERROR` tienen la forma
`[{ "field": "<campo>", "code": "<MOTIVO>" }]`. `field` es la ruta del campo en el
cuerpo (`origin`, `origin.lat`) y puede haber varios `details` en un mismo error.

Los motivos son de dos clases, y la diferencia importa para no duplicarlos:

| Clase | Motivos | Quién los produce |
| --- | --- | --- |
| **Genéricos** | `REQUIRED` (falta el campo), `INVALID` (está, pero no sirve) | Uno solo para toda la API: `backend/src/http/error-response.ts` |
| **De dominio** | `OUTSIDE_SERVICE_AREA`, `NO_NEARBY_ELEMENT` y los que agregue cada funcionalidad | La funcionalidad, después de validar la forma |

Los genéricos son política del catálogo: si cada módulo inventara los suyos, el cliente
tendría que traducir un vocabulario distinto por endpoint. Los de dominio describen algo
que sólo esa funcionalidad sabe —una punta fuera del perímetro, un email ya registrado— y
viven con su caso de uso ([13 §8](13-api-de-ruteo.md#8-cómo-se-rechaza)).

**Los motivos de dominio, con su caso de uso y su campo:**

| Motivo | Campo | Cuándo | Documento |
| --- | --- | --- | --- |
| `OUTSIDE_SERVICE_AREA` | `origin`, `destination` | Una punta del recorrido cae fuera del perímetro de búsqueda | [13 §8](13-api-de-ruteo.md#8-cómo-se-rechaza) |
| `NO_NEARBY_ELEMENT` | `geom` | El punto de un obstáculo no tiene ningún elemento del grafo cerca, así que no hay a qué colgarlo | [18 §3](18-la-api-de-obstaculos.md#3-el-alta) |

`NO_NEARBY_ELEMENT` no es un `INVALID`: el punto está bien formado y está en rango; lo que
falta es el grafo alrededor. Y existe porque la acción del cliente es distinta —elegir un
punto más cerca del recorrido peatonal, no corregir un número— y el texto que el portal
muestra sale de ese motivo ([18 §3](18-la-api-de-obstaculos.md#31-el-pegamento-el-elemento-más-cercano)).

## 5. Errores esperables y no esperables

- **Esperables**: el sistema los anticipa (validación, credenciales, permisos, no
  encontrado). Se mapean a un código del catálogo con su status, y cada cliente
  tiene un mensaje específico.
- **No esperables**: cualquier cosa no prevista. Regla dura: **todo status ≥ 500
  se responde siempre como `INTERNAL_ERROR` y sin `details`**, aunque internamente
  se trate de un error con más contexto. El detalle completo va al log (pino), no
  al cliente.

Nunca se exponen al cliente: mensajes internos, stack traces, SQL, nombres de
tablas o columnas, tokens ni identificadores internos.

## 6. El texto que ve el usuario

Lo escribe **cada cliente** (web y mobile), en español y con **tono formal**
("usted").

- Cada cliente mantiene un mapeo `código → mensaje`.
- Un código que el cliente no conoce cae al mensaje genérico.
- El genérico se usa para `INTERNAL_ERROR`, códigos desconocidos y fallos de red.

Texto genérico canónico:

> Ha ocurrido un error. Intente nuevamente. Si el problema persiste, contacte al
> soporte.

Ejemplos de referencia (la copia final vive en cada cliente):

| Código | Mensaje sugerido |
| --- | --- |
| `VALIDATION_ERROR` | _según el `field`, p. ej._ "El email no tiene un formato válido" |
| `UNAUTHENTICATED` | "El email o la contraseña son incorrectos" |
| `FORBIDDEN` | "No tiene permiso para realizar esta acción" |
| `NOT_FOUND` | "No encontramos lo que buscaba" |
| `CONFLICT` | _según el caso, p. ej._ "Ese email ya está registrado" |
| `INTERNAL_ERROR` | _el genérico_ |

**Costo asumido:** la copia en español se duplica entre web y mobile. Se extrae a un
paquete compartido cuando aparezca el segundo cliente, el mismo disparador que para
el monorepo (ver [02](02-stack-y-estructura.md) §3).

## 7. Agregar un código nuevo

1. Definirlo en el backend (`http/error-codes.ts`).
2. Agregarlo a la tabla de §4, con su status y su forma de `details` si tiene.
3. Mapearlo en cada cliente. Hasta entonces, ese código cae al genérico, que es un
   comportamiento correcto y no roto.

## 8. Documentos relacionados

- [00-reglas-documentacion.md](00-reglas-documentacion.md): las reglas de la
  documentación.
- [02-stack-y-estructura.md](02-stack-y-estructura.md): convenciones de idioma y
  estructura del proyecto.
- [13-api-de-ruteo.md](13-api-de-ruteo.md): el caso de uso que usa
  `OUTSIDE_SERVICE_AREA` como motivo de validación.

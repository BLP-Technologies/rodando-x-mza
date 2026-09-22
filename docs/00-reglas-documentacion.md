# Reglas de Documentación del Proyecto

> Documento normativo. Define cómo se organiza, se mantiene y se actualiza la
> documentación de un proyecto. Tiene prioridad sobre cualquier convención
> implícita de los demás documentos. Es agnóstico al proyecto: sirve para
> cualquier proyecto que adopte estas reglas.

## 1. Principio general

La documentación es el **estado vivo** del proyecto: describe cómo funciona hoy. No es un archivo histórico.

El historial ya lo guarda el control de versiones. Por eso, ante un cambio, la documentación se **actualiza en el lugar**, en vez de acumular documentos nuevos que reemplacen a los viejos. Quien lee un documento está leyendo la verdad actual, sin tener que averiguar cuál de varios documentos es el que manda.

De este principio salen dos reglas:

- **Actualizar es la norma.** Si algo cambia, se edita la documentación afectada.
- **Deprecar es la excepción.** Conservar un documento en su estado original está reservado a casos de fuerza mayor, y se marca de forma explícita (ver §7).

## 2. Alcance: qué es documentación del proyecto

Es documentación del proyecto todo material que describa cómo funciona, cómo se decide o cómo se integra el proyecto, incluida la documentación de terceros o de proveedores que sea relevante para el desarrollo.

Vive dentro del repositorio, en el directorio que el proyecto destine a documentación, y se versiona junto con el código.

## 3. Un tema, un documento

Cada tema se documenta en **un solo lugar**. Si ya existe un documento sobre ese tema, se lo **edita**; no se crea otro que lo complemente, lo continúe o lo reemplace.

Tener dos documentos sobre lo mismo es la principal causa de contradicciones y de documentación desactualizada. Si se detecta una contradicción, la resolución **no** es decidir cuál gana: es actualizar el que quedó desactualizado.

Si un tema crece y deja de ser manejable en un solo documento, se lo **divide** por sub-temas (no en versiones) y se enlazan entre sí.

Ejemplo: si un documento dice que el color de marca es rojo y el proyecto pasa a verde, no se crea un documento "Color de marca v2". Se edita el documento existente y pasa a decir verde.

## 4. Numeración y nombres

- Los documentos llevan un prefijo `NN-` (dos dígitos) que refleja el **orden en que se incorporaron** al proyecto.
- El número es **identidad, no jerarquía**: no indica importancia, ni cuál manda, ni cuál tiene contenido más nuevo. Sirve para ubicarlos y para saber cuándo llegó cada uno.
- El prefijo `00-` está **reservado** para este documento normativo.
- El nombre sigue el patrón `NN-titulo-breve-descriptivo.md`.
- Cuando se reordena la documentación (por ejemplo, al recuperar material que estaba fuera del repositorio), los números se reasignan para que la secuencia `NN-` quede contigua.

Como los documentos se actualizan en el lugar, es normal que un documento con número bajo tenga contenido más reciente que uno con número alto. Eso es esperable: el número indica cuándo se incorporó, no cuándo se editó por última vez.

## 5. Referencias cruzadas

Cuando un documento depende de otro, se enlaza de forma explícita con una ruta relativa. Los vínculos ayudan a mantener la coherencia y a encontrar todo lo que un cambio puede afectar. Al editar un documento, conviene revisar qué otros documentos lo referencian o dependen de él.

## 6. Mantenimiento: la documentación se actualiza con el proyecto

La documentación es parte del trabajo, no un agregado posterior. **Un cambio no está terminado hasta que la documentación afectada está actualizada.**

- Si un cambio de código afecta a varios documentos, se actualizan **todos** en el mismo cambio (mismo commit o pull request).
- Se **edita** el contenido existente; no se anexan notas al final ni se dejan secciones viejas al lado de las nuevas.
- Si el cambio invalida una sección, esa sección se reescribe; no se deja "por las dudas".
- Si aparece una contradicción entre dos documentos, se resuelve actualizando el que quedó desactualizado.

Regla práctica: si al revisar un cambio no se puede afirmar "la documentación refleja esto", el cambio no está listo.

## 7. Deprecación: la excepción

Deprecar es conservar un documento (o una sección) en su estado original, marcándolo como superado, en lugar de editarlo. Se usa **solo** cuando existe una razón de fuerza mayor para no tocarlo; por ejemplo, un documento contractual, una aprobación formal que debe permanecer tal como se firmó, o un registro que debe quedar intacto por trazabilidad.

No es el camino normal. Si un documento se puede actualizar, se actualiza.

Formato del aviso:

- **Deprecación total** → aviso al inicio del documento.
- **Deprecación parcial** → aviso al inicio del documento y un aviso puntual en cada sección deprecada, indicando qué documento (y qué sección de ese documento) la reemplaza.

```markdown
> [!WARNING] Deprecado
> Esta sección quedó superada. Ver [NN-titulo.md](NN-titulo.md#seccion).
```

## 8. Incorporar un documento nuevo

Se incorpora un documento nuevo **solo** cuando:

- Se documenta un tema que todavía no tiene documento.
- Se agrega un material que es aditivo o de registro por naturaleza (un contrato, un plan, un diccionario, un documento normativo), y que no reemplaza a otro.

No se incorpora un documento nuevo para actualizar uno existente.

Al incorporarlo:

1. Elegir el número siguiente de la secuencia.
2. Respetar el patrón de nombre.
3. Enlazarlo con los documentos con los que se relaciona.

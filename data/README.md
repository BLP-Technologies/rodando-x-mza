# Datos de la zona piloto

Datos crudos de la Fase 1. La decisión que los explica está en
[docs/10-datos-y-zona-piloto.md](../docs/10-datos-y-zona-piloto.md).

| Archivo | Se versiona | Qué es |
| --- | --- | --- |
| `pilot-zone.geojson` | Sí | El polígono que delimita la zona piloto |
| `pilot-zone.osm` | **No** | El extracto de OpenStreetMap, generado por el script |

El extracto no se versiona porque es **un artefacto derivado y mutable**: OSM cambia todos
los meses, así que el archivo que se guarda hoy dice otra cosa el mes que viene. Lo que se
versiona es el polígono, el script que descarga y la procedencia que el script imprime.

## Generar el extracto

```sh
node scripts/fetch-pilot-zone-osm.mjs
```

El script lee `pilot-zone.geojson`, le suma un búfer de 130 m (una cuadra) y pide por
Overpass las vías, las áreas de esparcimiento y los nodos peatonales de interés. Reintenta
con espera porque Overpass devuelve 502 y 504 con frecuencia, y **falla con un mensaje
claro si el extracto no trae las cuatro calles del perímetro o las cinco plazas**: una
descarga incompleta no pasa.

## El polígono

Es el cuadrilátero que forman las líneas centrales de las cuatro calles del perímetro:
Mariano Necochea al norte, San Lorenzo al sur, Perú al oeste y 9 de Julio al este. Para
obtenerlo se ajustó una recta por la geometría de cada calle (mínimos cuadrados sobre los
puntos de sus vías en OSM) y se cruzaron los dos pares. Precisión: **±2 m**.

| Esquina | Latitud, longitud |
| --- | --- |
| Noroeste — Necochea × Perú | -32.885789, -68.847481 |
| Noreste — Necochea × 9 de Julio | -32.887198, -68.839872 |
| Sudeste — San Lorenzo × 9 de Julio | -32.893626, -68.841541 |
| Sudoeste — San Lorenzo × Perú | -32.892218, -68.849165 |

Es un polígono y no un rectángulo de mínimos y máximos porque el damero de Mendoza está
rotado ~10-15° respecto de los ejes: la caja que envuelve al cuadrante mide 869 × 872 m,
o sea **142 % de su área**. El rectángulo del extracto se usa solo como parámetro de
descarga, con el búfer.

## Licencia

Datos de OpenStreetMap, bajo [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
La aplicación tiene que mostrar la atribución a OpenStreetMap donde se muestran los datos
(ver [docs/03-despliegue-y-operacion.md](../docs/03-despliegue-y-operacion.md)).

## Procedencia de la última corrida

| Fecha | Endpoint | Contenido | sha256 |
| --- | --- | --- | --- |
| 2026-10-31 | `overpass-api.de` | 332 ways · 1.468 nodos · 204 KB | `cdbad95ea94bf56b…` |

El hash cambia en cada corrida aunque los datos no cambien (el orden de los elementos varía
en la respuesta), así que sirve para decir *qué archivo se usó*, no para verificar contenido.

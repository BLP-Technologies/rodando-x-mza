import { Router } from 'express';
import { getDb } from '../db/index.js';
import { readServiceAreas } from './service-areas.service.js';

/** Rutas del área de servicio, montadas en `/api/service-areas`.
 *
 * Hay una sola lectura, sin parámetros ni autenticación, coherente con el resto del MVP.
 */
export const serviceAreasRouter = Router();

/**
 * Devuelve las áreas de servicio activas, como `FeatureCollection`.
 *
 * Es exactamente lo que viaja en el campo `service_areas` de `GET /api/graph` —la misma
 * función arma las dos—, pero sin el grafo: el mobile dibuja el polígono en el mapa y
 * avisa si el pin está adentro, y para eso no necesita las ~1000 features ni inventar un
 * `bbox` que no conoce ([14 §5.2](../../../docs/14-la-api-del-grafo.md)).
 *
 * Sin parámetros no hay validación de entrada, así que el único caso posible es
 * `200` (o `500` si falla la base). Una base sin área activa devuelve `features: []`: no
 * es un error.
 *
 * Sin encabezados de caché: la decisión es no resolver caché en el MVP. El `ETag` débil
 * que llega en la respuesta no lo pone este endpoint: es el que Express agrega a toda
 * respuesta JSON de la aplicación, igual que en `GET /api/graph`, y apagarlo acá solo
 * sería inconsistente con el resto.
 */
serviceAreasRouter.get('/', async (_req, res) => {
  res.json(await readServiceAreas(getDb()));
});

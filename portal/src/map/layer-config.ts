/**
 * Las capas del mapa, en un solo lugar: cuáles hay, cómo se llaman y con cuál arranca prendida.
 *
 * El panel de capas y el redibujado leen de acá, así que agregar una capa es agregar una
 * entrada y su función de dibujo; no hay dos listas que se puedan desincronizar.
 */

/** Una capa del mapa, en el orden fijo en que se dibujan (de abajo hacia arriba). */
export type LayerId = 'zona' | 'grafo' | 'reportes' | 'obstaculos' | 'ruta';

/** El orden del panel, que es también el orden de pintado. */
export const LAYER_IDS: readonly LayerId[] = [
  'zona',
  'grafo',
  'reportes',
  'obstaculos',
  'ruta',
];

/** El nombre con el que se lee cada capa en el panel. */
export const LAYER_LABELS: Record<LayerId, string> = {
  zona: 'Zona de servicio',
  grafo: 'Grafo',
  reportes: 'Reportes pendientes',
  obstaculos: 'Obstáculos',
  ruta: 'Ruta',
};

/**
 * Con qué arranca cada capa.
 *
 * El grafo y el borde de la zona son la pantalla y van prendidos; las dos capas que cuestan
 * una lectura aparte —reportes y obstáculos— arrancan apagadas y se piden recién cuando se
 * piden ver. La ruta está prendida sin costo: no dibuja nada mientras no haya un resultado.
 */
export const LAYER_DEFAULTS: Record<LayerId, boolean> = {
  zona: true,
  grafo: true,
  reportes: false,
  obstaculos: false,
  ruta: true,
};

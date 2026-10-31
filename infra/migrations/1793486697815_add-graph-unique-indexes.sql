-- Up Migration

-- La identidad del grafo es geométrica: un nodo es una coordenada y una arista es un
-- par de nodos (docs/11 §4). Estos índices son esa clave, y son lo que permite que el
-- importador reconozca una fila que ya existe con ON CONFLICT en lugar de duplicarla.

-- Un cordón por coordenada, normalizada a 7 decimales: es la precisión con la que el
-- extracto trae las coordenadas (~1 cm), así que un nodo reencontrado por el import cae
-- en la misma fila y no a milímetros de distancia. Es un índice de expresión y no un
-- UNIQUE de tabla porque la clave no es una columna.
CREATE UNIQUE INDEX kerb_nodes_geom_key ON kerb_nodes (
  (round(ST_X(geom)::numeric, 7)),
  (round(ST_Y(geom)::numeric, 7))
);

-- Caminar es no dirigido: A→B y B→A son la misma arista, así que la clave es el par de
-- nodos en orden canónico. Va en cada tabla de aristas por separado: una vereda y un
-- cruce pueden unir las mismas dos esquinas sin colisionar entre sí.
CREATE UNIQUE INDEX sidewalks_nodes_key ON sidewalks (
  (least(start_node_id, end_node_id)),
  (greatest(start_node_id, end_node_id))
);

CREATE UNIQUE INDEX crossings_nodes_key ON crossings (
  (least(start_node_id, end_node_id)),
  (greatest(start_node_id, end_node_id))
);

-- Down Migration

DROP INDEX IF EXISTS crossings_nodes_key;
DROP INDEX IF EXISTS sidewalks_nodes_key;
DROP INDEX IF EXISTS kerb_nodes_geom_key;

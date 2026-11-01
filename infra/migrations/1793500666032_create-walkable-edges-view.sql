-- Up Migration

-- La relacion que recorre pgr_dijkstra: una sola tabla de aristas con el costo ya
-- calculado, porque pgRouting pide id, source, target y cost en un unico lugar y las
-- aristas del grafo viven en dos tablas cuyos ids se pisan (docs/11 §5).
--
-- El id es sintetico y determinista: par para una vereda y impar para un cruce, asi que
-- no colisiona nunca y no depende de una secuencia. No hace falta una columna guardada
-- ni una tabla de topologia: source y target son las FK a kerb_nodes, que el modelo ya
-- tiene, y por eso reimportar no exige reconstruir nada (docs/11 §5).
--
-- No es una vista materializada: es el texto de una consulta, y cada consulta expande la
-- formula con los datos del momento. Un obstaculo nuevo, un nivel recien relevado o una
-- vereda que dejo de existir cambian el costo sin nada que refrescar (docs/09 §4.7).
--
-- Caminar es no dirigido: alcanza con `cost` y `directed => false`, sin reverse_cost. Una
-- arista intransitable se cobra -1, que es como pgRouting la saca del grafo sin un WHERE.
CREATE VIEW walkable_edges AS
WITH edge AS (
  SELECT (2 * s.id)::bigint         AS id,
         'sidewalk'::text           AS element_kind,
         s.id                       AS element_id,
         s.start_node_id            AS source,
         s.end_node_id              AS target,
         s.geom,
         s.accessibility_level      AS own_level,
         NULL::accessibility_level  AS start_level,
         NULL::accessibility_level  AS end_level,
         s.id                       AS sidewalk_id,
         NULL::integer              AS crossing_id
  FROM sidewalks s

  UNION ALL

  SELECT (2 * c.id + 1)::bigint,
         'crossing',
         c.id,
         c.start_node_id,
         c.end_node_id,
         c.geom,
         c.accessibility_level,
         start_node.accessibility_level,
         end_node.accessibility_level,
         NULL,
         c.id
  FROM crossings c
  JOIN kerb_nodes start_node ON start_node.id = c.start_node_id
  JOIN kerb_nodes end_node ON end_node.id = c.end_node_id
),

-- El nivel que se cobra. En un cruce, si no tiene nivel propio, es el peor de sus dos
-- esquinas, y una esquina sin dato cuenta como PARTIAL antes de comparar: sin dato no se
-- evita y no se premia (docs/09 §4.7).
resolved AS (
  SELECT edge.*,
         CASE
           WHEN edge.own_level IS NOT NULL THEN edge.own_level
           WHEN edge.element_kind = 'crossing'
             THEN greatest(coalesce(edge.start_level, 'PARTIAL'),
                           coalesce(edge.end_level, 'PARTIAL'))
           ELSE NULL
         END AS level
  FROM edge
),

-- Los metros y las penalizaciones de los obstaculos activos. Un obstaculo sobre un cordon
-- no suma metros -un nodo no tiene largo- pero un CRITICAL sobre un cordon bloquea todas
-- las aristas que lo tocan, que es lo que significa una rampa faltante (docs/09 §4.7).
priced AS (
  SELECT resolved.*,
         ST_Length(resolved.geom::geography) AS meters,
         coalesce((
           SELECT sum(CASE obstacle.severity
                        WHEN 'MINOR' THEN 15
                        WHEN 'MODERATE' THEN 40
                        ELSE 0
                      END)
           FROM obstacles obstacle
           WHERE obstacle.is_resolved = false
             AND obstacle.deleted_at IS NULL
             AND (obstacle.sidewalk_id = resolved.sidewalk_id
                  OR obstacle.crossing_id = resolved.crossing_id)
         ), 0)::float8 AS penalty,
         EXISTS (
           SELECT 1
           FROM obstacles obstacle
           WHERE obstacle.is_resolved = false
             AND obstacle.deleted_at IS NULL
             AND obstacle.severity = 'CRITICAL'
             AND (obstacle.sidewalk_id = resolved.sidewalk_id
                  OR obstacle.crossing_id = resolved.crossing_id
                  OR obstacle.kerb_node_id IN (resolved.source, resolved.target))
         ) AS blocked
  FROM resolved
)

SELECT id,
       source,
       target,
       element_kind,
       element_id,
       geom,
       meters,
       level,
       CASE
         WHEN blocked OR level = 'NONE' THEN -1
         ELSE meters * (CASE WHEN level = 'FULL' THEN 1 ELSE 2 END) + penalty
       END AS cost
FROM priced;

-- Down Migration

DROP VIEW IF EXISTS walkable_edges;

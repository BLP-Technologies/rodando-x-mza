-- Up Migration

-- Requiere PostGIS ya habilitado: lo hace infra/initdb/ al inicializar el volumen en
-- desarrollo, y un administrador una sola vez en el servidor (03 §8). Las migraciones
-- no crean extensiones porque eso pide privilegios elevados.

-- Accesibilidad de un elemento del grafo (vereda, cordón o cruce).
-- NULL = nadie lo relevó. Es distinto de NONE, que significa "no accesible".
CREATE TYPE accessibility_level AS ENUM ('FULL', 'PARTIAL', 'NONE');

-- Cordones: los vértices del grafo peatonal. Es el punto donde se conectan dos
-- veredas, o una vereda y un cruce. Suele coincidir con la esquina de la manzana,
-- pero un cruce a mitad de cuadra también crea dos.
-- La accesibilidad del nodo resume sus rampas: si hay varias, se registra la peor.
CREATE TABLE kerb_nodes (
  id                  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- El SRID va en el tipo: PostGIS rechaza una geometría con otro SRID y asume
  -- 4326 cuando la geometría no declara ninguno. Un CHECK no agregaría nada.
  geom                geometry(Point, 4326) NOT NULL,
  accessibility_level accessibility_level,
  is_verified         boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX kerb_nodes_geom_idx ON kerb_nodes USING gist (geom);

CREATE TRIGGER kerb_nodes_set_updated_at
  BEFORE UPDATE ON kerb_nodes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Veredas: aristas entre dos cordones. Una way de OSM se parte en una vereda por
-- tramo entre nodos, así que osm_way_id NO es único.
CREATE TABLE sidewalks (
  id                  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  start_node_id       integer NOT NULL
    CONSTRAINT fk_sidewalks_start_node
    REFERENCES kerb_nodes (id) ON DELETE RESTRICT,
  end_node_id         integer NOT NULL
    CONSTRAINT fk_sidewalks_end_node
    REFERENCES kerb_nodes (id) ON DELETE RESTRICT,
  -- Artefacto del import: lo llena el importador y nada más. Nullable porque un
  -- elemento dibujado desde el portal no viene de OpenStreetMap.
  osm_way_id          bigint,
  street_name         varchar(100),
  geom                geometry(LineString, 4326) NOT NULL,
  accessibility_level accessibility_level,
  is_verified         boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- Una arista de un nodo a sí mismo es un bucle: casi siempre un error del
  -- import, que colapsó los dos extremos en un nodo.
  CONSTRAINT sidewalks_start_end_check CHECK (start_node_id <> end_node_id)
);

CREATE INDEX sidewalks_geom_idx ON sidewalks USING gist (geom);
CREATE INDEX sidewalks_start_node_idx ON sidewalks (start_node_id);
CREATE INDEX sidewalks_end_node_idx ON sidewalks (end_node_id);
CREATE INDEX sidewalks_osm_way_id_idx ON sidewalks (osm_way_id)
  WHERE osm_way_id IS NOT NULL;

CREATE TRIGGER sidewalks_set_updated_at
  BEFORE UPDATE ON sidewalks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Cruces peatonales: aristas que atraviesan la calzada y unen dos cordones
-- opuestos.
CREATE TABLE crossings (
  id                  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  start_node_id       integer NOT NULL
    CONSTRAINT fk_crossings_start_node
    REFERENCES kerb_nodes (id) ON DELETE RESTRICT,
  end_node_id         integer NOT NULL
    CONSTRAINT fk_crossings_end_node
    REFERENCES kerb_nodes (id) ON DELETE RESTRICT,
  geom                geometry(LineString, 4326) NOT NULL,
  has_traffic_light   boolean NOT NULL DEFAULT false,
  accessibility_level accessibility_level,
  is_verified         boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crossings_start_end_check CHECK (start_node_id <> end_node_id)
);

CREATE INDEX crossings_geom_idx ON crossings USING gist (geom);
CREATE INDEX crossings_start_node_idx ON crossings (start_node_id);
CREATE INDEX crossings_end_node_idx ON crossings (end_node_id);

CREATE TRIGGER crossings_set_updated_at
  BEFORE UPDATE ON crossings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Down Migration

DROP TABLE IF EXISTS crossings;
DROP TABLE IF EXISTS sidewalks;
DROP TABLE IF EXISTS kerb_nodes;
DROP TYPE IF EXISTS accessibility_level;

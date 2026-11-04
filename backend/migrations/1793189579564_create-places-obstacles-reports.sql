-- Up Migration

CREATE TYPE obstacle_severity AS ENUM ('MINOR', 'MODERATE', 'CRITICAL');

-- La baja de un reporte es deleted_at, no un estado.
CREATE TYPE report_status AS ENUM ('PENDING', 'APPROVED', 'UNDER_REPAIR', 'RESOLVED', 'REJECTED');

-- Catálogo de tipos de obstáculo. Se crea y se siembra acá porque obstacles.type_id
-- y reports.type_id lo referencian; es el primer lugar donde hace falta.
CREATE TABLE obstacle_types (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code       varchar(40) NOT NULL,
  name_es    varchar(80) NOT NULL,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX obstacle_types_code_key ON obstacle_types (code);

CREATE TRIGGER obstacle_types_set_updated_at
  BEFORE UPDATE ON obstacle_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- OTHER va último y el portal ordena por name_es: el ciudadano puede elegirlo cuando
-- nada encaja, y el moderador lo reclasifica al crear el obstáculo. Un obstáculo
-- nunca queda en OTHER si el moderador lo evita.
INSERT INTO obstacle_types (code, name_es) VALUES
  ('POTHOLE',          'Pozo'),
  ('BROKEN_PAVEMENT',  'Rotura de vereda'),
  ('MISSING_SIDEWALK', 'Falta tramo de vereda'),
  ('CONSTRUCTION',     'Obra en la vía'),
  ('TREE',             'Árbol o raíces'),
  ('STEP',             'Escalón'),
  ('STEEP_SLOPE',      'Pendiente excesiva'),
  ('NARROWING',        'Estrechamiento'),
  ('MISSING_RAMP',     'Falta rampa'),
  ('BLOCKED_PASSAGE',  'Paso obstruido'),
  ('OTHER',            'Otros');

-- Lugares favoritos del usuario. Datos personales: se van con el usuario.
CREATE TABLE user_places (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     integer NOT NULL
    CONSTRAINT fk_user_places_user
    REFERENCES users (id) ON DELETE CASCADE,
  name        varchar(100) NOT NULL,
  description varchar(300),
  geom        geometry(Point, 4326) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_places_geom_idx ON user_places USING gist (geom);
CREATE INDEX user_places_user_id_idx ON user_places (user_id);

CREATE TRIGGER user_places_set_updated_at
  BEFORE UPDATE ON user_places
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Rutas guardadas. Se guardan solo los extremos, a propósito: la ruta se
-- recalcula cada vez para no mandar al usuario por un camino que dejó de ser
-- transitable (ver docs/09 §4.6).
CREATE TABLE saved_routes (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     integer NOT NULL
    CONSTRAINT fk_saved_routes_user
    REFERENCES users (id) ON DELETE CASCADE,
  name        varchar(100) NOT NULL,
  start_point geometry(Point, 4326) NOT NULL,
  end_point   geometry(Point, 4326) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX saved_routes_start_point_idx ON saved_routes USING gist (start_point);
CREATE INDEX saved_routes_end_point_idx ON saved_routes USING gist (end_point);
CREATE INDEX saved_routes_user_id_idx ON saved_routes (user_id);

CREATE TRIGGER saved_routes_set_updated_at
  BEFORE UPDATE ON saved_routes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Obstáculos: barreras puntuales que el moderador publica en el mapa.
-- Puede colgarse de a lo sumo uno de los tres elementos del grafo, y no es
-- obligatorio: su geom es la fuente de verdad de dónde está.
CREATE TABLE obstacles (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sidewalk_id  integer
    CONSTRAINT fk_obstacles_sidewalk
    REFERENCES sidewalks (id) ON DELETE RESTRICT,
  kerb_node_id integer
    CONSTRAINT fk_obstacles_kerb_node
    REFERENCES kerb_nodes (id) ON DELETE RESTRICT,
  crossing_id  integer
    CONSTRAINT fk_obstacles_crossing
    REFERENCES crossings (id) ON DELETE RESTRICT,
  type_id      integer NOT NULL
    CONSTRAINT fk_obstacles_type
    REFERENCES obstacle_types (id) ON DELETE RESTRICT,
  -- Sin default: un default silencioso en la severidad se propaga al ruteo.
  severity     obstacle_severity NOT NULL,
  geom         geometry(Point, 4326) NOT NULL,
  is_resolved  boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  CONSTRAINT obstacles_element_check
    CHECK (num_nonnulls(sidewalk_id, kerb_node_id, crossing_id) <= 1)
);

CREATE INDEX obstacles_geom_idx ON obstacles USING gist (geom);
CREATE INDEX obstacles_sidewalk_id_idx ON obstacles (sidewalk_id)
  WHERE sidewalk_id IS NOT NULL;
CREATE INDEX obstacles_kerb_node_id_idx ON obstacles (kerb_node_id)
  WHERE kerb_node_id IS NOT NULL;
CREATE INDEX obstacles_crossing_id_idx ON obstacles (crossing_id)
  WHERE crossing_id IS NOT NULL;
CREATE INDEX obstacles_type_id_idx ON obstacles (type_id);

CREATE TRIGGER obstacles_set_updated_at
  BEFORE UPDATE ON obstacles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Reportes de obstáculos. type_id y severity son la PERCEPCIÓN del ciudadano;
-- las mismas columnas en obstacles son la DECISIÓN del moderador (docs/09 §4.5).
-- Un reporte puede no tener obstáculo nunca, y un obstáculo puede tener varios
-- reportes apuntándolo.
CREATE TABLE reports (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     integer NOT NULL
    CONSTRAINT fk_reports_user
    REFERENCES users (id) ON DELETE RESTRICT,
  type_id     integer NOT NULL
    CONSTRAINT fk_reports_type
    REFERENCES obstacle_types (id) ON DELETE RESTRICT,
  severity    obstacle_severity NOT NULL,
  description varchar(300) NOT NULL,
  geom        geometry(Point, 4326) NOT NULL,
  image_url   varchar(300),
  status      report_status NOT NULL DEFAULT 'PENDING',
  obstacle_id integer
    CONSTRAINT fk_reports_obstacle
    REFERENCES obstacles (id) ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE INDEX reports_geom_idx ON reports USING gist (geom);
CREATE INDEX reports_user_id_idx ON reports (user_id);
CREATE INDEX reports_status_idx ON reports (status);
CREATE INDEX reports_obstacle_id_idx ON reports (obstacle_id)
  WHERE obstacle_id IS NOT NULL;

CREATE TRIGGER reports_set_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Down Migration

DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS obstacles;
DROP TABLE IF EXISTS saved_routes;
DROP TABLE IF EXISTS user_places;
DROP TABLE IF EXISTS obstacle_types;

DROP TYPE IF EXISTS report_status;
DROP TYPE IF EXISTS obstacle_severity;

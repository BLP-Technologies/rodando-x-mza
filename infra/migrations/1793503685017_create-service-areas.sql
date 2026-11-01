-- Up Migration

-- Áreas de servicio: hasta dónde se aceptan las puntas de una consulta de ruteo.
--
-- Es una tabla y no una columna de configuración por tres razones. La geometría es
-- dato y no esquema: agregar una zona o cambiar su forma es un INSERT o un UPDATE,
-- no una migración. Una fila por área permite convivir con varias zonas sin tocar
-- el esquema cuando el piloto crezca a la ciudad. Y `is_active` deja reemplazar un
-- polígono sin cortar el servicio: se desactiva el viejo y se activa el nuevo en la
-- misma transacción, en vez de dejar el sistema sin área entre dos deploys.
CREATE TABLE service_areas (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       varchar(100) NOT NULL,
  geom       geometry(Polygon, 4326) NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- El nombre identifica el área en el código y en la operación: es único.
CREATE UNIQUE INDEX service_areas_name_key ON service_areas (name);

-- La geometría es lo que se consulta con ST_Covers en cada pedido de ruta.
CREATE INDEX service_areas_geom_idx ON service_areas USING gist (geom);

CREATE TRIGGER service_areas_set_updated_at
  BEFORE UPDATE ON service_areas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- La red de seguridad del piloto: la zona de data/pilot-zone.geojson corrida 50 m
-- hacia afuera con las esquinas en ángulo recto, para que el borde de la búsqueda no
-- sea un redondeo. Se siembra el WKT ya calculado (8 decimales) para que la
-- migración no dependa de un archivo del repo ni del resultado de una función.
--
-- Cómo se generó, reproducible sobre la base:
--
--   SELECT ST_AsText(ST_SnapToGrid(ST_Buffer(
--     ST_GeomFromGeoJSON(<geometria de data/pilot-zone.geojson>)::geography,
--     50, 'join=mitre')::geometry, 1e-8));
--
-- El resultado es un POLYGON de 5 puntos (4 esquinas) que cubre las cuatro esquinas
-- del piloto, deja adentro 156 de los 373 kerb_nodes del grafo y no cubre Las Heras
-- y Perú (-68.847190 -32.884697), que queda a 74 m del borde (docs/10 §2).
INSERT INTO service_areas (name, geom) VALUES (
  'Zona piloto Fase 1',
  ST_GeomFromText(
    'POLYGON((-68.84788777 -32.8852519,-68.83923548 -32.88685409,-68.84113316 -32.89416301,-68.84980259 -32.89256194,-68.84788777 -32.8852519))',
    4326
  )
);

-- Down Migration

DROP TABLE IF EXISTS service_areas;

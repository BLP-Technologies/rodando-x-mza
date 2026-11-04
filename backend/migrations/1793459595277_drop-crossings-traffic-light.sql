-- Up Migration

-- La columna no aporta al ruteo: el import de OpenStreetMap no trae el tag de forma
-- confiable, asi que queda en false en todo el grafo, y un booleano no representa lo que
-- hace riesgoso un cruce (volumen y velocidad del trafico, senda pintada, fase
-- protegida). Ver docs/09 §4.3.
ALTER TABLE crossings DROP COLUMN has_traffic_light;

-- Down Migration

-- Al revertir vuelve con la forma que tenia: NOT NULL y con default false.
ALTER TABLE crossings ADD COLUMN has_traffic_light boolean NOT NULL DEFAULT false;
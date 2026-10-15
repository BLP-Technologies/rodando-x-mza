-- Aprovisionamiento de la base.
--
-- Se ejecuta una sola vez, cuando el contenedor inicializa un volumen de datos
-- nuevo (el entrypoint de Postgres corre los archivos de
-- /docker-entrypoint-initdb.d). Las extensiones son parte de la plataforma, no del
-- esquema de la aplicación: por eso viven acá y no en una migración.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgrouting;

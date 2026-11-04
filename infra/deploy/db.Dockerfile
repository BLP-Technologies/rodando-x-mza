FROM docker.io/pgrouting/pgrouting:16-3.5-4.0
COPY infra/initdb/01-extensions.sql /docker-entrypoint-initdb.d/01-extensions.sql

-- Up Migration

-- Sesiones abiertas por el inicio de sesión (C002). Cada fila es un token vigente:
-- cerrar sesión borra la fila y el token deja de servir. No se guarda el token sino
-- su SHA-256, para que una copia de la base no entregue sesiones utilizables.
-- No tiene updated_at: sus columnas son inmutables, así que no habría nada que
-- actualizar (docs/09 §7).
CREATE TABLE sessions (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    integer NOT NULL
    CONSTRAINT fk_sessions_user
    REFERENCES users (id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- Cada pedido autenticado busca la sesión por el hash de su token.
CREATE UNIQUE INDEX sessions_token_hash_key ON sessions (token_hash);

-- Down Migration

DROP TABLE IF EXISTS sessions;

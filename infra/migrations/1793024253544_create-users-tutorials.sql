-- Up Migration

-- Mantiene updated_at al día en cada UPDATE, sin depender de que cada cliente
-- se acuerde de escribirlo. La usan todas las tablas mutables del esquema.
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TABLE users (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          varchar(50)  NOT NULL,
  email         varchar(200) NOT NULL,
  password_hash varchar(255) NOT NULL,
  is_moderator  boolean      NOT NULL DEFAULT false,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

-- Único entre los no borrados y sin distinguir mayúsculas: el inicio de sesión
-- por email tiene que ser inequívoco, y dar de baja una cuenta no puede dejar
-- ese email bloqueado para siempre.
CREATE UNIQUE INDEX users_email_key ON users (lower(email))
  WHERE deleted_at IS NULL;

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Catálogo de categorías de tutorial. Se siembra cuando se defina la carga de
-- tutoriales; la tabla existe ahora porque tutorials.category_id la referencia.
CREATE TABLE tutorial_categories (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code       varchar(40) NOT NULL,
  name_es    varchar(80) NOT NULL,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX tutorial_categories_code_key ON tutorial_categories (code);

CREATE TRIGGER tutorial_categories_set_updated_at
  BEFORE UPDATE ON tutorial_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE tutorials (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id integer      NOT NULL
    CONSTRAINT fk_tutorials_category
    REFERENCES tutorial_categories (id) ON DELETE RESTRICT,
  title       varchar(100) NOT NULL,
  description varchar(300) NOT NULL,
  video_url   varchar(300) NOT NULL,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE TRIGGER tutorials_set_updated_at
  BEFORE UPDATE ON tutorials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Tutoriales guardados por un usuario. No tiene updated_at: sus únicas columnas
-- son inmutables, así que no habría nada que actualizar.
CREATE TABLE user_tutorials (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     integer NOT NULL
    CONSTRAINT fk_user_tutorials_user
    REFERENCES users (id) ON DELETE CASCADE,
  tutorial_id integer NOT NULL
    CONSTRAINT fk_user_tutorials_tutorial
    REFERENCES tutorials (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Guardar dos veces el mismo tutorial no puede duplicar la fila.
  CONSTRAINT user_tutorials_user_tutorial_key UNIQUE (user_id, tutorial_id)
);

-- Down Migration

DROP TABLE IF EXISTS user_tutorials;
DROP TABLE IF EXISTS tutorials;
DROP TABLE IF EXISTS tutorial_categories;
DROP TABLE IF EXISTS users;
DROP FUNCTION IF EXISTS set_updated_at();

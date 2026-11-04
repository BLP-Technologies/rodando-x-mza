-- Up Migration

-- El reporte puede ser anónimo: `reports.user_id` pasa a nullable.
--
-- La columna nació `NOT NULL` con FK a `users`, pero hoy no hay autenticación
-- (Fase 3) ni una sola fila en `users`: exigir el autor haría imposible el único
-- caso de uso que existe, que alguien reporte un pozo sin tener cuenta. Un
-- reporte anónimo es legítimo mientras no haya login, y cuando lo haya el
-- reporte autenticado vuelve a completar el campo (docs/09 §4.5).
--
-- La alternativa descartada es sembrar un usuario "ciudadano" y apuntarle todos
-- los reportes: deja una fila de mentira que después hay que deshacer con un
-- `UPDATE` masivo, y mientras tanto miente sobre quién reportó.
ALTER TABLE reports ALTER COLUMN user_id DROP NOT NULL;

-- Down Migration

-- Un reporte anónimo no tiene autor al que volver, así que este `down` falla si
-- ya se guardó uno. Es aceptable porque revertir la migración es volver a la
-- versión anterior del código, que tampoco sabe crear reportes sin usuario: la
-- base y el código quedan coherentes entre sí.
ALTER TABLE reports ALTER COLUMN user_id SET NOT NULL;

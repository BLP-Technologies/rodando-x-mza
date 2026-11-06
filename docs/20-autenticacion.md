# Autenticación

> Documento temático. Define cómo se registra una cuenta (C001), cómo se inicia y se
> cierra una sesión (C002) y cómo un cliente demuestra quién es en cada pedido. Es el
> estado vivo de esas decisiones: se edita en su lugar cuando cambian. Se complementa con
> [04-errores-y-mensajes.md](04-errores-y-mensajes.md), que define la forma del error,
> con [09-modelo-de-datos.md](09-modelo-de-datos.md), que define las convenciones del
> esquema, y con [15-integracion-con-el-cliente.md](15-integracion-con-el-cliente.md).

## 1. Alcance

Este documento responde:

- **Qué endpoints** tiene la autenticación y qué devuelve cada uno (§2).
- **Qué es el token** y por qué la sesión vive en la base (§3).
- **Cómo se guarda** una contraseña (§4).
- **Cómo manda** el cliente el token (§5).
- **Cómo se rechaza** un pedido (§6).

No decide los permisos de moderador sobre cada endpoint, ni la recuperación de
contraseña, ni el límite de intentos (§7).

## 2. El contrato

Todo vive bajo `/api/auth`. El código está en `backend/src/auth/` y el contrato en
`auth.schemas.ts`, que es la fuente ([02 §6](02-stack-y-estructura.md)).

| Endpoint | Pide | Responde |
| --- | --- | --- |
| `POST /api/auth/register` | `{ name, email, password }` | `201` con `{ user }` |
| `POST /api/auth/login` | `{ email, password }` | `200` con `{ token, user }` |
| `GET /api/auth/me` | el token | `200` con `{ user }` |
| `POST /api/auth/logout` | el token | `204`, sin cuerpo |

`user` es `{ id, name, email, is_moderator }`. Nunca incluye el hash de la contraseña.

- **El registro no abre sesión.** Devuelve la cuenta creada y el cliente inicia sesión
  aparte: así hay un solo lugar donde nace un token.
- **Toda cuenta nueva nace moderadora.** Es una decisión del MVP (§7), no del modelo:
  el default de la columna sigue en `false`.
- **El email se normaliza** antes de validarlo: sin espacios y en minúsculas. El índice
  único de `users` es sobre `lower(email)`, así que `Ana@Mail.com` y `ana@mail.com` son
  la misma cuenta.
- **La contraseña tiene al menos 8 caracteres** al registrarse. En el inicio de sesión
  sólo se exige que no venga vacía: repetir la regla ahí le diría a cualquiera cuál es.

## 3. El token es una sesión guardada en la base

Iniciar sesión crea una fila en `sessions` y devuelve un token aleatorio de 256 bits. La
base no guarda el token: guarda su **SHA-256**, así que una copia de la base no entrega
sesiones utilizables. En cada pedido se busca la sesión por el hash del token recibido.

**Por qué una sesión en la base y no un JWT.** Un JWT firmado no se puede invalidar antes
de que venza: cerrar sesión sólo lo borraría del cliente, y quien lo hubiera copiado lo
seguiría usando. Con la sesión en la base, `POST /logout` borra la fila y el token deja de
servir en ese instante. Además no hace falta ningún secreto de firma que administrar
([03 §7](03-despliegue-y-operacion.md)). El costo es una consulta por pedido autenticado,
por índice único, que en este volumen no se nota.

**Una sesión vale 30 días** desde que se inicia (`SESSION_TTL_MS` en `auth.service.ts`).
Una sesión vencida queda en la tabla pero ya no autentica, y tampoco autentica la de una
cuenta dada de baja (`deleted_at`).

La tabla es `sessions` (migración `create-sessions`): `user_id` con `ON DELETE CASCADE`,
`token_hash` único, `created_at` y `expires_at`. No lleva `updated_at` porque sus columnas
son inmutables ([09 §7](09-modelo-de-datos.md)).

## 4. Las contraseñas

Se guardan con **scrypt**, que viene con Node (`node:crypto`): no suma dependencias. Lo
que va a `users.password_hash` es `scrypt$N$r$p$sal$hash`, con una sal aleatoria por
contraseña. Guardar los parámetros junto al hash permite endurecerlos más adelante sin
invalidar las contraseñas existentes. La comparación es en tiempo constante.

**Email inexistente y contraseña incorrecta dan el mismo error**, y en los dos casos se
calcula un hash: así ni la respuesta ni el tiempo que tarda revelan qué emails tienen
cuenta.

## 5. Cómo manda el token el cliente

En cada pedido que lo necesita, como encabezado:

```
Authorization: Bearer <token>
```

El cliente guarda el token en un almacenamiento seguro del dispositivo y lo borra al
cerrar sesión. Para restaurar una sesión al abrir la app, pide `GET /api/auth/me`: si
responde `401`, el token ya no sirve y hay que volver a iniciar sesión.

Desde un navegador hace falta además que el backend permita el encabezado
`Authorization` en CORS ([15 §3](15-integracion-con-el-cliente.md)). La app mobile no
pasa por CORS.

**El portal no guarda el token en el navegador.** Lo deja en una cookie `httpOnly`
(`rodando_session`) y hace los pedidos desde el servidor de Next: el JavaScript de la
página nunca ve el token, así que un XSS no se lo puede llevar. La cookie dura lo mismo
que la sesión en la base y se borra al cerrar sesión ([16 §4](16-el-portal.md)).

## 6. Cómo se rechaza

| Situación | Status | Respuesta |
| --- | --- | --- |
| Falta un campo | 400 | `VALIDATION_ERROR` con `details: [{ field, code: "REQUIRED" }]` |
| Un campo presente pero inválido | 400 | `VALIDATION_ERROR` con `details: [{ field, code: "INVALID" }]` |
| El email ya tiene cuenta | 409 | `CONFLICT` |
| Credenciales incorrectas | 401 | `UNAUTHENTICATED` |
| Token ausente, mal formado, vencido o de una cuenta dada de baja | 401 | `UNAUTHENTICATED` |
| Cualquier fallo no previsto | 500 | `INTERNAL_ERROR`, sin detalles |

No hay códigos nuevos: todos están en el catálogo de
[04 §4](04-errores-y-mensajes.md). El texto que ve la persona lo escribe cada cliente.

## 7. Lo que este documento no decide

- **Qué endpoints exigen moderador.** `is_moderator` viaja en `user` y el portal lo
  exige para dejar entrar ([16 §4](16-el-portal.md)), pero ninguna ruta de la API lo
  pide todavía: se decide con los casos de uso (C011 a C014). El login protege la
  interfaz, no los datos.
- **Quién es moderador.** Mientras dure el MVP, **toda cuenta creada con
  `POST /api/auth/register` nace moderadora**: es una línea de `insertUser`
  (`backend/src/auth/auth.sql.ts`), con el default de la columna en `false` para que
  otra vía de alta no herede el permiso. Sirve para que quien se registra pueda entrar
  al portal sin que nadie toque la base a mano; el costo es que el registro queda
  abierto a cualquiera que llegue a la pantalla. Se revierte borrando esa línea, y hay
  un test (`auth.db.test.ts`) que avisa.
- **La recuperación de contraseña.** No hay endpoint todavía.
- **El límite de intentos de inicio de sesión.** No hay; se agrega si el uso lo pide.
- **Limpiar las sesiones vencidas.** Quedan en la tabla sin efecto; si crece, se agrega
  una limpieza periódica.

## 8. Documentos relacionados

- [04-errores-y-mensajes.md](04-errores-y-mensajes.md): la forma del error y el catálogo
  de códigos.
- [09-modelo-de-datos.md](09-modelo-de-datos.md): convenciones del esquema y de las
  migraciones.
- [15-integracion-con-el-cliente.md](15-integracion-con-el-cliente.md): cómo se conecta un
  cliente y la política de CORS.
- [07-plan-de-trabajo.md](07-plan-de-trabajo.md): la Fase 3, de la que es parte.

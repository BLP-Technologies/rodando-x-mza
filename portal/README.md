# Portal de moderación

Aplicación Next.js que muestra el grafo peatonal de accesibilidad del microcentro
de Mendoza y permite corregir el nivel de accesibilidad de un elemento (C014). El
mapa es **uno solo** y tiene tres herramientas —grafo, ruta y obstáculos— como
pestañas, con un panel de capas para prender y apagar lo que se dibuja; la cola de
reportes ciudadanos es una pantalla aparte. Todo con un moderador simulado.

Los pasos completos —base, backend y portal— están en
[docs/05-desarrollo.md](../docs/05-desarrollo.md) §4. Las decisiones del portal
—sesión, cliente tipado, mapa, edición— en
[docs/16-el-portal.md](../docs/16-el-portal.md).

## Requisitos

- Node.js 22 y pnpm 12.4.1.
- El backend levantado en `http://localhost:3001`, con `CORS_ORIGINS` que incluya
  `http://localhost:3000` ([docs/15](../docs/15-integracion-con-el-cliente.md) §3).

## Puesta en marcha

```sh
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:3001
pnpm install
pnpm dev                     # http://localhost:3000
```

La dirección de la API es configuración: sale de `NEXT_PUBLIC_API_URL`
([docs/15](../docs/15-integracion-con-el-cliente.md) §3). Si falta, el portal usa el
backend de desarrollo, así que el build de producción tiene que definirla: Next
inlinea las `NEXT_PUBLIC_*` al compilar
([docs/16](../docs/16-el-portal.md) §6).

## Comandos

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | desarrollo con recarga automática |
| `pnpm build` | build de producción; incluye el chequeo de tipos |
| `pnpm start` | sirve el build de `pnpm build` |
| `pnpm lint` | ESLint |
| `pnpm api:types` | regenera `src/api/schema.d.ts` desde la API levantada |

## Tipos de la API

`src/api/schema.d.ts` se genera desde `/api/openapi.json` y **se commitea**: el
build de CI no tiene un backend levantado. No se edita a mano; cuando cambia un
esquema del backend, con el backend arriba:

```sh
pnpm api:types
git add src/api/schema.d.ts
```

Si algo está mal en esos tipos, el error está en el esquema del backend: se
corrige allá y se regenera ([docs/16](../docs/16-el-portal.md)).

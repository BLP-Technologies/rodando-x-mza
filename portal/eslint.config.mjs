import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Código generado desde `/api/openapi.json` por `pnpm api:types`. No se
    // escribe a mano (ver docs/16-el-portal.md): las reglas de lint no aplican a
    // una salida de herramienta y el CI corre `pnpm lint`, así que tiene que
    // quedar afuera acá y no editando el archivo.
    "src/api/schema.d.ts",
  ]),
]);

export default eslintConfig;

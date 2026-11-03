import tseslint from 'typescript-eslint';

export default tseslint.config(
  // `src/db/types.ts` lo genera kysely-codegen desde la base (ver
  // .kysely-codegenrc.json): no se edita a mano, así que no se lintea.
  { ignores: ['dist', 'node_modules', 'src/db/types.ts'] },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Regla del proyecto: `any` prohibido. Ver docs/02-stack-y-estructura.md §4.
      '@typescript-eslint/no-explicit-any': 'error',
      // Fuerza `import type` en los imports que solo traen tipos.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // Ignora parámetros/variables con prefijo `_` (p. ej. `_req`, `_next`).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Toda la app loguea con el logger (pino), no con console.
      'no-console': 'error',
    },
  },
  // Los archivos `.js` (p. ej. este mismo archivo de config) no se type-chequean:
  // no están en el tsconfig y el project service no puede resolverlos.
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);

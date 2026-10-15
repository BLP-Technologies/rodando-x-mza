import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // El logger existe en los tests, pero no ensucia la salida.
    env: { LOG_LEVEL: 'silent' },
  },
});

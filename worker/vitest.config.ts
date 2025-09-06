import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globals: false
  },
  esbuild: {
    target: 'es2020',
    loader: 'ts'
  }
});

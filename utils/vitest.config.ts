import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.config.ts'
      ]
    }
  },
  esbuild: {
    target: 'es2020',
    loader: 'ts'
  },
  resolve: {
    alias: {
      '@': '/Users/arcadio/dev/pokedao'
    }
  }
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    server: {
      deps: {
        external: ['sharp'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**/*.ts'],
      exclude: [
        'node_modules/',
        'src/**/*.test.ts',
        '**/*.d.ts',
        'dist/',
        'src/routes/**',
        'src/index.ts',
      ],
    },
  },
});

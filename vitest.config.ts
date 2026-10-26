import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['packages/*/src/**/*.test.ts', 'apps/api/src/**/*.test.ts', 'apps/api/seed/**/*.test.ts'],
        },
      },
      {
        extends: './apps/web/vite.config.ts',
        test: {
          name: 'unit-web',
          root: './apps/web',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/test/setup.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['apps/api/test/**/*.test.ts'],
          globalSetup: ['./apps/api/test/global-setup.ts'],
          // One database: run files serially so they never race on shared state.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});

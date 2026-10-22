import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    // Integration tests share one database, so files must not run concurrently.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});

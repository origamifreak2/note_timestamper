import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      enabled: false,
    },
    include: ['tests/**/*.test.{js,mjs}'],
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Generator tests (wallpaper contours, content sync) do real file work; give them
  // headroom on busy machines and CI runners.
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node', testTimeout: 30_000 },
});

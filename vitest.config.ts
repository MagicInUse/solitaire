import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    // The shortest-path (BFS) endgame planner drives several diagnostic suites
    // (sim/register/drill) across dozens of seeds, and vitest runs test files in
    // parallel — so CPU contention can stretch a 40-seed planner sweep well past
    // vitest's 5 s default.  A generous global ceiling keeps the full suite green
    // under load; the heavy sim harness still sets its own explicit per-test cap.
    testTimeout: 4 * 60 * 1000,
  },
})

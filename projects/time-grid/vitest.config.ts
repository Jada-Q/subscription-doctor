import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["projects/time-grid/src/**/*.test.ts"],
  },
});

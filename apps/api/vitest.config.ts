import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/index.ts",
        "src/app.ts",
        "src/types/**",
        "src/test-helpers.ts",
        "**/dist/**",
        "**/generated/**",
        "**/node_modules/**",
      ],
    },
  },
});

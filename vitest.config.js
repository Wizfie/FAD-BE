import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/__tests__/**/*.test.js"],
    exclude: ["node_modules", "dist", ".idea", ".git", ".cache"],
    testTimeout: 10000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "services/**/*.js",
        "controllers/**/*.js",
        "utils/ApiError.js",
        "middlewares/validateSchema.js",
      ],
      exclude: ["node_modules/**", "**/*.test.js"],
    },
  },
});

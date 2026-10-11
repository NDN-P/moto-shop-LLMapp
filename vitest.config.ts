import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    env: { DATABASE_URL: ":memory:", ADMIN_USERNAME: "test-admin", ADMIN_PASSWORD: "unit-test-only" },
    include: ["server/**/*.test.ts", "server/**/*.spec.ts", "client/**/*.test.tsx"],
  },
});

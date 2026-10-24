import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  // Tests use explicit fixtures and must not read deployment credentials from .env.
  envDir: false,
  test: { exclude: [...configDefaults.exclude, ".next/**"] },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});

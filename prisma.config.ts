import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer auto-loads .env; Node 22+ can do it natively. The file is
// absent during `prisma generate` in the Docker build (DATABASE_URL not needed
// there), so a missing .env must not be fatal.
try {
  process.loadEnvFile();
} catch {
  // No .env on disk — rely on the ambient environment (e.g. CI, container).
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    path: "prisma/migrations",
    seed: "node scripts/seed-db.mjs",
  },
});

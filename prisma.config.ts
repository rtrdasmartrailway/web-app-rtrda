import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer auto-loads .env; Node 22+ can do it natively.
process.loadEnvFile();

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

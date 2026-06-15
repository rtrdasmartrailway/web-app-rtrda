import type { Config } from "drizzle-kit";

// Schema is synced with `drizzle-kit push` (no migration files / journal).
// `schema.ts` is the single source of truth; rebuild data with `npm run db:setup`.
export default {
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;

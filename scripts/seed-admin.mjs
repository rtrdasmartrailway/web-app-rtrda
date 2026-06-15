#!/usr/bin/env node
/**
 * Promote a user to the "admin" role by email.
 * Run AFTER that person has signed in with Microsoft at least once (the user
 * row is created on first sign-in).
 *
 * Usage:
 *   ADMIN_EMAIL=someone@org.com npm run db:seed:admin
 *   # or falls back to the email below if ADMIN_EMAIL is unset.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Load .env.local if present (same pattern as the other seed scripts).
try {
  const env = await readFile(path.join(root, ".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  }
} catch {
  // no .env.local, that's fine
}

if (!process.env.DATABASE_URL) {
  console.error("Error: DATABASE_URL is not set.");
  process.exit(1);
}

const email = process.env.ADMIN_EMAIL || "apiwit.pks@gmail.com";

const sql = postgres(process.env.DATABASE_URL);

const updated = await sql`
  UPDATE "user" SET role = 'admin', updated_at = now()
  WHERE email = ${email}
  RETURNING id, email, role
`;

if (updated.length === 0) {
  console.error(
    `No user found with email "${email}". Have them sign in with Microsoft first, then re-run.`,
  );
  await sql.end();
  process.exit(1);
}

console.log(`Promoted ${updated[0].email} to role "${updated[0].role}".`);
await sql.end();

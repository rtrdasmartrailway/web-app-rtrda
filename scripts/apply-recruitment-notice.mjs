/** Apply the idempotent recruitment notice to the one imported page only. */
import process from "node:process";
import pg from "pg";
import { applyRecruitmentNoticeOverride } from "./recruitment-notice-override.mjs";

process.loadEnvFile();
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  await client.query("BEGIN");
  await applyRecruitmentNoticeOverride(client);
  await client.query("COMMIT");
  console.log("Recruitment notice applied to th-page-442");
} catch (error) {
  try {
    await client.query("ROLLBACK");
  } catch (rollbackError) {
    console.error("Recruitment notice rollback failed", rollbackError);
  }
  throw error;
} finally {
  await client.end();
}

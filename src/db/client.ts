import postgres from "postgres";

// Pool sizing matters during `next build`, which spawns multiple worker
// processes (one pool each) that prerender hundreds of DB-backed pages against
// the shared Postgres. A high per-pool max across workers can exhaust
// max_connections ("too many clients"). Keep the pool small and recycle idle
// connections so they don't accumulate. Override with DB_POOL_MAX if needed.
const sql = process.env.DATABASE_URL
  ? postgres(process.env.DATABASE_URL, {
      max: Number(process.env.DB_POOL_MAX ?? 5),
      idle_timeout: 20, // seconds an idle connection is kept before closing
      max_lifetime: 60 * 30, // recycle connections after 30 min
    })
  : null;
export default sql;

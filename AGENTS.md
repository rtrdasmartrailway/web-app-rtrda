<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project rules

- **Postgres is the content source of truth.** The site reads from it at
  runtime via Prisma (`src/lib/db/`). `next build` must NOT need the database
  (routes are ISR with empty `generateStaticParams`).
- URL parity is the core requirement: every old URL must serve the same
  information here. `npm run audit:parity` is the regression gate — run it
  against a locally built container (127.0.0.1:3020) before pushing; 0 fail.
- `src/data/wp-content.json` is the frozen WordPress import artifact. It only
  feeds `npm run db:seed`. Never hand-edit it or the mirrored asset dirs
  (`public/wp-content/uploads/`, `public/sdc-downloads/`).
- Schema changes go through Prisma: edit `prisma/schema.prisma`, run
  `npx prisma migrate dev --name <change>`, then `npm run db:seed` if needed.
  The CI applies migrations with `npm run db:migrate` (prisma migrate deploy).
- `.env` holds `POSTGRES_PASSWORD`, `DATABASE_URL`, and the GitHub token.
  Never print or commit it. The runner keeps its own copy (gitignored).
- Before claiming done: `npm test && npm run lint && npm run typecheck &&
  npm run format:check && npm run build` (build works with the db stopped).
- Keep Thai/English route parity (`/en/...` mirrors) when adding routes.

## Layout

- `prisma/` — schema + migrations; `prisma.config.ts` loads `.env`
- `scripts/` — `import-wordpress*` (regenerates the JSON), `seed-db*`
  (JSON → Postgres), `audit-parity*` (regression gate). ESM `.mjs`, vitest.
- `src/lib/db/` — Prisma client, queries, and per-request page view models
- `src/lib/wp/` — shared types, url + presentation helpers
- `src/components/` — kebab-case server components (site-shell, content-page,
  search-results, article-card, intranet-*)
- `src/app/` — App Router; `[[...slug]]` serves all records from the DB (ISR)

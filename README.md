# web-app-rtrda

Next.js migration of the RTRDA website (https://www.rtrda.or.th/, WordPress).
Every public WordPress URL keeps working at the same path with the same
content; the UI is a modern "tech institute" redesign. Content is served from
**PostgreSQL** (the source of truth). The test deployment serves
https://test.rtrda.or.th from this machine.

## Architecture

```
WordPress (www.rtrda.or.th)
   │  REST API + sitemaps + rendered HTML (flip-books, fallbacks)
   ▼
scripts/import-wordpress.mjs         (one-time / refresh: produces the manifest)
   │
   ├── src/data/wp-content.json      frozen import artifact (seed input only)
   ├── public/wp-content/uploads/    mirrored media (gitignored, ~3.4 GB)
   └── public/sdc-downloads/         mirrored download-manager files
   ▼
scripts/seed-db.mjs  ──►  PostgreSQL  ◄── source of truth
                          (ContentRecord, Category, MediaAsset, Download,
                           SiteMeta; pg_trgm indexes for Thai search)
   ▼
Next.js App Router (reads the DB at runtime via Prisma, ISR)
   ├── src/app/[[...slug]]/page.tsx  catch-all serving every record
   ├── src/app/search/page.tsx       pg_trgm search (?s= redirects here)
   ├── src/app/sdc_download/[id]/    download routes
   └── src/app/rtrdaintranet/        intranet clone
```

- Schema and migrations live in `prisma/`; `prisma.config.ts` loads `.env`.
  The generated client is written to `src/generated/prisma` (gitignored).
- `src/lib/db/` is the read layer: `client.ts` (Prisma + pg adapter),
  `queries.ts` (typed query functions, including pg_trgm-ranked search),
  `page-data.ts` (per-request cached view models the components render).
- `src/data/wp-content.json` is the frozen WordPress import. It feeds
  `npm run db:seed` and nothing else. Never hand-edit it or the mirrored
  asset dirs — regenerate with `npm run import:wordpress`.

## Commands

```bash
npm run db:migrate         # prisma migrate deploy (apply migrations)
npm run db:seed            # load src/data/wp-content.json into Postgres
npm run db:studio          # browse/edit content in Prisma Studio
npm run dev                # dev server (needs the db up)
npm run build              # production build (does NOT need the db)
npm test                   # vitest unit tests
npm run lint               # eslint
npm run typecheck          # tsc --noEmit
npm run format / format:check
npm run audit:parity       # compare old site vs new site URL-by-URL
npm run import:wordpress   # regenerate the JSON manifest from WordPress
```

### First-time / local setup

```bash
docker compose up -d db                       # start Postgres
npm run db:migrate && npm run db:seed         # create schema + load content
npm run dev
```

`.env` must define `POSTGRES_PASSWORD` and `DATABASE_URL`
(`postgresql://rtrda:<password>@127.0.0.1:5432/rtrda` for host-side CLI; the
app container uses the compose-network host `db:5432`). Back up / restore:

```bash
docker exec web-app-rtrda-db pg_dump -U rtrda rtrda > backup.sql
docker exec -i web-app-rtrda-db psql -U rtrda -d rtrda < backup.sql
```

## Parity audit

`npm run audit:parity` builds the canonical URL inventory (Yoast sitemaps,
REST links, RTRDA_PAGES.md, downloads, pagination and search probes) and
compares old vs new for status, title, main-content containment similarity
and referenced assets. Reports land in `reports/parity-report.{json,md}`;
the process exits non-zero on failures. Useful flags:

```bash
npm run audit:parity -- --new-base https://test.rtrda.or.th
npm run audit:parity -- --only /category --max-urls 50
```

## Deployment (test.rtrda.or.th)

Push to `main` of `rtrdasmartrailway/web-app-rtrda` → self-hosted GitHub
Actions runner on this machine (`.github/workflows/deploy-test.yml`):
install deps → start Postgres + `db:migrate` → `db:seed` →
test/lint/typecheck/format → `docker compose up -d --build
web-app-rtrda-test` → health check. The web container listens on
127.0.0.1:3020; a cloudflared tunnel maps test.rtrda.or.th to it. The
Postgres container and mirrored assets persist on the host between deploys
(the checkout uses `clean: false`); the seed reloads content each deploy.

`SITE_ORIGIN` (docker-compose.yml) sets the public origin used for
canonical URLs, sitemap.xml and robots.txt.

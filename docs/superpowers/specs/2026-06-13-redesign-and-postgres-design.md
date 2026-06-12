# RTRDA redesign + Postgres content database — design

Date: 2026-06-13
Status: approved by user (direction: "Modern tech institute" visual, Postgres DB,
DB becomes content source of truth)

## Goals

1. Redesign the front-end as a modern government **research-reference** website
   ("tech institute" direction: dark-navy heroes, gradient accents, glassy cards),
   bilingual TH/EN.
2. **Every URL path stays identical** and serves the same information — the
   existing `audit:parity` gate (0 fail) remains the regression gate.
3. Move content from the build-time JSON manifest (`src/data/wp-content.json`)
   into **PostgreSQL**, read at runtime via **Prisma**. The database becomes the
   **source of truth**; WordPress import becomes a one-time seed.
4. Deploy to test.rtrda.or.th through the existing push→runner→compose→tunnel
   pipeline; commit everything to GitHub.

## Non-goals

- No admin/CMS UI yet (DB is editable with SQL/Prisma Studio for now).
- No visual cloning of the old WordPress theme (already decided in migration).
- Forms still link out (Google Forms etc.); no backend form handling.
- Intranet pages (`/rtrdaintranet`) keep their existing bespoke design.

## Architecture

### Database

- **Postgres 17 (alpine)** as a `db` service in `docker-compose.yml`, named
  volume `rtrda-db-data`, published only on `127.0.0.1:5432` (for host-side
  seeding, migrations, and ad-hoc edits). Healthcheck with `pg_isready`.
- **Prisma** as schema/migration/client layer. `DATABASE_URL` and
  `POSTGRES_PASSWORD` live in `.env` (gitignored; compose substitutes them).
  App container connects via the compose network (`db:5432`).
- **Thai-safe full-text search** via the `pg_trgm` extension: GIN trigram
  indexes on `title` and `searchText`; queries rank with `similarity()` +
  `ILIKE`. (tsvector tokenizers don't handle Thai; trigram matching does —
  the same insight the parity audit already uses.)

### Schema (Prisma models mirror the manifest types 1:1 to minimize risk)

- `ContentRecord` — wpId, language (th|en), kind (page|post|archive|category|
  author|flipbook), `path` (unique), title, excerpt, contentHtml, searchText,
  date, modified, parentPath, authorId. Trigram indexes for search; index on
  (language, kind, date) for listings.
- `Category` — wpId, language, name, slug, path.
- `MediaAsset` / `Download` — mirrored asset bookkeeping (files stay on disk
  under `public/`, exactly as today).
- `NavigationItem` — language, order, label, href, parentId (tree).
- `SiteMeta` — key/value (generatedAt, source).
- Migration enables `pg_trgm` (`CREATE EXTENSION IF NOT EXISTS pg_trgm`).

### Data flow

- **Seed**: new `scripts/seed-db.mjs` loads the existing, fully-audited
  `wp-content.json` into Postgres (`npm run db:seed`, idempotent upserts).
  No re-crawl of WordPress needed — the JSON is the final import artifact.
  `import:wordpress` remains available to regenerate the JSON if ever needed,
  but the DB is authoritative from now on.
- **Read**: new `src/lib/db/` layer (Prisma client singleton + query functions:
  `getRecordByPath`, `getNavigation`, `getChildren`, `getLatestPosts`,
  `getCounterpartPath`, `searchRecords`, `getAllPaths` for sitemap, `getStats`
  for the home stats band). Components receive plain typed objects — the
  existing `WpContentRecord` shape is kept so component changes stay mechanical.
- **Rendering**: `[[...slug]]` drops `generateStaticParams`; routes become
  **ISR on demand** (`revalidate = 300`). `next build` no longer needs the DB
  or the JSON manifest. Search stays dynamic. sitemap/robots query the DB at
  request time.

### Front-end redesign ("Modern tech institute")

Same component boundaries, presentation-only changes. The `.content-main`
wrapper, title pattern (`<title> | RTRDA`), and all content HTML are preserved
for the parity audit.

- **Design tokens** (rewritten `globals.css`): deep-navy palette
  (#0a1628-range), rail-gradient accent (blue→cyan), glass surfaces
  (translucent white, backdrop-blur), light content surfaces for legacy
  WordPress HTML readability, Thai-friendly font stack (IBM Plex Sans Thai /
  Noto Sans Thai via next/font with system fallbacks).
- **Shell**: dark sticky header with rail-line motif, glassy dropdown nav,
  TH/EN switch; dark footer with gradient topline.
- **Home**: dark gradient hero (headline, search box, CTA buttons), stats band
  (record counts from DB), glassy cards for latest news + publications; the
  imported home content still renders below (parity).
- **Content pages**: dark hero with breadcrumb + title; body in a light card;
  glassy sidebar navigation; related/latest grids with kind badges (PDF/news).
- **Search**: redesigned results page backed by pg_trgm ranking with the same
  title-first ordering semantics as today.

### Deploy

- `Dockerfile`: `prisma generate` before build; drop the wp-content.json guard
  (no longer a runtime input).
- `docker-compose.yml`: add `db` service + volume; app gets `DATABASE_URL`,
  `depends_on: db (healthy)`.
- `.github/workflows/deploy-test.yml`: after checkout, run
  `npx prisma migrate deploy` against `127.0.0.1:5432`, then build/up as today.
  `.env` (with `DATABASE_URL`, `POSTGRES_PASSWORD`) is placed once in the
  runner checkout (it persists; `clean: false`), same pattern as mirrored
  assets. Never committed.
- One-time production seed: bring up `db`, run migrations, `npm run db:seed`.

## Verification

1. `npm test && npm run lint && npm run typecheck && npm run format:check &&
   npm run build` — all green.
2. Local container audit: `npm run audit:parity -- --new-base
   http://127.0.0.1:3020` → **0 fail** (warns are cosmetic).
3. Push → CI deploy → `npm run audit:parity -- --new-base
   https://test.rtrda.or.th` → 0 fail (modulo the two known Cloudflare-cached
   404s pending manual purge).
4. Manual spot-check of redesign on key pages (home TH/EN, a post, a flipbook,
   search, category pagination).

## Risks / mitigations

- *Parity audit similarity drops from redesign* → content HTML untouched,
  `.content-main` selector kept; containment metric ignores added chrome.
- *DB empty/unreachable at runtime* → compose `depends_on` healthy gate;
  graceful 404 only for genuinely missing paths; deploy verification catches it.
- *ISR cache staleness after DB edits* → 5-minute revalidate; acceptable for a
  reference site; can add on-demand revalidation later.
- *Future Postgres major upgrades* → named volume + documented dump/restore in
  README.

# Redesign + Postgres Content DB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move content from the build-time JSON manifest into Postgres (DB becomes
source of truth) and redesign the front-end in the "modern tech institute"
direction, with every URL path unchanged and `audit:parity` still reporting 0 fail.

**Architecture:** Postgres 17 runs as a compose service; Prisma is the
schema/client layer; a one-time seed loads the audited `wp-content.json` into the
DB. A new `src/lib/db/` layer replaces `loadManifest()` with targeted queries and
assembles per-page view models; routes become ISR-on-demand (`revalidate = 300`)
so `next build` never touches the DB. Components become presentational and get
restyled (dark-navy/glass design) without touching content HTML, the
`.content-main` wrapper, or the `<title> | RTRDA` pattern (parity audit contracts).

**Tech Stack:** Next.js 16 App Router (standalone), Prisma 6 + @prisma/client,
Postgres 17 (pg_trgm for Thai trigram search), existing vitest/eslint/prettier
gates, docker compose + self-hosted runner deploy.

Spec: `docs/superpowers/specs/2026-06-13-redesign-and-postgres-design.md`
(one deviation: navigation/counts/generatedAt live in a `SiteMeta` key/JSON table
instead of a `NavigationItem` table — the nav tree is read-only display data).

**Execution notes (read first):**

- AGENTS.md: this Next.js version differs from training data — read
  `node_modules/next/dist/docs/` for ISR/`generateStaticParams`/metadata-route
  segment config before writing route code.
- Vitest must stay DB-free (tests run inside `docker build`). DB correctness is
  covered by `audit:parity` against the running container.
- Never print values from `.env`.

---

### Task 1: Postgres service, Prisma schema, first migration

**Files:**
- Modify: `docker-compose.yml` (add `db` service + volume)
- Modify: `.env` (append `POSTGRES_PASSWORD`, `DATABASE_URL` — never echo)
- Create: `prisma/schema.prisma`
- Create: `prisma/migrations/*` (init + pg_trgm)
- Modify: `package.json` (prisma deps + `db:*` scripts)
- Modify: `.dockerignore` / `.prettierignore` (exclude `prisma/migrations` from prettier)

- [ ] **Step 1: deps + scripts**

```bash
cd /srv/workspace/web-app-rtrda && npm install --save-dev prisma && npm install @prisma/client
```

Add scripts: `"db:migrate": "prisma migrate deploy"`, `"db:seed": "node scripts/seed-db.mjs"`.

- [ ] **Step 2: compose `db` service**

```yaml
  db:
    image: postgres:17-alpine
    container_name: web-app-rtrda-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: rtrda
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: rtrda
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - rtrda-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U rtrda -d rtrda"]
      interval: 10s
      timeout: 5s
      retries: 10

volumes:
  rtrda-db-data:
    name: rtrda-db-data
```

App service gains `DATABASE_URL: postgresql://rtrda:${POSTGRES_PASSWORD}@db:5432/rtrda`
and `depends_on: { db: { condition: service_healthy } }`.

- [ ] **Step 3: `.env`** — generate password with `openssl rand -hex 24`, append
  `POSTGRES_PASSWORD=...` and `DATABASE_URL=postgresql://rtrda:...@127.0.0.1:5432/rtrda`
  (host form, used by prisma CLI + seed + workflow).

- [ ] **Step 4: schema.prisma** — models mirror `src/lib/wp/types.ts` 1:1:

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

model ContentRecord {
  id              String  @id
  wpId            String
  language        String
  kind            String
  path            String  @unique
  sourceUrl       String
  title           String
  excerpt         String
  contentHtml     String
  searchText      String  @default("")
  date            String
  modified        String
  parentPath      String?
  categoryIds     Int[]
  featuredMediaId Int?
  authorId        Int?
  @@index([language, kind, date])
  @@index([parentPath])
}

model Category {
  id       Int    @id
  language String
  path     String
  slug     String
  name     String
  count    Int
  parent   Int
}

model MediaAsset {
  id        String @id
  sourceUrl String
  localPath String
  title     String
  alt       String
  width     Int?
  height    Int?
  mimeType  String
}

model Download {
  id          String   @id
  sourceUrl   String
  localPath   String
  fileName    String
  mimeType    String
  sizeBytes   Int
  title       String
  group       String
  sourcePages String[]
}

model SiteMeta {
  key   String @id
  value Json
}
```

(`date`/`modified` stay ISO strings — components already parse with `new Date()`,
and ISO strings sort correctly in `ORDER BY`.)

- [ ] **Step 5: migrations** — `docker compose up -d db`, wait healthy, then
  `npx prisma migrate dev --name init --create-only`; append to the generated SQL:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "ContentRecord_title_trgm" ON "ContentRecord" USING GIN (title gin_trgm_ops);
CREATE INDEX "ContentRecord_searchText_trgm" ON "ContentRecord" USING GIN ("searchText" gin_trgm_ops);
```

then `npx prisma migrate dev`. Verify: `npx prisma migrate status` clean.

- [ ] **Step 6: Commit** `feat(db): postgres service + prisma schema with pg_trgm`

---

### Task 2: Seed script (manifest → DB)

**Files:**
- Create: `scripts/seed-db.mjs`
- Create: `scripts/seed-db-helpers.mjs` (pure transforms)
- Test: `scripts/seed-db-helpers.test.mjs`

- [ ] **Step 1: failing test** for `manifestToRows(manifest)` — returns
  `{ records, categories, media, downloads, meta }` with `wpId`/media `id`
  coerced to `String`, `searchText` defaulting `""`, `meta` containing
  `generatedAt`, `source`, `navigation` entries.

- [ ] **Step 2: run** `npx vitest run scripts/seed-db-helpers.test.mjs` → FAIL.

- [ ] **Step 3: implement** `manifestToRows` (pure, no Prisma import).

- [ ] **Step 4: tests pass.**

- [ ] **Step 5: `scripts/seed-db.mjs`** — reads `src/data/wp-content.json`,
  connects via `@prisma/client`, then in order: `deleteMany` each table,
  `createMany` in chunks of 200 (contentHtml is large), upsert SiteMeta rows.
  Logs row counts only. Idempotent full reload.

- [ ] **Step 6: run seed** `npm run db:seed`; verify counts match manifest
  (`psql`-free check: small node -e with prisma count vs JSON lengths).

- [ ] **Step 7: Commit** `feat(db): seed script loading wp-content.json into postgres`

---

### Task 3: DB read layer (`src/lib/db/`)

**Files:**
- Create: `src/lib/db/client.ts` (PrismaClient singleton via `globalThis`)
- Create: `src/lib/db/queries.ts`
- Create: `src/lib/db/page-data.ts`
- Test: `src/lib/db/page-data.test.ts` (pure assembly helpers only — mock query results)

- [ ] **Step 1: client.ts**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 2: queries.ts** — all return `WpContentRecord`-shaped objects
  (row maps 1:1; `wpId` stays string). Functions:
  `getRecordByPath(path)`, `recordExists(path)`, `getChildren(parentPath, language)`,
  `getLatestPosts(language, limit = 6)`, `getTopLevelPages(language)`,
  `getNavigation(language)` (SiteMeta), `getMediaByIds(ids: number[])`,
  `getAllForSitemap()` (`{ path, modified }` only), `getStats()`
  (`{ posts, pages, flipbooks, downloads }` counts), `getGeneratedAt()`, and

```ts
export async function searchRecords(term: string, language: WpLanguage, limit = 80) {
  // rank 0: title/excerpt substring; rank 1: body substring; rank 2: fuzzy title
  return prisma.$queryRaw`
    SELECT *, CASE
      WHEN title ILIKE ${"%" + term + "%"} OR excerpt ILIKE ${"%" + term + "%"} THEN 0
      WHEN "searchText" ILIKE ${"%" + term + "%"} THEN 1
      ELSE 2 END AS rank
    FROM "ContentRecord"
    WHERE language = ${language} AND (
      title ILIKE ${"%" + term + "%"} OR excerpt ILIKE ${"%" + term + "%"}
      OR "searchText" ILIKE ${"%" + term + "%"}
      OR similarity(title, ${term}) > 0.25)
    ORDER BY rank ASC, date DESC LIMIT ${limit}`;
}
```

- [ ] **Step 3: page-data.ts** — view-model assembly replacing manifest helpers:
  `buildShellData(path)` → `{ language, alternatePath, navItems, footerNav, generatedAt }`
  (counterpart logic = existing `counterpartPath` semantics via `recordExists`;
  nav = SiteMeta navigation if present else `PRIMARY_NAV` + `getChildren` fallback,
  reusing mapping logic from `presentation.ts`);
  `getPageData(path)` → `{ record, children: Card[], latest: Card[], sidebarItems,
  parentTitle, shell }` where `Card = { record, imagePath }` (batch
  `getMediaByIds` + existing `selectFallbackAsset`). Sidebar = children else
  siblings (same as `getSidebarItems`). TDD the pure helpers (card mapping,
  counterpart path derivation) with mocked rows.

- [ ] **Step 4: gates** `npm test && npm run typecheck` pass. **Commit**
  `feat(db): runtime read layer and page view models`

---

### Task 4: Routes + components read from the DB

**Files:**
- Modify: `src/app/[[...slug]]/page.tsx`, `src/app/search/page.tsx`,
  `src/app/sitemap.ts`, `src/app/robots.ts`
- Modify: `src/components/{site-shell,content-page,search-results,article-card}.tsx`,
  `src/components/site-helpers.ts`
- Delete: `loadManifest` path of `src/lib/wp/content-store.ts` (keep/move pure helpers
  + update `content-store.test.ts`); `src/data/wp-content.json` stays as seed artifact.

- [ ] **Step 1:** `[[...slug]]/page.tsx` — replace manifest loading with
  `getPageData(path)`; **route segment config**:

```ts
export const revalidate = 300;
export const dynamicParams = true;
export async function generateStaticParams() {
  return []; // nothing prerendered at build; DB not needed by `next build`
}
```

  (verify against `node_modules/next/dist/docs/` that this is still the
  ISR-on-demand pattern in this Next version).
- [ ] **Step 2:** components become presentational: `SiteShell({ children, shell })`,
  `ContentPage({ data })`, `ArticleCard({ record, imagePath })`,
  `SearchResults({ results, query, language, shell })`; `site-helpers.ts` keeps only
  `formatDate`/`currentLanguage` (rest moved into `page-data.ts`).
- [ ] **Step 3:** search page calls `searchRecords`; sitemap/robots use
  `getAllForSitemap` with `export const dynamic = "force-dynamic"` (or revalidate
  per Next 16 docs); home stats from `getStats()`.
- [ ] **Step 4:** full gates: `npm test && npm run lint && npm run typecheck &&
  npm run format:check && npm run build` — build must succeed **with db stopped**
  (proves no build-time DB dependency), then `npm run dev` smoke vs db up:
  `/`, `/en`, one post, `/search?q=ราง` return 200 with content.
- [ ] **Step 5: Commit** `feat(db): serve all routes from postgres (ISR, db is source of truth)`

---

### Task 5: "Modern tech institute" redesign

**Files:**
- Modify: `src/app/layout.tsx` (next/font: `IBM_Plex_Sans_Thai` 400/500/600/700 +
  CSS variable), `src/app/globals.css` (rewrite on top of new tokens),
  all `src/components/*.tsx` markup classes, home sections in `content-page.tsx`.

**Hard constraints (parity audit):** keep `<main>`, keep `.content-main` wrapping
the rendered `record.contentHtml`, keep title template `… | RTRDA`, keep imported
home content rendered, light surface behind legacy WordPress HTML.

- [ ] **Step 1: design tokens** (top of `globals.css`):

```css
:root {
  --navy-950: #060d1d; --navy-900: #0a1628; --navy-800: #102341;
  --rail-gradient: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%);
  --accent: #38bdf8; --accent-strong: #2563eb;
  --surface: #ffffff; --surface-muted: #f1f5f9;
  --glass: rgba(255, 255, 255, 0.08); --glass-border: rgba(255, 255, 255, 0.16);
  --ink: #0f172a; --ink-muted: #475569; --on-dark: #e2e8f0;
  --radius-lg: 1rem; --radius-md: 0.625rem;
  --shadow-card: 0 8px 30px rgba(2, 8, 23, 0.08);
}
```

- [ ] **Step 2:** shell — dark sticky header (`--navy-900`, blur backdrop), glassy
  dropdowns, gradient rail-line under the header, TH/EN pill switch; dark footer
  (`--navy-950`) with gradient topline.
- [ ] **Step 3:** home — dark gradient hero (headline + sub + search form posting to
  `/search` + two CTAs), stats band (`getStats()` counts: posts/pages/flipbooks/
  downloads with TH/EN labels), glassy latest-news/publications cards; imported home
  HTML renders below in a light section.
- [ ] **Step 4:** content pages — dark page hero (breadcrumb, title, date), light
  content card, glassy sidebar, kind badges on cards (PDF for flipbook, ข่าว/News
  for post); search page restyled to match.
- [ ] **Step 5:** verify visually (playwright screenshots of `/`, `/en`, a post, a
  flipbook, search at 1440px and 390px); run full gates; **Commit**
  `feat(design): modern tech-institute redesign (dark navy, glass, rail gradient)`

---

### Task 6: Docker, CI, deploy config

**Files:**
- Modify: `Dockerfile`, `docker-compose.yml` (done in Task 1), `next.config.ts`,
  `.github/workflows/deploy-test.yml`, `README.md`, `AGENTS.md`

- [ ] **Step 1: Dockerfile** — deps stage: copy `prisma/` + `RUN npx prisma generate`
  after `npm ci`; builder: drop the wp-content.json guard; runner: drop
  `COPY src/data`, add `apt-get install -y --no-install-recommends openssl`.
- [ ] **Step 2: next.config.ts** — ensure Prisma engines reach standalone output:

```ts
outputFileTracingIncludes: {
  "/**": ["./node_modules/.prisma/client/**"],
},
```

- [ ] **Step 3: workflow** — remove "Import WordPress content" step; after
  `npm ci` add:

```yaml
      - name: Apply database migrations
        run: |
          docker compose up -d db
          npx prisma migrate deploy
```

  (`DATABASE_URL` comes from `.env` in the runner checkout.)
- [ ] **Step 4:** copy `.env` once into the runner checkout dir (find it under
  `/srv/workspace/actions-runner-web-app-rtrda/_work/`); persists via `clean: false`.
  Document in README: `.env` keys, seed/migrate flow, dump/restore
  (`docker exec web-app-rtrda-db pg_dump -U rtrda rtrda > backup.sql`).
- [ ] **Step 5:** update AGENTS.md project rules: DB is source of truth;
  `wp-content.json` is the frozen import artifact used only by `db:seed`;
  schema changes go through `prisma migrate`; parity gate unchanged.
- [ ] **Step 6: Commit** `feat(deploy): postgres-aware docker build and CI migrate step`

---

### Task 7: Local verification gate

- [ ] `docker compose up -d --build web-app-rtrda-test` (db already seeded).
- [ ] All five gates green; container healthy.
- [ ] `npm run audit:parity -- --new-base http://127.0.0.1:3020` → **0 fail**
  (warns cosmetic only). Fix anything that regressed before proceeding.
- [ ] Commit any fixes.

### Task 8: Deploy + public verification

- [ ] Push to `main` (token from `.env`, masked); watch the Actions run via GitHub
  REST API until success.
- [ ] `npm run audit:parity -- --new-base https://test.rtrda.or.th` → 0 fail
  (the two known Cloudflare-cached 404s may still appear until manually purged).
- [ ] Playwright spot-check of the live redesign (home TH/EN, post, flipbook, search).
- [ ] Final summary to user.

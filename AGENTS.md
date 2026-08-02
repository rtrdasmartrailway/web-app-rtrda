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

---

## Paperclip RTRDA Web Dev Team Policy

This workspace is also used by the Paperclip RTRDA Web Dev Team.

### Mission

- Complete human-assigned website update tasks on **test only**.
- Target runtime: `https://test.rtrda.or.th` on `rtrda-dgt-server`.
- Worktree: `/srv/workspace/web-app-rtrda`.

### Hard Boundary

Paperclip agents must **not** promote production.

Forbidden unless พี่ J explicitly asks Valent outside Paperclip with `push rtrda production`:

- Do not push `main`.
- Do not run GitHub Actions workflow `Deploy rtrda.or.th production`.
- Do not deploy to `rtrda.or.th` or `www.rtrda.or.th`.
- Do not SSH to `rtrda02` for production changes.
- Do not edit Cloudflare production ingress for `rtrda.or.th` / `www.rtrda.or.th`.

If a human asks for production from inside Paperclip, prepare a handoff note only. Production push is performed by Valent after พี่ J says `push rtrda production`.

### Required Verification Before Reporting Done

- Inspect current git status before editing.
- Preserve unrelated local changes.
- Run focused tests appropriate to the change: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` when relevant.
- Verify `https://test.rtrda.or.th/healthz` returns 200.
- For content/UI changes, verify the real test URL/page, not only the database or source file.
- Never print secret values from `.env`; mention key names only.

## RTRDA DGT Test Branch Team Policy

This DGT workspace is the team test workspace for `test.rtrda.or.th`.

- Default branch for team/opencode/Paperclip work: `test`.
- Team agents may edit, commit, build, seed, restart, and verify the test environment on DGT.
- Do not push or deploy `main`/production from this workspace unless พี่ J explicitly says to push production.
- `check web test update` is a permanently read-only deployed-state audit. Run the release worker and compare the running Test container SHA against the deployed Cloud/RTRDA02 production release SHA; never push or deploy while checking.
- Ignore workspace-only commits when reporting deployed updates. A Test release is promotable only when the container SHA label equals `origin/test` and both production targets are healthy/in parity.
- When production is approved for an exact deployed Test SHA, use `scripts/rtrda-release-worker.mjs promote`; the `main` production workflow must deploy the same release to both Cloud primary and RTRDA02 fallback. See `docs/RTRDA_RELEASE_PIPELINE.md`.
- Do not expose secrets, tokens, passwords, private keys, or auth stores.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project rules

- WordPress (www.rtrda.or.th) is the content source of truth. URL parity is
  the core requirement: every old URL must serve the same information here.
- Never hand-edit generated artifacts: `src/data/wp-content.json`,
  `public/wp-content/uploads/`, `public/sdc-downloads/`. Change
  `scripts/import-wordpress*.mjs` and re-run `npm run import:wordpress`.
- `npm run audit:parity` is the regression gate for content/URL changes.
  Run it against a locally built container (127.0.0.1:3020) before pushing;
  it must report 0 fail.
- Before claiming done: `npm test && npm run lint && npm run typecheck &&
  npm run format:check && npm run build`.
- Keep Thai/English route parity (`/en/...` mirrors) when adding routes.
- Do not expose secrets from `.env` (GitHub token) in code, logs or commits.

## Layout

- `scripts/` — importer + parity audit (ESM `.mjs`, vitest `*.test.mjs`)
- `src/lib/wp/` — typed manifest access and presentation helpers
- `src/components/` — kebab-case server components (site-shell, content-page,
  search-results, article-card, intranet-*)
- `src/app/` — App Router; `[[...slug]]` serves all migrated records

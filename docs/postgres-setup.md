# PostgreSQL Setup Guide (Linux)

Complete steps to initialize the RTRDA database on a fresh Linux server for development/testing.

---

## 1. Install PostgreSQL

**Ubuntu / Debian:**
```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

**RHEL / Rocky / AlmaLinux:**
```bash
sudo dnf install -y postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
sudo systemctl enable --now postgresql
```

---

## 2. Create the database and user

```bash
sudo -u postgres psql <<'SQL'
CREATE DATABASE rtrda;
CREATE USER rtrda WITH PASSWORD 'changeme';
GRANT ALL PRIVILEGES ON DATABASE rtrda TO rtrda;
\c rtrda
GRANT ALL ON SCHEMA public TO rtrda;
SQL
```

> You can use any username/password — just update `DATABASE_URL` to match.

---

## 3. Configure environment

Create `.env.local` in the project root:

```bash
# TCP connection (most common for remote or separate-user setup):
DATABASE_URL=postgresql://rtrda:changeme@localhost:5432/rtrda

# Unix socket (if app and DB are on the same machine, same OS user):
DATABASE_URL=postgres:///rtrda?host=/var/run/postgresql
```

---

## 4. Install Node dependencies

```bash
npm install
```

---

## 5. Push schema (creates all 24 tables)

> **One-command setup:** `npm run db:setup` runs the push + content seed + admin
> in order (`drizzle-kit push && npm run db:seed:all && npm run db:seed:admin`).
> The steps below are the manual equivalent.

```bash
npm run db:push        # alias for `drizzle-kit push`
```

This reads `src/db/schema.ts` and creates all tables against the database in
`DATABASE_URL`. There are **no migration files** — `schema.ts` is the single source
of truth and `push` syncs the database to it.

Tables created:

| Group | Tables |
|---|---|
| Content (bilingual, one row holds Thai + English) | `news`, `featured_projects`, `procurement`, `publications`, `pages` |
| Content (one row per language) | `flipbooks`, `jobs`, `faq` |
| Documents / media | `media`, `downloads` |
| Site config | `events`, `partners`, `hero_slides`, `navigation`, `site_meta` |
| Auth (Better Auth) | `user`, `session`, `account`, `verification` |
| Legacy WordPress import | `wp_content`, `wp_media`, `wp_downloads`, `wp_navigation`, `wp_meta` |

> `drizzle-kit push` is idempotent — safe to re-run on an existing database. When a
> column type/shape changes (e.g. the bilingual `title_th`/`title_en` columns), push
> will prompt before dropping the old columns.

---

## 6. Seed the database

Load the dedicated content tables from `src/data/wp-content.json`:

```bash
npm run db:seed:all     # media, pages, news, featured_projects, flipbooks, downloads, navigation
npm run db:seed:admin   # create the admin user
```

`db:seed:all` chains the individual seeders (each is also runnable on its own, e.g.
`npm run db:seed:news`). All scripts use upserts, so they are safe to re-run.

Notes:
- **`procurement`, `publications`, `jobs`, `faq`, `events`, `partners`, `hero_slides`**
  have no seed script — they start empty and are populated through the intranet CMS
  (`/rtrdaintranet/manage/...`).
- `npm run db:seed` (the `wp_*` importer) is **legacy** — the app now reads the
  dedicated tables above, not the `wp_content` tables. Run it only if you need the old
  WordPress mirror.

---

## 7. Verify

```bash
psql $DATABASE_URL -c "\dt"
# → should list 24 tables

psql $DATABASE_URL -c "SELECT count(*) FROM news;"
# → 508

psql $DATABASE_URL -c "SELECT count(*) FROM featured_projects;"
# → 6

# Bilingual columns exist on the content tables:
psql $DATABASE_URL -c "\d procurement"
# → columns include title_th, title_en, excerpt_th, excerpt_en (no `language` / `title`)
```

---

## 8. Start the app

```bash
npm run dev
# → http://localhost:3000
```

---

## Troubleshooting

| Error | Fix |
|---|---|
| `FATAL: role "rtrda" does not exist` | Re-run step 2 |
| `extension "pg_trgm" does not exist` | `sudo apt install postgresql-contrib` then re-run `npm run db:seed` |
| `drizzle-kit: DATABASE_URL is undefined` | Check `.env.local` exists; value must not be wrapped in quotes |
| `permission denied for schema public` | Run `GRANT ALL ON SCHEMA public TO rtrda;` inside psql |
| `Connection refused on port 5432` | `sudo systemctl start postgresql` |
| `peer authentication failed` | Use TCP URL (`postgresql://user:pass@localhost/rtrda`) instead of socket URL |

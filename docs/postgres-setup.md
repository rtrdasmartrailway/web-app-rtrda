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

## 5. Push schema (creates all 19 tables)

```bash
npx drizzle-kit push
```

This reads `src/db/schema.ts` and creates all tables against the database in `DATABASE_URL`.

Tables created:

| Group | Tables |
|---|---|
| Legacy WordPress | `wp_content`, `wp_media`, `wp_downloads`, `wp_navigation`, `wp_meta` |
| New content | `news`, `featured_projects`, `procurement`, `publications`, `flipbooks`, `pages`, `jobs`, `faq` |
| Site config | `events`, `partners`, `hero_slides`, `navigation`, `site_meta`, `media` |

> `drizzle-kit push` is idempotent — safe to re-run on an existing database.

---

## 6. Seed the database

Run the three seed scripts **in this order**:

```bash
# 1. Import all WordPress content (~700 records) and create full-text search indexes
npm run db:seed

# 2. Populate featured_projects table (6 records)
npm run db:seed:featured-projects

# 3. Populate news table (508 records — Thai + English)
npm run db:seed:news
```

All scripts read from `src/data/wp-content.json` and use upserts, so they are safe to re-run.

---

## 7. Verify

```bash
psql $DATABASE_URL -c "\dt"
# → should list 19 tables

psql $DATABASE_URL -c "SELECT count(*) FROM wp_content;"
# → ~700

psql $DATABASE_URL -c "SELECT count(*) FROM news;"
# → 508

psql $DATABASE_URL -c "SELECT count(*) FROM featured_projects;"
# → 6
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

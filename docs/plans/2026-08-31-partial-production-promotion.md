# Partial Commit Production Promotion Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task. Group policy does not permit delegation, so execute inline with the same TDD and two-stage review gates.

**Goal:** Add fail-closed partial commit promotion with isolated RC verification and mandatory RTRDA02 pre-deploy backups.

**Architecture:** Extend the existing worker additively, reconstruct an exact candidate tree from audited Production plus ordered Test commits, verify the candidate in a DGT-local RC compose project, then reuse the existing exact-tree GitHub/dual-target deployment machinery. Add a workflow backup gate before any Production replacement.

**Tech Stack:** Node.js 22, Vitest, Bash, Docker Compose, GitHub Actions, Git/GitHub APIs, PostgreSQL 17.

---

### Task 1: Lock candidate selection and identity behavior

**Files:**
- Modify: `scripts/rtrda-release-worker.test.ts`
- Modify: `scripts/rtrda-release-worker.mjs`

1. Add failing tests for repeated `--commit` parsing, full-SHA uniqueness, single-parent requirement, Test reachability, candidate identity, and stale Production rejection.
2. Run `npm test -- scripts/rtrda-release-worker.test.ts` and verify RED due to missing exports.
3. Implement pure helpers only.
4. Re-run focused tests and verify GREEN.
5. Keep existing exact promotion tests green.

### Task 2: Reconstruct partial candidates safely

**Files:**
- Modify: `scripts/rtrda-release-worker.test.ts`
- Modify: `scripts/rtrda-release-worker.mjs`

1. Add failing tests/source assertions for temporary worktree creation from audited Production, ordered cherry-picks, explicit clean empty-patch skip, conflict abort, deterministic candidate commit, and cleanup.
2. Verify RED.
3. Implement `buildPartialCandidate` with injected runner where practical.
4. Verify focused tests GREEN.
5. Run a read-only/dry candidate build against known content commits and assert no Board paths.

### Task 3: Add isolated RC compose and verification

**Files:**
- Create: `docker-compose.release-candidate.yml`
- Modify: `scripts/rtrda-release-worker.test.ts`
- Modify: `scripts/rtrda-release-worker.mjs`

1. Add failing tests for candidate SHA/tree/revision/health binding and source assertions for port `127.0.0.1:3022`, isolated DB volume, and RC-specific names.
2. Verify RED.
3. Add compose configuration and worker RC lifecycle.
4. Run focused tests GREEN.
5. Validate compose config without exposing environment values.

### Task 4: Add partial dry-run and execute command

**Files:**
- Modify: `scripts/rtrda-release-worker.test.ts`
- Modify: `scripts/rtrda-release-worker.mjs`
- Modify: `docs/RTRDA_RELEASE_PIPELINE.md`

1. Add failing tests for `promote-partial`, required approval SHA on execute, idempotent branch/PR identity, fresh evidence recheck, and preservation of exact `promote` behavior.
2. Verify RED.
3. Implement dry-run JSON and execute flow by parameterizing exact-tree release machinery.
4. Verify focused and full worker tests GREEN.
5. Update operator documentation with exact commands and recovery semantics.

### Task 5: Add mandatory RTRDA02 backup gate

**Files:**
- Create: `.github/scripts/backup-rtrda02-production.sh`
- Create: `.github/scripts/backup-rtrda02-production.test.ts`
- Modify: `.github/workflows/deploy-production.yml`
- Modify: `.github/workflows/deploy-production.test.ts`

1. Add failing tests for full-SHA validation, path containment, DB readiness, non-empty dump/assets, manifest, checksums, free-space threshold, and retention preserving at least three successful releases plus immediate rollback.
2. Add failing workflow source tests requiring backup before both deploy steps.
3. Verify RED.
4. Implement the backup script without reading/logging secret values; consume the target `.env` only inside the remote process.
5. Insert the workflow backup step before Cloud and RTRDA02 replacement.
6. Verify tests GREEN.

### Task 6: Full verification and independent review

**Files:** all changed files

1. Run Prisma generation before trusting type failures.
2. Run worker/backup/workflow focused tests.
3. Run full `npm test`, lint, typecheck, format check, security audit, and build.
4. Scan added lines for secrets, unsafe shell interpolation, path traversal, direct one-target deploy, and force pushes.
5. Review spec compliance, then code quality/security; fix all blocking findings and rerun gates.
6. Commit the verified infrastructure change as one isolated commit.

### Task 7: Bootstrap on Test and validate current content candidate

1. Push the isolated infrastructure commit to `test` through the approved RTRDA credential wrapper.
2. Verify Test workflow success and full deployed Test SHA.
3. Update `/srv/workspace/bin/rtrda-release-worker.mjs` from that exact repository commit and verify checksum equality.
4. Dry-run `promote-partial` with the infrastructure commit plus the seven selected content commits (recording any verified empty-patch skip explicitly).
5. Verify selected/skipped commits, candidate SHA/tree, changed files with no Board paths, all validation gates, RC revision, and RC health.

### Task 8: Promote and verify Production

1. Execute `promote-partial` with the exact approved candidate SHA.
2. Verify the RTRDA02 backup manifest/checksums and source Production SHA before replacement.
3. Watch the bounded Production workflow run.
4. Verify Cloud/RTRDA02 Git and release markers equal merged main SHA.
5. Verify direct/public health, security checks, parity, watchdog, and backup evidence.
6. Report PR, workflow run, merged/deployed SHA, backup identifier, and any retained baseline debt.

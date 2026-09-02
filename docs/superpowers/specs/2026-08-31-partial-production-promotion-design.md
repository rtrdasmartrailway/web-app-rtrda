# Partial Commit Production Promotion Design

**Date:** 2026-08-31
**Status:** Approved by owner in Telegram Web-RTRDA thread 15

## Goal

Extend the canonical RTRDA release worker so an owner can select an ordered set of full commit SHAs from the currently deployed Test history, reconstruct a candidate from the audited Production SHA, verify it in an isolated Release Candidate (RC) runtime, back up RTRDA02, and promote the exact verified candidate to both Production targets without including unselected Test changes.

## Compatibility

The existing `check` and exact-Test `promote --approved-sha` contracts remain unchanged. Partial promotion is additive through `promote-partial`. Existing Production workflow dispatch, exact merge identity, recovery checks, dual-target deployment, and parity verification remain authoritative.

## Command Contract

Dry run:

```bash
node scripts/rtrda-release-worker.mjs promote-partial \
  --commit <FULL_SHA> [--commit <FULL_SHA> ...] \
  --repo /srv/workspace/web-app-rtrda
```

Execute:

```bash
node scripts/rtrda-release-worker.mjs promote-partial \
  --commit <FULL_SHA> [--commit <FULL_SHA> ...] \
  --approved-candidate-sha <FULL_SHA> \
  --repo /srv/workspace/web-app-rtrda \
  --execute
```

The dry run creates no GitHub or Production mutation. It reconstructs the candidate in a temporary worktree, reports selected/skipped commits, changed files, candidate tree and deterministic candidate SHA, runs validation, verifies the isolated RC runtime, and returns the approval SHA. Execute must reproduce the same identity from fresh live evidence.

## Commit Selection and Candidate Identity

1. Collect fresh deployed Test and Production evidence.
2. Require healthy Test and healthy, in-parity Production.
3. Require each selected value to be a unique 40-character lowercase Git SHA.
4. Require each selected commit to be reachable from the deployed Test SHA and to have exactly one parent. Merge commits are rejected.
5. Start a temporary worktree at the audited Production SHA.
6. Cherry-pick selected commits in the supplied order.
7. A patch already present in Production may be explicitly skipped only when Git reports an empty cherry-pick and the worktree/index are clean.
8. Any conflict, dirty residue, missing object, or unexpected parent count aborts the operation.
9. Create one deterministic candidate commit whose only parent is audited Production and whose tree is the reconstructed worktree tree. The candidate commit message records selected and skipped source SHAs without secrets.
10. Candidate identity binds Production base SHA, deployed Test SHA, ordered selected SHAs, candidate tree, and candidate SHA.

## Release Candidate Runtime

RC runs on DGT independently from Test:

- Compose project and container names are RC-specific.
- App binds only to `127.0.0.1:3022`.
- PostgreSQL uses a dedicated RC volume and host port.
- RC uses an isolated candidate worktree and never changes `/srv/workspace/web-app-rtrda` or the Test containers.
- Validation runs `npm ci`, Prisma generation, migrations/seed, tests, lint, typecheck, format check, security audit, and build before RC startup.
- The RC container image revision label must equal the approved candidate SHA.
- Local RC health must pass before any GitHub mutation.
- Cleanup occurs after final success or before a fresh retry; failures retain enough bounded logs/evidence for diagnosis but never mutate Production.

## GitHub and Production Flow

1. Create/reuse `release/partial-<candidate-sha>` only when its commit parent/tree match the audited Production and reconstructed candidate.
2. Create/reuse a PR to `main`; reject stale or mismatched PR identity.
3. Recheck live Test reachability, Production SHA/parity, RC revision/tree/health, and current `main` before mutation.
4. Create a two-parent merge commit `[audited Production, release head]` with the exact candidate tree.
5. Atomically fast-forward `main` with `force=false`.
6. Dispatch the existing `deploy-production.yml` for the exact merge SHA.
7. Reuse only an in-flight run with the same display identity.
8. Verify Cloud and RTRDA02 Git/release markers, direct health, public health, security headers, parity, and RTRDA02 watchdog.

## Mandatory RTRDA02 Backup Gate

Before either Production target is replaced, the Production workflow invokes a versioned backup script on RTRDA02. The backup is bound to the exact pre-deploy Production SHA and stored under an approved backup root configured on RTRDA02.

Required artifacts:

- PostgreSQL custom-format dump from the running Production database.
- Hard-link snapshot of uploads and static downloads on RTRDA02, plus a full per-file checksum inventory. This preserves pre-deploy inodes while consuming additional space only for files replaced after deployment.
- Current compose file and non-secret release metadata.
- Current app image ID/tag and revision.
- `release-manifest.json` containing source Production SHA, target candidate SHA, timestamps, sizes, and artifact names.
- `SHA256SUMS` verified immediately after creation.

The gate fails closed on missing/malformed full SHA, wrong live marker, unhealthy database, empty dump/archive, insufficient free space, checksum failure, path escape, or incomplete manifest. Secrets and `.env` values are never copied into evidence or logs.

Retention keeps at least the three newest successful release backups and always preserves the immediate rollback backup. Cleanup runs only after successful post-deploy verification and never deletes the current or previous release backup.

## Rollback and Recovery

The existing exact merge recovery remains valid for partial candidates because the release/merge tree identity is still exact. A partial deployment can resume only when each target is on either the audited Production SHA or the verified merge SHA. Rollback uses the verified pre-deploy backup and previous immutable image/revision on both targets; one-target-only steady state is never accepted as success.

## Test Strategy

- Unit tests for argument parsing, uniqueness/full-SHA validation, Test ancestry, merge rejection, empty-patch classification, candidate identity, stale base rejection, RC evidence validation, backup manifest validation, and plan output.
- Source-level workflow tests that require backup before Cloud/RTRDA02 replacement and require post-backup checksum verification.
- Shell tests for backup path safety, manifest/checksum behavior, empty dump failure, and retention preservation.
- Existing exact promotion tests remain green.
- Integration dry run on the current selected content commits proves changed files contain no Board paths.
- RC deployment verifies candidate revision and health before Production.
- Final live audit verifies both Production targets and public parity.

## Non-Goals

- Arbitrary branch promotion.
- Selecting merge commits.
- Bypassing owner approval of the exact candidate SHA.
- Mutating or replacing the Test environment during partial promotion.
- Backing up secret files or credential stores.

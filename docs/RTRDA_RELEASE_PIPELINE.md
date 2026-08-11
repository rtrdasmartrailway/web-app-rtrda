# RTRDA Web Release Pipeline

## Command contract

### `check web test update`

Read-only. Never push, rebuild, restart, merge, or dispatch a workflow.

Run the release worker on DGT:

```bash
cd /srv/workspace/web-app-rtrda
node /srv/workspace/bin/rtrda-release-worker.mjs check \
  --repo /srv/workspace/web-app-rtrda
```

The report is promotable only when all conditions are true:

1. The running `web-app-rtrda-test` container has a full
   `org.opencontainers.image.revision` SHA label.
2. That deployed SHA equals `origin/test`; commits merely present in the DGT
   worktree are ignored.
3. Local and public Test health pass (`127.0.0.1:3020` and
   `https://test.rtrda.or.th/healthz`).
4. Cloud primary Git SHA equals its release marker.
5. RTRDA02 fallback Git SHA equals its release marker.
6. Cloud and RTRDA02 are healthy and on the same production SHA.

Report the deployed Test SHA, deployed Production SHA, changed files, and any
blocker. If the Test container label is absent or `unknown`, fail closed; never
infer a release from workspace HEAD or container creation time.

### Deploy Test

Only a push to `test` triggers `.github/workflows/deploy-test.yml`. The workflow
labels the running container with the exact `${GITHUB_SHA}` and verifies the
label. A manual compose rebuild without `RTRDA_RELEASE_SHA` becomes `unknown`,
which intentionally blocks promotion.

### Promote Production

Requires explicit owner approval for the exact deployed Test SHA.

1. Save fresh check evidence to JSON.
2. Dry-run:

```bash
node scripts/rtrda-release-worker.mjs promote \
  --approved-sha <FULL_DEPLOYED_TEST_SHA> \
  --evidence release-evidence.json
```

3. Execute only after approval:

```bash
node scripts/rtrda-release-worker.mjs promote \
  --approved-sha <FULL_DEPLOYED_TEST_SHA> \
  --evidence release-evidence.json \
  --execute
```

The worker creates or reuses `release/exact-<TEST_SHA>` with the audited
Production SHA as its only parent and the exact deployed Test tree. It opens a
review PR and waits for its checks, creates and verifies the two-parent merge
commit, then updates `main` with GitHub's non-force atomic fast-forward API. A
concurrent `main` change therefore fails before mutation. The worker verifies
the merge parents/tree before manually dispatching `deploy-production.yml` for
the exact merge SHA. Retries reuse a verified merged PR and any successful or
in-flight exact workflow run only while that merge remains the current `main`;
failed runs may then be dispatched again. Historical ancestors are never
accepted as implicit rollbacks.

The production workflow has no `push` trigger. It accepts only an explicit,
required SHA and deploys that same verified release to both:

- Cloud primary: `100.77.64.92:3021`
- RTRDA02 on-premise fallback/redundant: `100.91.174.121:3021`

The workflow itself verifies both Git/release markers, direct health, public
`rtrda.or.th`/`www`, and the RTRDA02 production watchdog. Re-run `check` after
completion and require production parity.

## Safety

- `check` is permanently read-only.
- Unpushed/manual Test builds are not promotable.
- Production promotion requires an exact SHA, not a branch name alone.
- Never deploy directly to one production target; CI/CD must finish both Cloud
  and RTRDA02 or fail.
- Do not expose SSH keys, GitHub tokens, or environment values in output.

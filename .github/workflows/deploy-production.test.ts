import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  join(process.cwd(), ".github/workflows/deploy-production.yml"),
  "utf8",
);
const deployTargetScript = readFileSync(
  join(process.cwd(), ".github/scripts/deploy-preprod-target.sh"),
  "utf8",
);
const deployRemoteScript = readFileSync(
  join(process.cwd(), ".github/scripts/deploy-preprod-remote.sh"),
  "utf8",
);
const backupScript = readFileSync(
  join(process.cwd(), ".github/scripts/backup-rtrda02-production.sh"),
  "utf8",
);
const pruneBackupScript = readFileSync(
  join(process.cwd(), ".github/scripts/prune-rtrda02-backups.sh"),
  "utf8",
);

describe("Deploy rtrda.or.th production workflow", () => {
  it("deploys only an explicitly dispatched main SHA to cloud primary and rtrda02 fallback", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain("  push:");
    expect(workflow).toContain("required: true");
    expect(workflow).toContain('test -n "$INPUT_REF"');
    expect(
      workflow.match(/test "\$DEPLOY_SHA" = "\$\(git rev-parse origin\/main\)"/g),
    ).toHaveLength(3);
    expect(workflow).not.toContain(
      'git merge-base --is-ancestor "$DEPLOY_SHA" origin/main',
    );
    expect(workflow).toContain("TARGET_NAME=cloud");
    expect(workflow).toContain("TARGET_NAME=rtrda02");
    expect(workflow).toContain("http://100.77.64.92:3021/healthz");
    expect(workflow).toContain("http://100.91.174.121:3021/healthz");
    expect(workflow).toContain("https://rtrda.or.th/healthz");
    expect(workflow).toContain("https://www.rtrda.or.th/healthz");
    expect(workflow).toContain(
      "DATABASE_URL: postgresql://rtrda:***@localhost:5432/build",
    );
    expect(workflow).not.toContain("rtrda-web-prod-preview");
    expect(workflow).not.toContain("/srv/apps/web-app-rtrda-production");
    expect(workflow).not.toContain("http://100.91.174.121:3030/healthz");
  });

  it("builds before replacement and rolls back an unhealthy release", () => {
    expect(deployRemoteScript).toContain("PREVIOUS_COMPOSE");
    expect(deployRemoteScript).toContain('build "$APP_SERVICE"');
    expect(deployRemoteScript).toContain('up -d --no-build "$APP_SERVICE"');
    expect(deployRemoteScript).toContain("if ! docker compose");
    expect(deployRemoteScript).toContain("rollback_previous_release");
    expect(deployRemoteScript).toContain("restored previous healthy release");
  });

  it("stages ignored mirrored assets from the canonical test workspace before production deploy", () => {
    expect(workflow).toContain(
      "MIRRORED_ASSET_SOURCE=/srv/workspace/web-app-rtrda/public",
    );
    expect(workflow).toContain(
      'rsync -a "$MIRRORED_ASSET_SOURCE/sdc-downloads/" "$SOURCE_PATH/public/sdc-downloads/"',
    );
    expect(workflow).toContain(
      'rsync -a "$MIRRORED_ASSET_SOURCE/wp-content/uploads/" "$SOURCE_PATH/public/wp-content/uploads/"',
    );
    expect(workflow).toContain("mirrored_download_count");
  });

  it("preserves legacy host-mounted public assets during production deploy", () => {
    expect(deployTargetScript).toContain("public/wp-content/uploads/");
    expect(deployTargetScript).toContain("public/sdc-downloads/");
    expect(deployTargetScript).not.toContain("rsync -az --delete");
  });

  it("creates and verifies the RTRDA02 backup before replacing either production target", () => {
    const backupIndex = workflow.indexOf("Backup current RTRDA02 production");
    const cloudIndex = workflow.indexOf("Deploy exact main SHA to cloud primary");
    const rtrda02Index = workflow.indexOf("Deploy exact main SHA to rtrda02 fallback");
    expect(backupIndex).toBeGreaterThan(-1);
    expect(backupIndex).toBeLessThan(cloudIndex);
    expect(backupIndex).toBeLessThan(rtrda02Index);
    expect(workflow).toContain("backup-rtrda02-production.sh");
    expect(workflow).toContain("SHA256SUMS");
  });

  it("fails the backup closed and preserves rollback evidence", () => {
    expect(backupScript).toContain('test "${#SOURCE_SHA}" -eq 40');
    expect(backupScript).toContain('test "${#TARGET_SHA}" -eq 40');
    expect(backupScript).toContain("pg_dump");
    expect(backupScript).toContain("pg_restore --list");
    expect(backupScript).toContain("cp -al");
    expect(backupScript).toContain("public-assets.SHA256SUMS");
    expect(backupScript).not.toContain("tar -czf");
    expect(backupScript).toContain("release-manifest.json");
    expect(backupScript).toContain('case "$IMAGE_REF" in');
    expect(backupScript).toContain("sha256sum -c SHA256SUMS");
    expect(backupScript).toContain("df -Pk");
    expect(backupScript).toContain('stat -c %d "$TARGET_PATH"');
    expect(backupScript).toContain('stat -c %d "$BACKUP_ROOT"');
    expect(backupScript).toContain("RETENTION_COUNT=3");
    expect(backupScript).not.toContain("rm -rf");
    expect(backupScript).not.toContain(".env >");
    expect(backupScript).not.toContain("cat .env");
  });

  it("prunes backups only after successful production verification", () => {
    const verifyIndex = workflow.indexOf("Verify production parity and public health");
    const integrityIndex = workflow.indexOf(
      "Verify backup integrity after production deployment",
    );
    const pruneIndex = workflow.indexOf("Prune successful RTRDA02 backups");
    expect(integrityIndex).toBeGreaterThan(verifyIndex);
    expect(pruneIndex).toBeGreaterThan(integrityIndex);
    expect(workflow).toContain("steps.backup.outputs.backup_dir");
    expect(workflow).toContain("public-assets.SHA256SUMS");
    expect(workflow).toContain("RELEASE_SUCCESS");
    expect(pruneBackupScript).toContain("RETENTION_COUNT=3");
    expect(pruneBackupScript).toContain("os.path.getmtime");
    expect(pruneBackupScript).toContain("complete = os.path.isfile");
    expect(pruneBackupScript).toContain('"RELEASE_SUCCESS"');
    expect(pruneBackupScript).toContain("incomplete");
    expect(pruneBackupScript).toContain('test "$old" != "$newest"');
    expect(pruneBackupScript).toContain("rm -rf --");
  });
});

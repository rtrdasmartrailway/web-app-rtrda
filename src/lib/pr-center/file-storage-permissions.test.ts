import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let storageRoot = "";

beforeEach(async () => {
  storageRoot = await mkdtemp(path.join(os.tmpdir(), "pr-center-storage-"));
  vi.stubEnv("PR_CENTER_FILE_DIR", storageRoot);
  vi.resetModules();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.resetModules();
  if (storageRoot) await rm(storageRoot, { recursive: true, force: true });
});

describe("PR Center private file storage permissions", () => {
  it("creates owner-only files and directories", async () => {
    const { storeFile } = await import("./file-storage");
    const stored = await storeFile("org-1", {
      fileName: "private.pdf",
      mimeType: "application/pdf",
      content: Buffer.from("test content"),
    });

    const expectedStorageRoot = path.join(storageRoot, "pr-center", "org-1");
    const directoryModes: number[] = [];
    for (
      let current = path.dirname(stored.absolutePath);
      current.startsWith(expectedStorageRoot);
      current = path.dirname(current)
    ) {
      directoryModes.push((await stat(current)).mode & 0o777);
      if (current === expectedStorageRoot) break;
    }

    expect(directoryModes.length).toBeGreaterThan(0);
    expect(directoryModes.every((mode) => mode === 0o700)).toBe(true);
    expect((await stat(stored.absolutePath)).mode & 0o777).toBe(0o600);
  });
});

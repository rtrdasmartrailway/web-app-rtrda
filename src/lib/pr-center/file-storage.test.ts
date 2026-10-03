import { describe, expect, it } from "vitest";
import {
  validateFileInput,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "./file-storage";

describe("file-storage validation", () => {
  it("accepts a valid PDF under the size limit", () => {
    expect(() =>
      validateFileInput({
        fileName: "report.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      }),
    ).not.toThrow();
  });

  it("rejects an unsupported MIME type", () => {
    expect(() =>
      validateFileInput({
        fileName: "script.exe",
        mimeType: "application/x-msdownload",
        sizeBytes: 100,
      }),
    ).toThrow(/not allowed/);
  });

  it("rejects files exceeding the size limit", () => {
    expect(() =>
      validateFileInput({
        fileName: "huge.zip",
        mimeType: "application/zip",
        sizeBytes: MAX_FILE_SIZE_BYTES + 1,
      }),
    ).toThrow(/size/);
  });

  it("rejects empty files", () => {
    expect(() =>
      validateFileInput({
        fileName: "empty.txt",
        mimeType: "text/plain",
        sizeBytes: 0,
      }),
    ).toThrow(/size/);
  });

  it("rejects empty or overly long file names", () => {
    expect(() =>
      validateFileInput({
        fileName: "",
        mimeType: "text/plain",
        sizeBytes: 10,
      }),
    ).toThrow(/File name/);
    expect(() =>
      validateFileInput({
        fileName: "x".repeat(501),
        mimeType: "text/plain",
        sizeBytes: 10,
      }),
    ).toThrow(/File name/);
  });

  it("includes common document and image types in the allow list", () => {
    expect(ALLOWED_MIME_TYPES.has("application/pdf")).toBe(true);
    expect(ALLOWED_MIME_TYPES.has("image/jpeg")).toBe(true);
    expect(ALLOWED_MIME_TYPES.has("image/png")).toBe(true);
    expect(
      ALLOWED_MIME_TYPES.has(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(true);
    expect(ALLOWED_MIME_TYPES.has("video/mp4")).toBe(true);
  });
});

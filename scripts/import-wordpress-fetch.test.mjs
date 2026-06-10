import { describe, expect, it } from "vitest";

import {
  createFetchTools,
  describeFetchError,
} from "./import-wordpress-fetch.mjs";

function okResponse(overrides = {}) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    ...overrides,
  };
}

describe("WordPress importer fetch helpers", () => {
  it("retries response body failures such as Undici body timeouts", async () => {
    let calls = 0;
    const timeoutError = new TypeError("terminated");
    timeoutError.cause = {
      code: "UND_ERR_BODY_TIMEOUT",
      message: "Body Timeout Error",
    };

    const { fetchBufferWithRetry } = createFetchTools({
      dispatcher: null,
      attempts: 2,
      retryBaseDelayMs: 0,
      fetchImpl: async () => {
        calls += 1;
        return okResponse({
          arrayBuffer: async () => {
            if (calls === 1) {
              throw timeoutError;
            }
            return Uint8Array.from([1, 2, 3]).buffer;
          },
        });
      },
    });

    const { body } = await fetchBufferWithRetry("https://example.test/file.pdf");

    expect(calls).toBe(2);
    expect(Array.from(body)).toEqual([1, 2, 3]);
  });

  it("does not retry permanent 404 responses", async () => {
    let calls = 0;
    const { fetchWithRetry } = createFetchTools({
      dispatcher: null,
      attempts: 5,
      retryBaseDelayMs: 0,
      fetchImpl: async () => {
        calls += 1;
        return {
          ok: false,
          status: 404,
          headers: new Headers(),
        };
      },
    });

    await expect(fetchWithRetry("https://example.test/missing.pdf")).rejects.toThrow(
      "HTTP 404",
    );
    expect(calls).toBe(1);
  });

  it("describes nested Undici error causes for CI logs", () => {
    const error = new TypeError("terminated");
    error.cause = {
      code: "UND_ERR_BODY_TIMEOUT",
      message: "Body Timeout Error",
    };

    expect(describeFetchError(error)).toBe(
      "terminated (UND_ERR_BODY_TIMEOUT: Body Timeout Error)",
    );
  });
});

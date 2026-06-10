import { setTimeout as sleep } from "node:timers/promises";
import { Agent } from "undici";

export const USER_AGENT = "web-app-rtrda-importer/1.0";

const retryableStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);

function positiveIntegerFromEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function nonNegativeIntegerFromEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

const defaultAttempts = positiveIntegerFromEnv("WP_IMPORT_FETCH_ATTEMPTS", 5);
const defaultRetryBaseDelayMs = nonNegativeIntegerFromEnv(
  "WP_IMPORT_FETCH_RETRY_BASE_DELAY_MS",
  1000,
);
const defaultHeadersTimeoutMs = positiveIntegerFromEnv(
  "WP_IMPORT_FETCH_HEADERS_TIMEOUT_MS",
  120_000,
);
const defaultBodyTimeoutMs = positiveIntegerFromEnv(
  "WP_IMPORT_FETCH_BODY_TIMEOUT_MS",
  900_000,
);

const defaultDispatcher = new Agent({
  headersTimeout: defaultHeadersTimeoutMs,
  bodyTimeout: defaultBodyTimeoutMs,
});

export class FetchHttpError extends Error {
  constructor(url, status) {
    super(`HTTP ${status} for ${url}`);
    this.name = "FetchHttpError";
    this.url = url;
    this.status = status;
  }
}

export function describeFetchError(error) {
  if (error instanceof FetchHttpError) {
    return error.message;
  }

  const causeCode = error?.cause?.code;
  const causeMessage = error?.cause?.message;
  const message = error?.message ?? String(error);

  if (causeCode && causeMessage) {
    return `${message} (${causeCode}: ${causeMessage})`;
  }

  return causeCode ? `${message} (${causeCode})` : message;
}

function shouldRetry(error) {
  if (error instanceof FetchHttpError) {
    return retryableStatuses.has(error.status);
  }

  return true;
}

function mergedHeaders(headers, userAgent) {
  const merged = new Headers(headers ?? {});

  if (!merged.has("user-agent")) {
    merged.set("user-agent", userAgent);
  }
  if (!merged.has("accept")) {
    merged.set("accept", "*/*");
  }

  return merged;
}

export function createFetchTools({
  fetchImpl = globalThis.fetch,
  dispatcher = defaultDispatcher,
  attempts = defaultAttempts,
  retryBaseDelayMs = defaultRetryBaseDelayMs,
  userAgent = USER_AGENT,
  onRetry = null,
} = {}) {
  async function fetchOnce(url, init = {}) {
    const requestInit = {
      ...init,
      headers: mergedHeaders(init.headers, userAgent),
    };

    if (dispatcher) {
      requestInit.dispatcher = dispatcher;
    }

    const response = await fetchImpl(url, requestInit);
    if (!response.ok) {
      throw new FetchHttpError(url, response.status);
    }

    return response;
  }

  async function retry(url, init, readResponse, requestAttempts = attempts) {
    let lastError;

    for (let attempt = 1; attempt <= requestAttempts; attempt += 1) {
      try {
        const response = await fetchOnce(url, init);
        return await readResponse(response);
      } catch (error) {
        lastError = error;
        if (attempt >= requestAttempts || !shouldRetry(error)) {
          break;
        }

        onRetry?.({
          url,
          attempt,
          attempts: requestAttempts,
          error,
        });

        await sleep(attempt * retryBaseDelayMs);
      }
    }

    throw lastError;
  }

  function fetchWithRetry(url, init = {}, requestAttempts = attempts) {
    return retry(url, init, (response) => response, requestAttempts);
  }

  function fetchBodyWithRetry(url, init, readBody, requestAttempts = attempts) {
    return retry(
      url,
      init,
      async (response) => ({
        response,
        body: await readBody(response),
      }),
      requestAttempts,
    );
  }

  async function fetchJson(url, init = {}, requestAttempts = attempts) {
    const { body } = await fetchBodyWithRetry(
      url,
      init,
      (response) => response.json(),
      requestAttempts,
    );
    return body;
  }

  function fetchJsonWithResponse(url, init = {}, requestAttempts = attempts) {
    return fetchBodyWithRetry(
      url,
      init,
      (response) => response.json(),
      requestAttempts,
    );
  }

  async function fetchText(url, init = {}, requestAttempts = attempts) {
    const { body } = await fetchBodyWithRetry(
      url,
      init,
      (response) => response.text(),
      requestAttempts,
    );
    return body;
  }

  function fetchBufferWithRetry(url, init = {}, requestAttempts = attempts) {
    return fetchBodyWithRetry(
      url,
      init,
      async (response) => Buffer.from(await response.arrayBuffer()),
      requestAttempts,
    );
  }

  return {
    fetchWithRetry,
    fetchBodyWithRetry,
    fetchJson,
    fetchJsonWithResponse,
    fetchText,
    fetchBufferWithRetry,
  };
}

#!/usr/bin/env node

const target = process.argv[2];
if (!target) {
  console.error("usage: node scripts/check-live-security.mjs https://host");
  process.exit(2);
}

const requiredHeaders = new Map([
  ["strict-transport-security", /^max-age=\d+/],
  ["content-security-policy", /default-src 'self'/],
  ["content-security-policy-report-only", /default-src 'self'/],
  ["x-frame-options", /^DENY$/],
  ["x-content-type-options", /^nosniff$/],
  ["referrer-policy", /^strict-origin-when-cross-origin$/],
  ["permissions-policy", /camera=\(\)/],
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const httpsUrl = new URL(target);
assert(httpsUrl.protocol === "https:", "target must use https");

const page = await fetch(httpsUrl, { redirect: "manual" });
assert(page.status === 200, `expected HTTPS 200, got ${page.status}`);
for (const [name, expected] of requiredHeaders) {
  const actual = page.headers.get(name) ?? "";
  assert(expected.test(actual), `missing or invalid ${name}: ${actual || "<absent>"}`);
}
assert(!page.headers.has("x-powered-by"), "x-powered-by must be absent");

for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
  const response = await fetch(httpsUrl, { method, redirect: "manual" });
  assert(response.status === 405, `${method} expected 405, got ${response.status}`);
  assert(
    response.headers.get("allow") === "GET, HEAD, OPTIONS",
    `${method} Allow is invalid`,
  );
}

const securityText = await fetch(new URL("/.well-known/security.txt", httpsUrl));
assert(
  securityText.status === 200,
  `security.txt expected 200, got ${securityText.status}`,
);
assert(
  (await securityText.text()).includes("Contact: mailto:info@rtrda.or.th"),
  "security.txt contact missing",
);

const httpUrl = new URL(httpsUrl);
httpUrl.protocol = "http:";
const httpResponse = await fetch(httpUrl, { redirect: "manual" });
assert(
  [301, 308].includes(httpResponse.status),
  `HTTP expected 301/308, got ${httpResponse.status}`,
);
const location = httpResponse.headers.get("location") ?? "";
assert(
  location.startsWith(`https://${httpsUrl.host}`),
  `HTTP redirect location is invalid: ${location}`,
);

console.log(`security live check passed: ${httpsUrl.origin}`);

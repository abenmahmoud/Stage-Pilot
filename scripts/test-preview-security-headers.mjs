import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const vite = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");

function rule(source) {
  return vercel.headers.find((entry) => entry.source === source);
}

function headerMap(source) {
  const entry = rule(source);
  assert.ok(entry, `missing header rule ${source}`);
  return new Map(entry.headers.map((header) => [header.key.toLowerCase(), header.value]));
}

test("locks the browser shell with explicit security headers", () => {
  const headers = headerMap("/(.*)");
  assert.equal(headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains");
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.get("x-frame-options"), "DENY");
  assert.equal(headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(headers.get("cross-origin-resource-policy"), "same-origin");
  assert.equal(headers.get("cross-origin-opener-policy"), "same-origin-allow-popups");
  assert.match(headers.get("permissions-policy") ?? "", /camera=\(self\)/);
  assert.match(headers.get("permissions-policy") ?? "", /microphone=\(\)/);
  assert.match(headers.get("permissions-policy") ?? "", /geolocation=\(\)/);
});

test("keeps the CSP closed to code injection and framing", () => {
  const csp = headerMap("/(.*)").get("content-security-policy") ?? "";
  for (const directive of [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self'",
    "upgrade-insecure-requests",
  ]) {
    assert.ok(csp.includes(directive), `missing CSP directive ${directive}`);
  }
  assert.doesNotMatch(csp, /unsafe-eval/i);
  assert.doesNotMatch(csp, /(?:^|[;\s])\*(?:$|[;\s])/);
  assert.doesNotMatch(csp, /\bhttp:\/\//i);
});

test("prevents API and service-worker state from being cached as public content", () => {
  assert.equal(headerMap("/api/:path*").get("cache-control"), "private, no-store, max-age=0");
  assert.equal(headerMap("/sw.js").get("cache-control"), "no-cache, no-store, must-revalidate");
  assert.doesNotMatch(JSON.stringify(vercel.headers), /access-control-allow-origin[^}]*\*/i);
});

test("keeps production source maps disabled", () => {
  assert.match(vite, /sourcemap:\s*false/);
});

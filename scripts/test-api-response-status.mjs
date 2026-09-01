import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://response-status.test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "response-status-test-service-role-key";

const { HttpError } = await import("../api/_shared/auth.ts");
const { handleApi } = await import("../api/_shared/response.ts");

function responseDouble() {
  return {
    statusCode: 200,
    headersSent: false,
    headers: new Map(),
    payload: undefined,
    setHeader(name, value) {
      this.headers.set(name, value);
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      this.headersSent = true;
      return this;
    },
  };
}

test("keeps the default success status", async () => {
  const response = responseDouble();
  await handleApi(response, async () => ({ ok: true }));
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.payload, { ok: true });
});

for (const status of [201, 202]) {
  test(`preserves an explicit HTTP ${status} success status`, async () => {
    const response = responseDouble();
    await handleApi(response, async () => {
      response.status(status);
      return { accepted: true };
    });
    assert.equal(response.statusCode, status);
    assert.deepEqual(response.payload, { accepted: true });
  });
}

test("keeps explicit HTTP errors unchanged", async () => {
  const response = responseDouble();
  await handleApi(response, async () => {
    throw new HttpError(429, "Réessayez plus tard");
  });
  assert.equal(response.statusCode, 429);
  assert.deepEqual(response.payload, { error: "Réessayez plus tard" });
});

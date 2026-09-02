import { isIP } from "node:net";

const DELIVERY_PATH = "/api/communications/deliveries";
const FIXTURE_HOST_PATTERN = /^lyceegest-webmail-fixture-[a-z0-9-]{5,80}-safe-scol\.vercel\.app$/u;
const RUN_ID_PATTERN = /^webmail-network-20\d{6}-[a-f0-9]{12}$/u;
const SECRET_PATTERN = /^[A-Za-z0-9_-]{43,128}$/u;
const FORBIDDEN_SECRET_MARKERS = /(?:admin93|example|password|secret|test)/iu;

function fail(reason) {
  throw new Error(reason);
}

export function assertCommunicationWebmailNetworkPreviewTarget(input) {
  if (!input || typeof input !== "object") fail("webmail_fixture_target_invalid");
  const {
    endpoint,
    expectedHost,
    runId,
    confirmation,
    previewOnly,
  } = input;
  if (previewOnly !== true) fail("webmail_fixture_preview_flag_required");
  if (typeof expectedHost !== "string" || !FIXTURE_HOST_PATTERN.test(expectedHost)) {
    fail("webmail_fixture_host_invalid");
  }
  if (isIP(expectedHost) !== 0 || expectedHost.endsWith(".")) {
    fail("webmail_fixture_host_invalid");
  }
  if (typeof runId !== "string" || !RUN_ID_PATTERN.test(runId)) {
    fail("webmail_fixture_run_id_invalid");
  }
  if (confirmation !== `${runId}@${expectedHost}`) {
    fail("webmail_fixture_confirmation_invalid");
  }
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    fail("webmail_fixture_endpoint_invalid");
  }
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== "" ||
    url.hostname !== expectedHost ||
    url.pathname !== DELIVERY_PATH ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    fail("webmail_fixture_endpoint_invalid");
  }
  return {
    endpoint: url.toString(),
    challengeEndpoint: new URL("/api/fixture/challenge", url.origin).toString(),
    expectedHost,
    runId,
  };
}

export function assertCommunicationWebmailNetworkPreviewSecrets(input) {
  if (!input || typeof input !== "object") fail("webmail_fixture_secrets_invalid");
  const entries = Object.entries(input);
  if (entries.length !== 4) fail("webmail_fixture_secrets_invalid");
  const expectedNames = new Set([
    "bearerToken",
    "deliverySecret",
    "receiptSecret",
    "proofSecret",
  ]);
  const values = [];
  for (const [name, value] of entries) {
    if (!expectedNames.delete(name)) fail("webmail_fixture_secrets_invalid");
    if (typeof value !== "string" || !SECRET_PATTERN.test(value) || FORBIDDEN_SECRET_MARKERS.test(value)) {
      fail("webmail_fixture_secret_invalid");
    }
    values.push(value);
  }
  if (expectedNames.size !== 0 || new Set(values).size !== values.length) {
    fail("webmail_fixture_secret_reuse_forbidden");
  }
  return input;
}


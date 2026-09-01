import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isSupportMagicAccessPayload } from "../shared/support-magic-access-payload-policy.ts";

const page = readFileSync(new URL("../src/pages/prototype/LyceeConnectPrototype.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../api/support/access/[token].ts", import.meta.url), "utf8");
const session = readFileSync(new URL("../api/_shared/support-access-session.ts", import.meta.url), "utf8");

const publicCode = "BC-2026-000123";

test("accepts only one exact public dossier reference", () => {
  const payload = { request: { publicCode } };
  assert.equal(isSupportMagicAccessPayload(payload), true);
  assert.equal(isSupportMagicAccessPayload(payload, publicCode), true);
  assert.equal(isSupportMagicAccessPayload(payload, "BC-2026-000999"), false);
  assert.equal(isSupportMagicAccessPayload({ ...payload, sessionToken: "hidden" }), false);
  assert.equal(isSupportMagicAccessPayload({
    request: { ...payload.request, contactVerified: true },
  }), false);
  assert.equal(isSupportMagicAccessPayload({ request: { publicCode: "BC-26-123" } }), false);
});

test("validates a magic-link exchange before opening the request view", () => {
  const effect = page.indexOf('const token = url.searchParams.get("support_token")');
  const readUnknown = page.indexOf("readApiResponse<unknown>", effect);
  const validation = page.indexOf("if (!isSupportMagicAccessPayload(payload))", readUnknown);
  const update = page.indexOf("setTicketCreated(payload.request.publicCode)", validation);
  assert.notEqual(effect, -1);
  assert.ok(effect < readUnknown);
  assert.ok(readUnknown < validation);
  assert.ok(validation < update);
});

test("delegates the browser contract and validates before visible state", () => {
  assert.match(page, /import \{ isSupportMagicAccessPayload \} from "\.\.\/\.\.\/\.\.\/shared\/support-magic-access-payload-policy"/);
  assert.doesNotMatch(page, /function isSupportMagicAccessPayload/);
});

test("removes the one-use token before the network request", () => {
  const effect = page.indexOf('const token = url.searchParams.get("support_token")');
  const end = page.indexOf("}, []);", effect);
  const body = page.slice(effect, end);
  const remove = body.indexOf('url.searchParams.delete("support_token")');
  const replace = body.indexOf("window.history.replaceState", remove);
  const featureGate = body.indexOf("if (!SUPPORT_API_ENABLED) return", replace);
  const read = body.indexOf("readApiResponse<unknown>", replace);
  assert.ok(remove >= 0 && remove < replace && replace < featureGate && featureGate < read);
  assert.equal(body.match(/url\.searchParams\.delete\("support_token"\)/g)?.length, 1);
  assert.equal(body.match(/window\.history\.replaceState/g)?.length, 1);
});

test("rejects repeated or malformed route tokens", () => {
  assert.match(route, /if \(Array\.isArray\(req\.query\.token\)\)/);
  assert.match(route, /\^\[A-Za-z0-9_-\]\{40,60\}\$/);
  assert.doesNotMatch(route, /Array\.isArray\(req\.query\.token\) \? req\.query\.token\[0\]/);
});

test("validates the projected server payload before issuing the cookie", () => {
  const payload = route.indexOf("const payload = { request: result }");
  const validation = route.indexOf("isSupportMagicAccessPayload(payload, result.publicCode)", payload);
  const cookie = route.indexOf("setSupportSessionCookie(res, newSessionToken)", validation);
  const returned = route.indexOf("return payload", cookie);
  assert.ok(payload >= 0 && payload < validation && validation < cookie && cookie < returned);
  assert.doesNotMatch(route.slice(payload, returned), /newSessionToken[,:]/);
});

test("keeps contact verification separate from school identity", () => {
  assert.match(route, /verificationSource: "email_magic_link"/);
  assert.match(session, /identityStatus: "contact_verifie"/);
  assert.doesNotMatch(`${route}\n${session}`, /identityStatus: "identite_confirmee"/);
  assert.match(session, /eq\(supportContacts\.id, targetContactId\)/);
  assert.match(session, /eq\(supportContacts\.requestId, input\.requestId\)/);
});

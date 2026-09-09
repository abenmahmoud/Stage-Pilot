import assert from "node:assert/strict";
import test from "node:test";
import { buildIdentityVerificationEmail, buildSupportRequesterEmail, buildSupportAgentEmail,
  schoolEmailUrl, schoolEmailSenderName } from "../shared/school-email-templates.mjs";
// The provider adapter imports the auth module; use a fictional, offline client.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://school-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fictitious-test-key";
const { sendTransactionalEmail } = await import("../api/_shared/brevo.ts");

const input = { publicCode: "BC-2026-000001", requesterName: "Camille Test", requestSubject: "Inscription à la cantine",
  accessCode: "123456", trackingUrl: "https://example.org/?support_token=fictitious&view=requests" };

test("OTP: readable plain text, escaped HTML, code absent from subject and preview", () => {
  const email = buildIdentityVerificationEmail({ firstName: 'A&B <img src=x>', code: "123456" });
  assert.match(email.textContent, /Bonjour A&B <img src=x>,/);
  assert.match(email.htmlContent, /A&amp;B &lt;img src=x&gt;/);
  assert.doesNotMatch(email.htmlContent, /<img|<script/i);
  assert.doesNotMatch(email.subject, /123456/);
  assert.doesNotMatch(email.htmlContent.match(/<div[^>]*>(.*?)<\/div>/s)[1], /123456/);
  assert.match(email.textContent, /10 minutes/);
  assert.match(email.textContent, /conversation ouverte/);
  assert.match(buildIdentityVerificationEmail({ code: "123456" }).textContent, /^Bonjour,/);
});

test("confirmation and recovery keep the request beyond the temporary access", () => {
  for (const kind of ["created", "recovery"]) {
    const email = buildSupportRequesterEmail({ ...input, kind });
    assert.match(email.textContent, /Bonjour Camille Test,/);
    assert.match(email.textContent, /30 minutes/);
    assert.match(email.textContent, /Votre demande reste enregistrée/);
    assert.ok(email.htmlContent.includes(input.trackingUrl.replaceAll("&", "&amp;")));
    assert.equal((email.htmlContent.match(/support_token=/g) || []).length, 1);
    assert.doesNotMatch(email.htmlContent, /<img|<script|<form|<iframe/i);
    assert.ok(Buffer.byteLength(email.htmlContent) < 20_000);
  }
});

test("reply preserves the human text and points to protected documents", () => {
  const email = buildSupportRequesterEmail({ ...input, kind: "reply", bodyText: 'Voici votre réponse.\nPièce <confidentielle> & originale.', attachmentCount: 2 });
  assert.match(email.textContent, /Pièce <confidentielle> & originale\./);
  assert.match(email.htmlContent, /<br>Pièce &lt;confidentielle&gt; &amp; originale\./);
  assert.match(email.textContent, /2 documents sont disponibles/);
  assert.doesNotMatch(email.subject, /confidentielle/);
});

test("agent notification uses the configured service and a working agent view URL", () => {
  const email = buildSupportAgentEmail({ ...input, serviceName: "Intendance", agentUrl: "https://example.org/?view=school", isMessage: false });
  assert.match(email.textContent, /Service : Intendance/);
  assert.match(email.htmlContent, /href="https:\/\/example.org\/\?view=agent"/);
  assert.doesNotMatch(email.subject, /cantine|Camille/);
  assert.doesNotMatch(email.textContent, /123456|support_token/);
});

test("link construction preserves query parameters and refuses unsafe links and codes", () => {
  const url = new URL(schoolEmailUrl("https://example.org/?view=requests", { support_token: "a&b" }));
  assert.equal(url.searchParams.get("view"), "requests");
  assert.equal(url.searchParams.get("support_token"), "a&b");
  assert.equal(new URL(schoolEmailUrl(undefined, {})).hostname, "lycee-blaise-cendrars-sevran.fr");
  for (const trackingUrl of ["http://example.org", "javascript:alert(1)", "https://name:pass@example.org", "https://example.org/#token"]) {
    assert.throws(() => buildSupportRequesterEmail({ ...input, kind: "created", trackingUrl }));
  }
  for (const code of [undefined, "12345", "<123456>"]) assert.throws(() => buildIdentityVerificationEmail({ code }));
  assert.throws(() => buildSupportRequesterEmail({ ...input, kind: "created", publicCode: "BC-2026-000001\r\nBcc: test@example.org" }));
});

test("provider payload keeps authenticated sender, reply address, plain text and idempotency", async (t) => {
  const keys = ["BREVO_API_KEY", "SUPPORT_FROM_EMAIL", "SUPPORT_FROM_NAME", "SUPPORT_REPLY_TO_EMAIL"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  t.after(() => { for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } });
  Object.assign(process.env, { BREVO_API_KEY: "fictitious", SUPPORT_FROM_EMAIL: "school@example.org",
    SUPPORT_FROM_NAME: "Lycee Blaise Cendrars", SUPPORT_REPLY_TO_EMAIL: "reply@example.org" });
  let sent;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    sent = JSON.parse(options.body);
    return new Response(JSON.stringify({ messageId: "fictitious-message" }), { status: 201 });
  });
  await sendTransactionalEmail({ ...buildIdentityVerificationEmail({ firstName: "Camille", code: "123456" }),
    to: { email: "recipient@example.org" }, idempotencyKey: "fictitious-event" });
  assert.deepEqual(sent.sender, { email: "school@example.org", name: "Lycée Blaise Cendrars" });
  assert.equal(sent.replyTo.email, "reply@example.org");
  assert.equal(sent.headers.idempotencyKey, "fictitious-event");
  assert.equal(sent.to.length, 1);
  assert.ok(sent.textContent && sent.htmlContent);
  assert.equal(schoolEmailSenderName(""), "Lycée Blaise Cendrars");
});

import assert from "node:assert/strict";

// Provider boundary only: no network request or real SMS is sent by this test.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://school-test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fictitious-test-key";
process.env.BREVO_API_KEY = "fictitious-test-key";
process.env.IDENTITY_DEVICE_SMS_SENDER = "PFMP";
delete process.env.SCHOOL_SMS_SENDER;
const { sendTransactionalSms } = await import("../api/_shared/brevo.ts");
const originalFetch = globalThis.fetch;
const calls = [];
globalThis.fetch = async (url, init) => {
  assert.equal(url, "https://api.brevo.com/v3/transactionalSMS/send");
  calls.push(JSON.parse(init.body));
  return new Response(JSON.stringify({ messageId: "fictitious-sms" }), { status: 201 });
};
try {
  const content = "Lycée Blaise Cendrars : 123456. Valable 10 min. Ne le partagez pas.";
  const result = await sendTransactionalSms({ recipient: "+33600000000", content });
  assert.equal(result.messageId, "fictitious-sms");
  assert.equal(calls[0].sender, "LycCendrars");
  assert.equal(calls[0].recipient, "33600000000");
  assert.equal(calls[0].type, "transactional");
  assert.equal(calls[0].content, content);
  assert.ok(content.length <= 70, "Keep this fixed OTP message within one Unicode SMS segment");
  process.env.SCHOOL_SMS_SENDER = " LyceeTest ";
  await sendTransactionalSms({ recipient: "+33600000000", content });
  assert.equal(calls[1].sender, "LyceeTest");
  process.env.SCHOOL_SMS_SENDER = "invalid sender";
  await assert.rejects(sendTransactionalSms({ recipient: "+33600000000", content }), /expéditeur/);
  assert.equal(calls.length, 2, "Reject invalid senders before contacting the provider");
  console.log("School SMS sender: legacy PFMP ignored, school sender checked, no real delivery.");
} finally {
  globalThis.fetch = originalFetch;
}

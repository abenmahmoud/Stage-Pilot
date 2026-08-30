import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://test-only.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-only-service-role";
const { sendTransactionalEmail } = await import("../api/_shared/brevo.ts");

const inboundWebhook = await readFile(
  new URL("../api/webhooks/brevo/inbound.ts", import.meta.url),
  "utf8"
);
const deliveryWebhook = await readFile(
  new URL("../api/webhooks/brevo/delivery.ts", import.meta.url),
  "utf8"
);
const supportWorker = await readFile(
  new URL("../api/cron/support-worker.ts", import.meta.url),
  "utf8"
);

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.BREVO_API_KEY;
const originalSender = process.env.SUPPORT_FROM_EMAIL;

function email() {
  return {
    to: { email: "requester@example.com", name: "Personne fictive" },
    subject: "Recette fictive",
    textContent: "Message fictif",
    htmlContent: "<p>Message fictif</p>",
    idempotencyKey: "00000000-0000-4000-8000-000000000901",
  };
}

test("handles Brevo success, duplicate and outage without losing idempotency", async () => {
  process.env.BREVO_API_KEY = "test-only-key";
  process.env.SUPPORT_FROM_EMAIL = "lycee@example.com";
  try {
    let sentBody;
    globalThis.fetch = async (_url, init) => {
      sentBody = JSON.parse(init.body);
      return new Response(JSON.stringify({ messageId: "recipe-message-id" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    };
    assert.deepEqual(await sendTransactionalEmail(email()), {
      messageId: "recipe-message-id",
      duplicate: false,
    });
    assert.equal(sentBody.headers.idempotencyKey, email().idempotencyKey);

    globalThis.fetch = async () => new Response(
      JSON.stringify({ code: "duplicate_parameter" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
    assert.deepEqual(await sendTransactionalEmail(email()), {
      messageId: `duplicate:${email().idempotencyKey}`,
      duplicate: true,
    });

    globalThis.fetch = async () => new Response(
      JSON.stringify({ code: "temporary_unavailable" }),
      { status: 503, headers: { "content-type": "application/json" } }
    );
    await assert.rejects(
      sendTransactionalEmail(email()),
      (error) => error?.name === "BrevoError" && error?.message === "temporary_unavailable"
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.BREVO_API_KEY;
    else process.env.BREVO_API_KEY = originalApiKey;
    if (originalSender === undefined) delete process.env.SUPPORT_FROM_EMAIL;
    else process.env.SUPPORT_FROM_EMAIL = originalSender;
  }
});

test("claims inbound webhook work atomically and only reopens retryable receipts", () => {
  const transaction = inboundWebhook.indexOf("db.transaction(async (tx)");
  const claim = inboundWebhook.indexOf("insert into public.support_webhook_receipts", transaction);
  const message = inboundWebhook.indexOf(".insert(supportMessages)", claim);
  const notification = inboundWebhook.indexOf("'notify_agent_message_received'", message);
  const processed = inboundWebhook.indexOf('.set({ status: "processed"', notification);

  assert.ok(transaction >= 0 && transaction < claim);
  assert.ok(claim < message && message < notification && notification < processed);
  assert.match(
    inboundWebhook,
    /where public\.support_webhook_receipts\.status in \('received', 'error'\)/
  );
  assert.match(inboundWebhook, /if \(!receipt\) return "duplicate" as const/);
});

test("deduplicates delivery events and keeps failed email jobs retryable", () => {
  const failureBranch = supportWorker.slice(
    supportWorker.indexOf("if (row.read_ct >= 5)"),
    supportWorker.indexOf('return "retried";') + 'return "retried";'.length
  );
  assert.match(deliveryWebhook, /\.onConflictDoNothing\(\)/);
  assert.match(failureBranch, /if \(row\.read_ct >= 5\)/);
  assert.match(failureBranch, /pgmq\.archive\('support_jobs'/);
  assert.match(failureBranch, /return "retried"/);
  assert.doesNotMatch(failureBranch, /pgmq\.delete\('support_jobs'/);
});

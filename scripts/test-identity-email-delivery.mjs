import assert from 'node:assert/strict';
import test from 'node:test';

// No real credentials, database connection or network transport in this recipe.
Object.assign(process.env, {
  DATABASE_URL: 'postgres://test:test@127.0.0.1:1/test',
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-only',
  BREVO_API_KEY: 'test-only',
  SUPPORT_FROM_EMAIL: 'lycee@example.test',
  SUPPORT_FROM_NAME: 'Lycée Blaise Cendrars',
  IDENTITY_DEVICE_OTP_SECRET: 'test-only-identity-secret-with-32-characters',
});
const { deliverIdentityCode } = await import('../api/_shared/identity-code-delivery.ts');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const challenge = '56d124d1-91cc-4858-9f53-14e53cf85700';
const input = { challengeId: challenge, contactType: 'email', contact: 'professeur@example.test', firstName: 'Élodie' };

test('email OTP : référence acceptée par Brevo, stable au rejeu et distincte par demande', async (t) => {
  const calls = [];
  const seen = new Set();
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
    const body = JSON.parse(init.body);
    calls.push(body);
    const key = body.headers.idempotencyKey;
    // Reproduction du refus observé dans le sandbox Brevo le 15/09/2026.
    if (key.length > 36) return Response.json({ code: 'out_of_range', message: 'Idempotency key exceeds char limit' }, { status: 400 });
    assert.match(key, uuid);
    if (seen.has(key)) return Response.json({ code: 'duplicate_parameter' }, { status: 400 });
    seen.add(key);
    return Response.json({ messageId: 'mock-accepted' }, { status: 201 });
  });
  await deliverIdentityCode(input);
  await deliverIdentityCode(input);
  await deliverIdentityCode({ ...input, challengeId: '44af8859-8b91-4001-a30a-963076f39fcb' });
  assert.equal(seen.size, 2);
  assert.equal(calls[0].headers.idempotencyKey, calls[1].headers.idempotencyKey);
  assert.notEqual(calls[0].headers.idempotencyKey, calls[2].headers.idempotencyKey);
  assert.equal(calls[0].sender.name, 'Lycée Blaise Cendrars');
  assert.equal(calls[0].to[0].email, input.contact);
  assert.match(calls[0].subject, /Votre code de vérification/);
  assert.match(calls[0].textContent, /valable 10 minutes/);
  assert.match(calls[0].htmlContent, /lang="fr"/);
  assert.doesNotMatch(calls[0].subject, /PFMP|Brevo/i);
});

test('SMS : conserve le canal, le nom du lycée et la durée du code', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'https://api.brevo.com/v3/transactionalSMS/send');
    const body = JSON.parse(init.body);
    assert.equal(body.recipient, '33600000000');
    assert.equal(body.sender, 'LycCendrars');
    assert.match(body.content, /^Lycée Blaise Cendrars : \d{6}\. Valable 10 min/);
    return Response.json({ messageId: 123 }, { status: 201 });
  });
  await deliverIdentityCode({ ...input, contactType: 'phone', contact: '+33600000000' });
});

test('un refus fournisseur reste un échec et les journaux ne contiennent aucune donnée personnelle', async (t) => {
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    code: 'out_of_range', message: `Do not log ${input.contact} or 123456`,
  }, { status: 400 }));
  await assert.rejects(deliverIdentityCode(input), { name: 'BrevoRejectedError', message: 'out_of_range' });
  assert.deepEqual(logs, [['[brevo] delivery_rejected', { channel: 'email', status: 400, code: 'out_of_range' }]]);
  assert.doesNotMatch(JSON.stringify(logs), /@|123456|Élodie|test-only/);
});

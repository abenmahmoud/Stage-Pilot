import { randomUUID } from "node:crypto";
import postgres from "postgres";

if (process.env.LOAD_TEST_CONFIRM !== "preview-only") {
  throw new Error("Set LOAD_TEST_CONFIRM=preview-only after checking the target database");
}

const connectionString = process.env.LOAD_TEST_DATABASE_URL;
if (!connectionString) throw new Error("LOAD_TEST_DATABASE_URL is required");
const expectedProjectRef = process.env.LOAD_TEST_EXPECTED_PROJECT_REF;
if (!expectedProjectRef || !/^[a-z0-9]{20}$/.test(expectedProjectRef)) {
  throw new Error("LOAD_TEST_EXPECTED_PROJECT_REF is required");
}
if (!connectionString.includes(expectedProjectRef)) {
  throw new Error("The database URL does not match LOAD_TEST_EXPECTED_PROJECT_REF");
}

const count = Number.parseInt(process.env.LOAD_TEST_COUNT ?? "200", 10);
const concurrency = Number.parseInt(process.env.LOAD_TEST_CONCURRENCY ?? "20", 10);
if (!Number.isInteger(count) || count < 1 || count > 2000) {
  throw new Error("LOAD_TEST_COUNT must be between 1 and 2000");
}
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 40) {
  throw new Error("LOAD_TEST_CONCURRENCY must be between 1 and 40");
}

const runId = randomUUID().replaceAll("-", "");
const prefix = `load-${runId}-`;
const queueName = `support_load_${runId.slice(0, 16)}`;
const sql = postgres(connectionString, {
  prepare: false,
  max: Math.min(concurrency, count),
  connect_timeout: 10,
  idle_timeout: 10,
});

let nextIndex = 0;
let queueCreated = false;
const startedAt = performance.now();

async function createSyntheticRequest(index) {
  await sql.begin(async (transaction) => {
    const [request] = await transaction`
      insert into public.support_requests (
        idempotency_key_hash, requester_type, requester_first_name,
        requester_last_name, beneficiary_type, category, subject,
        description, preferred_channel, subject_context
      ) values (
        ${`${prefix}key-${index}`}, 'parent', 'Test', ${`Usager-${index}`},
        'eleve', 'ent', 'Acces ENT', 'Demande fictive de test de charge', 'email',
        ${transaction.json({ loadTestRun: runId })}
      ) returning id
    `;
    const [session] = await transaction`
      insert into public.support_device_sessions (session_hash, expires_at)
      values (${`${prefix}session-${index}`}, now() + interval '30 days')
      returning id
    `;
    await transaction`
      insert into public.support_session_requests (session_id, request_id)
      values (${session.id}, ${request.id})
    `;
    await transaction`
      insert into public.support_contacts (
        request_id, person_type, channel, value, normalized_hash, is_primary
      ) values (
        ${request.id}, 'requester', 'email', ${`test-${index}@example.invalid`},
        ${`${prefix}contact-${index}`}, true
      )
    `;
    await transaction`
      insert into public.support_messages (
        request_id, direction, channel, author_label, body_text
      ) values (
        ${request.id}, 'inbound', 'web', 'Usager test',
        'Demande fictive de test de charge'
      )
    `;
    await transaction`
      select pgmq.send(
        ${queueName},
        jsonb_build_object('run_id', ${runId}::text, 'request_id', ${request.id}::uuid)
      )
    `;
  });
}

async function worker() {
  while (true) {
    const index = nextIndex++;
    if (index >= count) return;
    await createSyntheticRequest(index);
  }
}

try {
  await sql`select pgmq.create(${queueName})`;
  queueCreated = true;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, count) }, () => worker())
  );

  const [result] = await sql`
    select
      (select count(*)::int from public.support_requests
        where idempotency_key_hash like ${`${prefix}%`}) as requests,
      (select count(*)::int from public.support_messages m
        join public.support_requests r on r.id = m.request_id
        where r.idempotency_key_hash like ${`${prefix}%`}) as messages,
      (select count(*)::int from public.support_session_requests sr
        join public.support_requests r on r.id = sr.request_id
        where r.idempotency_key_hash like ${`${prefix}%`}) as sessions,
      (select queue_length::int from pgmq.metrics(${queueName})) as jobs
  `;
  const durationMs = Math.round(performance.now() - startedAt);
  if (
    result.requests !== count ||
    result.messages !== count ||
    result.sessions !== count ||
    result.jobs !== count
  ) {
    throw new Error(`load_test_count_mismatch:${JSON.stringify(result)}`);
  }

  console.log(JSON.stringify({
    concurrentRequests: count,
    concurrency,
    durationMs,
    requestsPerSecond: Number((count / (durationMs / 1000)).toFixed(1)),
    ...result,
  }));
} finally {
  await sql`
    delete from public.support_requests
    where idempotency_key_hash like ${`${prefix}%`}
  `;
  await sql`
    delete from public.support_device_sessions
    where session_hash like ${`${prefix}%`}
  `;
  if (queueCreated) await sql`select pgmq.drop_queue(${queueName})`;
  await sql.end();
}

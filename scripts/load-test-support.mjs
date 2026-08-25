import postgres from "postgres";

const connectionString = process.env.LOAD_TEST_DATABASE_URL;
if (!connectionString) throw new Error("LOAD_TEST_DATABASE_URL is required");
const count = Number.parseInt(process.env.LOAD_TEST_COUNT ?? "200", 10);
if (!Number.isInteger(count) || count < 1 || count > 2000) throw new Error("LOAD_TEST_COUNT is invalid");

const sql = postgres(connectionString, {
  prepare: false,
  max: Math.min(40, count),
  connect_timeout: 10,
  idle_timeout: 10,
});

const startedAt = performance.now();
await Promise.all(
  Array.from({ length: count }, async (_, index) => {
    await sql.begin(async (transaction) => {
      const [request] = await transaction`
        insert into public.support_requests (
          idempotency_key_hash, requester_type, requester_first_name,
          requester_last_name, beneficiary_type, category, subject,
          description, preferred_channel
        ) values (
          ${`load-key-${index}`}, 'parent', 'Test', ${`Usager-${index}`},
          'eleve', 'ent', 'Accès ENT', 'Demande fictive de test de charge', 'email'
        ) returning id
      `;
      const [session] = await transaction`
        insert into public.support_device_sessions (session_hash, expires_at)
        values (${`load-session-${index}`}, now() + interval '30 days')
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
          ${`load-contact-${index}`}, true
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
          'support_jobs',
          jsonb_build_object(
            'job_id', gen_random_uuid(),
            'job_type', 'notify_requester_request_created',
            'request_id', ${request.id}::uuid
          )
        )
      `;
      await transaction`
        select pgmq.send(
          'support_jobs',
          jsonb_build_object(
            'job_id', gen_random_uuid(),
            'job_type', 'notify_agent_request_created',
            'request_id', ${request.id}::uuid
          )
        )
      `;
    });
  })
);

const [result] = await sql`
  select
    (select count(*)::int from public.support_requests where idempotency_key_hash like 'load-key-%') as requests,
    (select count(*)::int from public.support_messages m join public.support_requests r on r.id = m.request_id where r.idempotency_key_hash like 'load-key-%') as messages,
    (select count(*)::int from public.support_session_requests sr join public.support_requests r on r.id = sr.request_id where r.idempotency_key_hash like 'load-key-%') as sessions,
    (select count(*)::int from pgmq.q_support_jobs) as jobs
`;
const durationMs = Math.round(performance.now() - startedAt);
const expectedJobs = count * 2;
if (
  result.requests !== count ||
  result.messages !== count ||
  result.sessions !== count ||
  result.jobs !== expectedJobs
) {
  throw new Error(`load_test_count_mismatch:${JSON.stringify(result)}`);
}

console.log(JSON.stringify({ concurrentRequests: count, durationMs, ...result }));
await sql.end();

import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import {
  COMMUNICATION_INBOUND_PREVIEW_PROJECT,
  communicationInboundPreviewDatabaseUrl,
} from "../workers/communication-inbound-preview-target.mjs";

const EXPECTED_PROJECT_REF = COMMUNICATION_INBOUND_PREVIEW_PROJECT;
const EXPECTED_INSTITUTION_SLUG = "blaise-cendrars-sevran";

async function loadEnvFile(path) {
  const content = await readFile(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    const raw = match[2].trim();
    process.env[match[1]] = raw.length >= 2
      && ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")))
      ? raw.slice(1, -1)
      : raw;
  }
}

if (!process.argv.includes("--preview-only")) throw new Error("preview_confirmation_required");
await loadEnvFile(process.env.PREVIEW_ENV_FILE ?? ".env.preview.runtime.local");
assert.equal(
  process.env.CONFIRM_PREVIEW_SUPPORT_SESSION_CONTACT,
  EXPECTED_PROJECT_REF,
  "Explicit preview recipe confirmation is required"
);
const databaseUrl = communicationInboundPreviewDatabaseUrl(process.env.DATABASE_URL);

const sql = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: true }, max: 3, prepare: false, idle_timeout: 5, connect_timeout: 10,
  connection: { application_name: "lyceegest_contact_revocation_preview" },
});
const ids = { request: randomUUID(), contact: randomUUID(), session: randomUUID(), token: randomUUID() };
const marker = randomUUID().replaceAll("-", "");
const hash = (value) => createHash("sha256").update(value).digest("hex");
let first;
let second;
let fixtureCreated = false;

try {
  const [institution] = await sql`select id from public.institutions where slug=${EXPECTED_INSTITUTION_SLUG} limit 1`;
  assert.ok(institution?.id, "Preview institution missing");
  await sql.begin(async (tx) => {
    await tx`insert into public.support_requests(
      id,institution_id,public_code,idempotency_key_hash,requester_type,requester_first_name,
      requester_last_name,beneficiary_type,category,subject,description,preferred_channel
    ) values(
      ${ids.request},${institution.id},${`BC-2099-${marker.slice(0, 6)}`},${hash(`request:${marker}`)},
      'autre','Test','Fictif','autre','autre','Test concurrence','Donnee fictive','email'
    )`;
    await tx`insert into public.support_contacts(
      id,request_id,person_type,channel,value,normalized_hash,usage_scope
    ) values(${ids.contact},${ids.request},'autre','email',${`revocation-${marker}@example.invalid`},${hash(`contact:${marker}`)},'support')`;
    await tx`insert into public.support_device_sessions(id,session_hash,access_contact_id,expires_at)
      values(${ids.session},${hash(`session:${marker}`)},${ids.contact},now()+interval '1 hour')`;
    await tx`insert into public.support_session_requests(session_id,request_id) values(${ids.session},${ids.request})`;
    await tx`insert into public.support_magic_tokens(id,request_id,contact_id,token_hash,purpose,expires_at)
      values(${ids.token},${ids.request},${ids.contact},${hash(`token:${marker}`)},'support_access',now()+interval '1 hour')`;
  });
  fixtureCreated = true;

  first = await sql.reserve();
  second = await sql.reserve();
  await first.unsafe("begin");
  await second.unsafe("begin");
  const firstStarted = Date.now();
  await first`update public.support_contacts set disabled_at=clock_timestamp() where id=${ids.contact}`;
  const secondStarted = Date.now();
  const waitingUpdate = second`update public.support_contacts set disabled_at=clock_timestamp() where id=${ids.contact}`;
  await new Promise((resolve) => setTimeout(resolve, 300));
  await first.unsafe("commit");
  await waitingUpdate;
  await second.unsafe("commit");
  const secondWaitMs = Date.now() - secondStarted;

  const [state] = await sql`select
    (select revoked_at is not null from public.support_device_sessions where id=${ids.session}) as session_revoked,
    (select used_at is not null from public.support_magic_tokens where id=${ids.token}) as token_consumed,
    (select count(*)::int from public.support_device_sessions where id=${ids.session}) as session_count,
    (select count(*)::int from public.support_magic_tokens where id=${ids.token}) as token_count`;
  assert.equal(state.session_revoked, true);
  assert.equal(state.token_consumed, true);
  assert.equal(state.session_count, 1);
  assert.equal(state.token_count, 1);
  assert.ok(secondWaitMs >= 250, "Concurrent update did not wait for the contact row lock");
  assert.ok(Date.now() - firstStarted < 10_000, "Concurrency recipe exceeded its bound");
  console.log(JSON.stringify({ concurrentUpdates: 2, secondWaitMs, sessionRevoked: true, tokenConsumed: true }));
} finally {
  for (const connection of [second, first]) {
    if (!connection) continue;
    try { await connection.unsafe("rollback"); } catch {}
    connection.release();
  }
  if (fixtureCreated) {
    await sql.begin(async (tx) => {
      await tx`delete from public.support_device_sessions where id=${ids.session}`;
      await tx`delete from public.support_requests where id=${ids.request}`;
    });
  }
  const [remaining] = await sql`select
    (select count(*)::int from public.support_requests where id=${ids.request})
    +(select count(*)::int from public.support_contacts where id=${ids.contact})
    +(select count(*)::int from public.support_device_sessions where id=${ids.session})
    +(select count(*)::int from public.support_magic_tokens where id=${ids.token}) as count`;
  await sql.end({ timeout: 5 });
  assert.equal(remaining.count, 0, "Fictitious concurrency data was not removed");
}

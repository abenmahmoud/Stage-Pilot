// Hard-coded disposable loopback target; never inherits DATABASE_URL or loads .env.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { persistNominativeImport, approveNominativeImport, preparePersistedNominativeDeliveries, loadNominativeMessages, reserveNominativeDispatch, readNominativeDispatchState } from "../api/_shared/nominative-persistence.ts";
import { FICTITIOUS_CANTINE_CSV, FICTITIOUS_CANTINE_DIRECTORY, FICTITIOUS_CANTINE_TEMPLATE } from "../shared/nominative-fictitious-fixture.ts";
import { createNominativeWebmailCommand } from "../shared/nominative-webmail-command.ts";
import { verifyCommunicationWebmailDeliveryToken } from "../shared/communication-webmail-delivery.ts";

if (process.argv.length !== 3 || process.argv[2] !== "--local-stack-only") throw new Error("local_stack_confirmation_required");
const client = postgres({ host: "127.0.0.1", port: 54322, database: "postgres", user: "postgres", password: "postgres", max: 1, prepare: false, connect_timeout: 5 });
const database = drizzle(client);
const rollback = new Error("intentional_fixture_rollback");
const institutionId = randomUUID();
const actorId = randomUUID();
const communicationId = randomUUID();
const versionId = randomUUID();
const encryption = { version: "v1", key: randomBytes(32) };
const fingerprintSecret = randomBytes(32).toString("hex");
const idempotencySecret = randomBytes(32).toString("hex");
const deliverySecret = randomBytes(32).toString("hex");
const now = new Date();
let assertions = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); assertions++; };

try {
  await database.transaction(async (tx) => {
    await tx.execute(sql`insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values (${actorId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', ${`fixture-${actorId}@example.test`}, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now())`);
    await tx.execute(sql`insert into public.institutions(id, slug, name, status) values (${institutionId}::uuid, ${`nominatif-${institutionId}`}, 'Nominatif fictif', 'draft')`);
    await tx.execute(sql`insert into public.communication_settings(institution_id, module_enabled, publication_enabled, sending_enabled, updated_by) values (${institutionId}::uuid, true, false, false, ${actorId}::uuid)`);
    await tx.execute(sql`insert into public.communications(id, institution_id, source_type, source_fingerprint, source_label, created_by)
      values (${communicationId}::uuid, ${institutionId}::uuid, 'direct_text', ${randomBytes(32).toString("hex")}, 'Recette fictive nominative', ${actorId}::uuid)`);
    await tx.execute(sql`insert into public.communication_versions(id, institution_id, communication_id, version, title, summary, body_markdown, content_hash, created_by)
      values (${versionId}::uuid, ${institutionId}::uuid, ${communicationId}::uuid, 1, 'Cantine fictive', 'Lot fictif', 'Modèle fictif.', ${randomBytes(32).toString("hex")}, ${actorId}::uuid)`);
    await tx.execute(sql`update public.communication_versions set status = 'review' where id = ${versionId}::uuid`);
    await tx.execute(sql`update public.communications set status = 'review' where id = ${communicationId}::uuid`);
    await tx.execute(sql`update public.communication_versions set status = 'approved', approved_by = ${actorId}::uuid, approved_at = now() where id = ${versionId}::uuid`);
    await tx.execute(sql`update public.communications set status = 'approved', approved_by = ${actorId}::uuid, approved_at = now() where id = ${communicationId}::uuid`);

    const options = { tx, institutionId, actorId, sourceRef: "import:cantine:fictif01", schoolYear: "2026-2027", contents: FICTITIOUS_CANTINE_CSV,
      mapping: { beneficiary_ref: 0, last_name: 1, first_name: 2, class_label: 3, value: 4 }, valueFunction: "cantine_information", template: FICTITIOUS_CANTINE_TEMPLATE,
      directory: FICTITIOUS_CANTINE_DIRECTORY, encryption, fingerprintSecret };
    const imported = await persistNominativeImport(options);
    const repeated = await persistNominativeImport(options);
    check(repeated.id, imported.id);
    check(repeated.duplicate, true);
    check(imported.report.readyCount, 2);
    check(imported.report.rows.every((row) => row.value === null), true);
    const [counts] = await tx.execute(sql`select (select count(*)::integer from public.communication_nominative_imports where institution_id = ${institutionId}::uuid) as imports,
      (select count(*)::integer from public.communication_nominative_values where institution_id = ${institutionId}::uuid) as values`);
    check(counts, { imports: 1, values: 2 });
    const [meta] = await tx.execute(sql`select frozen_batch, report from public.communication_nominative_imports where id = ${imported.id}::uuid`);
    check(meta.frozen_batch.excludedCount, 7);
    check(meta.frozen_batch.readyCount + meta.frozen_batch.excludedCount, 9);
    check(JSON.stringify(meta).includes('"0042"'), false);

    const prepareOptions = { tx, institutionId, importId: imported.id, communicationId, versionId, version: 1, encryption: () => encryption, fingerprintSecret, idempotencySecret,
      currentContacts: new Map(FICTITIOUS_CANTINE_DIRECTORY.filter((person) => person.contactRef).map((person) => [person.beneficiaryRef, { contactRef: person.contactRef, revoked: person.contactRevoked }])) };
    await assert.rejects(() => preparePersistedNominativeDeliveries(prepareOptions), /approval_required/); assertions++;
    await assert.rejects(() => approveNominativeImport({ tx, institutionId, importId: imported.id, scopeHash: "f".repeat(64), actorId }), /approval_conflict/); assertions++;
    await approveNominativeImport({ tx, institutionId, importId: imported.id, scopeHash: imported.scopeHash, actorId });
    const first = await preparePersistedNominativeDeliveries(prepareOptions);
    const second = await preparePersistedNominativeDeliveries(prepareOptions);
    check(first.length, 2);
    check(new Set(first.map((row) => row.deliveryId)).size, 2);
    check(new Set(first.map((row) => row.message.contactRef)).size, 1);
    check(second.map((row) => row.deliveryId), first.map((row) => row.deliveryId));
    check(second.every((row) => row.duplicate), true);
    check((await tx.execute(sql`select count(*)::integer as count from public.communication_deliveries where institution_id = ${institutionId}::uuid`))[0].count, 2);

    const commands = first.map((row) => {
      const token = createNominativeWebmailCommand({ institutionId, communicationId, versionId, version: 1, ...row, contactRef: row.message.contactRef, secret: deliverySecret, now });
      return verifyCommunicationWebmailDeliveryToken({ token, institutionId, secret: deliverySecret, now });
    });
    check(commands.every(Boolean), true);
    check(commands[0].bodyText.includes("0042") && !commands[0].bodyText.includes("0043"), true);
    check(commands[1].bodyText.includes("0043") && !commands[1].bodyText.includes("0042"), true);
    const revoked = new Map(prepareOptions.currentContacts);
    revoked.set("eleve:fictif01", { contactRef: "contact:parent0001", revoked: true });
    await assert.rejects(() => preparePersistedNominativeDeliveries({ ...prepareOptions, currentContacts: revoked }), /contact_changed/); assertions++;
    await assert.rejects(() => loadNominativeMessages({ ...prepareOptions, institutionId: randomUUID() }), /import_unavailable/); assertions++;

    const dispatchInput = { tx, institutionId, deliveryId: first[0].deliveryId };
    check(await reserveNominativeDispatch(dispatchInput), { reserved: false });
    await tx.execute(sql`update public.communication_settings set sending_enabled = true where institution_id = ${institutionId}::uuid`);
    check(await reserveNominativeDispatch(dispatchInput), { reserved: true });
    // Simulate process loss before a provider receipt: no success, no second reservation.
    check(await readNominativeDispatchState(dispatchInput), "result_uncertain");
    check(await reserveNominativeDispatch(dispatchInput), { reserved: false });

    const privileges = await tx.execute(sql`select role_name,
      has_table_privilege(role_name, 'public.communication_nominative_imports', 'select') as can_read_import,
      has_table_privilege(role_name, 'public.communication_nominative_values', 'select') as can_read_value,
      has_table_privilege(role_name, 'public.communication_nominative_values', 'insert') as can_write_value
      from unnest(array['anon', 'authenticated']) as role_name`);
    check(privileges.every((row) => !row.can_read_import && !row.can_read_value && !row.can_write_value), true);
    check((await tx.execute(sql`select count(*)::integer as count from pg_class where relname in ('communication_nominative_imports','communication_nominative_values','communication_nominative_delivery_values') and relrowsecurity and relforcerowsecurity`))[0].count, 3);
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  await client.end();
}
const verifier = postgres({ host: "127.0.0.1", port: 54322, database: "postgres", user: "postgres", password: "postgres", max: 1, connect_timeout: 5 });
try {
  check((await verifier`select count(*)::integer as count from public.institutions where id = ${institutionId}`)[0].count, 0);
} finally { await verifier.end(); }
console.log(JSON.stringify({ target: "127.0.0.1:54322", assertions, rollbackVerified: true, realData: false, providerCalls: 0 }));

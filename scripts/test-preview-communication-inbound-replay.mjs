import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const EXPECTED_PROJECT_REF = "xijocumlwivhbmffrnlj";
const ROLLBACK_RECIPE = new Error("rollback_preview_communication_inbound_replay");

if (!process.argv.includes("--preview-only")) {
  throw new Error("Use --preview-only to confirm the isolated preview recipe");
}

const databaseUrl = process.env.DATABASE_URL ?? "";
assert.match(databaseUrl, new RegExp(EXPECTED_PROJECT_REF), "Unexpected Supabase preview target");
assert.doesNotMatch(
  databaseUrl,
  new RegExp(process.env.PRODUCTION_SUPABASE_REF || "production-ref-must-not-match"),
  "Preview and production database targets must differ"
);

const [drizzle, { db }, schema, inboundModule, parserModule] = await Promise.all([
  import("drizzle-orm"),
  import("../db/index.js"),
  import("../db/schema.js"),
  import("../api/_shared/communication-inbound-persistence.js"),
  import("../shared/communication-brevo-inbound.js"),
]);

const { count, inArray, sql } = drizzle;
const {
  communicationDeliveries,
  communicationEvents,
  communicationInbound,
  communications,
  communicationVersions,
  institutions,
} = schema;
const { persistCommunicationInboundReceipts } = inboundModule;
const { parseCommunicationBrevoInboundEnvelope } = parserModule;

const marker = randomUUID().replaceAll("-", "").slice(0, 12);
const ids = {
  user: randomUUID(),
  institutionA: randomUUID(),
  institutionB: randomUUID(),
  communicationA: randomUUID(),
  communicationB: randomUUID(),
  versionA: randomUUID(),
  versionB: randomUUID(),
  deliveryA: randomUUID(),
  deliveryB: randomUUID(),
};
const hashingSecret = `preview-inbound-${marker}-secret-at-least-32-characters`;
const [matchedReceipt] = parseCommunicationBrevoInboundEnvelope({ items: [{
  MessageId: `<inbound-${marker}@example.test>`,
  InReplyTo: `<outbound-${marker}@example.test>`,
  To: [`communication-${marker}@example.test`],
}] }, hashingSecret);
const [unmatchedReceipt] = parseCommunicationBrevoInboundEnvelope({ items: [{
  MessageId: `<unmatched-${marker}@example.test>`,
  To: [`communication-${marker}@example.test`],
}] }, hashingSecret);
assert.ok(matchedReceipt.inReplyToHash);

let rolledBack = false;
try {
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) values (
        '00000000-0000-0000-0000-000000000000', ${ids.user}::uuid,
        'authenticated', 'authenticated', ${`communication-inbound-${marker}@example.test`}, '',
        transaction_timestamp(), '{"provider":"email","providers":["email"]}'::jsonb,
        '{"fixture":true}'::jsonb, transaction_timestamp(), transaction_timestamp()
      )
    `);
    await tx.insert(institutions).values([
      { id: ids.institutionA, slug: `preview-inbound-a-${marker}`, name: "Preview Inbound A" },
      { id: ids.institutionB, slug: `preview-inbound-b-${marker}`, name: "Preview Inbound B" },
    ]);
    await tx.insert(communications).values([
      {
        id: ids.communicationA,
        institutionId: ids.institutionA,
        sourceType: "direct_text",
        sourceFingerprint: "a".repeat(64),
        sourceLabel: "Réponse entrante fictive A",
        status: "approved",
        approvedBy: ids.user,
        approvedAt: new Date(),
        createdBy: ids.user,
      },
      {
        id: ids.communicationB,
        institutionId: ids.institutionB,
        sourceType: "direct_text",
        sourceFingerprint: "b".repeat(64),
        sourceLabel: "Réponse entrante fictive B",
        status: "approved",
        approvedBy: ids.user,
        approvedAt: new Date(),
        createdBy: ids.user,
      },
    ]);
    await tx.insert(communicationVersions).values([
      {
        id: ids.versionA,
        institutionId: ids.institutionA,
        communicationId: ids.communicationA,
        version: 1,
        status: "approved",
        title: "Communication fictive A",
        bodyMarkdown: "Contenu fictif A.",
        contentHash: "c".repeat(64),
        createdBy: ids.user,
        approvedBy: ids.user,
        approvedAt: new Date(),
      },
      {
        id: ids.versionB,
        institutionId: ids.institutionB,
        communicationId: ids.communicationB,
        version: 1,
        status: "approved",
        title: "Communication fictive B",
        bodyMarkdown: "Contenu fictif B.",
        contentHash: "d".repeat(64),
        createdBy: ids.user,
        approvedBy: ids.user,
        approvedAt: new Date(),
      },
    ]);
    await tx.insert(communicationDeliveries).values([
      {
        id: ids.deliveryA,
        institutionId: ids.institutionA,
        communicationId: ids.communicationA,
        versionId: ids.versionA,
        version: 1,
        contactRef: `contact:fictive:${marker}:a`,
        status: "sent",
        idempotencyKeyHash: "e".repeat(64),
        providerMessageRef: matchedReceipt.inReplyToHash,
        sentAt: new Date(),
      },
      {
        id: ids.deliveryB,
        institutionId: ids.institutionB,
        communicationId: ids.communicationB,
        versionId: ids.versionB,
        version: 1,
        contactRef: `contact:fictive:${marker}:b`,
        status: "sent",
        idempotencyKeyHash: "f".repeat(64),
        providerMessageRef: matchedReceipt.inReplyToHash,
        sentAt: new Date(),
      },
    ]);

    const first = await persistCommunicationInboundReceipts({
      tx,
      institutionId: ids.institutionA,
      receipts: [matchedReceipt, unmatchedReceipt],
    });
    assert.deepEqual(first, {
      accepted: true,
      received: 2,
      duplicates: 0,
      matched: 1,
      unmatched: 1,
    });

    const replay = await persistCommunicationInboundReceipts({
      tx,
      institutionId: ids.institutionA,
      receipts: [matchedReceipt, unmatchedReceipt],
    });
    assert.deepEqual(replay, {
      accepted: true,
      received: 0,
      duplicates: 2,
      matched: 0,
      unmatched: 0,
    });

    const otherInstitution = await persistCommunicationInboundReceipts({
      tx,
      institutionId: ids.institutionB,
      receipts: [matchedReceipt],
    });
    assert.deepEqual(otherInstitution, {
      accepted: true,
      received: 1,
      duplicates: 0,
      matched: 1,
      unmatched: 0,
    });

    const inboundRows = await tx
      .select({
        institutionId: communicationInbound.institutionId,
        communicationId: communicationInbound.communicationId,
        total: count(),
      })
      .from(communicationInbound)
      .where(inArray(communicationInbound.institutionId, [ids.institutionA, ids.institutionB]))
      .groupBy(communicationInbound.institutionId, communicationInbound.communicationId);
    assert.equal(inboundRows.reduce((sum, row) => sum + row.total, 0), 3);
    assert.equal(
      inboundRows.find((row) => row.institutionId === ids.institutionA && row.communicationId === ids.communicationA)?.total,
      1
    );
    assert.equal(
      inboundRows.find((row) => row.institutionId === ids.institutionB && row.communicationId === ids.communicationB)?.total,
      1
    );
    assert.equal(
      inboundRows.find((row) => row.institutionId === ids.institutionA && row.communicationId === null)?.total,
      1
    );

    const [{ total: eventTotal }] = await tx
      .select({ total: count() })
      .from(communicationEvents)
      .where(inArray(communicationEvents.institutionId, [ids.institutionA, ids.institutionB]));
    assert.equal(eventTotal, 2);

    const privileges = await tx.execute(sql`
      select exists (
        select 1
        from (values
          ('anon', 'public.communication_inbound'),
          ('authenticated', 'public.communication_inbound')
        ) as client_tables(role_name, table_name)
        cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as privileges(privilege_name)
        where has_table_privilege(role_name, table_name, privilege_name)
      ) as exposed
    `);
    assert.equal(privileges[0]?.exposed, false);
    throw ROLLBACK_RECIPE;
  });
} catch (error) {
  if (error !== ROLLBACK_RECIPE) throw error;
  rolledBack = true;
}
assert.equal(rolledBack, true);

for (const [table, column, values] of [
  [communicationEvents, communicationEvents.institutionId, [ids.institutionA, ids.institutionB]],
  [communicationInbound, communicationInbound.institutionId, [ids.institutionA, ids.institutionB]],
  [communicationDeliveries, communicationDeliveries.institutionId, [ids.institutionA, ids.institutionB]],
  [communications, communications.institutionId, [ids.institutionA, ids.institutionB]],
  [institutions, institutions.id, [ids.institutionA, ids.institutionB]],
]) {
  const [{ total }] = await db.select({ total: count() }).from(table).where(inArray(column, values));
  assert.equal(total, 0);
}

const userRows = await db.execute(sql`
  select count(*)::integer as total from auth.users where id = ${ids.user}::uuid
`);
assert.equal(userRows[0]?.total, 0);

console.log(JSON.stringify({
  target: "preview",
  scenario: "communication_inbound_replay",
  replay: "idempotent",
  institutions: 2,
  inboundRows: 3,
  events: 2,
  rollback: "verified",
  residue: 0,
}));

import { createHash, createHmac, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { db } from "../../db/index.js";
import { communicationDeliveries, communications, communicationVersions } from "../../db/schema.js";
import { assertMappingComplete, buildNominativeImportReport, parseDelimitedFile, type DirectoryBeneficiary, type NominativeColumnMapping, type NominativeImportReport } from "../../shared/nominative-import.js";
import { assertDiffusableNominativeValue, parseBeneficiaryRef, parseNominativeValueRecord, parseSchoolYear } from "../../shared/nominative-value-policy.js";
import { freezeNominativeBatch, prepareNominativeDeliveryRows, type FrozenNominativeBatch } from "../../shared/nominative-batch.js";
import { mergeNominativeMessage, parseNominativeBeneficiaryContext, parseNominativeTemplate, type NominativeTemplate } from "../../shared/nominative-merge.js";
import { encryptNominativePayload, decryptNominativePayload, nominativePrivateFingerprint, type NominativeEncryptionConfig } from "../../shared/nominative-private-store.js";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PrivateRow = { beneficiary_ref: string; contact_ref: string; value_version: string; key_version: string; iv: string; auth_tag: string; ciphertext: string; revoked_at: Date | null };
type StoredImport = { id: string; institution_id: string; source_fingerprint: string; scope_hash: string; status: string; school_year: string; source_ref: string; template: NominativeTemplate; frozen_batch: FrozenNominativeBatch; report: NominativeImportReport; ready_count: number };
const sha256 = () => createHash("sha256");

// Called only by the trusted import worker. The HTTP client must never supply
// the directory: it is resolved from the active institutional/Webmail registry.
export async function persistNominativeImport(input: {
  tx: Transaction; institutionId: string; actorId: string; sourceRef: string;
  schoolYear: string; contents: string; mapping: NominativeColumnMapping;
  valueFunction: unknown; template: unknown; directory: readonly DirectoryBeneficiary[];
  encryption: NominativeEncryptionConfig; fingerprintSecret: string;
}) {
  const sourceRef = parseBeneficiaryRef(input.sourceRef);
  const schoolYear = parseSchoolYear(input.schoolYear);
  const valueFunction = assertDiffusableNominativeValue(input.valueFunction);
  const parsed = parseDelimitedFile(input.contents);
  assertMappingComplete(input.mapping, parsed.headers.length);
  const template = parseNominativeTemplate(input.template);
  const report = buildNominativeImportReport({ rows: parsed.rows, mapping: input.mapping, directory: input.directory });
  if (!report.readyCount) throw new Error("nominative_no_ready_rows");
  const people = new Map(input.directory.map((person) => [person.beneficiaryRef, person]));
  const payloads = report.rows.filter((row) => row.outcome === "ready").map((row) => {
    const person = people.get(row.beneficiaryRef!)!;
    const beneficiary = parseNominativeBeneficiaryContext({ beneficiaryRef: person.beneficiaryRef, firstName: person.firstName, lastName: person.lastName, classLabel: person.classLabel });
    const record = parseNominativeValueRecord({ beneficiaryRef: person.beneficiaryRef, value: row.value, valueFunction, schoolYear, sourceRef }, sha256);
    // Validate the completed message before persisting a ready row.
    mergeNominativeMessage({ template, beneficiary, record });
    const valueVersion = nominativePrivateFingerprint([record], input.fingerprintSecret);
    return { beneficiary, record, contactRef: row.contactRef!, valueVersion };
  });
  // Keep every excluded source line in the approved scope, including unknown
  // identities and duplicate rows. No source row disappears from the count.
  const exclusions = report.rows.filter((row) => row.outcome !== "ready").map((row) => ({
    beneficiaryRef: `source-row:${row.rowNumber.toString().padStart(8, "0")}`,
    reason: ({ value_missing: "valeur_manquante", match_missing: "rapprochement_absent", match_ambiguous: "rapprochement_ambigu", source_duplicate: "doublon_source", contact_missing: "contact_absent", contact_revoked: "contact_revoque" } as const)[row.outcome as Exclude<typeof row.outcome, "ready">],
  }));
  const batch = freezeNominativeBatch({ institutionId: input.institutionId, sourceRef, schoolYear, templateRef: template.templateRef,
    templateHash: createHash("sha256").update(JSON.stringify(template)).digest("hex"),
    lines: payloads.map((row) => ({ beneficiaryRef: row.beneficiary.beneficiaryRef, contactRef: row.contactRef, valueVersion: row.valueVersion })), exclusions }, sha256);
  const safeReport = { ...report, rows: report.rows.map((row) => ({ ...row, value: null })) };
  const fingerprint = nominativePrivateFingerprint([input.institutionId, sourceRef, schoolYear, valueFunction, input.contents,
    Object.entries(input.mapping).sort(([a], [b]) => a.localeCompare(b)), template, batch.scopeHash], input.fingerprintSecret);
  const proposedId = randomUUID();
  const inserted = await input.tx.execute(sql`
    insert into public.communication_nominative_imports
      (id, institution_id, source_ref, school_year, source_fingerprint, scope_hash, template, report, frozen_batch, ready_count, created_by)
    values (${proposedId}::uuid, ${input.institutionId}::uuid, ${sourceRef}, ${schoolYear}, ${fingerprint}, ${batch.scopeHash},
      ${JSON.stringify(template)}::jsonb, ${JSON.stringify(safeReport)}::jsonb, ${JSON.stringify(batch)}::jsonb, ${batch.readyCount}, ${input.actorId}::uuid)
    on conflict (institution_id, source_fingerprint) do nothing returning id
  `);
  const [stored] = Array.from(await input.tx.execute(sql`
    select * from public.communication_nominative_imports where institution_id = ${input.institutionId}::uuid and source_fingerprint = ${fingerprint} for update
  `)) as unknown as StoredImport[];
  if (!stored || stored.status === "revoked" || stored.scope_hash !== batch.scopeHash) throw new Error("nominative_import_conflict");
  if (inserted.length) {
    for (const payload of payloads) {
      const envelope = encryptNominativePayload({ beneficiary: payload.beneficiary, record: payload.record },
        { institutionId: input.institutionId, importId: stored.id, beneficiaryRef: payload.beneficiary.beneficiaryRef }, input.encryption);
      await input.tx.execute(sql`
        insert into public.communication_nominative_values
          (import_id, institution_id, beneficiary_ref, contact_ref, value_version, key_version, iv, auth_tag, ciphertext)
        values (${stored.id}::uuid, ${input.institutionId}::uuid, ${payload.beneficiary.beneficiaryRef}, ${payload.contactRef}, ${payload.valueVersion},
          ${envelope.keyVersion}, ${envelope.iv}, ${envelope.authTag}, ${envelope.ciphertext})
      `);
    }
  }
  return { id: stored.id, scopeHash: stored.scope_hash, status: stored.status, report: safeReport, duplicate: !inserted.length };
}

export async function loadNominativeMessages(input: { tx: Transaction; institutionId: string; importId: string; encryption: (version: string) => NominativeEncryptionConfig; fingerprintSecret: string }) {
  const [stored] = Array.from(await input.tx.execute(sql`
    select * from public.communication_nominative_imports where id = ${input.importId}::uuid and institution_id = ${input.institutionId}::uuid for update
  `)) as unknown as StoredImport[];
  if (!stored || stored.status === "revoked") throw new Error("nominative_import_unavailable");
  const rows = Array.from(await input.tx.execute(sql`
    select * from public.communication_nominative_values where import_id = ${input.importId}::uuid and institution_id = ${input.institutionId}::uuid order by beneficiary_ref for update
  `)) as unknown as PrivateRow[];
  if (rows.length !== stored.ready_count) throw new Error("nominative_import_incomplete");
  const messages = rows.map((row) => {
    if (row.revoked_at) throw new Error("nominative_value_revoked");
    const payload = decryptNominativePayload({ keyVersion: row.key_version, iv: row.iv, authTag: row.auth_tag, ciphertext: row.ciphertext },
      { institutionId: input.institutionId, importId: input.importId, beneficiaryRef: row.beneficiary_ref }, input.encryption(row.key_version)) as { beneficiary: unknown; record: Record<string, unknown> };
    const beneficiary = parseNominativeBeneficiaryContext(payload.beneficiary);
    const { valueClass: _class, valueVersion: _version, ...recordInput } = payload.record;
    const record = parseNominativeValueRecord(recordInput, sha256);
    if (record.beneficiaryRef !== row.beneficiary_ref || beneficiary.beneficiaryRef !== row.beneficiary_ref ||
      record.schoolYear !== stored.school_year || record.sourceRef !== stored.source_ref ||
      nominativePrivateFingerprint([record], input.fingerprintSecret) !== row.value_version) throw new Error("nominative_value_mismatch");
    return { ...mergeNominativeMessage({ template: parseNominativeTemplate(stored.template), beneficiary, record }),
      beneficiaryRef: row.beneficiary_ref, contactRef: row.contact_ref, valueVersion: row.value_version };
  });
  return { stored, messages };
}

export async function approveNominativeImport(input: { tx: Transaction; institutionId: string; importId: string; scopeHash: string; actorId: string }) {
  const rows = await input.tx.execute(sql`
    update public.communication_nominative_imports set status = 'approved', approved_by = ${input.actorId}::uuid, approved_at = transaction_timestamp()
    where id = ${input.importId}::uuid and institution_id = ${input.institutionId}::uuid and scope_hash = ${input.scopeHash} and status = 'ready' returning id
  `);
  if (rows.length) return { approved: true as const, duplicate: false };
  const existing = await input.tx.execute(sql`
    select id from public.communication_nominative_imports where id = ${input.importId}::uuid and institution_id = ${input.institutionId}::uuid and scope_hash = ${input.scopeHash} and status = 'approved'
  `);
  if (!existing.length) throw new Error("nominative_approval_conflict");
  return { approved: true as const, duplicate: true };
}

export async function preparePersistedNominativeDeliveries(input: {
  tx: Transaction; institutionId: string; importId: string; communicationId: string; versionId: string; version: number;
  encryption: (version: string) => NominativeEncryptionConfig; fingerprintSecret: string; idempotencySecret: string;
  // Fresh Webmail resolution of the exact beneficiary/contact pairs. No addresses.
  currentContacts: ReadonlyMap<string, { contactRef: string; revoked: boolean }>;
}) {
  const { stored, messages } = await loadNominativeMessages(input);
  if (stored.status !== "approved") throw new Error("nominative_approval_required");
  for (const message of messages) {
    const current = input.currentContacts.get(message.beneficiaryRef);
    if (!current || current.revoked || current.contactRef !== message.contactRef) throw new Error("nominative_contact_changed");
  }
  const [scope] = await input.tx.select({ currentVersion: communications.currentVersion, status: communications.status, versionStatus: communicationVersions.status })
    .from(communications).innerJoin(communicationVersions, and(eq(communicationVersions.communicationId, communications.id), eq(communicationVersions.institutionId, communications.institutionId)))
    .where(and(eq(communications.id, input.communicationId), eq(communications.institutionId, input.institutionId), eq(communicationVersions.id, input.versionId), eq(communicationVersions.version, input.version)))
    .for("update");
  if (!scope || scope.currentVersion !== input.version || !["approved", "published"].includes(scope.status) || !["approved", "published"].includes(scope.versionStatus)) throw new Error("nominative_communication_not_approved");
  const prepared = prepareNominativeDeliveryRows({ batch: stored.frozen_batch, communicationId: input.communicationId, versionId: input.versionId, version: input.version, secret: input.idempotencySecret, hmacFactory: (secret) => createHmac("sha256", secret) });
  const deliveries = [];
  for (const row of prepared) {
    const inserted = await input.tx.insert(communicationDeliveries).values({ institutionId: input.institutionId, communicationId: input.communicationId, versionId: input.versionId, version: input.version,
      contactRef: row.contactRef, channel: "email", status: "prepared", idempotencyKeyHash: row.idempotencyKeyHash, resolutionHash: stored.scope_hash })
      .onConflictDoNothing().returning({ id: communicationDeliveries.id });
    const [delivery] = await input.tx.select().from(communicationDeliveries).where(and(eq(communicationDeliveries.institutionId, input.institutionId), eq(communicationDeliveries.idempotencyKeyHash, row.idempotencyKeyHash))).for("update");
    if (!delivery || delivery.contactRef !== row.contactRef || delivery.resolutionHash !== stored.scope_hash || delivery.communicationId !== input.communicationId || delivery.versionId !== input.versionId) throw new Error("nominative_delivery_conflict");
    await input.tx.execute(sql`
      insert into public.communication_nominative_delivery_values(delivery_id, institution_id, import_id, beneficiary_ref)
      values (${delivery.id}::uuid, ${input.institutionId}::uuid, ${input.importId}::uuid, ${row.beneficiaryRef}) on conflict (delivery_id) do nothing
    `);
    const message = messages.find((item) => item.beneficiaryRef === row.beneficiaryRef)!;
    deliveries.push({ deliveryId: delivery.id, duplicate: !inserted.length, idempotencyKeyHash: row.idempotencyKeyHash, resolutionHash: stored.scope_hash, message });
  }
  return deliveries;
}

// Commit this reservation BEFORE any network call. A process loss leaves
// 'dispatching', displayed as 'result_uncertain', and cannot reserve again.
// Reconciliation is read-only toward the provider; never a blind resend.
export async function reserveNominativeDispatch(input: { tx: Transaction; institutionId: string; deliveryId: string }) {
  const rows = await input.tx.execute(sql`
    update public.communication_nominative_delivery_values as value
    set dispatch_state = 'dispatching', dispatched_at = transaction_timestamp()
    from public.communication_nominative_imports as import, public.communication_nominative_values as personal
    where value.delivery_id = ${input.deliveryId}::uuid and value.institution_id = ${input.institutionId}::uuid
      and value.dispatch_state = 'prepared' and import.id = value.import_id and import.institution_id = value.institution_id
      and import.status = 'approved' and personal.import_id = value.import_id and personal.institution_id = value.institution_id
      and personal.beneficiary_ref = value.beneficiary_ref and personal.revoked_at is null
      and exists (select 1 from public.communication_settings as settings
        where settings.institution_id = value.institution_id and settings.module_enabled and settings.sending_enabled)
      and exists (select 1 from public.communication_deliveries as delivery
        join public.communications as communication on communication.id = delivery.communication_id and communication.institution_id = delivery.institution_id
        join public.communication_versions as version on version.id = delivery.version_id and version.institution_id = delivery.institution_id
        where delivery.id = value.delivery_id and delivery.institution_id = value.institution_id
          and delivery.status = 'prepared' and delivery.provider_message_ref is null
          and communication.status in ('approved', 'published') and version.status in ('approved', 'published')
          and communication.current_version = delivery.version and version.version = delivery.version)
    returning value.delivery_id
  `);
  return { reserved: rows.length === 1 };
}

export async function readNominativeDispatchState(input: { tx: Transaction; institutionId: string; deliveryId: string }) {
  const [row] = Array.from(await input.tx.execute(sql`
    select dispatch_state from public.communication_nominative_delivery_values
    where delivery_id = ${input.deliveryId}::uuid and institution_id = ${input.institutionId}::uuid
  `)) as { dispatch_state: string }[];
  if (!row) throw new Error("nominative_delivery_unavailable");
  return row.dispatch_state === "dispatching" || row.dispatch_state === "uncertain" ? "result_uncertain" : row.dispatch_state;
}

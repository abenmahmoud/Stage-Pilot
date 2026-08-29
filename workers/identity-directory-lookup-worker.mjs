import { createHash, createHmac } from "node:crypto";
import postgres from "postgres";
import {
  decryptIdentityLookupRequest,
  encryptIdentityLookupResult,
  identityLookupWorkerConfig,
} from "../shared/identity-directory-lookup-crypto.mjs";
import {
  decryptIdentityVaultPayload,
  identityVaultKeyForVersion,
} from "./identity-directory-vault.mjs";

const databaseUrl = process.env.DATABASE_URL;
const contactPepper = process.env.IDENTITY_CONTACT_PEPPER;
if (!databaseUrl || !contactPepper) {
  throw new Error("DATABASE_URL and IDENTITY_CONTACT_PEPPER are required");
}
if (contactPepper.length < 32) throw new Error("IDENTITY_CONTACT_PEPPER is too short");
const lookupConfig = identityLookupWorkerConfig();
const sql = postgres(databaseUrl, { prepare: false, max: 1, idle_timeout: 20 });

function normalizeEmail(value) {
  const normalized = String(value ?? "").normalize("NFKC").trim().toLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("lookup_query_invalid");
  }
  return normalized;
}

function normalizePhone(value) {
  let normalized = String(value ?? "").normalize("NFKC").trim().replace(/[\s().-]/g, "");
  if (normalized.startsWith("00")) normalized = `+${normalized.slice(2)}`;
  if (/^0\d{9}$/.test(normalized)) normalized = `+33${normalized.slice(1)}`;
  if (!normalized.startsWith("+")) normalized = `+${normalized}`;
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new Error("lookup_query_invalid");
  return normalized;
}

function normalizeRef(value) {
  const normalized = String(value ?? "").normalize("NFKC").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/.test(normalized)) {
    throw new Error("lookup_query_invalid");
  }
  return normalized;
}

function requestPayload(value, row) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.schema !== 1) {
    throw new Error("lookup_request_invalid");
  }
  for (const [field, expected] of [
    ["requestId", row.id],
    ["institutionId", row.institution_id],
    ["actorId", row.actor_id],
    ["searchType", row.search_type],
    ["reasonCategory", row.reason_category],
  ]) {
    if (value[field] !== expected) throw new Error("lookup_request_context_mismatch");
  }
  if (!["academic_email", "personal_email", "phone", "person_ref"].includes(value.searchType)) {
    throw new Error("lookup_request_invalid");
  }
  if (typeof value.justification !== "string" || value.justification.length < 20 || value.justification.length > 500) {
    throw new Error("lookup_request_invalid");
  }
  if (createHash("sha256").update(value.justification, "utf8").digest("hex") !== row.justification_hash) {
    throw new Error("lookup_request_context_mismatch");
  }
  if (typeof value.responseKey !== "string") throw new Error("lookup_request_invalid");
  const responseKey = Buffer.from(value.responseKey, "base64");
  if (responseKey.length !== 32 || responseKey.toString("base64") !== value.responseKey) {
    throw new Error("lookup_request_invalid");
  }
  const expiresAt = new Date(value.expiresAt);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() !== row.expires_at.getTime()) {
    throw new Error("lookup_request_context_mismatch");
  }
  return { ...value, responseKey };
}

function lookupFactor(searchType, query) {
  if (searchType === "person_ref") return { column: "person_ref", value: normalizeRef(query) };
  const normalized = searchType === "phone" ? normalizePhone(query) : normalizeEmail(query);
  const column = searchType === "academic_email"
    ? "academic_email_hash"
    : searchType === "personal_email"
      ? "personal_email_hash"
      : "phone_hash";
  return {
    column,
    value: createHmac("sha256", contactPepper).update(normalized).digest("hex"),
  };
}

async function findMatches(row, payload) {
  const factor = lookupFactor(payload.searchType, payload.query);
  return sql`
    select r.person_ref, r.person_type, r.class_ref, r.service_code,
           i.id as import_id, i.activated_at,
           p.key_version, p.payload_schema, p.iv, p.auth_tag, p.ciphertext
    from public.identity_directory_imports i
    join public.identity_directory_rows r
      on r.import_id = i.id and r.institution_id = i.institution_id
    join public.identity_directory_private_rows p
      on p.import_id = r.import_id and p.institution_id = r.institution_id
      and p.person_ref = r.person_ref
    where i.institution_id = ${row.institution_id}
      and i.status = 'active'
      and r.record_type = 'person'
      and r.validation_status in ('valid', 'warning')
      and (r.valid_from is null or r.valid_from <= current_date)
      and (r.valid_until is null or r.valid_until >= current_date)
      and ${sql(factor.column)} = ${factor.value}
    order by r.row_number
    limit 2
  `;
}

async function finalize(row, status, options = {}) {
  await sql.begin(async (transaction) => {
    const [updated] = await transaction`
      update public.identity_directory_lookup_requests
      set status = ${status}, matched_import_id = ${options.matchedImportId ?? null},
          request_schema = null, request_key_version = null,
          request_wrapped_key = null, request_iv = null,
          request_auth_tag = null, request_ciphertext = null,
          result_schema = ${options.envelope?.schema ?? null},
          result_iv = ${options.envelope?.iv ?? null},
          result_auth_tag = ${options.envelope?.authTag ?? null},
          result_ciphertext = ${options.envelope?.ciphertext ?? null},
          result_count = ${options.resultCount ?? null},
          error_code = ${options.errorCode ?? null}, completed_at = now()
      where id = ${row.id} and institution_id = ${row.institution_id}
        and status in ('queued', 'processing')
      returning actor_id, search_type
    `;
    if (updated) {
      await transaction`
        insert into public.identity_directory_audit (
          institution_id, resource_type, resource_id, action, actor_id, summary
        ) values (
          ${row.institution_id}, 'lookup_request', ${row.id}, 'complete_lookup',
          ${updated.actor_id}, ${transaction.json({
            status,
            searchType: updated.search_type,
            resultCount: options.resultCount ?? 0,
            matchedImportId: options.matchedImportId ?? null,
          })}
        )
      `;
    }
    await transaction`select pgmq.delete('identity_directory_lookup', ${row.msg_id}::bigint)`;
  });
}

async function processMessage(message) {
  const requestId = message.message?.request_id;
  const institutionId = message.message?.institution_id;
  if (typeof requestId !== "string" || typeof institutionId !== "string") {
    await sql`select pgmq.archive('identity_directory_lookup', ${message.msg_id}::bigint)`;
    return;
  }
  const [row] = await sql.begin(async (transaction) => {
    const [locked] = await transaction`
      select *
      from public.identity_directory_lookup_requests
      where id = ${requestId} and institution_id = ${institutionId}
      for update
    `;
    if (!locked || !["queued", "processing"].includes(locked.status)) {
      await transaction`select pgmq.delete('identity_directory_lookup', ${message.msg_id}::bigint)`;
      return [];
    }
    if (locked.expires_at <= new Date()) {
      await transaction`
        update public.identity_directory_lookup_requests
        set status = 'expired', error_code = 'lookup_expired', completed_at = now(),
            request_schema = null, request_key_version = null,
            request_wrapped_key = null, request_iv = null,
            request_auth_tag = null, request_ciphertext = null
        where id = ${requestId}
      `;
      await transaction`
        insert into public.identity_directory_audit (
          institution_id, resource_type, resource_id, action, actor_id, summary
        ) values (
          ${institutionId}, 'lookup_request', ${requestId}, 'expire_lookup',
          ${locked.actor_id}, ${transaction.json({ previousStatus: locked.status })}
        )
      `;
      await transaction`select pgmq.delete('identity_directory_lookup', ${message.msg_id}::bigint)`;
      return [];
    }
    await transaction`
      update public.identity_directory_lookup_requests
      set status = 'processing', started_at = coalesce(started_at, now()), error_code = null
      where id = ${requestId}
    `;
    return [{ ...locked, msg_id: message.msg_id }];
  });
  if (!row) return;

  const decrypted = decryptIdentityLookupRequest({
    envelope: {
      schema: row.request_schema,
      keyVersion: row.request_key_version,
      wrappedKey: row.request_wrapped_key,
      iv: row.request_iv,
      authTag: row.request_auth_tag,
      ciphertext: row.request_ciphertext,
    },
    requestId: row.id,
    institutionId: row.institution_id,
    actorId: row.actor_id,
    privateKey: lookupConfig.privateKey,
  });
  const payload = requestPayload(decrypted, row);
  const matches = await findMatches(row, payload);
  if (matches.length === 0) return finalize(row, "not_found", { resultCount: 0 });
  if (matches.length > 1) return finalize(row, "ambiguous", { resultCount: 2 });

  const match = matches[0];
  const vault = decryptIdentityVaultPayload({
    envelope: {
      keyVersion: match.key_version,
      payloadSchema: match.payload_schema,
      iv: match.iv,
      authTag: match.auth_tag,
      ciphertext: match.ciphertext,
    },
    institutionId: row.institution_id,
    importId: match.import_id,
    personRef: match.person_ref,
    key: identityVaultKeyForVersion(match.key_version),
  });
  const result = {
    firstName: vault.firstName,
    lastName: vault.lastName,
    personType: match.person_type,
    classRef: match.class_ref,
    serviceCode: match.service_code,
    personRef: match.person_ref,
    matchedBy: payload.searchType,
    directoryVersionId: match.import_id,
    directoryActivatedAt: match.activated_at.toISOString(),
  };
  const envelope = encryptIdentityLookupResult({
    value: result,
    responseKey: payload.responseKey,
    requestId: row.id,
    institutionId: row.institution_id,
    actorId: row.actor_id,
  });
  return finalize(row, "completed", {
    resultCount: 1,
    matchedImportId: match.import_id,
    envelope,
  });
}

async function expireStaleRequests() {
  await sql.begin(async (transaction) => {
    const stale = await transaction`
      select id, institution_id, actor_id, status
      from public.identity_directory_lookup_requests
      where expires_at <= now()
        and status in ('queued', 'processing', 'completed')
      order by expires_at
      limit 100
      for update skip locked
    `;
    for (const row of stale) {
      await transaction`
        update public.identity_directory_lookup_requests
        set status = 'expired', error_code = 'lookup_expired',
            completed_at = coalesce(completed_at, now()),
            request_schema = null, request_key_version = null,
            request_wrapped_key = null, request_iv = null,
            request_auth_tag = null, request_ciphertext = null,
            matched_import_id = null, result_schema = null,
            result_iv = null, result_auth_tag = null,
            result_ciphertext = null, result_count = null
        where id = ${row.id}
      `;
      await transaction`
        insert into public.identity_directory_audit (
          institution_id, resource_type, resource_id, action, actor_id, summary
        ) values (
          ${row.institution_id}, 'lookup_request', ${row.id}, 'expire_lookup',
          ${row.actor_id}, ${transaction.json({ previousStatus: row.status })}
        )
      `;
    }
  });
}

async function main() {
  await expireStaleRequests();
  const messages = await sql`
    select msg_id, read_ct, message
    from pgmq.read('identity_directory_lookup', 90, 5)
  `;
  for (const message of messages) {
    try {
      await processMessage(message);
    } catch {
      if (Number(message.read_ct) >= 5) {
        const requestId = message.message?.request_id;
        const institutionId = message.message?.institution_id;
        if (typeof requestId === "string" && typeof institutionId === "string") {
          await finalize(
            { id: requestId, institution_id: institutionId, actor_id: null, search_type: "unknown", msg_id: message.msg_id },
            "failed",
            { resultCount: 0, errorCode: "lookup_worker_failed" }
          );
        } else {
          await sql`select pgmq.archive('identity_directory_lookup', ${message.msg_id}::bigint)`;
        }
      } else {
        await sql`
          update public.identity_directory_lookup_requests
          set status = 'queued', error_code = 'lookup_retry_pending'
          where id = ${message.message?.request_id ?? null}
            and institution_id = ${message.message?.institution_id ?? null}
            and status = 'processing'
        `;
      }
    }
  }
}

main()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });

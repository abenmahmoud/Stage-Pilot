import {
  createHash,
  createHmac,
  createPublicKey,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import postgres from "postgres";
import {
  decryptIdentityLookupResult,
  encryptIdentityLookupRequest,
  identityLookupWorkerConfig,
} from "../shared/identity-directory-lookup-crypto.mjs";
import {
  encryptIdentityVaultPayload,
  identityVaultConfig,
} from "../workers/identity-directory-vault.mjs";

const EXPECTED_PROJECT_REF = "xijocumlwivhbmffrnlj";
if (process.env.IDENTITY_LOOKUP_TEST_CONFIRM !== "preview-only") {
  throw new Error("Set IDENTITY_LOOKUP_TEST_CONFIRM=preview-only");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !databaseUrl.includes(EXPECTED_PROJECT_REF)) {
  throw new Error("DATABASE_URL does not match the expected preview project");
}
const contactPepper = process.env.IDENTITY_CONTACT_PEPPER;
if (!contactPepper || contactPepper.length < 32) {
  throw new Error("IDENTITY_CONTACT_PEPPER is unavailable");
}

const sql = postgres(databaseUrl, { prepare: false, max: 1, idle_timeout: 20 });
const marker = randomUUID().replaceAll("-", "").slice(0, 12);
const institutionId = randomUUID();
const importId = randomUUID();
const requestId = randomUUID();
const publicActorId = randomUUID();
const personRef = `TEST-OTP-${marker.toUpperCase()}`;
const email = `otp-${marker}@example.test`;
const justification = "Recette fictive du worker privé de vérification OTP.";
const responseKey = randomBytes(32);
const execFileAsync = promisify(execFile);
const lookupWorkerPath = process.env.IDENTITY_LOOKUP_WORKER_PATH || fileURLToPath(
  new URL("../workers/identity-directory-lookup-worker.mjs", import.meta.url),
);

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function readResult() {
  const [row] = await sql`
    select status, error_code, matched_import_id, result_schema, result_iv,
           result_auth_tag, result_ciphertext, result_count
    from public.identity_directory_lookup_requests
    where id = ${requestId}
  `;
  return row;
}

try {
  const [actor] = await sql`
    select user_id from public.institution_memberships
    where status = 'active'
    order by created_at
    limit 1
  `;
  check(actor, "No active preview actor found");

  const workerConfig = identityLookupWorkerConfig();
  const vaultConfig = identityVaultConfig();
  const expiresAt = new Date(Date.now() + 5 * 60_000);
  const encryptedPerson = encryptIdentityVaultPayload({
    value: {
      firstName: "CamilleTest",
      lastName: "MartinTest",
      academicEmail: "",
      personalEmail: email,
      phone: "",
    },
    institutionId,
    importId,
    personRef,
    config: vaultConfig,
  });
  const envelope = encryptIdentityLookupRequest({
    value: {
      schema: 1,
      requestId,
      institutionId,
      actorId: publicActorId,
      searchType: "email",
      query: email,
      reasonCategory: "identity_verification",
      justification,
      responseKey: responseKey.toString("base64"),
      requestedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
    requestId,
    institutionId,
    actorId: publicActorId,
    config: {
      keyVersion: workerConfig.keyVersion,
      publicKey: createPublicKey(workerConfig.privateKey),
    },
  });

  await sql.begin(async (transaction) => {
    await transaction`
      insert into public.institutions (id, slug, name, status)
      values (${institutionId}, ${`test-otp-${marker}`}, '[TEST] OTP privé', 'draft')
    `;
    await transaction`
      insert into public.identity_directory_imports (
        id, institution_id, title, purpose_description, source_type,
        original_name, mime_type, size_bytes, storage_path, checksum, status,
        row_count, valid_row_count, rejected_row_count, uploaded_by,
        approved_by, uploaded_at, approved_at, activated_at
      ) values (
        ${importId}, ${institutionId}, '[TEST] Annuaire OTP',
        'Recette privée fictive du rapprochement exact par email.', 'csv',
        'otp-fictif.csv', 'text/csv', 128, ${`test/${marker}/otp.csv`},
        ${createHash("sha256").update(marker).digest("hex")}, 'active',
        1, 1, 0, ${actor.user_id}, ${actor.user_id}, now(), now(), now()
      )
    `;
    await transaction`
      insert into public.identity_directory_rows (
        institution_id, import_id, source_sheet, row_number, record_type,
        person_ref, person_type, personal_email_hash, valid_from, valid_until,
        validation_status, issues, fingerprint
      ) values (
        ${institutionId}, ${importId}, 'CSV', 2, 'person', ${personRef}, 'student',
        ${createHmac("sha256", contactPepper).update(email).digest("hex")},
        current_date, current_date + 30, 'valid', '[]'::jsonb,
        ${createHash("sha256").update(`row:${marker}`).digest("hex")}
      )
    `;
    await transaction`
      insert into public.identity_directory_private_rows (
        institution_id, import_id, person_ref, key_version, payload_schema,
        iv, auth_tag, ciphertext
      ) values (
        ${institutionId}, ${importId}, ${personRef}, ${encryptedPerson.keyVersion},
        ${encryptedPerson.payloadSchema}, ${encryptedPerson.iv},
        ${encryptedPerson.authTag}, ${encryptedPerson.ciphertext}
      )
    `;
    await transaction`
      insert into public.identity_directory_lookup_requests (
        id, institution_id, actor_id, public_actor_id, search_type,
        reason_category, justification_hash, request_schema,
        request_key_version, request_wrapped_key, request_iv,
        request_auth_tag, request_ciphertext, expires_at
      ) values (
        ${requestId}, ${institutionId}, null, ${publicActorId}, 'email',
        'identity_verification',
        ${createHash("sha256").update(justification).digest("hex")},
        ${envelope.schema}, ${envelope.keyVersion}, ${envelope.wrappedKey},
        ${envelope.iv}, ${envelope.authTag}, ${envelope.ciphertext}, ${expiresAt}
      )
    `;
    await transaction`
      select pgmq.send(
        'identity_directory_lookup',
        ${JSON.stringify({ schema: 1, request_id: requestId, institution_id: institutionId })}::jsonb
      )
    `;
  });

  await execFileAsync(process.execPath, [lookupWorkerPath], {
    env: process.env,
    timeout: 20_000,
    windowsHide: true,
  });
  const resultRow = await readResult();
  check(resultRow, "Lookup request disappeared");
  if (resultRow.status === "queued" || resultRow.status === "processing") {
    const [queueState] = await sql`
      select count(*)::int as messages,
             coalesce(max(read_ct), 0)::int as read_count
      from pgmq.q_identity_directory_lookup
      where message->>'request_id' = ${requestId}
    `;
    throw new Error(
      `Lookup worker left the fictitious request ${resultRow.status}`
      + ` (${resultRow.error_code ?? "no_error"}; messages=${queueState.messages}; reads=${queueState.read_count})`,
    );
  }
  check(resultRow.status === "completed", `Unexpected lookup status: ${resultRow.status}`);
  check(resultRow.result_count === 1, "Lookup did not return exactly one match");
  const result = decryptIdentityLookupResult({
    envelope: {
      schema: resultRow.result_schema,
      iv: resultRow.result_iv,
      authTag: resultRow.result_auth_tag,
      ciphertext: resultRow.result_ciphertext,
    },
    responseKey,
    requestId,
    institutionId,
    actorId: publicActorId,
  });
  check(result.personRef === personRef, "Lookup returned the wrong person");
  check(result.personType === "student", "Lookup returned the wrong person type");
  check(result.directoryVersionId === importId, "Lookup returned the wrong directory version");
  console.log(JSON.stringify({ target: "preview", fictitious: true, lookup: "completed", resultCount: 1 }));
} finally {
  await sql`delete from public.identity_directory_lookup_requests where id = ${requestId}`;
  await sql`delete from pgmq.q_identity_directory_lookup where message->>'request_id' = ${requestId}`;
  await sql`delete from public.institutions where id = ${institutionId}`;
  const [leftovers] = await sql`
    select
      (select count(*)::int from public.institutions where id = ${institutionId}) as institutions,
      (select count(*)::int from public.identity_directory_lookup_requests where id = ${requestId}) as lookups,
      (select count(*)::int from pgmq.q_identity_directory_lookup where message->>'request_id' = ${requestId}) as queued
  `;
  console.log(JSON.stringify({ cleanup: leftovers }));
  await sql.end({ timeout: 5 });
}

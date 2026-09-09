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
  sealIdentityLookupReceipt,
  openIdentityLookupReceipt,
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
  process.env[`IDENTITY_DIRECTORY_LOOKUP_PUBLIC_KEY_${workerConfig.keyVersion.toUpperCase()}`] = createPublicKey(workerConfig.privateKey).export({format:"der",type:"spki"}).toString("base64");
  const vaultConfig = identityVaultConfig();
  const expiresAt = new Date(Date.now() + 5 * 60_000);
  const encryptedPerson = encryptIdentityVaultPayload({
    value: {
      firstName: "CamilleTest",
      lastName: "MartinTest",
      academicEmail: "",
      personalEmail: email,
      phone: "+33600000057",
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
      searchType: "identity",
      query: { claimedProfile: "student", claimedFirstName: "CamilleTest", claimedLastName: "MartinTest" },
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
        ${requestId}, ${institutionId}, null, ${publicActorId}, 'identity',
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

  const { randomBytes: freshBytes } = await import('node:crypto');
  process.env.IDENTITY_DEVICE_ACCESS_ENABLED = 'true';
  process.env.IDENTITY_DIRECTORY_LOOKUP_RECEIPT_SECRET = freshBytes(32).toString('base64');
  process.env.SUPPORT_HASH_SECRET = 'fictitious-support-secret-for-private-recette';
  process.env.IDENTITY_DEVICE_OTP_SECRET = 'fictitious-otp-secret-for-private-recette';
  process.env.BREVO_API_KEY = 'fictitious-key-no-provider-access';
  process.env.SUPPORT_FROM_EMAIL = 'test@example.test';
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'fake-test-key';
  globalThis.WebSocket ||= (await import('ws')).default;
  const assert = (await import('node:assert/strict')).default;
  const { default: statusHandler } = await import('../api/identity/device/status.ts');
  const { default: selectHandler } = await import('../api/identity/device/select.ts');
  const { default: verifyHandler } = await import('../api/identity/device/verify.ts');
  const { personalHash } = await import('../api/_shared/support.ts');
  const { identityDeviceCode } = await import('../api/_shared/identity-device-access.ts');
  const { client: apiClient } = await import('../db/index.ts');
  const receiptKey = Buffer.from(process.env.IDENTITY_DIRECTORY_LOOKUP_RECEIPT_SECRET, 'base64');
  const deviceId = `test-device-${marker}`;
  let cookie = 'lyceegest_identity_challenge=' + encodeURIComponent(sealIdentityLookupReceipt({
    schema: 2, challengeId: publicActorId, requestId, institutionId, responseKey: responseKey.toString('base64'),
    contactType: null, contact: null, claimedProfile: 'student', claimedFirstName: 'CamilleTest', claimedLastName: 'MartinTest',
    deviceId, expiresAt: new Date(Date.now()+600000).toISOString(),
  }, receiptKey));
  const sent = [];
  globalThis.fetch = async (url, options) => {
    assert.ok(String(url).startsWith('https://api.brevo.com/v3/'), 'Only simulated Brevo is allowed');
    const body = JSON.parse(options.body);
    assert.equal(options.headers['api-key'], 'fictitious-key-no-provider-access');
    assert.ok(body.recipient === '33600000057' || body.to?.[0]?.email === email, 'Only fictitious recipient');
    sent.push(body);
    return new Response(JSON.stringify({messageId:'fake-provider-id'}), {status:201, headers:{'Content-Type':'application/json'}});
  };
  async function call(handler, body) {
    const result = { status: 200, data: null, headers: {} };
    const res = { statusCode: 200, headersSent: false, getHeader: name=>result.headers[name], setHeader: (name,value)=>{result.headers[name]=value;},
      status(code){this.statusCode=code;result.status=code;return this;}, json(data){result.data=data;this.headersSent=true;return this;} };
    await handler({method:'POST',body,headers:{cookie}},res);
    const updated = result.headers['Set-Cookie'];
    if (updated) {
      const line = (Array.isArray(updated)?updated:[updated]).find(v=>v.startsWith('lyceegest_identity_challenge=') && !v.includes('Max-Age=0'));
      if(line) cookie = line.split(';')[0];
    }
    return result;
  }
  try {
    await sql`insert into public.identity_device_challenges(id,institution_id,lookup_request_id,device_key_hash,contact_hash,expires_at)
      values(${publicActorId},${institutionId},${requestId},${personalHash(`identity-device:${institutionId}:${deviceId}`)},${personalHash('fictitious-unselected')},${new Date(Date.now()+600000)})`;
    const choices = await call(statusHandler);
    assert.equal(choices.status,200); assert.equal(choices.data.status,'choose_contact');
    assert.deepEqual(choices.data.options.map(o=>o.id),['phone','personal_email']);
    assert.ok(!JSON.stringify(choices.data).includes(email));
    assert.ok(!JSON.stringify(choices.data).includes('+33600000057')); assert.equal(sent.length,0);
    assert.equal((await call(selectHandler,{optionId:'phone',contact:'attacker@example.test'})).status,400);
    assert.equal((await call(selectHandler,{optionId:'academic_email'})).status,400);
    assert.equal((await call(verifyHandler,{code:identityDeviceCode(publicActorId)})).status,400);
    assert.equal(sent.length,0);
    const optionId = process.env.TEST_CONTACT_CHANNEL === 'email' ? 'personal_email' : 'phone';
    const pair = await Promise.all([call(selectHandler,{optionId}),call(selectHandler,{optionId})]);
    assert.deepEqual(pair.map(r=>r.status).sort(),[200,409]); assert.equal(sent.length,1);
    for(let i=0;i<3;i++) assert.equal((await call(statusHandler)).data.status,'code_sent');
    assert.equal(sent.length,1);
    const correct = identityDeviceCode(publicActorId);
    const wrong = correct === '000000' ? '111111' : '000000';
    assert.equal((await call(verifyHandler,{code:wrong})).status,400);
    const verified = await call(verifyHandler,{code:correct});
    assert.equal(verified.status,200); assert.equal(verified.data.status,'verified');
    assert.equal(verified.data.verifiedContact.contactType,optionId==='phone'?'phone':'email');
    assert.ok(verified.headers['Set-Cookie'].some(c=>c.startsWith('lyceegest_identity_session=') && c.includes('HttpOnly')));
    assert.equal((await call(verifyHandler,{code:correct})).status,400);
    assert.equal(sent.length,1);
    const otherRef = `${personRef}-D`;
    const other = encryptIdentityVaultPayload({ value: { firstName:'CamilleTest',lastName:'MartinTest',academicEmail:'',personalEmail:'other@example.test',phone:'' },
      institutionId,importId,personRef:otherRef,config:vaultConfig });
    await sql`insert into public.identity_directory_rows(institution_id,import_id,source_sheet,row_number,record_type,person_ref,person_type,validation_status,issues,fingerprint)
      values(${institutionId},${importId},'CSV',3,'person',${otherRef},'student','valid','[]'::jsonb,${createHash('sha256').update(otherRef).digest('hex')})`;
    await sql`insert into public.identity_directory_private_rows(institution_id,import_id,person_ref,key_version,payload_schema,iv,auth_tag,ciphertext)
      values(${institutionId},${importId},${otherRef},${other.keyVersion},${other.payloadSchema},${other.iv},${other.authTag},${other.ciphertext})`;
    await sql`update public.identity_directory_lookup_requests set status='queued',
      request_schema=${envelope.schema},request_key_version=${envelope.keyVersion},request_wrapped_key=${envelope.wrappedKey},
      request_iv=${envelope.iv},request_auth_tag=${envelope.authTag},request_ciphertext=${envelope.ciphertext},
      result_schema=null,result_iv=null,result_auth_tag=null,result_ciphertext=null,result_count=null,matched_import_id=null,completed_at=null
      where id=${requestId}`;
    await sql`select pgmq.send('identity_directory_lookup',${sql.json({schema:1,request_id:requestId,institution_id:institutionId})}::jsonb)`;
    await execFileAsync(process.execPath,[lookupWorkerPath],{env:process.env,timeout:20000,windowsHide:true});
    const ambiguous = await readResult();
    assert.equal(ambiguous.status,'ambiguous'); assert.equal(ambiguous.result_ciphertext,null);
    assert.equal(sent.length,1);
    console.log(JSON.stringify({fictitious:true,channel:optionId,maskedChoices:true,sendAfterSelectionOnly:true,concurrentSelections:'one_send',otp:'verified_once',realMessages:0}));
    console.log(JSON.stringify({homonyms:'no_contacts_returned'}));
  } finally {
    await sql`delete from public.identity_device_sessions where institution_id=${institutionId}`;
    await sql`delete from public.identity_device_challenges where institution_id=${institutionId}`;
    await apiClient.end({timeout:5});
  }

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

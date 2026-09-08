// Recette locale jetable de la route réelle /api/depot pour l'annuaire, les
// codes et un petit PDF EDT. Les cibles sont codées en dur sur la boucle locale,
// aucun fichier .env n'est lu et toutes les personnes sont fictives.
import assert from "node:assert/strict";
import {
  constants,
  createCipheriv,
  createHash,
  generateKeyPairSync,
  publicEncrypt,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { createServer } from "node:http";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

if (process.argv.length !== 3 || process.argv[2] !== "--local-stack-only") {
  throw new Error("local_stack_confirmation_required");
}

const LOCAL_API_URL = "http://127.0.0.1:54321";
const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const marker = randomUUID().replaceAll("-", "").slice(0, 12);
const institutionId = randomUUID();
const activeDirectoryId = randomUUID();
const institutionSlug = `depot-fictif-${marker}`;
const personRef = `STU-FICTIF-${marker}`;
const identifier = `identifiant-${marker}`;
const codeValue = `code-${marker}-fictif`;
const depotToken = randomBytes(32).toString("base64url");
const actorEmail = `depot-fictif-${marker}@example.test`;
const actorPassword = `Fictif-${randomBytes(18).toString("base64url")}!`;
const encryptionKey = randomBytes(32).toString("base64");
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

const admin = createClient(LOCAL_API_URL, LOCAL_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const createdUser = await admin.auth.admin.createUser({
  email: actorEmail,
  password: actorPassword,
  email_confirm: true,
  app_metadata: { role: "superadmin" },
});
if (createdUser.error || !createdUser.data.user) {
  throw new Error("local_fixture_actor_creation_failed");
}
const actorId = createdUser.data.user.id;

process.env.DATABASE_URL = LOCAL_DATABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL_API_URL;
process.env.VITE_SUPABASE_URL = LOCAL_API_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = LOCAL_SERVICE_ROLE_KEY;
process.env.SUPPORT_INSTITUTION_SLUG = institutionSlug;
process.env.LYCEEGEST_DEPOT_ACTOR_ID = actorId;
process.env.LYCEEGEST_DEPOT_TOKEN_SHA256 = createHash("sha256").update(depotToken).digest("hex");
process.env.LYCEEGEST_CODES_PRIVATE_KEY_PEM_BASE64 = Buffer.from(
  privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  "utf8"
).toString("base64");
process.env.CODE_VAULT_ENCRYPTION_KEY_VERSION = "v1";
process.env.CODE_VAULT_ENCRYPTION_KEY_V1 = encryptionKey;

const database = postgres(LOCAL_DATABASE_URL, {
  max: 1,
  prepare: false,
  connect_timeout: 5,
});

await database`
  insert into public.institutions (id, slug, name, status)
  values (${institutionId}, ${institutionSlug}, 'Lycée fictif — recette Dépôt complète', 'pilot')
`;
await database`
  insert into public.identity_directory_imports
    (id, institution_id, title, purpose_description, source_type, original_name,
     mime_type, size_bytes, storage_path, status, uploaded_by, approved_by,
     uploaded_at, approved_at, activated_at)
  values (
    ${activeDirectoryId}, ${institutionId}, 'Annuaire actif fictif préalable',
    'Fixture locale permettant de vérifier le rapprochement des codes fictifs.',
    'csv', 'annuaire-actif-fictif.csv', 'text/csv', 1024,
    ${`identity-local/${activeDirectoryId}.csv`}, 'active', ${actorId}, ${actorId},
    now(), now(), now()
  )
`;
await database`
  insert into public.identity_directory_rows
    (institution_id, import_id, source_sheet, row_number, record_type, person_ref,
     person_type, class_ref, valid_from, validation_status, fingerprint)
  values (
    ${institutionId}, ${activeDirectoryId}, 'recette-fictive', 2, 'person',
    ${personRef}, 'student', '2F1', '2026-09-01', 'valid',
    ${createHash("sha256").update(`fixture:${personRef}`).digest("hex")}
  )
`;

const routeModule = await import("../api/depot/[type].js");
const { decryptVaultCodeValue } = await import("../shared/code-vault-crypto.js");

function withVercelResponseShim(res) {
  res.status = function status(code) {
    res.statusCode = code;
    return res;
  };
  res.json = function json(data) {
    if (!res.hasHeader("Content-Type")) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    res.end(JSON.stringify(data));
    return res;
  };
  return res;
}

const server = createServer(async (req, res) => {
  withVercelResponseShim(res);
  const url = new URL(req.url, "http://127.0.0.1");
  req.query = { type: url.pathname.split("/").at(-1) };
  try {
    await routeModule.default(req, res);
  } catch {
    if (!res.headersSent) res.status(500).json({ error: "local_recipe_transport_failure" });
  }
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const capturedResponses = [];
let assertions = 0;
function check(value, label) {
  assert.equal(Boolean(value), true, label);
  assertions += 1;
}

async function post(type, body) {
  const response = await fetch(`${baseUrl}/api/depot/${type}`, {
    method: "POST",
    headers: { authorization: `Bearer ${depotToken}` },
    body,
  });
  const text = await response.text();
  capturedResponses.push(text);
  let json = null;
  try { json = JSON.parse(text); } catch { /* la forme est contrôlée par les assertions */ }
  return { status: response.status, json };
}

async function postJson(type, body) {
  const response = await fetch(`${baseUrl}/api/depot/${type}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${depotToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  capturedResponses.push(text);
  let json = null;
  try { json = JSON.parse(text); } catch { /* la forme est contrôlée par les assertions */ }
  return { status: response.status, json };
}

function annuaireForm() {
  const csv = `type_ligne,reference_personne,type_personne,nom,prenom,date_naissance,reference_classe,email,telephone,type_relation,reference_sujet,reference_objet,valide_depuis,valide_jusquau,source,commentaire,actif\nperson,${personRef},student,Fictif,Eleve,2010-04-02,2F1,eleve.${marker}@example.test,,,,,2026-09-01,2027-08-31,ent,Recette locale,true`;
  const report = `Rapport de verification fictif\nlignes_total=1\npersonnes=1\nrelations=0\nreferences_orphelines=0\ndoublons_reference_personne=0\nclasses_distinctes=1\ncolonnes_interdites=0\ncodes_detectes=0\nListe des reference_classe : 2F1`;
  const form = new FormData();
  form.set("fichier", new Blob([csv], { type: "text/csv" }), "annuaire_import.csv");
  form.set("rapport", new Blob([report], { type: "text/plain" }), "rapport_verification.txt");
  form.set("titre", "Annuaire fictif reçu par HTTP");
  return form;
}

function encryptedCodeBundle() {
  const plaintext = Buffer.from(
    `reference_personne,type_code,identifiant,code,genere_le\n${personRef},ent,${identifier},${codeValue},2026-09-08T10:00:00Z`,
    "utf8"
  );
  const key = randomBytes(32);
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from("lyceegest-codes-v1", "ascii"));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  const wrapped = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    key
  );
  const length = Buffer.alloc(2);
  length.writeUInt16BE(wrapped.length);
  key.fill(0);
  plaintext.fill(0);
  return Buffer.concat([Buffer.from("LGC1", "ascii"), length, wrapped, nonce, ciphertext]);
}

function codesForm(bundle) {
  const form = new FormData();
  form.set("fichier", new Blob([bundle], { type: "application/octet-stream" }), "codes-fictifs.enc");
  form.set("annee_scolaire", "2026-2027");
  return form;
}

function edtForm(pdf) {
  const form = new FormData();
  form.set("fichier", new Blob([pdf], { type: "application/pdf" }), "edt-fictif.pdf");
  form.set("annee_scolaire", "2026-2027");
  form.set("titre", "EDT fictif reçu par HTTP");
  form.set("valide_du", "2026-09-08");
  form.set("valide_au", "2027-07-07");
  form.set("fraiche_jusquau", "2026-09-15");
  form.set("source_kind", "classes");
  return form;
}

let annuaireStorage = [];
let edtStorage = [];
try {
  const firstAnnuaire = await post("annuaire", annuaireForm());
  assert.equal(
    firstAnnuaire.status,
    202,
    `annuaire_first_delivery_is_accepted:${JSON.stringify({
      status: firstAnnuaire.status,
      error: firstAnnuaire.json?.error,
    })}`
  );
  assertions += 1;
  check(firstAnnuaire.json?.status === "quarantined" && firstAnnuaire.json?.duplicate === false, "annuaire_waits_for_scan");
  const repeatedAnnuaire = await post("annuaire", annuaireForm());
  check(repeatedAnnuaire.status === 200, "annuaire_repeat_is_idempotent");
  check(repeatedAnnuaire.json?.duplicate === true && repeatedAnnuaire.json?.importId === firstAnnuaire.json?.importId, "annuaire_repeat_reuses_import");
  const annuaireRows = await database`
    select storage_path, validation_summary from public.identity_directory_imports
    where institution_id = ${institutionId} and checksum is not null
  `;
  check(annuaireRows.length === 1, "annuaire_has_one_persisted_import");
  annuaireStorage = [
    annuaireRows[0].storage_path,
    annuaireRows[0].validation_summary.verificationReport.storagePath,
  ];
  const annuaireObject = await admin.storage.from("identity-ingest").download(annuaireStorage[0]);
  check(!annuaireObject.error && (await annuaireObject.data.arrayBuffer()).byteLength > 0, "annuaire_is_in_private_storage");

  const bundle = encryptedCodeBundle();
  const firstCodes = await post("codes", codesForm(bundle));
  check(firstCodes.status === 202 && firstCodes.json?.accepted === 1, "codes_first_delivery_is_stored");
  const repeatedCodes = await post("codes", codesForm(bundle));
  check(repeatedCodes.status === 202 && repeatedCodes.json?.accepted === 0 && repeatedCodes.json?.alreadyPresent === 1, "codes_repeat_does_not_replace_value");
  const [storedCode] = await database`
    select a.id as assignment_id, p.key_version, p.payload_schema, p.iv, p.auth_tag, p.ciphertext,
      ((p.*)::text like ${`%${codeValue}%`}) as plaintext_present
    from public.code_vault_assignments a
    join public.code_vault_private_rows p
      on p.assignment_id = a.id and p.institution_id = a.institution_id
    where a.institution_id = ${institutionId} and a.person_ref = ${personRef} and a.service = 'ent'
  `;
  check(Boolean(storedCode) && storedCode.plaintext_present === false, "code_is_persisted_only_as_ciphertext");
  const revealed = decryptVaultCodeValue({
    envelope: {
      keyVersion: storedCode.key_version,
      payloadSchema: storedCode.payload_schema,
      iv: storedCode.iv,
      authTag: storedCode.auth_tag,
      ciphertext: storedCode.ciphertext,
    },
    institutionId,
    assignmentId: storedCode.assignment_id,
    key: Buffer.from(encryptionKey, "base64"),
  });
  check(revealed === `Identifiant : ${identifier} | Code : ${codeValue}`, "code_ciphertext_round_trip_is_exact");

  const pdf = Buffer.from("%PDF-1.4\n% fichier fictif de recette\n1 0 obj<</Type/Catalog>>endobj\n%%EOF", "utf8");
  const firstEdt = await post("edt", edtForm(pdf));
  check(firstEdt.status === 202, "edt_first_delivery_is_accepted");
  check(firstEdt.json?.status === "quarantined" && firstEdt.json?.duplicate === false, "edt_waits_for_scan");
  const repeatedEdt = await post("edt", edtForm(pdf));
  check(repeatedEdt.status === 200, "edt_repeat_is_idempotent");
  check(repeatedEdt.json?.duplicate === true && repeatedEdt.json?.importId === firstEdt.json?.importId, "edt_repeat_reuses_import");
  const edtRows = await database`
    select storage_bucket, storage_path, checksum from public.schedule_source_versions
    where institution_id = ${institutionId} and checksum = ${createHash("sha256").update(pdf).digest("hex")}
  `;
  check(edtRows.length === 1, "edt_has_one_persisted_version");
  edtStorage = [edtRows[0].storage_path];
  const edtObject = await admin.storage.from(edtRows[0].storage_bucket).download(edtRows[0].storage_path);
  check(!edtObject.error && (await edtObject.data.arrayBuffer()).byteLength === pdf.length, "edt_is_in_private_storage");

  const tabular = Buffer.from(
    `classe,matiere,date,debut,fin\n2F1,Maths,2026-09-08,08:00,09:00\n`,
    "utf8"
  );
  const tabularChecksum = createHash("sha256").update(tabular).digest("hex");
  const tabularReservationBody = {
    mode: "reserve",
    originalName: "edt-classes-fictif.csv",
    sizeBytes: tabular.length,
    schoolYear: "2026-2027",
    title: "EDT tabulaire fictif reçu automatiquement",
    effectiveFrom: "2026-09-08",
    effectiveUntil: "2027-07-07",
    freshUntil: "2026-09-10",
    sourceKind: "classes",
    sourceFormat: "tabular_import",
    mimeType: "text/csv",
    checksum: tabularChecksum,
  };
  const tabularReservation = await postJson("edt", tabularReservationBody);
  check(tabularReservation.status === 201, "edt_tabular_reservation_is_created");
  check(
    tabularReservation.json?.status === "reserved"
      && tabularReservation.json?.duplicate === false
      && tabularReservation.json?.upload?.bucket === "schedule-ingest"
      && typeof tabularReservation.json?.upload?.signedUrl === "string",
    "edt_tabular_reservation_has_private_upload_url"
  );
  const resumedTabularReservation = await postJson("edt", tabularReservationBody);
  check(
    resumedTabularReservation.status === 200
      && resumedTabularReservation.json?.duplicate === true
      && resumedTabularReservation.json?.status === "reserved"
      && resumedTabularReservation.json?.importId === tabularReservation.json.importId
      && typeof resumedTabularReservation.json?.upload?.signedUrl === "string",
    "edt_tabular_interrupted_reservation_can_resume"
  );
  const tabularUpload = await fetch(resumedTabularReservation.json.upload.signedUrl, {
    method: "PUT",
    headers: { "content-type": "text/csv", "x-upsert": "false" },
    body: tabular,
  });
  check(tabularUpload.ok, "edt_tabular_signed_upload_succeeds");
  const tabularConfirmation = await postJson("edt", {
    mode: "confirm",
    importId: tabularReservation.json.importId,
  });
  check(
    tabularConfirmation.status === 202
      && tabularConfirmation.json?.status === "quarantined"
      && tabularConfirmation.json?.duplicate === false,
    "edt_tabular_confirmation_queues_security_scan"
  );
  const repeatedTabular = await postJson("edt", tabularReservationBody);
  check(
    repeatedTabular.status === 200
      && repeatedTabular.json?.duplicate === true
      && repeatedTabular.json?.importId === tabularReservation.json.importId,
    "edt_tabular_repeat_is_idempotent"
  );
  const tabularRows = await database`
    select storage_bucket, storage_path, source_format, mime_type
    from public.schedule_source_versions
    where institution_id = ${institutionId} and checksum = ${tabularChecksum}
  `;
  check(
    tabularRows.length === 1
      && tabularRows[0].source_format === "tabular_import"
      && tabularRows[0].mime_type === "text/csv"
      && tabularRows[0].storage_path.endsWith(".csv"),
    "edt_tabular_metadata_is_persisted_exactly"
  );
  edtStorage.push(tabularRows[0].storage_path);

  const responseLeak = capturedResponses.some((text) => (
    text.includes(codeValue) || text.includes(identifier) || text.includes(depotToken)
  ));
  check(responseLeak === false, "http_responses_expose_no_code_identifier_or_token");
} finally {
  await new Promise((resolve) => server.close(resolve));
  if (annuaireStorage.length) {
    const removed = await admin.storage.from("identity-ingest").remove(annuaireStorage);
    check(!removed.error, "annuaire_storage_cleanup_succeeds");
  }
  if (edtStorage.length) {
    const removed = await admin.storage.from("schedule-ingest").remove(edtStorage);
    check(!removed.error, "edt_storage_cleanup_succeeds");
  }
  await database`delete from pgmq.q_identity_directory_scan where message ->> 'institution_id' = ${institutionId}`;
  await database`delete from pgmq.q_schedule_document_scan where message ->> 'institution_id' = ${institutionId}`;
  await database`delete from public.code_vault_private_rows where institution_id = ${institutionId}`;
  await database`delete from public.code_vault_assignments where institution_id = ${institutionId}`;
  await database`delete from public.institutions where id = ${institutionId}`;
  const [{ fixtureCount }] = await database`
    select count(*)::integer as "fixtureCount"
    from public.institutions where id = ${institutionId}
  `;
  check(fixtureCount === 0, "database_fixture_cleanup_is_verified");
  const deletedUser = await admin.auth.admin.deleteUser(actorId);
  check(!deletedUser.error, "auth_fixture_cleanup_succeeds");
  await database.end();
}

console.log(JSON.stringify({
  target: "127.0.0.1:54321 + 127.0.0.1:54322",
  assertions,
  annuaireIdempotent: true,
  encryptedCodesIdempotent: true,
  edtIdempotent: true,
  edtAutomaticTabularUpload: true,
  privateStorage: true,
  cleanupVerified: true,
  realData: false,
}, null, 2));

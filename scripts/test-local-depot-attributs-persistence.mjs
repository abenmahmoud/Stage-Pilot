// Recette locale jetable du chemin HTTP réel Dépôt Lycée -> attributs chiffrés.
// La cible est volontairement codée en dur sur la pile Supabase locale. Aucun
// .env n'est chargé et aucune URL distante ne peut être héritée.
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
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
const directoryImportId = randomUUID();
const institutionSlug = `depot-attributs-fictif-${marker}`;
const personRef = `STU-FICTIF-${marker}`;
const attributeValue = `Groupe fictif ${randomUUID()}`;
const depotToken = randomBytes(32).toString("base64url");
const wrongToken = randomBytes(32).toString("base64url");
const encryptionKey = randomBytes(32).toString("base64");
const actorEmail = `depot-attributs-${marker}@example.test`;
const actorPassword = `Fictif-${randomBytes(18).toString("base64url")}!`;

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
process.env.VITE_SUPABASE_URL = LOCAL_API_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = LOCAL_SERVICE_ROLE_KEY;
process.env.SUPPORT_INSTITUTION_SLUG = institutionSlug;
process.env.LYCEEGEST_DEPOT_ACTOR_ID = actorId;
process.env.LYCEEGEST_DEPOT_TOKEN_SHA256 = createHash("sha256").update(depotToken).digest("hex");
process.env.PERSON_ATTRIBUTE_ENCRYPTION_KEY_VERSION = "v1";
process.env.PERSON_ATTRIBUTE_ENCRYPTION_KEY_V1 = encryptionKey;

const database = postgres(LOCAL_DATABASE_URL, {
  max: 1,
  prepare: false,
  connect_timeout: 5,
});

const fingerprint = createHash("sha256").update(`fixture:${personRef}`).digest("hex");
await database`
  insert into public.institutions (id, slug, name, status)
  values (${institutionId}, ${institutionSlug}, 'Lycée fictif — recette Dépôt', 'pilot')
`;
await database`
  insert into public.identity_directory_imports
    (id, institution_id, title, purpose_description, source_type, original_name,
     mime_type, size_bytes, storage_path, status, uploaded_by, approved_by,
     uploaded_at, approved_at, activated_at)
  values (
    ${directoryImportId}, ${institutionId}, 'Annuaire fictif de recette',
    'Annuaire exclusivement fictif pour vérifier la persistance locale du Dépôt Lycée.',
    'csv', 'annuaire-fictif.csv', 'text/csv', 1024,
    ${`identity-local/${directoryImportId}.csv`}, 'active', ${actorId}, ${actorId},
    now(), now(), now()
  )
`;
await database`
  insert into public.identity_directory_rows
    (institution_id, import_id, source_sheet, row_number, record_type, person_ref,
     person_type, class_ref, valid_from, validation_status, fingerprint)
  values (
    ${institutionId}, ${directoryImportId}, 'recette-fictive', 2, 'person',
    ${personRef}, 'student', '2F1', '2026-09-01', 'valid', ${fingerprint}
  )
`;

const routeModule = await import("../api/depot/[type].js");
const activationModule = await import("../api/identity/admin/attributes/[id]/activate.js");
const cryptoModule = await import("../shared/person-attribute-crypto.js");

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
  req.query = { type: "attributs" };
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

function fictitiousForm() {
  const csv = `reference_personne,cle,valeur,valide_depuis,valide_jusquau,source\n${personRef},groupe_option,${attributeValue},2026-09-01,2027-08-31,recette_locale_fictive`;
  const form = new FormData();
  form.set("fichier", new Blob([csv], { type: "text/csv" }), "attributs_import.csv");
  return form;
}

async function post(token) {
  const response = await fetch(`${baseUrl}/api/depot/attributs`, {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: fictitiousForm(),
  });
  const text = await response.text();
  capturedResponses.push(text);
  let json = null;
  try { json = JSON.parse(text); } catch { /* forme vérifiée ci-dessous */ }
  return { status: response.status, json };
}

try {
  const missing = await post("");
  check(missing.status === 401, "missing_bearer_is_refused");
  const wrong = await post(wrongToken);
  check(wrong.status === 401, "wrong_bearer_is_refused");

  const first = await post(depotToken);
  check(first.status === 202, "first_delivery_is_accepted");
  check(first.json?.type === "attributs" && first.json?.status === "review", "first_delivery_waits_for_review");
  check(first.json?.rowCount === 1 && first.json?.duplicate === false, "first_delivery_has_expected_counts");
  const importId = first.json?.importId;
  check(typeof importId === "string" && /^[0-9a-f-]{36}$/i.test(importId), "first_delivery_returns_opaque_id");

  const duplicate = await post(depotToken);
  check(duplicate.status === 200, "same_delivery_is_idempotent");
  check(duplicate.json?.duplicate === true && duplicate.json?.importId === importId, "duplicate_reuses_import");

  const [stored] = await database`
    select id, key_version, payload_schema, iv, auth_tag, ciphertext,
           ((person_attribute_rows.*)::text like ${`%${attributeValue}%`}) as plaintext_present
    from public.person_attribute_rows
    where institution_id = ${institutionId} and import_id = ${importId}
  `;
  check(Boolean(stored), "one_encrypted_row_is_persisted");
  check(stored.plaintext_present === false, "plaintext_is_absent_from_persisted_row");
  const decrypted = cryptoModule.decryptPersonAttributeValue({
    envelope: {
      keyVersion: stored.key_version,
      payloadSchema: stored.payload_schema,
      iv: stored.iv,
      authTag: stored.auth_tag,
      ciphertext: stored.ciphertext,
    },
    institutionId,
    importId,
    rowId: stored.id,
    personRef,
    attributeKey: "groupe_option",
  });
  check(decrypted === attributeValue, "ciphertext_round_trip_is_exact");

  const activated = await activationModule.activatePersonAttributeImport({
    institutionId,
    actorId,
    importId,
    justification: "Lot fictif rapproché de l’annuaire local et volume vérifié.",
  });
  check(activated.import.status === "active" && activated.duplicate === false, "reviewed_import_is_activated");
  const activatedAgain = await activationModule.activatePersonAttributeImport({
    institutionId,
    actorId,
    importId,
    justification: "Deuxième appel fictif destiné à vérifier l’idempotence.",
  });
  check(activatedAgain.duplicate === true, "activation_is_idempotent");

  const events = await database`
    select action from public.person_attribute_events
    where institution_id = ${institutionId} and import_id = ${importId}
    order by id asc
  `;
  check(events.map((row) => row.action).join(",") === "receive,activate", "audit_events_are_complete");
  await assert.rejects(
    () => database`update public.person_attribute_events set summary = '{}'::jsonb where import_id = ${importId}`,
    /append-only/i
  );
  assertions += 1;
  await assert.rejects(
    () => database`delete from public.person_attribute_events where import_id = ${importId}`,
    /append-only/i
  );
  assertions += 1;

  const responseLeak = capturedResponses.some((text) => (
    text.includes(attributeValue) || text.includes(depotToken) || text.includes(wrongToken)
  ));
  check(responseLeak === false, "http_responses_expose_no_value_or_token");
} finally {
  await new Promise((resolve) => server.close(resolve));
  await database.end();
}

console.log(JSON.stringify({
  target: "127.0.0.1:54321 + 127.0.0.1:54322",
  assertions,
  encryptedPersistence: true,
  idempotence: true,
  appendOnlyAudit: true,
  cleanup: "pile locale jetable, purgée au prochain supabase db reset",
  realData: false,
}, null, 2));

// Hard-coded disposable loopback target; never inherits DATABASE_URL or loads .env.
// Recette ADVERSE du LOT 4 du plan de lecture du 6 septembre 2026
// (docs/operations/PLAN_LECTURE_COFFRE_2026-09-06.md, « LOT 4 — la recette
// adverse, avec un marqueur traqué partout ») sur PostgreSQL réel jetable.
// Personnes et établissements entièrement fictifs. Jamais `--linked`, jamais
// `db push`, jamais d'URL distante.
//
// Différence assumée avec les recettes adverses déjà existantes
// (`test-local-code-vault-adversarial.mjs`, LOT 6 du 5 septembre ;
// `test-local-code-vault-branchement-adversarial.mjs`, LOT 6 du branchement
// du 6 septembre) : celles-ci gardaient `CODE_VAULT_REVEAL_ENABLED` fermé —
// elles prouvaient que rien ne fuit tant que le drapeau est fermé. Ce
// script-ci ouvre le drapeau, mais UNIQUEMENT dans l'objet `env` passé en
// paramètre à `resolveVaultCodeReveal` via les routes réelles — jamais dans
// `process.env`, jamais dans `.env.local.example`, jamais dans une
// configuration qui survivrait à ce script — pour que le marqueur soit
// RÉELLEMENT déchiffré au moins une fois, exactement comme l'exige le plan
// (« un code fictif [...] est écrit, remis, affiché, puis recherché
// partout »). Sans ouvrir le drapeau ici, la valeur ne serait jamais
// déchiffrée et la recette ne prouverait rien de plus que le LOT 2.
//
// Balayage attendu, texte exact du plan : `code_vault_access_events`,
// `agent_skill_audit` (table sans aucun rapport avec le coffre — balayée
// quand même, pour que « partout » ne soit pas qu'une figure de style), les
// journaux applicatifs (ce script n'en écrit pas d'autres que sa propre
// sortie console — voir capture ci-dessous), les réponses d'erreur, les
// métriques (aucun mécanisme de métriques n'existe dans ce dépôt pour le
// coffre — constaté, pas contourné, voir le JSON final), le contexte du
// modèle (`buildModelVisibleVaultFact`), et la sortie capturée de tout le
// scénario. Zéro occurrence attendue, sauf dans l'objet `outcome.value`
// renvoyé par chaque route (l'équivalent de la réponse HTTP destinée à la
// personne) — qui n'est jamais journalisé par ce script.
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { handleEntInactifVaultRequest } from "../api/_shared/code-vault-ent-inactif-route.ts";
import { handleServiceDeliveryVaultRequest } from "../api/_shared/code-vault-service-delivery-route.ts";
import { getOrCreateVaultAssignment } from "../api/_shared/code-vault-assignment.ts";
import { writeVaultCodeValue } from "../api/_shared/code-vault-write.ts";
import { buildModelVisibleVaultFact } from "../shared/code-vault-policy.ts";

if (process.argv.length !== 3 || process.argv[2] !== "--local-stack-only") {
  throw new Error("local_stack_confirmation_required");
}

// ---------------------------------------------------------------------------
// Balayage anti-fuite (« la sortie capturée de tout le scénario ») : capture
// tout ce que ce script écrit sur la sortie standard/erreur pendant toute son
// exécution. Le résultat des routes (`outcome`, qui porte `value`) n'est
// JAMAIS passé à `console.log`/`console.error` dans ce script : seuls des
// booléens et des résumés le sont.
// ---------------------------------------------------------------------------
const capturedOutput = [];
const originalConsoleLog = console.log.bind(console);
const originalConsoleError = console.error.bind(console);
console.log = (...args) => {
  capturedOutput.push(args.map(String).join(" "));
  originalConsoleLog(...args);
};
console.error = (...args) => {
  capturedOutput.push(args.map(String).join(" "));
  originalConsoleError(...args);
};

const markerPrefix = `LOT4-LECTURE-MARQUEUR-${randomUUID()}`;
const MARKERS = {
  ent: `${markerPrefix}-ENT`,
  cantine: `${markerPrefix}-CANTINE`,
  koxo: `${markerPrefix}-KOXO`,
};
const ALL_MARKER_VALUES = Object.values(MARKERS);

// Drapeau ouvert et clé de chiffrement fictive, tous deux confinés à cet
// objet `env` local : jamais assignés à `process.env`, jamais écrits sur
// disque. Ce n'est pas « le drapeau activé » au sens du plan (qui parle du
// `.env.local.example` réel, resté à `false`) : c'est un paramètre de test
// pur, comme le prévoit explicitement le type `env?: NodeJS.ProcessEnv` des
// routes (« recette locale uniquement »).
const testEnv = {
  CODE_VAULT_REVEAL_ENABLED: "true",
  CODE_VAULT_ENCRYPTION_KEY_VERSION: "v1",
  CODE_VAULT_ENCRYPTION_KEY_V1: randomBytes(32).toString("base64"),
};

const client = postgres({
  host: "127.0.0.1",
  port: 54322,
  database: "postgres",
  user: "postgres",
  password: "postgres",
  max: 1,
  prepare: false,
  connect_timeout: 5,
});
const database = drizzle(client);
let assertions = 0;
const check = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  assertions++;
};

async function insertFictitiousInstitution(tx, institutionId, name) {
  await tx.execute(sql`
    insert into public.institutions (id, slug, name, status)
    values (${institutionId}, ${`coffre-lot4-lecture-${institutionId}`}, ${name}, 'draft')
  `);
}

const rollback = new Error("intentional_fixture_rollback");
const institutionD = randomUUID();
let duplicateWriteErrorText = "";

try {
  await database.transaction(async (tx) => {
    await insertFictitiousInstitution(tx, institutionD, "Lycée fictif D — LOT 4 lecture adverse");

    // -----------------------------------------------------------------
    // Scénario ENT inactif : écrit, remis, affiché — via la vraie chaîne
    // écriture (LOT 1/2 branchement) -> route réelle (LOT 3 branchement)
    // -> point de lecture réel (LOT 1/2 lecture).
    // -----------------------------------------------------------------
    const entPersonRef = "eleve-lot4-lecture-ent";
    const entIdentity = {
      institutionId: institutionD,
      personRef: entPersonRef,
      service: "ent",
      schoolYear: "2026-2027",
      version: 1,
    };
    const entAssignment = await getOrCreateVaultAssignment(tx, entIdentity);
    await writeVaultCodeValue(tx, {
      assignmentId: entAssignment.id,
      institutionId: institutionD,
      value: MARKERS.ent,
      env: testEnv,
    });
    const entActor = { profile: "eleve", personRef: entPersonRef, institutionId: institutionD };
    const entTarget = {
      service: "ent",
      institutionId: institutionD,
      subjectKind: "self",
      subjectPersonRef: entPersonRef,
      subjectClassRef: null,
    };
    const entOutcome = await handleEntInactifVaultRequest(tx, {
      actor: entActor,
      target: entTarget,
      phase: "verified",
      proofChannel: "email",
      schoolYear: "2026-2027",
      now: new Date("2026-09-06T08:00:00.000Z"),
      env: testEnv,
    });
    check(entOutcome.outcome, "displayed", "ent_written_then_delivered_then_displayed");
    check(entOutcome.reason, null, "ent_reveal_not_blocked_when_flag_open_in_test_env_only");
    check(entOutcome.value, MARKERS.ent, "ent_marker_actually_decrypted_through_the_real_read_point");

    // -----------------------------------------------------------------
    // Scénario cantine : même chaîne, via la route de service partagée
    // (LOT 4 branchement).
    // -----------------------------------------------------------------
    const cantinePersonRef = "eleve-lot4-lecture-cantine";
    const cantineIdentity = {
      institutionId: institutionD,
      personRef: cantinePersonRef,
      service: "cantine",
      schoolYear: "2026-2027",
      version: 1,
    };
    const cantineAssignment = await getOrCreateVaultAssignment(tx, cantineIdentity);
    await writeVaultCodeValue(tx, {
      assignmentId: cantineAssignment.id,
      institutionId: institutionD,
      value: MARKERS.cantine,
      env: testEnv,
    });
    const cantineActor = { profile: "eleve", personRef: cantinePersonRef, institutionId: institutionD };
    const cantineTarget = {
      service: "cantine",
      institutionId: institutionD,
      subjectKind: "self",
      subjectPersonRef: cantinePersonRef,
      subjectClassRef: null,
    };
    const cantineOutcome = await handleServiceDeliveryVaultRequest(tx, {
      journeyType: "cantine",
      actor: cantineActor,
      target: cantineTarget,
      phase: "verified",
      proofChannel: "email",
      schoolYear: "2026-2027",
      now: new Date("2026-09-06T08:00:00.000Z"),
      env: testEnv,
    });
    check(cantineOutcome.outcome, "displayed", "cantine_written_then_delivered_then_displayed");
    check(cantineOutcome.value, MARKERS.cantine, "cantine_marker_actually_decrypted_through_the_real_read_point");

    // -----------------------------------------------------------------
    // Scénario koxo : même chaîne, même route de service, service différent.
    // -----------------------------------------------------------------
    const koxoPersonRef = "eleve-lot4-lecture-koxo";
    const koxoIdentity = {
      institutionId: institutionD,
      personRef: koxoPersonRef,
      service: "koxo",
      schoolYear: "2026-2027",
      version: 1,
    };
    const koxoAssignment = await getOrCreateVaultAssignment(tx, koxoIdentity);
    await writeVaultCodeValue(tx, {
      assignmentId: koxoAssignment.id,
      institutionId: institutionD,
      value: MARKERS.koxo,
      env: testEnv,
    });
    const koxoActor = { profile: "eleve", personRef: koxoPersonRef, institutionId: institutionD };
    const koxoTarget = {
      service: "koxo",
      institutionId: institutionD,
      subjectKind: "self",
      subjectPersonRef: koxoPersonRef,
      subjectClassRef: null,
    };
    const koxoOutcome = await handleServiceDeliveryVaultRequest(tx, {
      journeyType: "koxo",
      actor: koxoActor,
      target: koxoTarget,
      phase: "verified",
      proofChannel: "email",
      schoolYear: "2026-2027",
      now: new Date("2026-09-06T08:00:00.000Z"),
      env: testEnv,
    });
    check(koxoOutcome.outcome, "displayed", "koxo_written_then_delivered_then_displayed");
    check(koxoOutcome.value, MARKERS.koxo, "koxo_marker_actually_decrypted_through_the_real_read_point");

    // -----------------------------------------------------------------
    // « Le contexte du modèle » : ce que l'IA recevrait au sujet de ces
    // trois remises accordées ne porte structurellement aucun champ de
    // valeur, marqueur ou non.
    // -----------------------------------------------------------------
    for (const service of ["ent", "cantine", "koxo"]) {
      const modelFact = buildModelVisibleVaultFact({
        service,
        status: "active",
        validationRequired: false,
        deliveryAuthorized: true,
        refusalReason: null,
        receipt: null,
      });
      check(Object.keys(modelFact).includes("value"), false, `model_visible_fact_has_no_value_field_${service}`);
      check(JSON.stringify(modelFact).includes(markerPrefix), false, `model_visible_fact_never_carries_any_marker_${service}`);
    }

    // -----------------------------------------------------------------
    // « code_vault_access_events » : les trois remises ont chacune inséré
    // exactement une ligne `consult`, sans jamais aucune colonne portant un
    // marqueur (la table n'a structurellement pas de colonne valeur, vérifié
    // ici par balayage de contenu, pas seulement de schéma).
    // -----------------------------------------------------------------
    const accessEventsRows = await tx.execute(sql`
      select assignment_id, actor_person_ref, actor_profile, event_type, refusal_reason
      from public.code_vault_access_events
      where institution_id = ${institutionD}
      order by id asc
    `);
    check(Array.from(accessEventsRows).length, 3, "exactly_three_consult_events_recorded");
    const accessEventsText = JSON.stringify(Array.from(accessEventsRows));
    for (const marker of ALL_MARKER_VALUES) {
      check(accessEventsText.includes(marker), false, `code_vault_access_events_never_contains_marker_${marker}`);
    }

    // -----------------------------------------------------------------
    // « Une réponse d'erreur » : une deuxième écriture sur l'attribution ENT
    // déjà écrite déclenche une vraie erreur Postgres (contrainte
    // d'unicité), sanitisée avant de remonter — le message ne doit jamais
    // répéter ni le marqueur déjà stocké, ni celui qu'on tente d'écrire.
    // -----------------------------------------------------------------
    const secondEntMarker = `${markerPrefix}-ENT-REJECTED-ATTEMPT`;
    await tx.execute(sql`savepoint before_duplicate_write_attempt`);
    let duplicateWriteError = null;
    try {
      await writeVaultCodeValue(tx, {
        assignmentId: entAssignment.id,
        institutionId: institutionD,
        value: secondEntMarker,
        env: testEnv,
      });
    } catch (error) {
      duplicateWriteError = error;
    }
    check(duplicateWriteError !== null, true, "second_write_on_the_same_assignment_is_rejected");
    duplicateWriteErrorText = `${duplicateWriteError?.message ?? ""} ${JSON.stringify(duplicateWriteError ?? {})}`;
    check(duplicateWriteErrorText.includes(MARKERS.ent), false, "error_response_never_echoes_the_already_stored_marker");
    check(duplicateWriteErrorText.includes(secondEntMarker), false, "error_response_never_echoes_the_rejected_new_marker");
    check("detail" in (duplicateWriteError ?? {}), false, "sanitized_write_error_carries_no_raw_pg_detail_field");
    await tx.execute(sql`rollback to savepoint before_duplicate_write_attempt`);

    // -----------------------------------------------------------------
    // Balayage anti-fuite sur le contenu réel des lignes écrites par ce
    // scénario, colonnes texte libres comprises.
    // -----------------------------------------------------------------
    for (const marker of ALL_MARKER_VALUES) {
      const likePattern = `%${marker}%`;
      const rowContentLeakScan = await tx.execute(sql`
        select 'code_vault_assignments' as tbl from public.code_vault_assignments
        where institution_id = ${institutionD}
          and (person_ref ilike ${likePattern} or coalesce(defective_reason, '') ilike ${likePattern})
        union all
        select 'code_vault_access_events' from public.code_vault_access_events
        where institution_id = ${institutionD}
          and (coalesce(actor_person_ref, '') ilike ${likePattern} or coalesce(refusal_reason, '') ilike ${likePattern})
        union all
        select 'code_vault_private_rows' from public.code_vault_private_rows
        where institution_id = ${institutionD}
          and (ciphertext ilike ${likePattern} or iv ilike ${likePattern} or auth_tag ilike ${likePattern})
      `);
      check(Array.from(rowContentLeakScan).length, 0, `marker_never_stored_in_plaintext_in_any_free_text_or_binary_column_${marker}`);
    }

    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  await client.end();
}

void duplicateWriteErrorText;

// ---------------------------------------------------------------------------
// Vérifications post-transaction : rollback vérifié, puis balayage de
// `agent_skill_audit` — une table SANS AUCUN RAPPORT avec le coffre de
// codes, balayée quand même parce que le plan dit « partout », pas
// « partout où c'est plausible ». Connexion neuve, hors transaction annulée.
// ---------------------------------------------------------------------------
const verifier = postgres({
  host: "127.0.0.1",
  port: 54322,
  database: "postgres",
  user: "postgres",
  password: "postgres",
  max: 1,
  connect_timeout: 5,
});
try {
  const [{ count: institutionDTraceCount }] = await verifier`
    select count(*)::integer as count from public.institutions where id = ${institutionD}
  `;
  check(institutionDTraceCount, 0, "rollback_left_no_trace_of_institution_d");

  for (const marker of ALL_MARKER_VALUES) {
    const likePattern = `%${marker}%`;
    const agentSkillAuditScan = await verifier`
      select id from public.agent_skill_audit
      where summary::text ilike ${likePattern}
         or resource_type ilike ${likePattern}
         or action ilike ${likePattern}
    `;
    check(agentSkillAuditScan.length, 0, `agent_skill_audit_never_contains_marker_${marker}`);
  }
} finally {
  await verifier.end();
}

// ---------------------------------------------------------------------------
// Balayage anti-fuite final (« la sortie capturée de tout le scénario ») :
// aucun des trois marqueurs ne doit apparaître dans AUCUNE ligne de sortie
// capturée pendant toute l'exécution de ce script. Ceci tient aussi lieu de
// balayage des « journaux applicatifs » : ce script n'écrit et ne provoque
// l'écriture d'aucun autre journal que sa propre sortie console.
// ---------------------------------------------------------------------------
console.log = originalConsoleLog;
console.error = originalConsoleError;
const leakedInOutput = capturedOutput.filter((line) =>
  ALL_MARKER_VALUES.some((marker) => line.includes(marker))
);
check(leakedInOutput, [], "no_marker_ever_appears_in_any_captured_output_line");

console.log(
  JSON.stringify(
    {
      target: "127.0.0.1:54322",
      assertions,
      rollbackVerified: true,
      realData: false,
      revealFlagOpenedOnlyInLocalTestEnvObject: true,
      metricsMechanism: {
        present: false,
        note: "aucune table ou pipeline de métriques n'existe dans ce dépôt pour le coffre de codes — constaté, non balayé",
      },
    },
    null,
    2
  )
);

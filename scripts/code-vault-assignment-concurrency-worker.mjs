// Processus enfant du LOT 3 (recette coffre sur PostgreSQL réel) : appelle
// `getOrCreateVaultAssignment` depuis SA PROPRE connexion Postgres, pour que
// deux demandes "simultanées" passent réellement par deux connexions
// distinctes, comme deux invocations serverless concurrentes. Jamais utilisé
// seul : lancé par scripts/test-local-code-vault-assignment.mjs.

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { getOrCreateVaultAssignment } from "../api/_shared/code-vault-assignment.ts";

const [identityJson, targetTimeMsRaw] = process.argv.slice(2);
const identity = JSON.parse(identityJson);
const targetTimeMs = Number(targetTimeMsRaw);

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

// Attente active courte : les deux processus visent le même instant pour
// maximiser la chance d'une vraie collision sur le verrou posé par
// `on conflict ... do update`.
while (Date.now() < targetTimeMs) {
  // volontairement vide
}

try {
  const row = await database.transaction((tx) => getOrCreateVaultAssignment(tx, identity));
  process.stdout.write(JSON.stringify({ ok: true, id: row.id }));
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, error: String(error && error.message || error) }));
} finally {
  await client.end();
}

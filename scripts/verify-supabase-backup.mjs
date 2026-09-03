#!/usr/bin/env node
// Verifie une sauvegarde produite par backup-supabase.mjs : presence des
// artefacts, tailles, empreintes SHA-256, coherence du manifeste, et
// controles de contenu minimaux. Lecture seule, aucun acces reseau.
//
//   npm run backup:verify -- --dir backups/<ref>-<horodatage>

import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

function argument(nom) {
  const i = process.argv.indexOf("--" + nom);
  return i === -1 ? null : process.argv[i + 1] ?? null;
}

const echecs = [];
function controle(ok, message) {
  if (ok) {
    console.log("  OK   " + message);
  } else {
    console.log("  KO   " + message);
    echecs.push(message);
  }
}

const dossierArg = argument("dir");
if (!dossierArg) {
  console.error("[verification] --dir <dossier de sauvegarde> est obligatoire.");
  process.exit(1);
}
const dossier = resolve(process.cwd(), dossierArg);
const cheminManifeste = join(dossier, "manifeste.json");

if (!existsSync(cheminManifeste)) {
  console.error("[verification] manifeste.json introuvable dans " + dossier);
  process.exit(1);
}

let manifeste;
try {
  manifeste = JSON.parse(readFileSync(cheminManifeste, "utf8"));
} catch (e) {
  console.error("[verification] manifeste.json illisible : " + e.message);
  process.exit(1);
}

console.log("[verification] " + dossier);
console.log("[verification] projet " + manifeste.projectRef + ", pris le " + manifeste.horodatage);
console.log("");

controle(manifeste.version === 1, "version de manifeste reconnue");
controle(
  typeof manifeste.projectRef === "string" && /^[a-z]{20}$/.test(manifeste.projectRef),
  "reference de projet bien formee",
);
controle(Array.isArray(manifeste.artefacts) && manifeste.artefacts.length === 3, "trois artefacts declares");

const attendusNoms = ["roles.sql", "schema.sql", "data.sql"];
for (const nom of attendusNoms) {
  const declare = (manifeste.artefacts || []).find((a) => a.nom === nom);
  if (!declare) {
    controle(false, nom + " declare dans le manifeste");
    continue;
  }
  const chemin = join(dossier, nom);
  if (!existsSync(chemin)) {
    controle(false, nom + " present sur le disque");
    continue;
  }
  const taille = statSync(chemin).size;
  controle(taille === declare.octets, nom + " taille conforme (" + taille + " octets)");
  const sha = createHash("sha256").update(readFileSync(chemin)).digest("hex");
  controle(sha === declare.sha256, nom + " empreinte SHA-256 conforme");
}

const cheminSchema = join(dossier, "schema.sql");
if (existsSync(cheminSchema)) {
  const schema = readFileSync(cheminSchema, "utf8");
  controle(schema.includes("CREATE TABLE") || schema.includes("CREATE SCHEMA"), "schema.sql contient bien du DDL");
  controle(!/PGPASSWORD|password=|SUPABASE_SERVICE_ROLE/i.test(schema), "schema.sql ne contient aucun secret apparent");
}

const cheminRoles = join(dossier, "roles.sql");
if (existsSync(cheminRoles)) {
  const roles = readFileSync(cheminRoles, "utf8");
  controle(/CREATE ROLE|ALTER ROLE/i.test(roles), "roles.sql contient bien des roles");
}

console.log("");
if (echecs.length === 0) {
  console.log("[verification] TOUS LES CONTROLES PASSENT.");
  console.log("[verification] Rappel : une sauvegarde n'est prouvee qu'apres restauration");
  console.log("[verification] reelle dans un projet Supabase isole et vide.");
  process.exit(0);
}
console.log("[verification] " + echecs.length + " controle(s) en echec :");
for (const e of echecs) console.log("  - " + e);
process.exit(1);

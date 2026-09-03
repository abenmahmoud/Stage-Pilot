#!/usr/bin/env node
// Sauvegarde d'un projet Supabase : roles + schema + donnees, avec manifeste
// verifiable. Ecrit uniquement sur disque local. N'affiche jamais l'URL ni le
// mot de passe. Refuse toute cible qui ne correspond pas exactement a la
// reference de projet passee explicitement.
//
//   npm run backup:supabase -- --project-ref <ref> --confirm sauvegarde-reelle
//
// L'URL de connexion est lue dans SUPABASE_BACKUP_DB_URL (jamais en argument,
// pour ne pas la laisser dans l'historique du shell).

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const SUPABASE_CLI = "supabase@2.116.0";
const CONFIRMATION = "sauvegarde-reelle";
const MIN_OCTETS = { roles: 200, schema: 5000, data: 100 };

function echec(message) {
  console.error("[sauvegarde] ECHEC : " + message);
  process.exit(1);
}

function argument(nom) {
  const i = process.argv.indexOf("--" + nom);
  return i === -1 ? null : process.argv[i + 1] ?? null;
}

const projectRef = argument("project-ref");
const confirmation = argument("confirm");
const destination = argument("out") ?? "backups";

if (!projectRef || !/^[a-z]{20}$/.test(projectRef)) {
  echec("--project-ref manquant ou mal forme (20 lettres minuscules attendues).");
}
if (confirmation !== CONFIRMATION) {
  echec("--confirm " + CONFIRMATION + " est obligatoire : cette commande lit une base reelle.");
}

const dbUrl = process.env.SUPABASE_BACKUP_DB_URL;
if (!dbUrl) {
  echec("SUPABASE_BACKUP_DB_URL absente de l'environnement.");
}

let cible;
try {
  cible = new URL(dbUrl);
} catch {
  echec("SUPABASE_BACKUP_DB_URL n'est pas une URL valide.");
}
if (cible.protocol !== "postgresql:" && cible.protocol !== "postgres:") {
  echec("SUPABASE_BACKUP_DB_URL doit etre une URL postgresql://.");
}

const hote = cible.hostname.toLowerCase();
const cibleAttendue = "db." + projectRef + ".supabase.co";
const viaPooler = hote.endsWith(".pooler.supabase.com") && (cible.username || "").includes(projectRef);
if (hote !== cibleAttendue && !viaPooler) {
  echec(
    "l'URL ne correspond pas a --project-ref. Attendu " +
      cibleAttendue +
      " ou un pooler dont l'utilisateur contient la reference.",
  );
}

const horodatage = new Date().toISOString().replace(/[:.]/g, "-");
const dossier = resolve(process.cwd(), destination, projectRef + "-" + horodatage);
if (existsSync(dossier)) echec("le dossier de sauvegarde existe deja.");
mkdirSync(dossier, { recursive: true });

function nettoyer(texte) {
  if (!texte) return "";
  let sortie = texte.split(dbUrl).join("<url-masquee>");
  if (cible.password) sortie = sortie.split(cible.password).join("<secret>");
  return sortie;
}

function lancerDump(nom, options) {
  return new Promise((fini) => {
    const fichier = join(dossier, nom + ".sql");
    const args = ["--yes", SUPABASE_CLI, "db", "dump", "--db-url", dbUrl, "-f", fichier].concat(options);
    const enfant = spawn("npx", args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    let erreur = "";
    enfant.stderr.on("data", (d) => {
      erreur += d.toString();
    });
    enfant.stdout.on("data", () => {});
    enfant.on("error", (e) => fini({ code: -1, erreur: e.message, fichier }));
    enfant.on("close", (code) => fini({ code, erreur, fichier }));
  });
}

function empreinte(fichier) {
  return createHash("sha256").update(readFileSync(fichier)).digest("hex");
}

const etapes = [
  { nom: "roles", options: ["--role-only"] },
  { nom: "schema", options: [] },
  { nom: "data", options: ["--data-only", "--use-copy"] },
];

const manifeste = {
  version: 1,
  projectRef,
  horodatage: new Date().toISOString(),
  cliSupabase: SUPABASE_CLI,
  artefacts: [],
};

console.log("[sauvegarde] projet " + projectRef + " -> " + dossier);

for (const etape of etapes) {
  process.stdout.write("[sauvegarde] " + etape.nom + " ... ");
  const r = await lancerDump(etape.nom, etape.options);
  if (r.code !== 0) {
    console.log("echec");
    echec("dump " + etape.nom + " code " + r.code + ". " + nettoyer(r.erreur).slice(0, 400));
  }
  if (!existsSync(r.fichier)) echec("dump " + etape.nom + " n'a produit aucun fichier.");
  const taille = statSync(r.fichier).size;
  if (taille < MIN_OCTETS[etape.nom]) {
    echec("dump " + etape.nom + " suspect : " + taille + " octets, sous le minimum attendu.");
  }
  manifeste.artefacts.push({ nom: etape.nom + ".sql", octets: taille, sha256: empreinte(r.fichier) });
  console.log(taille + " octets");
}

const schema = readFileSync(join(dossier, "schema.sql"), "utf8");
const attendus = ["support_requests", "site_content_items", "institutions"];
const manquants = attendus.filter((t) => !schema.includes(t));
manifeste.tablesAttendues = attendus;
manifeste.tablesManquantes = manquants;

writeFileSync(join(dossier, "manifeste.json"), JSON.stringify(manifeste, null, 2) + "\n", "utf8");

console.log("[sauvegarde] manifeste ecrit.");
for (const a of manifeste.artefacts) {
  console.log("  " + a.nom.padEnd(12) + String(a.octets).padStart(10) + " octets  " + a.sha256.slice(0, 16) + "...");
}
if (manquants.length) {
  console.log("[sauvegarde] ATTENTION : tables absentes du schema : " + manquants.join(", "));
  console.log("[sauvegarde] attendu si la base cible n'a pas encore recu ses migrations.");
}
console.log("");
console.log("[sauvegarde] SAUVEGARDE NON VERIFIEE tant qu'elle n'a pas ete restauree.");
console.log("[sauvegarde] etape suivante : npm run backup:verify -- --dir " + dossier);

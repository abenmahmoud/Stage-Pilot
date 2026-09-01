import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const runbookUrl = new URL(
  "../docs/operations/SUPPORT_INCIDENT_RESPONSE_RUNBOOK.md",
  import.meta.url
);

const [runbook, packageJson] = await Promise.all([
  readFile(runbookUrl, "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8").then(JSON.parse),
]);

test("keeps the incident cycle complete and ordered", () => {
  const headings = [
    "### Detecter et declarer",
    "### Contenir sans detruire",
    "### Diagnostiquer",
    "### Decider et restaurer",
    "### Reouvrir progressivement",
    "### Clore et apprendre",
  ];

  let previous = -1;
  for (const heading of headings) {
    const current = runbook.indexOf(heading);
    assert.ok(current > previous, `${heading} must be present and ordered`);
    previous = current;
  }
});

test("covers every critical preview surface", () => {
  for (const surface of [
    "Site public",
    "API du guichet",
    "Base de donnees",
    "Pieces jointes",
    "Notifications",
    "Identite et acces",
  ]) {
    assert.match(runbook, new RegExp(`\\| ${surface.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")} \\|`));
  }
});

test("forbids destructive recovery and security bypasses", () => {
  for (const requiredRule of [
    "Ne jamais restaurer directement",
    "Ne jamais supprimer une file d'echec",
    "Ne jamais contourner le MFA",
    "Ne jamais placer de mot de passe",
    "Ne jamais envoyer une communication collective",
  ]) {
    assert.match(runbook, new RegExp(requiredRule));
  }

  for (const dangerousCommand of [
    /git\s+reset\s+--hard/i,
    /git\s+clean\s+-fd/i,
    /DROP\s+DATABASE/i,
    /\bTRUNCATE\b/i,
    /supabase\s+db\s+reset/i,
    /rm\s+-rf/i,
    /Remove-Item[^\n]*-Recurse/i,
  ]) {
    assert.doesNotMatch(runbook, dangerousCommand);
  }
});

test("keeps restoration isolated and human-governed", () => {
  assert.match(runbook, /cible vide, isolee et non routable/);
  assert.match(runbook, /Une meme personne ne doit pas executer et valider seule/);
  assert.match(runbook, /T057 reste ouverte/);
  assert.match(runbook, /ne donne aucun accord implicite/);
  assert.match(runbook, /preuve locale ou fictive ne prouve pas/);
});

test("references only existing local verification scripts", () => {
  const commands = [...runbook.matchAll(/^npm run ([a-z0-9:-]+)$/gim)].map((match) => match[1]);
  assert.deepEqual(commands, [
    "test:support-operations",
    "test:support-resilience",
    "test:recovery-sample-bundle",
    "test:migration-integrity",
    "build",
  ]);

  for (const command of commands) {
    assert.equal(typeof packageJson.scripts?.[command], "string", `${command} must exist`);
  }
});

test("contains no embedded credentials or private contact examples", () => {
  assert.doesNotMatch(runbook, /-----BEGIN [A-Z ]+PRIVATE KEY-----/);
  assert.doesNotMatch(runbook, /\bsk-[A-Za-z0-9_-]{12,}\b/);
  assert.doesNotMatch(runbook, /Bearer\s+[A-Za-z0-9._-]{12,}/i);
  assert.doesNotMatch(runbook, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  assert.doesNotMatch(runbook, /(?:\+33|0)[1-9](?:[ .-]?\d{2}){4}/);
});

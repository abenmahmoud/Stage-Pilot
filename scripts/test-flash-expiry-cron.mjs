// LOT 5 — Preuves de composition pour le balayage d'expiration flash
// (api/cron/flash-expiry.ts, T071D).
//
// La route n'est pas exercée ici (aucune pile PostgreSQL locale disponible
// dans ce shell, voir docs/operations/night-logs/PERSIST-LOT5.md) : ce
// script ne prouve donc PAS un comportement HTTP bout en bout. Il rejoue,
// avec les MÊMES fonctions pures réellement importées par la route (jamais
// une réimplémentation parallèle), la composition exacte qu'elle exécute, et
// vérifie par lecture du fichier source que cette composition est bien celle
// utilisée en production (même méthode que scripts/test-flash-correction.mjs
// au LOT 4).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { selectExpiredFlashProposals, buildFlashExpirationAuthorNotice, FlashExpirationError } from "../shared/flash-expiration.ts";
import { assertLegalFlashVersionTransition, FlashTransitionError } from "../shared/flash-transitions.ts";

const routeSource = readFileSync(new URL("../api/cron/flash-expiry.ts", import.meta.url), "utf8");

test("preuve de wiring : la route importe les modules purs réels, ne les réimplémente pas", () => {
  assert.match(
    routeSource,
    /import \{ selectExpiredFlashProposals, buildFlashExpirationAuthorNotice \} from "\.\.\/\.\.\/shared\/flash-expiration\.js";/
  );
  assert.match(
    routeSource,
    /import \{ assertLegalFlashVersionTransition \} from "\.\.\/\.\.\/shared\/flash-transitions\.js";/
  );
});

test("preuve de wiring : le secret de cron est vérifié avant toute lecture", () => {
  assert.match(routeSource, /secretMatches\(process\.env\.CRON_SECRET, provided\)/);
});

test("preuve de wiring : la proposition est conservée — jamais de suppression", () => {
  assert.doesNotMatch(routeSource, /\.delete\(flashInfoVersions\)/);
  assert.doesNotMatch(routeSource, /\.delete\(flashInfos\)/);
});

test("preuve de wiring : aucun envoi — l'avis est enregistré comme à émettre, jamais émis", () => {
  assert.doesNotMatch(routeSource, /fetch\(/);
  assert.doesNotMatch(routeSource, /axios/i);
  assert.doesNotMatch(routeSource, /sendMail|sendGrid|twilio|nodemailer/i);
});

test("preuve de wiring : le SQL ne filtre que sur le statut, la décision d'expiration vient de la fonction pure", () => {
  assert.match(routeSource, /eq\(flashInfoVersions\.status, "proposee"\)/);
  assert.match(routeSource, /selectExpiredFlashProposals\(pending, now\)/);
});

// Rejeu, avec les fonctions réellement importées, de la composition exacte de
// la route : détection -> transition -> avis, sans jamais réécrire une de ces
// trois règles ici.
test("composition réelle : une proposition expirée est transitée et reçoit un avis factuel", () => {
  const now = new Date("2026-09-05T22:00:00.000Z");
  const pending = [
    {
      id: "v1",
      institutionId: "inst-1",
      flashInfoId: "flash-1",
      status: "proposee",
      title: "Absence surveillance étude du soir",
      expiresAt: new Date("2026-09-05T21:00:00.000Z"),
      proposedBy: "user-1",
    },
    {
      id: "v2",
      institutionId: "inst-1",
      flashInfoId: "flash-2",
      status: "proposee",
      title: "Toujours en attente",
      expiresAt: new Date("2026-09-06T08:00:00.000Z"),
      proposedBy: "user-2",
    },
  ];

  const expired = selectExpiredFlashProposals(pending, now);
  assert.deepEqual(expired.map((proposal) => proposal.id), ["v1"], "seule la proposition réellement expirée est retenue");

  const notices = expired.map((proposal) => ({
    proposal,
    toStatus: assertLegalFlashVersionTransition(proposal.status, "expiree_sans_validation"),
    notice: buildFlashExpirationAuthorNotice({ title: proposal.title, expiresAt: proposal.expiresAt }),
  }));

  assert.equal(notices.length, 1);
  assert.equal(notices[0].toStatus, "expiree_sans_validation");
  assert.equal(notices[0].notice.status, "a_emettre");
  assert.match(notices[0].notice.message, /Absence surveillance étude du soir/);
});

test("une proposition déjà décidée ne peut pas être transitée une seconde fois", () => {
  for (const status of ["validee", "publiee", "modifiee", "refusee", "expiree_sans_validation"]) {
    assert.throws(
      () => assertLegalFlashVersionTransition(status, "expiree_sans_validation"),
      (error) => error instanceof FlashTransitionError,
      status
    );
  }
});

test("un titre vide ne produit jamais d'avis silencieux : l'erreur est explicite", () => {
  assert.throws(
    () => buildFlashExpirationAuthorNotice({ title: "", expiresAt: new Date("2026-09-05T21:00:00.000Z") }),
    (error) => error instanceof FlashExpirationError && error.reason === "title_invalid"
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFlashExpirationAuthorNotice,
  buildFlashValidatedExpirationAuthorNotice,
  checkFlashProposalExpiration,
  checkFlashValidatedProposalExpiration,
  FlashExpirationError,
  selectExpiredFlashProposals,
  selectExpiredValidatedFlashProposals,
} from "../shared/flash-expiration.ts";

const NOW = new Date("2026-09-05T22:00:00.000Z");

test("expiration sans validation : proposee et expires_at depasse", () => {
  const result = checkFlashProposalExpiration({
    status: "proposee",
    expiresAt: new Date("2026-09-05T21:00:00.000Z"),
    now: NOW,
  });
  assert.equal(result.isExpiredWithoutValidation, true);
  assert.equal(result.reason, "expired_without_validation");
});

test("une proposition encore dans les temps reste en attente", () => {
  const result = checkFlashProposalExpiration({
    status: "proposee",
    expiresAt: new Date("2026-09-06T08:00:00.000Z"),
    now: NOW,
  });
  assert.equal(result.isExpiredWithoutValidation, false);
  assert.equal(result.reason, "still_pending");
});

test("une version deja validee, publiee ou refusee n'est plus concernee", () => {
  for (const status of ["validee", "publiee", "modifiee", "refusee", "expiree_sans_validation"]) {
    const result = checkFlashProposalExpiration({
      status,
      expiresAt: new Date("2026-09-05T21:00:00.000Z"),
      now: NOW,
    });
    assert.equal(result.isExpiredWithoutValidation, false, status);
    assert.equal(result.reason, "not_applicable", status);
  }
});

test("l'instant d'expiration exact n'est pas encore un depassement", () => {
  const expiresAt = new Date(NOW.getTime());
  const result = checkFlashProposalExpiration({ status: "proposee", expiresAt, now: NOW });
  assert.equal(result.isExpiredWithoutValidation, true);
});

test("des dates invalides sont refusees explicitement", () => {
  assert.throws(
    () => checkFlashProposalExpiration({ status: "proposee", expiresAt: "hier", now: NOW }),
    (error) => error instanceof FlashExpirationError && error.reason === "expires_at_invalid"
  );
  assert.throws(
    () => checkFlashProposalExpiration({ status: "proposee", expiresAt: NOW, now: new Date("invalide") }),
    (error) => error instanceof FlashExpirationError && error.reason === "now_invalid"
  );
});

test("le filtre ne retient que les propositions reellement expirees", () => {
  const proposals = [
    { id: "a", status: "proposee", expiresAt: new Date("2026-09-05T21:00:00.000Z") },
    { id: "b", status: "proposee", expiresAt: new Date("2026-09-06T08:00:00.000Z") },
    { id: "c", status: "publiee", expiresAt: new Date("2026-09-01T00:00:00.000Z") },
  ];
  const expired = selectExpiredFlashProposals(proposals, NOW);
  assert.deepEqual(expired.map((proposal) => proposal.id), ["a"]);
});

// T071D (LOT 5) : le message a l'auteur est factuel — il dit ce qui s'est
// passe (pas publiee, personne informe), jamais qui aurait du valider ni
// pourquoi la decision n'est pas venue.
test("l'avis a l'auteur est factuel : aucun valideur nomme, aucun motif ajoute", () => {
  const notice = buildFlashExpirationAuthorNotice({
    title: "Sortie pédagogique reportée",
    expiresAt: new Date("2026-09-05T21:00:00.000Z"),
  });
  assert.equal(notice.status, "a_emettre");
  assert.match(notice.message, /sans avoir été validée/);
  assert.match(notice.message, /n'a pas été publiée et personne n'a été informé/);
  assert.match(notice.message, /Sortie pédagogique reportée/);
  assert.doesNotMatch(notice.message, /referent|référent|valideur|ddfpt/i);
});

test("l'avis a l'auteur refuse un titre ou une date invalides", () => {
  assert.throws(
    () => buildFlashExpirationAuthorNotice({ title: "  ", expiresAt: new Date("2026-09-05T21:00:00.000Z") }),
    (error) => error instanceof FlashExpirationError && error.reason === "title_invalid"
  );
  assert.throws(
    () => buildFlashExpirationAuthorNotice({ title: "Titre valide", expiresAt: new Date("invalide") }),
    (error) => error instanceof FlashExpirationError && error.reason === "expires_at_invalid"
  );
});

// LOT 2 (plan de publication, T071F) : une proposition deja VALIDEE mais
// jamais publiee avant son expiration est une catégorie distincte de T071D
// ("jamais validee"). checkFlashProposalExpiration (ci-dessus) reste
// muet sur ce cas (il renvoie "not_applicable" pour "validee", verifie plus
// haut) : c'est checkFlashValidatedProposalExpiration qui le couvre, jamais
// le meme compteur.
test("expiration apres validation : validee et expires_at depasse", () => {
  const result = checkFlashValidatedProposalExpiration({
    status: "validee",
    expiresAt: new Date("2026-09-05T21:00:00.000Z"),
    now: NOW,
  });
  assert.equal(result.isExpiredAfterValidationWithoutPublication, true);
  assert.equal(result.reason, "expired_after_validation_without_publication");
});

test("une version validee encore dans les temps attend toujours sa publication", () => {
  const result = checkFlashValidatedProposalExpiration({
    status: "validee",
    expiresAt: new Date("2026-09-06T08:00:00.000Z"),
    now: NOW,
  });
  assert.equal(result.isExpiredAfterValidationWithoutPublication, false);
  assert.equal(result.reason, "still_awaiting_publication");
});

test("checkFlashValidatedProposalExpiration ne concerne que le statut validee", () => {
  for (const status of ["proposee", "publiee", "modifiee", "refusee", "expiree_sans_validation", "expiree_sans_publication"]) {
    const result = checkFlashValidatedProposalExpiration({
      status,
      expiresAt: new Date("2026-09-05T21:00:00.000Z"),
      now: NOW,
    });
    assert.equal(result.isExpiredAfterValidationWithoutPublication, false, status);
    assert.equal(result.reason, "not_applicable", status);
  }
});

test("des dates invalides sont refusees explicitement (version validee)", () => {
  assert.throws(
    () => checkFlashValidatedProposalExpiration({ status: "validee", expiresAt: "hier", now: NOW }),
    (error) => error instanceof FlashExpirationError && error.reason === "expires_at_invalid"
  );
  assert.throws(
    () => checkFlashValidatedProposalExpiration({ status: "validee", expiresAt: NOW, now: new Date("invalide") }),
    (error) => error instanceof FlashExpirationError && error.reason === "now_invalid"
  );
});

test("le filtre validee ne retient que les propositions reellement expirees, jamais celles jamais validees", () => {
  const proposals = [
    { id: "a", status: "validee", expiresAt: new Date("2026-09-05T21:00:00.000Z") },
    { id: "b", status: "validee", expiresAt: new Date("2026-09-06T08:00:00.000Z") },
    { id: "c", status: "proposee", expiresAt: new Date("2026-09-01T00:00:00.000Z") },
  ];
  const expired = selectExpiredValidatedFlashProposals(proposals, NOW);
  assert.deepEqual(expired.map((proposal) => proposal.id), ["a"]);
});

test("l'avis a l'auteur d'une version validee jamais publiee est factuel, sans blame ni fausse affirmation", () => {
  const notice = buildFlashValidatedExpirationAuthorNotice({
    title: "Sortie pédagogique reportée",
    expiresAt: new Date("2026-09-05T21:00:00.000Z"),
  });
  assert.equal(notice.status, "a_emettre");
  assert.match(notice.message, /personne n'a été informé/);
  assert.match(notice.message, /Sortie pédagogique reportée/);
  // A la difference de T071D, cette proposition A ete validee : le message
  // ne doit jamais pretendre le contraire.
  assert.doesNotMatch(notice.message, /sans avoir été validée/);
  assert.doesNotMatch(notice.message, /referent|référent|valideur|ddfpt/i);
});

test("l'avis a l'auteur (version validee) refuse un titre ou une date invalides", () => {
  assert.throws(
    () => buildFlashValidatedExpirationAuthorNotice({ title: "  ", expiresAt: new Date("2026-09-05T21:00:00.000Z") }),
    (error) => error instanceof FlashExpirationError && error.reason === "title_invalid"
  );
  assert.throws(
    () => buildFlashValidatedExpirationAuthorNotice({ title: "Titre valide", expiresAt: new Date("invalide") }),
    (error) => error instanceof FlashExpirationError && error.reason === "expires_at_invalid"
  );
});

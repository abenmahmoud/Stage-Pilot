import assert from "node:assert/strict";
import test from "node:test";

import {
  checkFlashProposalExpiration,
  FlashExpirationError,
  selectExpiredFlashProposals,
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

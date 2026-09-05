import assert from "node:assert/strict";
import test from "node:test";

import {
  assertLegalFlashVersionTransition,
  FlashTransitionError,
  isFlashVersionStatusTerminal,
  isLegalFlashVersionTransition,
} from "../shared/flash-transitions.ts";

test("les transitions legales sont acceptees", () => {
  assert.equal(isLegalFlashVersionTransition("proposee", "validee"), true);
  assert.equal(isLegalFlashVersionTransition("proposee", "refusee"), true);
  assert.equal(isLegalFlashVersionTransition("proposee", "expiree_sans_validation"), true);
  assert.equal(isLegalFlashVersionTransition("validee", "publiee"), true);
  assert.equal(isLegalFlashVersionTransition("publiee", "modifiee"), true);
});

test("une transition illegale est refusee", () => {
  assert.equal(isLegalFlashVersionTransition("proposee", "publiee"), false);
  assert.equal(isLegalFlashVersionTransition("publiee", "proposee"), false);
  assert.equal(isLegalFlashVersionTransition("validee", "refusee"), false);
  assert.throws(
    () => assertLegalFlashVersionTransition("proposee", "publiee"),
    (error) => error instanceof FlashTransitionError && error.reason === "transition_illegal"
  );
});

test("rester sur le meme etat n'est pas une transition", () => {
  assert.equal(isLegalFlashVersionTransition("proposee", "proposee"), false);
  assert.throws(
    () => assertLegalFlashVersionTransition("publiee", "publiee"),
    (error) => error.reason === "not_a_transition"
  );
});

test("un etat inconnu est refuse explicitement", () => {
  assert.equal(isLegalFlashVersionTransition("proposee", "en_cours"), false);
  assert.throws(
    () => assertLegalFlashVersionTransition("proposee", "en_cours"),
    (error) => error.reason === "to_status_invalid"
  );
  assert.throws(
    () => assertLegalFlashVersionTransition("en_cours", "proposee"),
    (error) => error.reason === "from_status_invalid"
  );
});

test("modifiee, refusee et expiree_sans_validation sont terminaux", () => {
  assert.equal(isFlashVersionStatusTerminal("modifiee"), true);
  assert.equal(isFlashVersionStatusTerminal("refusee"), true);
  assert.equal(isFlashVersionStatusTerminal("expiree_sans_validation"), true);
  assert.equal(isFlashVersionStatusTerminal("proposee"), false);
  assert.equal(isFlashVersionStatusTerminal("validee"), false);
  assert.equal(isFlashVersionStatusTerminal("publiee"), false);
});

test("double modification successive : la chaine complete reste legale a chaque etape", () => {
  // version 1 : proposee -> validee -> publiee -> modifiee (corrigee par version 2)
  let status = "proposee";
  status = assertLegalFlashVersionTransition(status, "validee");
  status = assertLegalFlashVersionTransition(status, "publiee");
  status = assertLegalFlashVersionTransition(status, "modifiee");
  assert.equal(status, "modifiee");
  assert.equal(isFlashVersionStatusTerminal(status), true);

  // version 2 (nouvelle ligne, previous_version_id = version 1) : meme chaine,
  // rejouee independamment, puis corrigee une seconde fois par version 3.
  let status2 = "proposee";
  status2 = assertLegalFlashVersionTransition(status2, "validee");
  status2 = assertLegalFlashVersionTransition(status2, "publiee");
  status2 = assertLegalFlashVersionTransition(status2, "modifiee");
  assert.equal(status2, "modifiee");
});

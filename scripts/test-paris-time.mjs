// LOT 6 du plan de connaissance OB1 (2026-09-05). `shared/paris-time.ts`
// est le seul point qui a le droit de convertir un instant absolu en heure
// ou en date calendaire Europe/Paris — preuve qu'il reste correct des deux
// côtés du changement d'heure (CET l'hiver, CEST l'été), jamais figé sur un
// décalage UTC fixe.
import assert from "node:assert/strict";
import test from "node:test";
import { parisHourOf, parisDateStringOf } from "../shared/paris-time.ts";

test("parisHourOf lit l'heure locale en hiver (CET, UTC+1)", () => {
  assert.equal(parisHourOf(new Date("2026-01-15T01:15:00.000Z")), 2);
});

test("parisHourOf lit l'heure locale en été (CEST, UTC+2)", () => {
  assert.equal(parisHourOf(new Date("2026-07-15T00:15:00.000Z")), 2);
});

test("parisHourOf franchit minuit heure de Paris, pas minuit UTC", () => {
  // 23:30 UTC un jour d'hiver = 00:30 le lendemain à Paris (UTC+1).
  assert.equal(parisHourOf(new Date("2026-01-15T23:30:00.000Z")), 0);
});

test("parisDateStringOf change de jour à minuit Paris, pas à minuit UTC", () => {
  assert.equal(parisDateStringOf(new Date("2026-01-15T22:30:00.000Z")), "2026-01-15");
  assert.equal(parisDateStringOf(new Date("2026-01-15T23:30:00.000Z")), "2026-01-16");
});

test("parisDateStringOf reste sur le même jour Paris malgré le décalage été (CEST, UTC+2)", () => {
  // 21:30 UTC un jour d'été = 23:30 à Paris : encore le même jour.
  assert.equal(parisDateStringOf(new Date("2026-09-05T21:30:00.000Z")), "2026-09-05");
  // 22:30 UTC le même jour = 00:30 le lendemain à Paris : jour suivant.
  assert.equal(parisDateStringOf(new Date("2026-09-05T22:30:00.000Z")), "2026-09-06");
});
